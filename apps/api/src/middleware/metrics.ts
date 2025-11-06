// Metrics Middleware
import { Context, Next } from 'hono';
import { metricsCollector } from '../lib/metrics.js';

/**
 * Metrics collection middleware
 * Records request metrics for monitoring
 */
export async function metricsMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    const status = c.res.status;

    // Record metrics
    metricsCollector.recordRequest(method, path, status, duration);

    // Record errors (4xx and 5xx)
    if (status >= 400) {
      const errorType = status >= 500 ? 'server_error' : 'client_error';
      metricsCollector.recordError(errorType);
    }
  }
}
