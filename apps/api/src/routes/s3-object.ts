// S3 Object API Routes
import { Hono } from 'hono';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { s3AuthMiddleware } from '../middleware/s3-auth.js';
import { buildErrorXml, buildCopyObjectXml, S3ErrorCodes } from '../lib/s3-xml.js';
import {
  calculateMD5,
  generateETag,
  generateObjectPath,
  saveFile,
  deleteFile,
  fileExists,
  getFileSize,
  getFileStats,
  isValidObjectKey,
  getContentTypeFromExtension,
  generateVersionId,
} from '../lib/object-storage.js';
import { Readable } from 'stream';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';

const app = new Hono();

/**
 * Helper: Write request body to temporary file
 */
async function writeBodyToTemp(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) {
    throw new Error('No request body');
  }

  const tempPath = join(tmpdir(), `s3-upload-${randomBytes(16).toString('hex')}`);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    await writeFile(tempPath, buffer);
    return tempPath;
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Check if object exists (HEAD) - HEAD /:bucket/:key
 */
app.on('HEAD', '/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    if (!key) {
      return c.text('', 400);
    }

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket || bucket.userId !== user.id) {
      return c.text('', 404);
    }

    const object = await prisma.object.findUnique({
      where: {
        bucketId_key: {
          bucketId: bucket.id,
          key,
        },
      },
    });

    if (!object || object.isDeleted) {
      return c.text('', 404);
    }

    // Check if file exists on disk
    const objectPath = generateObjectPath(bucket.volumePath, key);
    const exists = await fileExists(objectPath);

    if (!exists) {
      return c.text('', 404);
    }

    return c.text('', 200, {
      'Content-Type': object.contentType,
      'Content-Length': object.size.toString(),
      'ETag': object.etag,
      'Last-Modified': object.updatedAt.toUTCString(),
      'x-amz-storage-class': object.storageClass,
      'x-amz-version-id': object.versionId || undefined,
    });
  } catch (error) {
    logger.error({ error }, 'Head object error');
    return c.text('', 500);
  }
});

/**
 * Get object (download) - GET /:bucket/:key
 */
app.get('/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    if (!key) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        'Missing object key'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchBucket,
        'The specified bucket does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (bucket.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    const object = await prisma.object.findUnique({
      where: {
        bucketId_key: {
          bucketId: bucket.id,
          key,
        },
      },
    });

    if (!object || object.isDeleted) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchKey,
        'The specified key does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    // Get object path and check if file exists
    const objectPath = generateObjectPath(bucket.volumePath, key);
    const exists = await fileExists(objectPath);

    if (!exists) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchKey,
        'The specified key does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    // Stream file to response
    const stream = createReadStream(objectPath);

    return c.body(stream as any, 200, {
      'Content-Type': object.contentType,
      'Content-Length': object.size.toString(),
      'ETag': object.etag,
      'Last-Modified': object.updatedAt.toUTCString(),
      'x-amz-storage-class': object.storageClass,
      'x-amz-version-id': object.versionId || undefined,
      // Include custom metadata as x-amz-meta- headers
      ...Object.fromEntries(
        Object.entries(object.metadata as Record<string, string> || {}).map(
          ([k, v]) => [`x-amz-meta-${k}`, v]
        )
      ),
    });
  } catch (error) {
    logger.error({ error }, 'Get object error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
});

/**
 * Upload object (PUT) or Copy object - PUT /:bucket/:key
 */
