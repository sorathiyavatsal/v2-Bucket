// Better-Auth Configuration
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { logger } from './logger.js';

// Define the auth configuration
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true when email service is ready
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // Security
  secret: process.env.AUTH_SECRET || process.env.BETTER_AUTH_SECRET || 'development-secret-key-change-in-production',
  baseURL: process.env.AUTH_URL || process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/auth', // Use /auth as base path (Tailscale strips /api prefix)
  trustedOrigins: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],

  // Advanced options
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'v2bucket',
  },

  // TODO: Re-implement first user as admin logic
  // The hooks API in Better Auth v1.3.34 appears to have compatibility issues
  // We'll implement this in the tRPC signup endpoint instead
});

// Export auth handler for use in routes
export const authHandler = auth.handler;

// Helper to get session from Hono context
export async function getSession(c: any) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.header(),
    });
    return session;
  } catch (error) {
    return null;
  }
}

// Helper to require authenticated user
export async function requireAuth(c: any) {
  const session = await getSession(c);
  if (!session || !session.user) {
    throw new Error('Unauthorized');
  }
  return session;
}
