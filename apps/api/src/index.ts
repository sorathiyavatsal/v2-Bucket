import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './lib/errors.js';
import { initializeDatabase, disconnectDatabase, getDatabaseHealth } from './lib/db.js';
import { initializeRedis, disconnectRedis, getRedisHealth } from './lib/redis.js';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { securityHeaders, requestId, trustedProxy } from './middleware/security.js';
import { apiRateLimiter } from './middleware/rate-limit.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { metricsCollector } from './lib/metrics.js';
import { timeout } from './middleware/timeout.js';
import { validateEnv } from './lib/env.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root (3 levels up: src -> api -> apps -> v2-bucket)
dotenv.config({ path: resolve(__dirname, '../../../.env') });

// Validate environment variables on startup
validateEnv();

const app = new Hono();

// Request timeout (30 seconds)
app.use('/*', timeout(30000));

// Metrics collection (first middleware to capture all requests)
app.use('/*', metricsMiddleware);

// Security headers
app.use('/*', securityHeaders);

// Request ID
app.use('/*', requestId);

// Trusted proxy handling
app.use('/*', trustedProxy);

// CORS middleware
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// Hono request logger
app.use('/*', honoLogger());

// Health check endpoint with database and Redis status (no rate limiting)
app.get('/health', async (c) => {
  const [dbHealth, redisHealth] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
  ]);

  const isHealthy = dbHealth.connected && redisHealth.connected;

  return c.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    services: {
      database: {
        status: dbHealth.connected ? 'up' : 'down',
        responseTime: dbHealth.responseTime,
        error: dbHealth.error,
      },
      redis: {
        status: redisHealth.connected ? 'up' : 'down',
        responseTime: redisHealth.responseTime,
        error: redisHealth.error,
      },
    },
  }, isHealthy ? 200 : 503);
});

// Liveness probe - checks if application is running
// Used by Kubernetes to determine if container should be restarted
app.get('/health/live', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, 200);
});

// Readiness probe - checks if application can handle requests
// Used by Kubernetes to determine if traffic should be routed to this instance
app.get('/health/ready', async (c) => {
  const [dbHealth, redisHealth] = await Promise.all([
    getDatabaseHealth(),
    getRedisHealth(),
  ]);

  // Application is ready if database is available
  // Redis is optional - graceful degradation
  const isReady = dbHealth.connected;

  if (!isReady) {
    return c.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      reason: 'Database not connected',
      services: {
        database: { status: 'down', error: dbHealth.error },
        redis: { status: redisHealth.connected ? 'up' : 'down' },
      },
    }, 503);
  }

  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'up', responseTime: dbHealth.responseTime },
      redis: { status: redisHealth.connected ? 'up' : 'down' },
    },
  }, 200);
});

// Prometheus metrics endpoint
app.get('/metrics', (c) => {
  const metrics = metricsCollector.getPrometheusMetrics();
  return c.text(metrics, 200, {
    'Content-Type': 'text/plain; version=0.0.4',
  });
});

// Metrics as JSON (for debugging)
app.get('/metrics/json', (c) => {
  return c.json(metricsCollector.getMetrics());
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'V2-Bucket Platform API',
    version: '1.0.0',
    docs: '/docs',
  });
});

// Test error endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/test-error', (_c) => {
    throw new Error('This is a test error');
  });
}

// Better-Auth routes (handles all auth endpoints: /api/auth/*)
app.use('/api/auth/*', async (c) => {
  const { authHandler } = await import('./lib/auth.js');
  return authHandler(c.req.raw);
});

// S3 API routes (AWS SDK/CLI compatible)
// Import dynamically to avoid circular dependencies
import s3BucketRoutes from './routes/s3-bucket.js';
import s3ObjectRoutes from './routes/s3-object.js';
import s3MultipartRoutes from './routes/s3-multipart.js';
app.route('/s3', s3BucketRoutes);
app.route('/s3', s3ObjectRoutes);
app.route('/s3', s3MultipartRoutes);

// tRPC handler with rate limiting
app.use('/trpc/*', apiRateLimiter);
app.use('/trpc/*', async (c) => {
  return fetchRequestHandler({
    req: c.req.raw,
    router: appRouter,
    endpoint: '/trpc',
    createContext: () => createContext({ c }),
  });
});

// 404 handler
app.notFound((c) => {
  const err = new NotFoundError('The requested resource does not exist');
  return c.json({
    error: err.name,
    code: err.code,
    message: err.message,
  }, 404);
});

// Error handler
app.onError(errorHandler);

const port = parseInt(process.env.PORT || '3000');

// Initialize connections and start server
async function startServer() {
  try {
    logger.info('Initializing services...');

    // Initialize database
    try {
      await initializeDatabase();
    } catch (error) {
      logger.warn('Database initialization failed, server will start anyway');
    }

    // Initialize Redis
    try {
      await initializeRedis();
    } catch (error) {
      logger.warn('Redis initialization failed, server will start anyway');
    }

    // Start server
    const server = serve({
      fetch: app.fetch,
      port,
    }, (info) => {
      logger.info(`🚀 Server running on http://localhost:${info.port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      server.close(() => {
        logger.info('HTTP server closed');
      });

      await disconnectDatabase();
      await disconnectRedis();

      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
