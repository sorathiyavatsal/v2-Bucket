// tRPC Initialization and Procedures
import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context.js';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

// Initialize tRPC
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Base router and procedure
export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to check if user is authenticated
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    logger.warn('Unauthorized access attempt');
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type-safe user
    },
  });
});

// Middleware to check if user is admin
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  if (!ctx.user.isAdmin) {
    logger.warn({ userId: ctx.user.id }, 'Forbidden access attempt by non-admin');
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure.use(isAuthenticated);

// Admin procedure (requires admin role)
export const adminProcedure = t.procedure.use(isAdmin);

// Logging middleware for all procedures
export const loggedProcedure = t.procedure.use(async ({ ctx, path, type, next }) => {
  const start = Date.now();

  logger.debug({
    path,
    type,
    userId: ctx.user?.id,
  }, 'tRPC call started');

  const result = await next();

  const duration = Date.now() - start;

  logger.debug({
    path,
    type,
    userId: ctx.user?.id,
    duration,
    success: result.ok,
  }, 'tRPC call completed');

  return result;
});
