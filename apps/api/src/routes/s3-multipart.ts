// S3 Multipart Upload API Routes
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { s3AuthMiddleware } from '../middleware/s3-auth.js';
import {
  buildErrorXml,
  buildInitiateMultipartUploadXml,
  buildCompleteMultipartUploadXml,
  buildListPartsXml,
  buildListMultipartUploadsXml,
  parseCompleteMultipartUploadXml,
  S3ErrorCodes,
} from '../lib/s3-xml.js';
import {
  generateUploadId,
  savePart,
  combineParts,
  cleanupMultipartUpload,
  isValidPartNumber,
  verifyParts,
} from '../lib/multipart-upload.js';
import {
  generateObjectPath,
  isValidObjectKey,
  getContentTypeFromExtension,
  generateVersionId,
} from '../lib/object-storage.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';

/**
 * Register S3 multipart routes directly on the main app
 */
export function registerS3MultipartRoutes(app: Hono<AppEnv>) {

/**
 * Helper: Write request body to temporary file
 */
async function writeBodyToTemp(body: ArrayBuffer | null): Promise<string> {
  if (!body) {
    throw new Error('No request body');
  }

  const tempPath = join(tmpdir(), `s3-part-${randomBytes(16).toString('hex')}`);

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
 * Initiate multipart upload - POST /api/s3/:bucket/:key?uploads
 */
app.post('/api/s3/:bucket/*', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    // Check for ?uploads query parameter
    const url = new URL(c.req.url);
    if (!url.searchParams.has('uploads')) {
      // Not an initiate multipart upload request
      // Pass to next middleware/route
      return await next();
    }

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

    // Generate upload ID
    const uploadId = generateUploadId();

    // Determine content type
    const contentType = c.req.header('content-type') || getContentTypeFromExtension(key);

    // Parse custom metadata from x-amz-meta- headers
    const metadata: Record<string, string> = {};
    for (const [headerName, headerValue] of Object.entries(c.req.header())) {
      if (headerName.startsWith('x-amz-meta-')) {
        const metaKey = headerName.substring(11); // Remove 'x-amz-meta-'
        metadata[metaKey] = headerValue as string;
      }
    }

    // Create multipart upload record
    await prisma.multipartUpload.create({
      data: {
        uploadId,
        bucketId: bucket.id,
        key,  // Required field in schema
        objectKey: key,  // Compatibility field
        contentType,
        metadata,
        storageClass: c.req.header('x-amz-storage-class') || bucket.storageClass,
        userId: user.id,
      },
    });

    logger.info({
      userId: user.id,
      bucketName,
      key,
      uploadId,
    }, 'Multipart upload initiated via S3 API');

    const xml = buildInitiateMultipartUploadXml({
      bucketName,
      key,
      uploadId,
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'Initiate multipart upload error');
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
 * Upload part or complete/abort multipart upload - PUT /:bucket/:key?uploadId=...
 */
app.put('/api/s3/:bucket/*', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');

    if (!uploadId) {
      // This is handled by s3-object.ts (regular PUT)
      // Pass to next middleware/route instead of returning 404
      return await next();
    }

    const partNumberParam = url.searchParams.get('partNumber');

    if (partNumberParam) {
      // Upload part operation
      const partNumber = parseInt(partNumberParam, 10);

      if (!isValidPartNumber(partNumber)) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Part number must be between 1 and 10000'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      const multipartUpload = await prisma.multipartUpload.findUnique({
        where: { uploadId },
        include: { bucket: true },
      });

      if (!multipartUpload) {
        const xml = buildErrorXml(
          S3ErrorCodes.NoSuchUpload,
          'The specified multipart upload does not exist'
        );
        return c.text(xml, 404, {
          'Content-Type': 'application/xml',
        });
      }

      if (multipartUpload.userId !== user.id) {
        const xml = buildErrorXml(
          S3ErrorCodes.AccessDenied,
          'Access Denied'
        );
        return c.text(xml, 403, {
          'Content-Type': 'application/xml',
        });
      }

      if (multipartUpload.bucket.name !== bucketName || multipartUpload.objectKey !== key) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Upload ID does not match bucket and key'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      if (multipartUpload.isCompleted) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Multipart upload already completed'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

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

      // Write request body to temporary file
      const bodyBuffer = await c.req.arrayBuffer();
      const tempPath = await writeBodyToTemp(bodyBuffer);

      try {
        // Save part
        const partResult = await savePart(uploadId, partNumber, tempPath, size);

        // Check if part already exists
        const existingPart = await prisma.multipartPart.findUnique({
          where: {
            uploadId_partNumber: {
              uploadId,
              partNumber,
            },
          },
        });

        // Create or update part record
        await prisma.multipartPart.upsert({
          where: {
            uploadId_partNumber: {
              uploadId,
              partNumber,
            },
          },
          create: {
            uploadId,
            partNumber,
            size: BigInt(size),
            etag: partResult.etag,
            md5Hash: partResult.md5Hash,
          },
          update: {
            size: BigInt(size),
            etag: partResult.etag,
            md5Hash: partResult.md5Hash,
            updatedAt: new Date(),
          },
        });

        logger.info({
          userId: user.id,
          bucketName,
          key,
          uploadId,
          partNumber,
        }, 'Part uploaded via S3 API');

        return c.text('', 200, {
          'ETag': partResult.etag,
        });
      } finally {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } else {
      // This might be CompleteMultipartUpload (requires POST, not PUT)
      const xml = buildErrorXml(
        S3ErrorCodes.MethodNotAllowed,
        'The specified method is not allowed against this resource'
      );
      return c.text(xml, 405, {
        'Content-Type': 'application/xml',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Upload part error');
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
 * Complete or abort multipart upload, or list parts - POST/DELETE/GET /:bucket/:key?uploadId=...
 */
app.on(['POST', 'DELETE', 'GET'], '/api/s3/:bucket/*', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');
    const method = c.req.method;

    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');

    if (!uploadId) {
      // Not a multipart operation
      // Pass to next middleware/route instead of returning 404
      return await next();
    }

    const multipartUpload = await prisma.multipartUpload.findUnique({
      where: { uploadId },
      include: { bucket: true, parts: { orderBy: { partNumber: 'asc' } } },
    });

    if (!multipartUpload) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchUpload,
        'The specified multipart upload does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (multipartUpload.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    if (method === 'POST') {
      // Complete multipart upload
      if (multipartUpload.isCompleted) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Multipart upload already completed'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      // Parse request body for parts list
      const body = await c.req.text();
      const parts = parseCompleteMultipartUploadXml(body);

      // Verify parts
      const verification = verifyParts(parts, multipartUpload.parts.map(p => ({
        partNumber: p.partNumber,
        etag: p.etag,
      })));

      if (!verification.valid) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidPart,
          verification.error || 'Invalid parts'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      // Combine parts into final object
      const destPath = generateObjectPath(multipartUpload.bucket.volumePath, key);
      const combinedResult = await combineParts(uploadId, destPath, multipartUpload.parts);

      // Calculate total size
      const totalSize = multipartUpload.parts.reduce((sum, p) => sum + p.size, BigInt(0));

      // Check if object already exists
      const existingObject = await prisma.object.findUnique({
        where: {
          bucketId_key_versionId: {
            bucketId: multipartUpload.bucketId,
            key,
            versionId: null,
          },
        },
      });

      let versionId: string | null = null;
      let isNewObject = !existingObject;

      if (multipartUpload.bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      // Create or update object in database
      await prisma.object.upsert({
        where: {
          bucketId_key_versionId: {
            bucketId: multipartUpload.bucketId,
            key,
            versionId: null,
          },
        },
        create: {
          bucketId: multipartUpload.bucketId,
          key,
          size: totalSize,
          contentType: multipartUpload.contentType,
          etag: combinedResult.etag,
          md5Hash: combinedResult.md5Hash,
          storageClass: multipartUpload.storageClass,
          metadata: multipartUpload.metadata,
          versionId,
        },
        update: {
          size: totalSize,
          contentType: multipartUpload.contentType,
          etag: combinedResult.etag,
          md5Hash: combinedResult.md5Hash,
          storageClass: multipartUpload.storageClass,
          metadata: multipartUpload.metadata,
          versionId,
          updatedAt: new Date(),
        },
      });

      // Mark multipart upload as completed
      await prisma.multipartUpload.update({
        where: { id: multipartUpload.id },
        data: { isCompleted: true, completedAt: new Date() },
      });

      // Update bucket statistics
      await prisma.bucket.update({
        where: { id: multipartUpload.bucketId },
        data: {
          objectCount: isNewObject ? { increment: 1 } : undefined,
          totalSize: isNewObject
            ? { increment: totalSize }
            : { increment: totalSize - (existingObject?.size || BigInt(0)) },
          updatedAt: new Date(),
        },
      });

      // Update user storage
      await prisma.user.update({
        where: { id: user.id },
        data: {
          usedStorage: isNewObject
            ? { increment: totalSize }
            : { increment: totalSize - (existingObject?.size || BigInt(0)) },
        },
      });

      // Clean up multipart files
      await cleanupMultipartUpload(uploadId);

      logger.info({
        userId: user.id,
        bucketName,
        key,
        uploadId,
      }, 'Multipart upload completed via S3 API');

      const location = `${url.protocol}//${url.host}/${bucketName}/${key}`;

      const xml = buildCompleteMultipartUploadXml({
        location,
        bucketName,
        key,
        etag: combinedResult.etag,
      });

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    } else if (method === 'DELETE') {
      // Abort multipart upload
      await prisma.multipartUpload.delete({
        where: { id: multipartUpload.id },
      });

      // Clean up multipart files
      await cleanupMultipartUpload(uploadId);

      logger.info({
        userId: user.id,
        bucketName,
        key,
        uploadId,
      }, 'Multipart upload aborted via S3 API');

      return c.body(null, 204);
    } else if (method === 'GET') {
      // List parts
      const maxPartsParam = url.searchParams.get('max-parts');
      const partNumberMarkerParam = url.searchParams.get('part-number-marker');

      const maxParts = maxPartsParam ? Math.min(parseInt(maxPartsParam, 10), 1000) : 1000;
      const partNumberMarker = partNumberMarkerParam ? parseInt(partNumberMarkerParam, 10) : undefined;

      const filteredParts = partNumberMarker
        ? multipartUpload.parts.filter(p => p.partNumber > partNumberMarker)
        : multipartUpload.parts;

      const isTruncated = filteredParts.length > maxParts;
      const returnedParts = filteredParts.slice(0, maxParts);

      const xml = buildListPartsXml({
        bucketName,
        key,
        uploadId,
        storageClass: multipartUpload.storageClass,
        partNumberMarker,
        nextPartNumberMarker: isTruncated
          ? returnedParts[returnedParts.length - 1]?.partNumber
          : undefined,
        maxParts,
        isTruncated,
        parts: returnedParts.map(p => ({
          partNumber: p.partNumber,
          lastModified: p.updatedAt,
          etag: p.etag,
          size: p.size,
        })),
      });

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    return c.text('', 405);
  } catch (error) {
    logger.error({ error }, 'Multipart operation error');
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
 * List multipart uploads - GET /:bucket?uploads
 */
app.get('/api/s3/:bucket', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    const url = new URL(c.req.url);

    // Check for ?uploads query parameter
    if (!url.searchParams.has('uploads')) {
      // This is handled by s3-bucket.ts (list objects)
      // Pass to next middleware/route instead of returning 404
      return await next();
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

    const maxUploadsParam = url.searchParams.get('max-uploads');
    const keyMarker = url.searchParams.get('key-marker');
    const uploadIdMarker = url.searchParams.get('upload-id-marker');

    const maxUploads = maxUploadsParam ? Math.min(parseInt(maxUploadsParam, 10), 1000) : 1000;

    // Build where clause
    const where: any = {
      bucketId: bucket.id,
      isCompleted: false,
    };

    if (keyMarker) {
      where.objectKey = { gt: keyMarker };
    }

    // Fetch uploads
    const uploads = await prisma.multipartUpload.findMany({
      where,
      orderBy: [{ objectKey: 'asc' }, { uploadId: 'asc' }],
      take: maxUploads + 1, // Fetch one extra to check if truncated
    });

    const isTruncated = uploads.length > maxUploads;
    const returnedUploads = uploads.slice(0, maxUploads);

    const xml = buildListMultipartUploadsXml({
      bucketName,
      keyMarker,
      uploadIdMarker,
      nextKeyMarker: isTruncated ? returnedUploads[returnedUploads.length - 1]?.objectKey : undefined,
      nextUploadIdMarker: isTruncated ? returnedUploads[returnedUploads.length - 1]?.uploadId : undefined,
      maxUploads,
      isTruncated,
      uploads: returnedUploads.map(u => ({
        key: u.objectKey,
        uploadId: u.uploadId,
        initiatedAt: u.createdAt,
        storageClass: u.storageClass,
      })),
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'List multipart uploads error');
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
 * Initiate multipart upload - POST /s3/:bucket/:key?uploads (alias)
 */
app.post('/s3/:bucket/*', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const fullPath = c.req.path;
    const key = fullPath.replace(`/s3/${bucketName}/`, '');
    const user = c.get('user');

    // Check for ?uploads query parameter
    const url = new URL(c.req.url);
    if (!url.searchParams.has('uploads')) {
      // Not an initiate multipart upload request
      // Pass to next middleware/route
      return await next();
    }

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

    // Generate upload ID
    const uploadId = generateUploadId();

    // Get content type
    const contentType = c.req.header('content-type') || getContentTypeFromExtension(key);

    // Create multipart upload record
    const multipartUpload = await prisma.multipartUpload.create({
      data: {
        uploadId,
        bucketId: bucket.id,
        key,
        contentType,
        metadata: {},
      },
    });

    logger.info({ userId: user.id, bucketName: bucket.name, key, uploadId }, 'Multipart upload initiated');

    const xml = buildInitiateMultipartUploadXml(bucket.name, key, uploadId);
    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'Initiate multipart upload error');
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
 * Upload part / Complete multipart upload / Abort multipart upload - PUT /s3/:bucket/:key (alias)
 */
app.put('/s3/:bucket/*', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const fullPath = c.req.path;
    const key = fullPath.replace(`/s3/${bucketName}/`, '');
    const user = c.get('user');

    // Check for uploadId query parameter
    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');

    if (!uploadId) {
      // Not a multipart upload request
      // Pass to next middleware/route
      return await next();
    }

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

    // Get multipart upload
    const multipartUpload = await prisma.multipartUpload.findUnique({
      where: { uploadId },
      include: { parts: true },
    });

    if (!multipartUpload || multipartUpload.bucketId !== bucket.id || multipartUpload.key !== key) {
      const xml = buildErrorXml(
        'NoSuchUpload',
        'The specified upload does not exist. The upload ID may be invalid, or the upload may have been aborted or completed.'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    // Check for partNumber (upload part)
    const partNumberParam = url.searchParams.get('partNumber');

    if (partNumberParam) {
      // Upload part
      const partNumber = parseInt(partNumberParam, 10);

      if (!isValidPartNumber(partNumber)) {
        const xml = buildErrorXml(
          S3ErrorCodes.InvalidArgument,
          'Part number must be an integer between 1 and 10000'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      const contentLength = parseInt(c.req.header('content-length') || '0', 10);

      // Get request body
      const body = await c.req.arrayBuffer();

      // Write to temp file
      const tempPath = await writeBodyToTemp(body);

      try {
        // Save part
        const etag = await savePart(tempPath, multipartUpload.id, partNumber);

        // Create or update part record
        const existingPart = await prisma.multipartUploadPart.findUnique({
          where: {
            multipartUploadId_partNumber: {
              multipartUploadId: multipartUpload.id,
              partNumber,
            },
          },
        });

        if (existingPart) {
          await prisma.multipartUploadPart.update({
            where: { id: existingPart.id },
            data: {
              etag,
              size: contentLength,
            },
          });
        } else {
          await prisma.multipartUploadPart.create({
            data: {
              multipartUploadId: multipartUpload.id,
              partNumber,
              etag,
              size: contentLength,
            },
          });
        }

        logger.info({ uploadId, partNumber, etag }, 'Part uploaded');

        return c.text('', 200, {
          'ETag': `"${etag}"`,
        });
      } finally {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } else {
      // Complete multipart upload
      // Parse body to get parts list
      const bodyText = await c.req.text();
      const parts = parseCompleteMultipartUploadXml(bodyText);

      // Verify all parts exist
      const verificationResult = await verifyParts(multipartUpload.id, parts);
      if (!verificationResult.valid) {
        const xml = buildErrorXml(
          'InvalidPart',
          verificationResult.error || 'One or more of the specified parts could not be found'
        );
        return c.text(xml, 400, {
          'Content-Type': 'application/xml',
        });
      }

      // Combine parts
      const destPath = generateObjectPath(bucket.volumePath, key);
      const etag = await combineParts(multipartUpload.id, parts, destPath);

      // Calculate total size
      const totalSize = multipartUpload.parts.reduce((sum, part) => sum + part.size, 0);

      // Generate version ID if versioning enabled
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
            size: BigInt(totalSize),
            contentType: multipartUpload.contentType,
            etag,
            storageClass: bucket.storageClass,
            metadata: multipartUpload.metadata as any,
            physicalPath: destPath,
            updatedAt: new Date(),
          },
        });
      } else {
        object = await prisma.object.create({
          data: {
            bucketId: bucket.id,
            key,
            size: BigInt(totalSize),
            contentType: multipartUpload.contentType,
            etag,
            storageClass: bucket.storageClass,
            metadata: multipartUpload.metadata as any,
            versionId,
            physicalPath: destPath,
            isLatest: true,
          },
        });
      }

      // Clean up multipart upload
      await cleanupMultipartUpload(multipartUpload.id);

      logger.info({ userId: user.id, bucketName: bucket.name, key, uploadId, size: totalSize }, 'Multipart upload completed');

      const xml = buildCompleteMultipartUploadXml(bucket.name, key, etag, object.versionId);
      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }
  } catch (error) {
    logger.error({ error }, 'Multipart upload PUT error');
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
 * List multipart uploads / List parts - GET /s3/:bucket (alias)
 */
app.get('/s3/:bucket', s3AuthMiddleware, async (c, next) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    const url = new URL(c.req.url);

    // Check for multipart upload queries
    if (!url.searchParams.has('uploads') && !url.searchParams.has('uploadId')) {
      // Not a multipart upload request
      return await next();
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

    // List multipart uploads
    if (url.searchParams.has('uploads')) {
      const prefix = url.searchParams.get('prefix') || undefined;
      const maxUploadsParam = url.searchParams.get('max-uploads');
      const maxUploads = maxUploadsParam ? Math.min(parseInt(maxUploadsParam, 10), 1000) : 1000;

      const where: any = {
        bucketId: bucket.id,
      };

      if (prefix) {
        where.key = { startsWith: prefix };
      }

      const uploads = await prisma.multipartUpload.findMany({
        where,
        select: {
          uploadId: true,
          key: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: maxUploads + 1,
      });

      const isTruncated = uploads.length > maxUploads;
      const contents = uploads.slice(0, maxUploads);

      const xml = buildListMultipartUploadsXml({
        bucketName: bucket.name,
        prefix,
        maxUploads,
        isTruncated,
        uploads: contents.map(u => ({
          uploadId: u.uploadId,
          key: u.key,
          initiated: u.createdAt,
        })),
      });

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // List parts
    const uploadId = url.searchParams.get('uploadId');
    if (!uploadId) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        'Missing uploadId parameter'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    const multipartUpload = await prisma.multipartUpload.findUnique({
      where: { uploadId },
      include: { parts: { orderBy: { partNumber: 'asc' } } },
    });

    if (!multipartUpload || multipartUpload.bucketId !== bucket.id) {
      const xml = buildErrorXml(
        'NoSuchUpload',
        'The specified upload does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    const maxPartsParam = url.searchParams.get('max-parts');
    const maxParts = maxPartsParam ? Math.min(parseInt(maxPartsParam, 10), 1000) : 1000;
    const partNumberMarker = url.searchParams.get('part-number-marker');
    const partNumberMarkerInt = partNumberMarker ? parseInt(partNumberMarker, 10) : 0;

    const filteredParts = multipartUpload.parts.filter(p => p.partNumber > partNumberMarkerInt);
    const isTruncated = filteredParts.length > maxParts;
    const parts = filteredParts.slice(0, maxParts);

    const xml = buildListPartsXml({
      bucketName: bucket.name,
      key: multipartUpload.key,
      uploadId,
      maxParts,
      isTruncated,
      partNumberMarker: partNumberMarkerInt,
      nextPartNumberMarker: isTruncated ? parts[parts.length - 1]?.partNumber : undefined,
      parts: parts.map(p => ({
        partNumber: p.partNumber,
        etag: p.etag,
        size: p.size,
        lastModified: p.createdAt,
      })),
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'List multipart uploads/parts error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
});

} // end registerS3MultipartRoutes
