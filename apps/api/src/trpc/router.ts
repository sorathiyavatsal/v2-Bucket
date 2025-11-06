// Main tRPC Router
import { router } from './init.js';
import { testRouter } from './routers/test.js';
import { authRouter } from './routers/auth.js';
import { accessKeyRouter } from './routers/access-key.js';
import { bucketRouter } from './routers/bucket.js';

/**
 * Main application router
 * Combines all feature routers
 */
export const appRouter = router({
  test: testRouter,
  auth: authRouter,
  accessKey: accessKeyRouter,
  bucket: bucketRouter,
  // Future routers will be added here:
  // user: userRouter,
  // object: objectRouter,
  // domain: domainRouter,
  // webhook: webhookRouter,
});

/**
 * Export type for frontend tRPC client
 */
export type AppRouter = typeof appRouter;
