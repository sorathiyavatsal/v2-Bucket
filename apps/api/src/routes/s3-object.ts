// S3 Object API Routes
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono.js';
import { createReadStream } from 'fs';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { s3AuthMiddleware } from '../middleware/s3-auth.js';
import { buildErrorXml, buildCopyObjectXml, buildListObjectsXml, S3ErrorCodes } from '../lib/s3-xml.js';
import {
  calculateMD5,
  generateETag,
  generateObjectPath,
  saveFile,
  deleteFile,
  fileExists,
  isValidObjectKey,
  getContentTypeFromExtension,
  generateVersionId,
} from '../lib/object-storage.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';

/**
 * Register S3 object routes directly on the main app
 */
export function registerS3ObjectRoutes(app: Hono<AppEnv>) {

/**
 * Helper: Write request body to temporary file
 */
async function writeBodyToTemp(body: ArrayBuffer | null): Promise<string> {
  if (!body) {
    throw new Error('No request body');
  }

  const tempPath = join(tmpdir(), `s3-upload-${randomBytes(16).toString('hex')}`);

  try {
    const buffer = Buffer.from(body);
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
 * Helper: Stream request body to temporary file (for large files)
 */
async function streamBodyToTemp(request: Request): Promise<string> {
  if (!request.body) {
    throw new Error('No request body');
  }

  const tempPath = join(tmpdir(), `s3-upload-${randomBytes(16).toString('hex')}`);

  try {
    const { createWriteStream } = await import('fs');
    const writeStream = createWriteStream(tempPath);

    const reader = request.body.getReader();

    return new Promise((resolve, reject) => {
      writeStream.on('error', (error) => {
        reader.cancel();
        reject(error);
      });

      writeStream.on('finish', () => {
        resolve(tempPath);
      });

      async function pump() {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              writeStream.end();
              break;
            }

            if (!writeStream.write(value)) {
              // Wait for drain event before continuing
              await new Promise((resolve) => writeStream.once('drain', resolve));
            }
          }
        } catch (error) {
          writeStream.destroy();
          reject(error);
        }
      }

      pump();
    });
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
 * Check if object exists (HEAD) - HEAD /api/s3/:bucket/:key
 */
app.on('HEAD', '/api/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/api/s3/${bucketName}/`, '');
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

    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
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
      ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
    });
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Head object error');
    return c.text('', 500);
  }
});

/**
 * Get object (download) - GET /api/s3/:bucket/:key
 * Note: Due to Hono's routing, this wildcard route will also match /api/s3/:bucket/ (with empty key).
 * When the key is empty, we need to check if it's a list objects request based on query params.
 */
