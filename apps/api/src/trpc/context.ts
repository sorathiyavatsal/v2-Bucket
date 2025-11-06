// tRPC Context
import { Context as HonoContext } from 'hono';
import { prisma } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  isActive: boolean;
  storageQuota: bigint;
  usedStorage: bigint;
  maxBuckets: number;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Create tRPC context from Hono context
 */
export async function createContext({ c }: { c: HonoContext }) {
  // Get user from context (will be set by auth middleware)
  const user = c.get('user') as User | undefined;
  const session = c.get('session') as Session | undefined;

  // Extract client info
  const clientIp = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || 'unknown';

  const userAgent = c.req.header('user-agent') || 'unknown';

  // Try to get session from token if not already set
  let contextUser = user;
  let contextSession = session;

  if (!contextUser) {
    // Try to get session from Bearer token
    const authHeader = c.req.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const sessionData = await prisma.session.findUnique({
          where: { token },
          include: { user: true },
        });

        if (sessionData && sessionData.expiresAt > new Date()) {
          contextSession = sessionData;
          contextUser = sessionData.user;
        }
      } catch (error) {
        // Session lookup failed, continue without auth
        logger.debug({ error }, 'Session lookup failed');
      }
    }
  }

  return {
    prisma,
    redis,
    logger,
    user: contextUser,
    session: contextSession,
    clientIp,
    userAgent,
    req: c.req,
    res: c.res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
