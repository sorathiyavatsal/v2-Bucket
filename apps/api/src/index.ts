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
import 'dotenv/config';

const app = new Hono();

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

// Rate limiting (applied to all routes)
app.use('/*', apiRateLimiter);

// Health check endpoint with database and Redis status
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
  app.get('/test-error', (c) => {
    throw new Error('This is a test error');
  });
}

// tRPC handler
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
