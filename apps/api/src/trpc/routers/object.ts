// Object tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
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
  parseObjectKey,
} from '../../lib/object-storage.js';

/**
 * Object Router
 * Manages S3-compatible object storage operations
 */
export const objectRouter = router({
  /**
   * Upload an object to a bucket
   */
  upload: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      filePath: z.string(), // Temporary file path from upload
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

      // Check if file exists at source path
      const sourceExists = await fileExists(input.filePath);
      if (!sourceExists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Source file not found',
        });
      }

      // Get file size and calculate MD5
      const size = await getFileSize(input.filePath);
      const md5Hash = await calculateMD5(input.filePath);
      const etag = generateETag(md5Hash);

      // Check storage quota
      const totalUsed = ctx.user.usedStorage + BigInt(size);
      if (totalUsed > ctx.user.storageQuota) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Storage quota exceeded. Used: ${totalUsed}, Quota: ${ctx.user.storageQuota}`,
        });
      }

      // Generate destination path
      const destPath = generateObjectPath(bucket.volumePath, input.key);

      // Check if object already exists
      const existingObject = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      let versionId: string | null = null;
      let isNewObject = !existingObject;

      // Handle versioning
      if (bucket.versioningEnabled && existingObject) {
        versionId = generateVersionId();
      }

      try {
        // Save file to destination
        await saveFile(input.filePath, destPath);

        // Determine content type
        const contentType = input.contentType || getContentTypeFromExtension(input.key);

        // Create or update object in database
        const object = await prisma.object.upsert({
          where: {
            bucketId_key: {
              bucketId: bucket.id,
              key: input.key,
            },
          },
          create: {
            bucketId: bucket.id,
            key: input.key,
            size: BigInt(size),
            contentType,
            etag,
            md5Hash,
            storageClass: input.storageClass || bucket.storageClass,
            metadata: input.metadata || {},
            versionId,
          },
          update: {
            size: BigInt(size),
            contentType,
            etag,
            md5Hash,
            storageClass: input.storageClass || bucket.storageClass,
            metadata: input.metadata || {},
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

        // Update user storage usage
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            usedStorage: isNewObject
              ? { increment: BigInt(size) }
              : { increment: BigInt(size) - (existingObject?.size || BigInt(0)) },
          },
        });

        logger.info({
          userId: ctx.user.id,
          bucketName: bucket.name,
          objectKey: input.key,
          size,
        }, 'Object uploaded');

        return {
          success: true,
          object: {
            key: object.key,
            size: object.size.toString(),
            etag: object.etag,
            contentType: object.contentType,
            versionId: object.versionId,
            lastModified: object.updatedAt,
          },
          message: 'Object uploaded successfully',
        };
      } catch (error) {
        logger.error({ err: error, objectKey: input.key }, 'Failed to upload object');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload object',
        });
      }
    }),

  /**
   * Get object metadata
   */
  getMetadata: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      versionId: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const object = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      if (!object) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Object not found',
        });
      }

      return {
        key: object.key,
        size: object.size.toString(),
        etag: object.etag,
        contentType: object.contentType,
        storageClass: object.storageClass,
        metadata: object.metadata,
        versionId: object.versionId,
        isDeleted: object.isDeleted,
        createdAt: object.createdAt,
        lastModified: object.updatedAt,
      };
    }),

  /**
   * List objects in a bucket
   */
  list: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      prefix: z.string().optional(),
      delimiter: z.string().optional(),
      maxKeys: z.number().min(1).max(1000).default(1000),
      startAfter: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      // Build query conditions
      const where: any = {
        bucketId: bucket.id,
        isDeleted: false,
      };

      if (input.prefix) {
        where.key = {
          startsWith: input.prefix,
        };
      }

      if (input.startAfter) {
        where.key = {
          ...where.key,
          gt: input.startAfter,
        };
      }

      const objects = await prisma.object.findMany({
        where,
        select: {
          key: true,
          size: true,
          etag: true,
          contentType: true,
          storageClass: true,
          versionId: true,
          updatedAt: true,
        },
        orderBy: { key: 'asc' },
        take: input.maxKeys,
      });

      // Handle delimiter for folder simulation
      let contents = objects;
      let commonPrefixes: string[] = [];

      if (input.delimiter) {
        const prefixLength = input.prefix?.length || 0;
        const seen = new Set<string>();

        contents = objects.filter(obj => {
          const keyAfterPrefix = obj.key.substring(prefixLength);
          const delimiterIndex = keyAfterPrefix.indexOf(input.delimiter!);

          if (delimiterIndex > 0) {
            // This is a "folder"
            const commonPrefix = obj.key.substring(0, prefixLength + delimiterIndex + 1);
            if (!seen.has(commonPrefix)) {
              seen.add(commonPrefix);
              commonPrefixes.push(commonPrefix);
            }
            return false;
          }

          return true;
        });
      }

      return {
        bucketName: bucket.name,
        prefix: input.prefix,
        delimiter: input.delimiter,
        maxKeys: input.maxKeys,
        isTruncated: objects.length === input.maxKeys,
        contents: contents.map(obj => ({
          key: obj.key,
          size: obj.size.toString(),
          etag: obj.etag,
          contentType: obj.contentType,
          storageClass: obj.storageClass,
          versionId: obj.versionId,
          lastModified: obj.updatedAt,
        })),
        commonPrefixes,
      };
    }),

  /**
   * Delete an object
   */
  delete: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      versionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const object = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      if (!object) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Object not found',
        });
      }

      try {
        // Delete physical file
        const filePath = generateObjectPath(bucket.volumePath, input.key);
        await deleteFile(filePath);

        // Delete from database or mark as deleted (if versioning)
        if (bucket.versioningEnabled) {
          await prisma.object.update({
            where: {
              bucketId_key: {
                bucketId: bucket.id,
                key: input.key,
              },
            },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        } else {
          await prisma.object.delete({
            where: {
              bucketId_key: {
                bucketId: bucket.id,
                key: input.key,
              },
            },
          });
        }

        // Update bucket statistics
        await prisma.bucket.update({
          where: { id: bucket.id },
          data: {
            objectCount: { decrement: 1 },
            totalSize: { decrement: object.size },
            updatedAt: new Date(),
          },
        });

        // Update user storage usage
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: {
            usedStorage: { decrement: object.size },
          },
        });

        logger.info({
          userId: ctx.user.id,
          bucketName: bucket.name,
          objectKey: input.key,
        }, 'Object deleted');

        return {
          success: true,
          message: 'Object deleted successfully',
        };
      } catch (error) {
        logger.error({ err: error, objectKey: input.key }, 'Failed to delete object');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete object',
        });
      }
    }),

  /**
   * Update object metadata
   */
  updateMetadata: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      contentType: z.string().optional(),
      metadata: z.record(z.string()).optional(),
      storageClass: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const object = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      if (!object) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Object not found',
        });
      }

      const updatedObject = await prisma.object.update({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
        data: {
          ...(input.contentType && { contentType: input.contentType }),
          ...(input.metadata && { metadata: input.metadata }),
          ...(input.storageClass && { storageClass: input.storageClass }),
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: bucket.name,
        objectKey: input.key,
      }, 'Object metadata updated');

      return {
        success: true,
        object: {
          key: updatedObject.key,
          contentType: updatedObject.contentType,
          metadata: updatedObject.metadata,
          storageClass: updatedObject.storageClass,
          lastModified: updatedObject.updatedAt,
        },
        message: 'Object metadata updated successfully',
      };
    }),

  /**
   * Copy an object
   */
  copy: protectedProcedure
    .input(z.object({
      sourceBucket: z.string(),
      sourceKey: z.string(),
      destBucket: z.string(),
      destKey: z.string(),
      metadata: z.record(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate destination key
      const keyValidation = isValidObjectKey(input.destKey);
      if (!keyValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: keyValidation.error,
        });
      }

      // Get source bucket
      const sourceBucket = await prisma.bucket.findUnique({
        where: { name: input.sourceBucket },
      });

      if (!sourceBucket || sourceBucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source bucket not found',
        });
      }

      // Get destination bucket
      const destBucket = await prisma.bucket.findUnique({
        where: { name: input.destBucket },
      });

      if (!destBucket || destBucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Destination bucket not found',
        });
      }

      // Get source object
      const sourceObject = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: sourceBucket.id,
            key: input.sourceKey,
          },
        },
      });

      if (!sourceObject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source object not found',
        });
      }

      try {
        // Copy physical file
        const sourcePath = generateObjectPath(sourceBucket.volumePath, input.sourceKey);
        const destPath = generateObjectPath(destBucket.volumePath, input.destKey);
        await saveFile(sourcePath, destPath);

        // Create new object record
        const copiedObject = await prisma.object.create({
          data: {
            bucketId: destBucket.id,
            key: input.destKey,
            size: sourceObject.size,
            contentType: sourceObject.contentType,
            etag: sourceObject.etag,
            md5Hash: sourceObject.md5Hash,
            storageClass: sourceObject.storageClass,
            metadata: input.metadata || sourceObject.metadata,
          },
        });

        // Update destination bucket statistics
        await prisma.bucket.update({
          where: { id: destBucket.id },
          data: {
            objectCount: { increment: 1 },
            totalSize: { increment: sourceObject.size },
            updatedAt: new Date(),
          },
        });

        // Update user storage usage (only if copying to different bucket)
        if (sourceBucket.id !== destBucket.id) {
          await prisma.user.update({
            where: { id: ctx.user.id },
            data: {
              usedStorage: { increment: sourceObject.size },
            },
          });
        }

        logger.info({
          userId: ctx.user.id,
          sourceBucket: input.sourceBucket,
          sourceKey: input.sourceKey,
          destBucket: input.destBucket,
          destKey: input.destKey,
        }, 'Object copied');

        return {
          success: true,
          object: {
            key: copiedObject.key,
            size: copiedObject.size.toString(),
            etag: copiedObject.etag,
            contentType: copiedObject.contentType,
            lastModified: copiedObject.updatedAt,
          },
          message: 'Object copied successfully',
        };
      } catch (error) {
        logger.error({ err: error }, 'Failed to copy object');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to copy object',
        });
      }
    }),

  /**
   * Get object statistics for a bucket
   */
  getStats: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const totalObjects = await prisma.object.count({
        where: {
          bucketId: bucket.id,
          isDeleted: false,
        },
      });

      const totalSize = await prisma.object.aggregate({
        where: {
          bucketId: bucket.id,
          isDeleted: false,
        },
        _sum: {
          size: true,
        },
      });

      return {
        bucketName: bucket.name,
        totalObjects,
        totalSize: (totalSize._sum.size || BigInt(0)).toString(),
        bucketCreatedAt: bucket.createdAt,
        lastModified: bucket.updatedAt,
      };
    }),
});
