// Main tRPC Router
import { router } from './init.js';
import { testRouter } from './routers/test.js';
import { authRouter } from './routers/auth.js';
import { accessKeyRouter } from './routers/access-key.js';
import { bucketRouter } from './routers/bucket.js';
import { objectRouter } from './routers/object.js';
import { multipartRouter } from './routers/multipart.js';

/**
 * Main application router
 * Combines all feature routers
 */
export const appRouter = router({
  test: testRouter,
  auth: authRouter,
  accessKey: accessKeyRouter,
  bucket: bucketRouter,
  object: objectRouter,
  multipart: multipartRouter,
  // Future routers will be added here:
  // user: userRouter,
  // domain: domainRouter,
  // webhook: webhookRouter,
});

/**
 * Export type for frontend tRPC client
 */
export type AppRouter = typeof appRouter;