app.put('/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    if (!key) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        'Missing object key'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    // Validate object key
    const keyValidation = isValidObjectKey(key);
    if (!keyValidation.valid) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        keyValidation.error || 'Invalid object key'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchBucket,
        'The specified bucket does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (bucket.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    // Check for copy operation
    const copySource = c.req.header('x-amz-copy-source');
    if (copySource) {
      // Copy object operation
      const [sourceBucketName, ...sourceKeyParts] = copySource.startsWith('/')
        ? copySource.substring(1).split('/')
        : copySource.split('/');
      const sourceKey = sourceKeyParts.join('/');

      const sourceBucket = await prisma.bucket.findUnique({
        where: { name: sourceBucketName },
      });

      if (!sourceBucket || sourceBucket.userId !== user.id) {
        const xml = buildErrorXml(
          S3ErrorCodes.NoSuchBucket,
          'The specified source bucket does not exist'
        );
        return c.text(xml, 404, {
          'Content-Type': 'application/xml',
        });
      }

      const sourceObject = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: sourceBucket.id,
            key: sourceKey,
          },
        },
      });

      if (!sourceObject || sourceObject.isDeleted) {
        const xml = buildErrorXml(
          S3ErrorCodes.NoSuchKey,
          'The specified source key does not exist'
        );
        return c.text(xml, 404, {
          'Content-Type': 'application/xml',
        });
      }

      // Copy file on disk
      const sourceObjectPath = generateObjectPath(sourceBucket.volumePath, sourceKey);
      const destObjectPath = generateObjectPath(bucket.volumePath, key);

      await saveFile(sourceObjectPath, destObjectPath);

      // Check if object already exists
      const existingObject = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key,
          },
        },
      });

      let versionId: string | null = null;
      if (bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      const now = new Date();

      // Create or update object in database
      await prisma.object.upsert({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key,
          },
        },
        create: {
          bucketId: bucket.id,
          key,
          size: sourceObject.size,
          contentType: sourceObject.contentType,
          etag: sourceObject.etag,
          md5Hash: sourceObject.md5Hash,
          storageClass: sourceObject.storageClass,
          metadata: sourceObject.metadata,
          versionId,
          updatedAt: now,
        },
        update: {
          size: sourceObject.size,
          contentType: sourceObject.contentType,
          etag: sourceObject.etag,
          md5Hash: sourceObject.md5Hash,
          storageClass: sourceObject.storageClass,
          metadata: sourceObject.metadata,
          versionId,
          updatedAt: now,
        },
      });

      const xml = buildCopyObjectXml({
        etag: sourceObject.etag,
        lastModified: now,
      });

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // Regular PUT (upload) operation
    const contentType = c.req.header('content-type') || getContentTypeFromExtension(key);
    const contentLength = c.req.header('content-length');

    if (!contentLength) {
      const xml = buildErrorXml(
        S3ErrorCodes.MissingContentLength,
        'You must provide the Content-Length HTTP header'
      );
      return c.text(xml, 411, {
        'Content-Type': 'application/xml',
      });
    }

    const size = parseInt(contentLength, 10);

    // Check storage quota
    const totalUsed = user.usedStorage + BigInt(size);
    if (totalUsed > user.storageQuota) {
      const xml = buildErrorXml(
        'QuotaExceeded',
        `Storage quota exceeded. Used: ${totalUsed}, Quota: ${user.storageQuota}`
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    // Write request body to temporary file
    const tempPath = await writeBodyToTemp(c.req.raw.body);

    try {
      // Calculate MD5 and ETag
      const md5Hash = await calculateMD5(tempPath);
      const etag = generateETag(md5Hash);

      // Verify ETag if provided
      const clientETag = c.req.header('content-md5');
      if (clientETag && clientETag !== Buffer.from(md5Hash, 'hex').toString('base64')) {
        const xml = buildErrorXml(
          'BadDigest',
          'The Content-MD5 you specified did not match what we received'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      // Save file to destination
      const destPath = generateObjectPath(bucket.volumePath, key);
      await saveFile(tempPath, destPath);

      // Parse custom metadata from x-amz-meta- headers
      const metadata: Record<string, string> = {};
      for (const [headerName, headerValue] of Object.entries(c.req.header())) {
        if (headerName.startsWith('x-amz-meta-')) {
          const metaKey = headerName.substring(11); // Remove 'x-amz-meta-'
          metadata[metaKey] = headerValue as string;
        }
      }

      // Check if object already exists
      const existingObject = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key,
          },
        },
      });

      let versionId: string | null = null;
      let isNewObject = !existingObject;

      if (bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      // Create or update object in database
      const object = await prisma.object.upsert({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key,
          },
        },
        create: {
          bucketId: bucket.id,
          key,
          size: BigInt(size),
          contentType,
          etag,
          md5Hash,
          storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
          metadata,
          versionId,
        },
        update: {
          size: BigInt(size),
          contentType,
          etag,
          md5Hash,
          storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
          metadata,
          versionId,
          updatedAt: new Date(),
        },
      });

      // Update bucket statistics
      await prisma.bucket.update({
        where: { id: bucket.id },
        data: {
          objectCount: isNewObject ? { increment: 1 } : undefined,
          totalSize: isNewObject
            ? { increment: BigInt(size) }
            : { increment: BigInt(size) - (existingObject?.size || BigInt(0)) },
          updatedAt: new Date(),
        },
      });

      // Update user storage
      await prisma.user.update({
        where: { id: user.id },
        data: {
          usedStorage: isNewObject
            ? { increment: BigInt(size) }
            : { increment: BigInt(size) - (existingObject?.size || BigInt(0)) },
        },
      });

      logger.info({ userId: user.id, bucketName, key }, 'Object uploaded via S3 API');

      return c.text('', 200, {
        'ETag': etag,
        'x-amz-version-id': versionId || undefined,
      });
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    logger.error({ error }, 'Put object error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
});

/**
 * Delete object - DELETE /:bucket/:key
 */
app.delete('/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    if (!key) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        'Missing object key'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchBucket,
        'The specified bucket does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (bucket.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    const object = await prisma.object.findUnique({
      where: {
        bucketId_key: {
          bucketId: bucket.id,
          key,
        },
      },
    });

    if (!object) {
      // S3 returns 204 even if object doesn't exist
      return c.text('', 204);
    }

    // Delete file from disk
    const objectPath = generateObjectPath(bucket.volumePath, key);
    await deleteFile(objectPath);

    // Delete from database
    await prisma.object.delete({
      where: {
        bucketId_key: {
          bucketId: bucket.id,
          key,
        },
      },
    });

    // Update bucket statistics
    await prisma.bucket.update({
      where: { id: bucket.id },
      data: {
        objectCount: { decrement: 1 },
        totalSize: { decrement: object.size },
        updatedAt: new Date(),
      },
    });

    // Update user storage
    await prisma.user.update({
      where: { id: user.id },
      data: {
        usedStorage: { decrement: object.size },
      },
    });

    logger.info({ userId: user.id, bucketName, key }, 'Object deleted via S3 API');

    return c.text('', 204);
  } catch (error) {
    logger.error({ error }, 'Delete object error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
});

export default app;
