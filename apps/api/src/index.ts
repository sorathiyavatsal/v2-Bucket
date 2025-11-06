import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './lib/errors.js';
import 'dotenv/config';

const app = new Hono();

// CORS middleware
app.use('/*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
}));

// Hono request logger
app.use('/*', honoLogger());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
  });
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

// Start server
const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info(`🚀 Server running on http://localhost:${info.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
