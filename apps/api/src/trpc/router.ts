// Main tRPC Router
import { router } from './init.js';
import { testRouter } from './routers/test.js';

/**
 * Main application router
 * Combines all feature routers
 */
export const appRouter = router({
  test: testRouter,
  // Future routers will be added here:
  // auth: authRouter,
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
