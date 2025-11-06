// Multipart Upload tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
import {
  generateUploadId,
  savePart,
  combineParts,
  cleanupMultipartUpload,
  listParts,
  isValidPartNumber,
  isValidPartSize,
  calculateTotalSize,
  verifyParts,
} from '../../lib/multipart-upload.js';
import {
  generateObjectPath,
  isValidObjectKey,
  getContentTypeFromExtension,
} from '../../lib/object-storage.js';

/**
 * Multipart Upload Router
 * Manages S3-compatible multipart uploads for large files
 */
export const multipartRouter = router({
  /**
   * Initiate a multipart upload
   */
  initiate: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      contentType: z.string().optional(),
      metadata: z.record(z.string()).optional(),
      storageClass: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate object key
      const keyValidation = isValidObjectKey(input.key);
      if (!keyValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: keyValidation.error,
        });
      }

      // Get bucket
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      // Generate upload ID
      const uploadId = generateUploadId();

      // Determine content type
      const contentType = input.contentType || getContentTypeFromExtension(input.key);

      // Create multipart upload record
      const multipartUpload = await prisma.multipartUpload.create({
        data: {
          uploadId,
          bucketId: bucket.id,
          objectKey: input.key,
          contentType,
          metadata: input.metadata || {},
          storageClass: input.storageClass || bucket.storageClass,
          userId: ctx.user.id,
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: bucket.name,
        objectKey: input.key,
        uploadId,
      }, 'Multipart upload initiated');

      return {
        success: true,
        uploadId: multipartUpload.uploadId,
        bucketName: bucket.name,
        key: input.key,
        message: 'Multipart upload initiated successfully',
      };
    }),

  /**
   * Upload a part
   */
  uploadPart: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      uploadId: z.string(),
      partNumber: z.number().int().min(1).max(10000),
      filePath: z.string(), // Temporary file path from upload
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate part number
      if (!isValidPartNumber(input.partNumber)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Part number must be between 1 and 10000',
        });
      }

      // Get multipart upload
      const multipartUpload = await prisma.multipartUpload.findUnique({
        where: { uploadId: input.uploadId },
        include: { bucket: true },
      });

      if (!multipartUpload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Multipart upload not found',
        });
      }

      if (multipartUpload.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      if (multipartUpload.bucket.name !== input.bucketName || multipartUpload.objectKey !== input.key) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Upload ID does not match bucket and key',
        });
      }

      if (multipartUpload.isCompleted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Multipart upload already completed',
        });
      }

      if (multipartUpload.isAborted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Multipart upload was aborted',
        });
      }

      try {
        // Save part file
        const { size, etag } = await savePart(input.uploadId, input.partNumber, input.filePath);

        // Validate part size (we'll skip validation for now as we don't know if it's the last part)
        // In production, you'd want stricter validation

        // Create or update part record
        const part = await prisma.multipartUploadPart.upsert({
          where: {
            uploadId_partNumber: {
              uploadId: input.uploadId,
              partNumber: input.partNumber,
            },
          },
          create: {
            uploadId: input.uploadId,
            partNumber: input.partNumber,
            size: BigInt(size),
            etag,
          },
          update: {
            size: BigInt(size),
            etag,
            uploadedAt: new Date(),
          },
        });

        logger.info({
          userId: ctx.user.id,
          uploadId: input.uploadId,
          partNumber: input.partNumber,
          size,
        }, 'Part uploaded');

        return {
          success: true,
          partNumber: part.partNumber,
          etag: part.etag,
          size: part.size.toString(),
          message: 'Part uploaded successfully',
        };
      } catch (error) {
        logger.error({ err: error, uploadId: input.uploadId, partNumber: input.partNumber }, 'Failed to upload part');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload part',
        });
      }
    }),

  /**
   * Complete multipart upload
   */
  complete: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      uploadId: z.string(),
      parts: z.array(z.object({
        partNumber: z.number().int(),
        etag: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get multipart upload
      const multipartUpload = await prisma.multipartUpload.findUnique({
        where: { uploadId: input.uploadId },
        include: {
          bucket: true,
          parts: true,
        },
      });

      if (!multipartUpload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Multipart upload not found',
        });
      }

      if (multipartUpload.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      if (multipartUpload.isCompleted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Multipart upload already completed',
        });
      }

      if (multipartUpload.isAborted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Multipart upload was aborted',
        });
      }

      // Verify all parts exist and ETags match
      const partNumbers = input.parts.map(p => p.partNumber);
      const partsExist = await verifyParts(input.uploadId, partNumbers);

      if (!partsExist) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more parts not found',
        });
      }

      // Verify ETags match
      for (const inputPart of input.parts) {
        const dbPart = multipartUpload.parts.find(p => p.partNumber === inputPart.partNumber);
        if (!dbPart || dbPart.etag !== inputPart.etag) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `ETag mismatch for part ${inputPart.partNumber}`,
          });
        }
      }

      try {
        // Calculate total size
        const totalSize = await calculateTotalSize(input.uploadId, partNumbers);

        // Check storage quota
        const totalUsed = ctx.user.usedStorage + BigInt(totalSize);
        if (totalUsed > ctx.user.storageQuota) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Storage quota exceeded. Used: ${totalUsed}, Quota: ${ctx.user.storageQuota}`,
          });
        }

        // Combine parts into final file
        const destPath = generateObjectPath(multipartUpload.bucket.volumePath, input.key);
        const { size, etag } = await combineParts(input.uploadId, partNumbers, destPath);

        // Check if object already exists
        const existingObject = await prisma.object.findUnique({
          where: {
            bucketId_key: {
              bucketId: multipartUpload.bucketId,
              key: input.key,
            },
          },
        });

        const isNewObject = !existingObject;

        // Create or update object in database
        const object = await prisma.object.upsert({
          where: {
            bucketId_key: {
              bucketId: multipartUpload.bucketId,
              key: input.key,
            },
          },
          create: {
            bucketId: multipartUpload.bucketId,
            key: input.key,
            size: BigInt(size),
            contentType: multipartUpload.contentType,
            etag,
            md5Hash: etag.replace(/"/g, '').split('-')[0], // Extract MD5 from ETag
            storageClass: multipartUpload.storageClass,
            metadata: multipartUpload.metadata,
          },
          update: {
            size: BigInt(size),
            contentType: multipartUpload.contentType,
            etag,
            md5Hash: etag.replace(/"/g, '').split('-')[0],
            storageClass: multipartUpload.storageClass,
            metadata: multipartUpload.metadata,
            updatedAt: new Date(),
          },
        });

        // Mark multipart upload as completed
        await prisma.multipartUpload.update({
          where: { uploadId: input.uploadId },
          data: {
            isCompleted: true,
            completedAt: new Date(),
          },
        });

        // Update bucket statistics
        await prisma.bucket.update({
          where: { id: multipartUpload.bucketId },
          data: {
            objectCount: isNewObject ? { increment: 1 } : undefined,
            totalSize: isNewObject
              ? { increment: BigInt(size) }
              : { increment: BigInt(size) - (existingObject?.size || BigInt(0)) },
            updatedAt: new Date(),
          },
        });

        // Update user storage usage
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            usedStorage: isNewObject
              ? { increment: BigInt(size) }
              : { increment: BigInt(size) - (existingObject?.size || BigInt(0)) },
          },
        });

        // Clean up temp files
        await cleanupMultipartUpload(input.uploadId);

        logger.info({
          userId: ctx.user.id,
          uploadId: input.uploadId,
          objectKey: input.key,
          size,
          partCount: partNumbers.length,
        }, 'Multipart upload completed');

        return {
          success: true,
          object: {
            key: object.key,
            size: object.size.toString(),
            etag: object.etag,
            contentType: object.contentType,
            lastModified: object.updatedAt,
          },
          message: 'Multipart upload completed successfully',
        };
      } catch (error) {
        logger.error({ err: error, uploadId: input.uploadId }, 'Failed to complete multipart upload');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete multipart upload',
        });
      }
    }),

  /**
   * Abort multipart upload
   */
  abort: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      uploadId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get multipart upload
      const multipartUpload = await prisma.multipartUpload.findUnique({
        where: { uploadId: input.uploadId },
        include: { bucket: true },
      });

      if (!multipartUpload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Multipart upload not found',
        });
      }

      if (multipartUpload.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      if (multipartUpload.isCompleted) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot abort completed upload',
        });
      }

      try {
        // Mark as aborted
        await prisma.multipartUpload.update({
          where: { uploadId: input.uploadId },
          data: {
            isAborted: true,
            abortedAt: new Date(),
          },
        });

        // Clean up temp files
        await cleanupMultipartUpload(input.uploadId);

        logger.info({
          userId: ctx.user.id,
          uploadId: input.uploadId,
        }, 'Multipart upload aborted');

        return {
          success: true,
          message: 'Multipart upload aborted successfully',
        };
      } catch (error) {
        logger.error({ err: error, uploadId: input.uploadId }, 'Failed to abort multipart upload');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to abort multipart upload',
        });
      }
    }),

  /**
   * List parts for a multipart upload
   */
  listParts: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      uploadId: z.string(),
      maxParts: z.number().min(1).max(1000).default(1000),
      partNumberMarker: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Get multipart upload
      const multipartUpload = await prisma.multipartUpload.findUnique({
        where: { uploadId: input.uploadId },
        include: { bucket: true },
      });

      if (!multipartUpload) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Multipart upload not found',
        });
      }

      if (multipartUpload.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Get parts from database
      const parts = await prisma.multipartUploadPart.findMany({
        where: {
          uploadId: input.uploadId,
          ...(input.partNumberMarker && { partNumber: { gt: input.partNumberMarker } }),
        },
        orderBy: { partNumber: 'asc' },
        take: input.maxParts,
      });

      return {
        bucketName: multipartUpload.bucket.name,
        key: multipartUpload.objectKey,
        uploadId: input.uploadId,
        storageClass: multipartUpload.storageClass,
        partNumberMarker: input.partNumberMarker,
        maxParts: input.maxParts,
        isTruncated: parts.length === input.maxParts,
        parts: parts.map(part => ({
          partNumber: part.partNumber,
          etag: part.etag,
          size: part.size.toString(),
          lastModified: part.uploadedAt,
        })),
      };
    }),

  /**
   * List in-progress multipart uploads
   */
  listUploads: protectedProcedure
    .input(z.object({
      bucketName: z.string().optional(),
      maxUploads: z.number().min(1).max(1000).default(1000),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        userId: ctx.user.id,
        isCompleted: false,
        isAborted: false,
      };

      if (input.bucketName) {
        const bucket = await prisma.bucket.findUnique({
          where: { name: input.bucketName },
        });

        if (!bucket || bucket.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Bucket not found',
          });
        }

        where.bucketId = bucket.id;
      }

      const uploads = await prisma.multipartUpload.findMany({
        where,
        include: {
          bucket: { select: { name: true } },
          _count: { select: { parts: true } },
        },
        orderBy: { initiatedAt: 'desc' },
        take: input.maxUploads,
      });

      return {
        bucketName: input.bucketName,
        maxUploads: input.maxUploads,
        isTruncated: uploads.length === input.maxUploads,
        uploads: uploads.map(upload => ({
          uploadId: upload.uploadId,
          bucketName: upload.bucket.name,
          key: upload.objectKey,
          storageClass: upload.storageClass,
          initiatedAt: upload.initiatedAt,
          partCount: upload._count.parts,
        })),
      };
    }),
});
