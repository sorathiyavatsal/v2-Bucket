import { Context } from 'hono';
import { AppError, isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { ZodError } from 'zod';

export async function errorHandler(err: Error, c: Context) {
  // Log the error
  logger.error({
    err,
    path: c.req.path,
    method: c.req.method,
  }, 'Error occurred');

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: 'Validation Error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    }, 422);
  }

  // Handle custom AppError instances
  if (isAppError(err)) {
    return c.json({
      error: err.name,
      code: err.code,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && err.details ? { details: err.details } : {}),
    }, err.statusCode);
  }

  // Handle unknown errors
  const isDevelopment = process.env.NODE_ENV === 'development';

  return c.json({
    error: 'Internal Server Error',
    code: 'INTERNAL_SERVER_ERROR',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    ...(isDevelopment ? { stack: err.stack } : {}),
  }, 500);
}
