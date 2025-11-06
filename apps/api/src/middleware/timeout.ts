// Request Timeout Middleware
import { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

/**
 * Request timeout middleware
 * Aborts requests that take longer than the specified timeout
 */
export function timeout(timeoutMs: number = 30000) {
  return async (c: Context, next: Next) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const requestId = c.get('requestId') || 'unknown';

    try {
      await next();
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn({
          requestId,
          path: c.req.path,
          method: c.req.method,
          timeout: timeoutMs,
        }, 'Request timeout');

        return c.json({
          error: 'Request Timeout',
          message: `Request exceeded ${timeoutMs}ms timeout`,
          requestId,
        }, 408);
      }

      throw error;
    }
  };
}
