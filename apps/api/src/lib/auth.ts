// Better-Auth Configuration
import { betterAuth } from 'better-auth';

// Define the auth configuration
export const auth = betterAuth({
  database: {
    provider: 'pg',
    url: process.env.DATABASE_URL!,
  },

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
  secret: process.env.AUTH_SECRET || 'development-secret-key-change-in-production',
  baseURL: process.env.AUTH_URL || 'http://localhost:3000',

  // Advanced options
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'v2bucket',
  },
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
