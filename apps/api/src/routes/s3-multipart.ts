// S3 Multipart Upload API Routes
import { Hono } from 'hono';
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
  generateETag,
  generateVersionId,
} from '../lib/object-storage.js';
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

  const tempPath = join(tmpdir(), `s3-part-${randomBytes(16).toString('hex')}`);
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
 * Initiate multipart upload - POST /:bucket/:key?uploads
 */
app.post('/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    // Check for ?uploads query parameter
    const url = new URL(c.req.url);
    if (!url.searchParams.has('uploads')) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidArgument,
        'Missing uploads query parameter'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
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
        objectKey: key,
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
app.put('/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');

    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');

    if (!uploadId) {
      // This is handled by s3-object.ts (regular PUT)
      return c.text('', 404);
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
      const tempPath = await writeBodyToTemp(c.req.raw.body);

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
app.on(['POST', 'DELETE', 'GET'], '/:bucket/*', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const key = c.req.param('*');
    const user = c.get('user');
    const method = c.req.method;

    const url = new URL(c.req.url);
    const uploadId = url.searchParams.get('uploadId');

    if (!uploadId) {
      // Not a multipart operation
      return c.text('', 404);
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
          bucketId_key: {
            bucketId: multipartUpload.bucketId,
            key,
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
          bucketId_key: {
            bucketId: multipartUpload.bucketId,
            key,
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

      return c.text('', 204);
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
app.get('/:bucket', s3AuthMiddleware, async (c) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    const url = new URL(c.req.url);

    // Check for ?uploads query parameter
    if (!url.searchParams.has('uploads')) {
      // This is handled by s3-bucket.ts (list objects)
      return c.text('', 404);
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

export default app;
