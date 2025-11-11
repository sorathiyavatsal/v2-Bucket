// IMPORTANT: Load environment variables FIRST before any other imports
// This ensures DATABASE_URL is available when Prisma client is instantiated
import './lib/load-env.js';

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

// Validate environment variables on startup
validateEnv();

const app = new Hono();

// Request timeout (30 seconds)
app.use('/*', timeout(30000));

// Metrics collection (first middleware to capture all requests)
app.use('/*', metricsMiddleware);

// Security headers
app.use('/*', securityHeaders);
app.use('/*', requestId);
app.use('/*', trustedProxy);

// Logger middleware
app.use('/*', honoLogger());

// CORS configuration
// Note: For S3 API compatibility, we need to allow all headers including AWS-specific ones
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'content-md5',
    'cache-control',
    'x-requested-with',
    // AWS S3 specific headers (comprehensive list for AWS SDK compatibility)
    'x-amz-content-sha256',
    'x-amz-date',
    'x-amz-security-token',
    'x-amz-user-agent',
    'x-amz-acl',
    'x-amz-copy-source',
    'x-amz-metadata-directive',
    'x-amz-server-side-encryption',
    'x-amz-storage-class',
    'x-amz-tagging',
    'x-amz-website-redirect-location',
    'x-amz-server-side-encryption-customer-algorithm',
    'x-amz-server-side-encryption-customer-key',
    'x-amz-server-side-encryption-customer-key-md5',
    'x-amz-request-payer',
    'x-amz-expected-bucket-owner',
    // AWS SDK specific headers
    'x-amz-sdk-invocation-id',
    'x-amz-sdk-request',
    'amz-sdk-invocation-id',
    'amz-sdk-request',
    'x-amz-sdk-checksum-algorithm',
    'x-amz-checksum-algorithm',
    'x-amz-checksum-crc32',
    'x-amz-checksum-crc32c',
    'x-amz-checksum-sha1',
    'x-amz-checksum-sha256',
    // Custom metadata headers (note: individual headers must be listed)
    // Common x-amz-meta- headers
    'x-amz-meta-name',
    'x-amz-meta-author',
    'x-amz-meta-department',
    'x-amz-meta-project',
    'x-amz-meta-description',
    'x-amz-meta-category',
    'x-amz-meta-tags',
    'x-amz-meta-custom',
  ],
  exposeHeaders: [
    'X-Request-ID',
    'ETag',
    'content-length',
    'content-type',
    'last-modified',
    'accept-ranges',
    // AWS S3 specific headers
    'x-amz-version-id',
    'x-amz-delete-marker',
    'x-amz-request-id',
    'x-amz-id-2',
    'x-amz-storage-class',
    'x-amz-server-side-encryption',
    'x-amz-bucket-region',
    // Custom metadata headers
    'x-amz-meta-name',
    'x-amz-meta-author',
    'x-amz-meta-department',
    'x-amz-meta-project',
    'x-amz-meta-description',
    'x-amz-meta-category',
    'x-amz-meta-tags',
    'x-amz-meta-custom',
  ],
  maxAge: 86400,
}));

// Rate limiting (after CORS, before routes)
// TODO: Fix rate limiter Redis integration
// app.use('/api/*', apiRateLimiter);

// Health check endpoint (no auth required)
app.get('/health', async (c) => {
  const dbHealth = await getDatabaseHealth();
  const redisHealth = await getRedisHealth();

  const isHealthy = dbHealth.connected && redisHealth.connected;

  return c.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
    version: process.env.npm_package_version || '1.0.0',
  }, isHealthy ? 200 : 503);
});

// Metrics endpoint
app.get('/metrics', (c) => {
  const metrics = metricsCollector.getMetrics();
  return c.text(metrics, 200, {
    'Content-Type': 'text/plain; version=0.0.4',
  });
});

app.get('/metrics/json', (c) => {
  const metrics = metricsCollector.getJSONMetrics();
  return c.json(metrics);
});

// Better-Auth routes
// Note: Better Auth returns a native Response object
app.all('/api/auth/*', async (c) => {
  const { auth } = await import('./lib/auth.js');
  const response = await auth.handler(c.req.raw);
  return response;
});

// Better-Auth routes (alias without /api prefix for Tailscale Serve path stripping)
app.all('/auth/*', async (c) => {
  const { auth } = await import('./lib/auth.js');
  const response = await auth.handler(c.req.raw);
  return response;
});

// tRPC endpoint
app.use('/api/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext({ c }),
  });
});

// tRPC endpoint (alias without /api prefix for Tailscale Serve path stripping)
app.use('/trpc/*', async (c) => {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext({ c }),
  });
});

// S3-compatible API routes
// CRITICAL: Import route handlers directly and register them on the main app
// Using app.route() breaks wildcard parameter extraction
import { registerS3BucketRoutes } from './routes/s3-bucket.js';
import { registerS3ObjectRoutes } from './routes/s3-object.js';
import { registerS3MultipartRoutes } from './routes/s3-multipart.js';

// Register all S3 routes directly on the main app (not via sub-routers)
registerS3MultipartRoutes(app);
registerS3BucketRoutes(app);
registerS3ObjectRoutes(app);

console.log('🔧 Registered S3 routes directly on main app');

// Catch-all 404 - IMPORTANT: This must come AFTER all route registrations
// or it will intercept requests meant for other routes!
// Temporarily commented out to allow S3 routes to work
// app.all('/*', (c) => {
//   throw new NotFoundError(`Route ${c.req.path} not found`);
// });

// Error handler (must be last)
app.onError(errorHandler);

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize database
    logger.info('Initializing database...');
    await initializeDatabase();

    // Initialize Redis
    logger.info('Initializing Redis...');
    await initializeRedis();

    // Start HTTP server
    const port = Number(process.env.PORT) || 3000;
    const server = serve({
      fetch: app.fetch,
      port,
    });

    logger.info({
      port,
      nodeEnv: process.env.NODE_ENV,
      corsOrigin: process.env.CORS_ORIGIN,
    }, `🚀 Server started on http://localhost:${port}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');

      try {
        // Disconnect from database
        await disconnectDatabase();

        // Disconnect from Redis
        await disconnectRedis();

        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();

