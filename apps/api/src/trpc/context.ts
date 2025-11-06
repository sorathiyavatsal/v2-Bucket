// tRPC Context
import { Context } from 'hono';
import { prisma } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export interface User {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

/**
 * Create tRPC context from Hono context
 */
export async function createContext({ c }: { c: Context }) {
  // Get user from context (will be set by auth middleware)
  const user = c.get('user') as User | undefined;

  return {
    prisma,
    redis,
    logger,
    user,
    req: c.req,
    res: c.res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
