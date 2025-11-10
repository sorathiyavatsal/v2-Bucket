// S3-Compatible API Routes
import { Hono } from 'hono';
import s3BucketRoutes from './s3-bucket.js';
import s3ObjectRoutes from './s3-object.js';
import s3MultipartRoutes from './s3-multipart.js';

// Create plain Hono router WITHOUT basePath
// The /api/s3 prefix will be added when mounting in index.ts
const app = new Hono();

console.log('🔧 s3.ts: Creating S3 router with basePath /api/s3');

// Note: CORS is handled globally in index.ts
// No need for S3-specific CORS middleware to avoid conflicts

// Mount S3 route modules directly
// IMPORTANT: Order matters! More specific routes should come before catch-all routes
// When using app.route(), Hono combines the routes but does NOT strip path prefixes
// So we need to register them directly without nesting
console.log('🔧 s3.ts: Mounting multipart routes');
app.route('/', s3MultipartRoutes);
console.log('🔧 s3.ts: Mounting bucket routes');
app.route('/', s3BucketRoutes);
console.log('🔧 s3.ts: Mounting object routes');
app.route('/', s3ObjectRoutes);

// Debug catch-all route to see what's not matching (for development only)
// TODO: Remove in production
app.all('*', (c) => {
  console.log('🔴 S3 CATCH-ALL: Route not found', {
    method: c.req.method,
    path: c.req.path,
  });
  const xml = '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist</Message></Error>';
  return c.text(xml, 404, {
    'Content-Type': 'application/xml',
  });
});

export default app;
