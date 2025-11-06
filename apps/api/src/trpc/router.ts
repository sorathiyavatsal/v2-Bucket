// Main tRPC Router
import { router } from './init.js';
import { testRouter } from './routers/test.js';
import { authRouter } from './routers/auth.js';

/**
 * Main application router
 * Combines all feature routers
 */
export const appRouter = router({
  test: testRouter,
  auth: authRouter,
  // Future routers will be added here:
  // user: userRouter,
  // bucket: bucketRouter,
  // object: objectRouter,
  // accessKey: accessKeyRouter,
  // domain: domainRouter,
  // webhook: webhookRouter,
});

/**
 * Export type for frontend tRPC client
 */
export type AppRouter = typeof appRouter;