app.get('/api/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  console.log('📍 OBJECT ROUTE HIT: /api/s3/:bucket/*');
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const pathAfterBucket = fullPath.replace(`/api/s3/${bucketName}/`, '');
    const key = pathAfterBucket || c.req.param('*');
    const user = c.get('user');

    console.log('📍 Object route params:', { bucketName, key, path: c.req.path, pathAfterBucket });
    logger.debug({ bucketName, key, path: c.req.path, url: c.req.url }, 'S3 Object GET route handler');

    // If no key or empty key, handle as bucket listing request
    // This happens because /:bucket/* matches /bucket/ with empty wildcard
    if (!key || key.trim() === '') {
      // Get bucket for listing
      const bucket = await prisma.bucket.findUnique({
        where: { name: bucketName },
      });

      if (!bucket) {
        const xml = buildErrorXml(
          S3ErrorCodes.NoSuchBucket,
          'The specified bucket does not exist',
          `/${bucketName}`
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

      // Handle bucket listing (ListObjectsV2)
      const url = new URL(c.req.url);
      const prefix = url.searchParams.get('prefix') || '';
      const delimiter = url.searchParams.get('delimiter') || undefined;
      const maxKeysParam = url.searchParams.get('max-keys');
      const maxKeys = maxKeysParam ? Math.min(parseInt(maxKeysParam, 10), 1000) : 1000;
      const marker = url.searchParams.get('marker') || undefined;
      const startAfter = url.searchParams.get('start-after') || undefined;

      // Build where clause for listing
      const where: any = {
        bucketId: bucket.id,
        isDeleted: false,
      };

      if (prefix) {
        where.key = { startsWith: prefix };
      }

      if (startAfter || marker) {
        where.key = { ...where.key, gt: startAfter || marker };
      }

      // Fetch objects
      const objects = await prisma.object.findMany({
        where,
        orderBy: { key: 'asc' },
        take: maxKeys + 1,
      });

      const isTruncated = objects.length > maxKeys;
      const contents = objects.slice(0, maxKeys);

      // If delimiter is specified, group by common prefixes
      const commonPrefixes: string[] = [];
      if (delimiter) {
        const prefixSet = new Set<string>();
        contents.forEach((obj) => {
          const keyAfterPrefix = obj.key.substring(prefix.length);
          const delimiterIndex = keyAfterPrefix.indexOf(delimiter);
          if (delimiterIndex > 0) {
            const commonPrefix = prefix + keyAfterPrefix.substring(0, delimiterIndex + 1);
            prefixSet.add(commonPrefix);
          }
        });
        commonPrefixes.push(...Array.from(prefixSet).sort());
      }

      const xml = buildListObjectsXml({
        bucketName: bucket.name,
        prefix: prefix || undefined,
        marker: marker || startAfter,
        maxKeys,
        delimiter,
        isTruncated,
        nextMarker: isTruncated ? contents[contents.length - 1]?.key : undefined,
        contents: contents.map(obj => ({
          key: obj.key,
          lastModified: obj.updatedAt,
          etag: obj.etag,
          size: obj.size,
          storageClass: obj.storageClass,
        })),
        commonPrefixes,
      });

      return c.text(xml, 200, {
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

    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
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
      ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
      // Include custom metadata as x-amz-meta- headers
      ...Object.fromEntries(
        Object.entries(object.metadata as Record<string, string> || {}).map(
          ([k, v]) => [`x-amz-meta-${k}`, v]
        )
      ),
    });
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Get object error');
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
 * Upload object (PUT) or Copy object - PUT /api/s3/:bucket/:key
 */
app.put('/api/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/api/s3/${bucketName}/`, '');
    const user = c.get('user');

    console.log('📍 OBJECT PUT ROUTE HIT:', { bucket: bucketName, key, path: fullPath });

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

      // Find the source object (use findFirst instead of findUnique because versionId is null)
      const sourceObject = await prisma.object.findFirst({
        where: {
          bucketId: sourceBucket.id,
          key: sourceKey,
          versionId: null,
          isLatest: true,
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
      const existingObject = await prisma.object.findFirst({
        where: {
          bucketId: bucket.id,
          key,
          versionId: null,
          isLatest: true,
        },
      });

      let versionId: string | null = null;
      if (bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      const now = new Date();

      // Create or update object in database
      if (existingObject) {
        await prisma.object.update({
          where: { id: existingObject.id },
          data: {
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
      } else {
        await prisma.object.create({
          data: {
            bucketId: bucket.id,
            key,
            size: sourceObject.size,
            contentType: sourceObject.contentType,
            etag: sourceObject.etag,
            md5Hash: sourceObject.md5Hash,
            storageClass: sourceObject.storageClass,
            metadata: sourceObject.metadata,
            versionId,
            physicalPath: generateObjectPath(bucket.volumePath, key),
            isLatest: true,
          },
        });
      }

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
    // For large files (>100MB), use streaming to avoid memory issues
    const STREAMING_THRESHOLD = 100 * 1024 * 1024; // 100MB
    let tempPath: string;

    if (size > STREAMING_THRESHOLD) {
      // Stream large files directly to disk
      logger.info({ key, size, bucket: bucketName }, 'Using streaming upload for large file (>100MB)');
      tempPath = await streamBodyToTemp(c.req.raw);
    } else {
      // Load smaller files into memory first
      const bodyBuffer = await c.req.arrayBuffer();
      tempPath = await writeBodyToTemp(bodyBuffer);
    }

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
      const existingObject = await prisma.object.findFirst({
        where: {
          bucketId: bucket.id,
          key,
          versionId: null,
          isLatest: true,
        },
      });

      let versionId: string | null = null;
      let isNewObject = !existingObject;

      if (bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      // Create or update object in database
      // For non-versioned buckets, we can't use upsert with versionId: null in the where clause
      // So we handle create/update separately
      let object;

      if (existingObject && !bucket.versioningEnabled) {
        // Update existing object (non-versioned bucket)
        object = await prisma.object.update({
          where: { id: existingObject.id },
          data: {
            size: BigInt(size),
            contentType,
            etag,
            md5Hash,
            storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
            metadata,
            physicalPath: destPath,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new object (either new object or versioned bucket)
        object = await prisma.object.create({
          data: {
            bucketId: bucket.id,
            key,
            size: BigInt(size),
            contentType,
            etag,
            md5Hash,
            storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
            metadata,
            versionId,
            physicalPath: destPath,
            isLatest: true,
          },
        });

        // If versioned bucket and there was an existing object, mark it as not latest
        if (bucket.versioningEnabled && existingObject) {
          await prisma.object.update({
            where: { id: existingObject.id },
            data: { isLatest: false },
          });
        }
      }

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

      const responseHeaders: Record<string, string> = {
        'ETag': etag,
      };

      if (versionId) {
        responseHeaders['x-amz-version-id'] = versionId;
      }

      return c.text('', 200, responseHeaders);
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Put object error');
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
 * Delete object - DELETE /api/s3/:bucket/:key
 */
app.delete('/api/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/api/s3/${bucketName}/`, '');
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

    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
      },
    });

    if (!object) {
      // S3 returns 204 even if object doesn't exist
      return c.body(null, 204);
    }

    // Delete file from disk
    const objectPath = generateObjectPath(bucket.volumePath, key);
    await deleteFile(objectPath);

    // Delete from database
    // Use the object ID instead of the composite key with null versionId
    await prisma.object.delete({
      where: {
        id: object.id,
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

    return c.body(null, 204);
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Delete object error');
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
 * Route aliases without /api prefix for Tailscale Serve path stripping
 */

/**
 * Check if object exists (HEAD) - HEAD /s3/:bucket/:key (alias)
 */
app.on('HEAD', '/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/s3/${bucketName}/`, '');
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

    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
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
      ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
    });
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Head object error');
    return c.text('', 500);
  }
});

/**
 * Get object (download) - GET /s3/:bucket/:key (alias)
 */
app.get('/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  console.log('📍 OBJECT ROUTE HIT (alias): /s3/:bucket/*');
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const pathAfterBucket = fullPath.replace(`/s3/${bucketName}/`, '');
    const key = pathAfterBucket || c.req.param('*');
    const user = c.get('user');

    console.log('📍 Object route params (alias):', { bucketName, key, path: c.req.path, pathAfterBucket });
    logger.debug({ bucketName, key, path: c.req.path, url: c.req.url }, 'S3 Object GET route handler (alias)');

    // If no key or empty key, handle as bucket listing request
    // This happens because /:bucket/* matches /bucket/ with empty wildcard
    if (!key || key.trim() === '') {
      // Get bucket for listing
      const bucket = await prisma.bucket.findUnique({
        where: { name: bucketName },
      });

      if (!bucket) {
        const xml = buildErrorXml(
          S3ErrorCodes.NoSuchBucket,
          'The specified bucket does not exist',
          `/${bucketName}`
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

      // Check query parameters
      const url = new URL(c.req.url);

      // Default: List bucket contents (ListObjectsV2)
      const prefix = url.searchParams.get('prefix') || '';
      const delimiter = url.searchParams.get('delimiter') || undefined;
      const maxKeysParam = url.searchParams.get('max-keys');
      const maxKeys = maxKeysParam ? Math.min(parseInt(maxKeysParam, 10), 1000) : 1000;
      const marker = url.searchParams.get('marker') || undefined;
      const startAfter = url.searchParams.get('start-after') || undefined;

      // Build where clause
      const where: any = {
        bucketId: bucket.id,
        isDeleted: false,
      };

      if (prefix) {
        where.key = { startsWith: prefix };
      }

      if (startAfter) {
        where.key = { ...where.key, gt: startAfter };
      } else if (marker) {
        where.key = { ...where.key, gt: marker };
      }

      // Fetch objects
      const objects = await prisma.object.findMany({
        where,
        select: {
          key: true,
          size: true,
          etag: true,
          storageClass: true,
          updatedAt: true,
        },
        orderBy: { key: 'asc' },
        take: maxKeys + 1, // Fetch one extra to check if truncated
      });

      const isTruncated = objects.length > maxKeys;
      const contents = objects.slice(0, maxKeys);

      // Handle delimiter (common prefixes)
      let commonPrefixes: string[] | undefined;
      if (delimiter) {
        const prefixes = new Set<string>();
        const filteredContents: typeof contents = [];

        for (const obj of contents) {
          const keyAfterPrefix = obj.key.substring(prefix.length);
          const delimiterIndex = keyAfterPrefix.indexOf(delimiter);

          if (delimiterIndex !== -1) {
            // This object is in a "subdirectory"
            const commonPrefix = prefix + keyAfterPrefix.substring(0, delimiterIndex + 1);
            prefixes.add(commonPrefix);
          } else {
            // This object is at the current level
            filteredContents.push(obj);
          }
        }

        commonPrefixes = Array.from(prefixes).sort();
        contents.length = 0;
        contents.push(...filteredContents);
      }

      const xml = buildListObjectsXml({
        bucketName: bucket.name,
        prefix: prefix || undefined,
        marker: marker || startAfter,
        maxKeys,
        delimiter,
        isTruncated,
        nextMarker: isTruncated ? contents[contents.length - 1]?.key : undefined,
        contents: contents.map(obj => ({
          key: obj.key,
          lastModified: obj.updatedAt,
          etag: obj.etag,
          size: obj.size,
          storageClass: obj.storageClass,
        })),
        commonPrefixes,
      });

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // Get bucket
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

    // Get object
    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
      },
    });

    if (!object || object.isDeleted) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchKey,
        'The specified key does not exist.'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    // Get file from storage
    const objectPath = generateObjectPath(bucket.volumePath, key);
    const exists = await fileExists(objectPath);

    if (!exists) {
      logger.error({ objectPath, key, bucketName }, 'Object file not found on disk');
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchKey,
        'The specified key does not exist.'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    // Stream file
    const stream = createReadStream(objectPath);

    return c.body(stream as any, 200, {
      'Content-Type': object.contentType,
      'Content-Length': object.size.toString(),
      'ETag': object.etag,
      'Last-Modified': object.updatedAt.toUTCString(),
      'x-amz-storage-class': object.storageClass,
      ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
    });
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Get object error');
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
 * Upload object (PUT) or Copy object - PUT /s3/:bucket/:key (alias)
 */
app.put('/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/s3/${bucketName}/`, '');
    const user = c.get('user');

    console.log('📍 OBJECT PUT ROUTE HIT (alias):', { bucket: bucketName, key, path: fullPath });

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
      // Copy operation
      const sourceMatch = copySource.match(/^\/?(.*?)\/(.*?)$/);
      if (!sourceMatch) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Invalid copy source'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      const sourceBucketName = sourceMatch[1];
      const sourceKey = decodeURIComponent(sourceMatch[2]);

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

      const sourceObject = await prisma.object.findFirst({
        where: {
          bucketId: sourceBucket.id,
          key: sourceKey,
          versionId: null,
          isLatest: true,
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

      const sourceObjectPath = generateObjectPath(sourceBucket.volumePath, sourceKey);
      const destPath = generateObjectPath(bucket.volumePath, key);

      // Copy file
      try {
        const fs = await import('fs/promises');
        await fs.mkdir(join(destPath, '..'), { recursive: true });
        await fs.copyFile(sourceObjectPath, destPath);
      } catch (error) {
        logger.error({ error, sourceObjectPath, destPath }, 'Failed to copy object file');
        const xml = buildErrorXml(
          S3ErrorCodes.InternalError,
          'Failed to copy object'
        );
        return c.text(xml, 500, {
          'Content-Type': 'application/xml',
        });
      }

      const versionId = bucket.versioningEnabled ? generateVersionId() : null;

      // Check if object exists to determine create vs update
      const existingObject = await prisma.object.findFirst({
        where: {
          bucketId: bucket.id,
          key,
          versionId: null,
        },
      });

      let object;
      if (existingObject && !bucket.versioningEnabled) {
        object = await prisma.object.update({
          where: { id: existingObject.id },
          data: {
            size: sourceObject.size,
            contentType: sourceObject.contentType,
            etag: sourceObject.etag,
            md5Hash: sourceObject.md5Hash,
            storageClass: c.req.header('x-amz-storage-class') || sourceObject.storageClass,
            metadata: sourceObject.metadata,
            physicalPath: destPath,
            updatedAt: new Date(),
          },
        });
      } else {
        object = await prisma.object.create({
          data: {
            bucketId: bucket.id,
            key,
            size: sourceObject.size,
            contentType: sourceObject.contentType,
            etag: sourceObject.etag,
            md5Hash: sourceObject.md5Hash,
            storageClass: c.req.header('x-amz-storage-class') || sourceObject.storageClass,
            metadata: sourceObject.metadata,
            versionId,
            physicalPath: destPath,
            isLatest: true,
          },
        });
      }

      logger.info({ userId: user.id, bucketName: bucket.name, key }, 'Object copied via S3 API');

      const xml = buildCopyObjectXml(object.etag, object.updatedAt);
      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
        ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
      });
    } else {
      // Upload operation
      const contentType = c.req.header('content-type') || getContentTypeFromExtension(key);
      const contentLength = parseInt(c.req.header('content-length') || '0', 10);

      if (contentLength > user.maxObjectSize) {
        const xml = buildErrorXml(
          'EntityTooLarge',
          `Object size exceeds maximum allowed size of ${user.maxObjectSize} bytes`
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      // Write request body to temporary file
      // For large files (>100MB), use streaming to avoid memory issues
      const STREAMING_THRESHOLD = 100 * 1024 * 1024; // 100MB
      let tempPath: string;

      if (contentLength > STREAMING_THRESHOLD) {
        // Stream large files directly to disk
        logger.info({ key, size: contentLength, bucket: bucketName }, 'Using streaming upload for large file (>100MB)');
        tempPath = await streamBodyToTemp(c.req.raw);
      } else {
        // Load smaller files into memory first
        const body = await c.req.arrayBuffer();
        tempPath = await writeBodyToTemp(body);
      }

      try {
        // Calculate MD5 and ETag
        const md5Hash = await calculateMD5(tempPath);
        const etag = generateETag(tempPath);

        // Validate Content-MD5 if provided
        const clientMD5 = c.req.header('content-md5');
        if (clientMD5 && clientMD5 !== md5Hash) {
          const xml = buildErrorXml(
            'BadDigest',
            'The Content-MD5 you specified did not match what we received'
          );
          return c.text(xml, 400, {
            'Content-Type': 'application/xml',
          });
        }

        // Save file to storage
        const destPath = generateObjectPath(bucket.volumePath, key);
        await saveFile(tempPath, destPath);

        // Parse metadata from headers (x-amz-meta-*)
        const headers = Object.fromEntries(
          Object.entries(c.req.header()).filter(([k]) => k.toLowerCase().startsWith('x-amz-meta-'))
        );

        const metadata: Record<string, string> = {};
        for (const [header, value] of Object.entries(headers)) {
          const metaKey = header.toLowerCase().replace('x-amz-meta-', '');
          if (typeof value === 'string') {
            metadata[metaKey] = value;
          }
        }

        const versionId = bucket.versioningEnabled ? generateVersionId() : null;

        // Check if object exists to determine create vs update
        const existingObject = await prisma.object.findFirst({
          where: {
            bucketId: bucket.id,
            key,
            versionId: null,
          },
        });

        const size = BigInt(contentLength);

        let object;
        if (existingObject && !bucket.versioningEnabled) {
          object = await prisma.object.update({
            where: { id: existingObject.id },
            data: {
              size,
              contentType,
              etag,
              md5Hash,
              storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
              metadata,
              physicalPath: destPath,
              updatedAt: new Date(),
            },
          });
        } else {
          object = await prisma.object.create({
            data: {
              bucketId: bucket.id,
              key,
              size,
              contentType,
              etag,
              md5Hash,
              storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
              metadata,
              versionId,
              physicalPath: destPath,
              isLatest: true,
            },
          });
        }

        logger.info({ userId: user.id, bucketName: bucket.name, key, size: object.size }, 'Object uploaded via S3 API');

        return c.text('', 200, {
          'ETag': `"${object.etag}"`,
          ...(object.versionId ? { 'x-amz-version-id': object.versionId } : {}),
        });
      } finally {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Put object error');
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
 * Delete object - DELETE /s3/:bucket/:key (alias)
 */
app.delete('/s3/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    // Manual path parsing workaround (Hono wildcard param broken)
    const fullPath = c.req.path;
    const key = fullPath.replace(`/s3/${bucketName}/`, '');
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

    const object = await prisma.object.findFirst({
      where: {
        bucketId: bucket.id,
        key,
        versionId: null,
        isLatest: true,
      },
    });

    if (!object) {
      // S3 returns 204 No Content even if object doesn't exist (idempotent operation)
      return c.body(null, 204);
    }

    // Soft delete: mark as deleted
    await prisma.object.update({
      where: { id: object.id },
      data: {
        isDeleted: true,
      },
    });

    // Delete physical file
    const objectPath = generateObjectPath(bucket.volumePath, key);
    try {
      await deleteFile(objectPath);
    } catch (error) {
      logger.warn({ error, objectPath, key }, 'Failed to delete object file from disk');
    }

    logger.info({ userId: user.id, bucketName: bucket.name, key }, 'Object deleted via S3 API');

    return c.body(null, 204);
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Delete object error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
});

} // end registerS3ObjectRoutes
