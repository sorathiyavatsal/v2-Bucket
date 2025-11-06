// Bucket tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
import {
  isValidBucketName,
  generateBucketPath,
  ensureBucketDirectory,
  S3_REGIONS,
  STORAGE_CLASSES,
  ACL_OPTIONS,
  formatBytes,
  calculateStorageUsagePercent,
} from '../../lib/bucket-utils.js';

/**
 * Bucket Router
 * Manages S3-compatible storage buckets
 */
export const bucketRouter = router({
  /**
   * Create a new bucket
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3).max(63),
      region: z.enum(S3_REGIONS as [string, ...string[]]).default('us-east-1'),
      storageClass: z.enum(STORAGE_CLASSES as [string, ...string[]]).default('STANDARD'),
      acl: z.enum(ACL_OPTIONS as [string, ...string[]]).default('private'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate bucket name
      const nameValidation = isValidBucketName(input.name);
      if (!nameValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: nameValidation.error,
        });
      }

      // Check if bucket name already exists (globally unique)
      const existingBucket = await prisma.bucket.findUnique({
        where: { name: input.name },
      });

      if (existingBucket) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Bucket name already exists. Bucket names must be globally unique.',
        });
      }

      // Check if user has reached max buckets
      const userBucketCount = await prisma.bucket.count({
        where: { userId: ctx.user.id },
      });

      if (userBucketCount >= ctx.user.maxBuckets) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum number of buckets (${ctx.user.maxBuckets}) reached.`,
        });
      }

      // Generate bucket storage path
      const volumePath = generateBucketPath(ctx.user.id, input.name);

      // Create physical directory
      try {
        ensureBucketDirectory(volumePath);
      } catch (error) {
        logger.error({ err: error, volumePath }, 'Failed to create bucket directory');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create bucket storage directory',
        });
      }

      // Create bucket in database
      const bucket = await prisma.bucket.create({
        data: {
          name: input.name,
          userId: ctx.user.id,
          region: input.region,
          volumePath,
          storageClass: input.storageClass,
          acl: input.acl,
        },
      });

      logger.info({ userId: ctx.user.id, bucketName: bucket.name }, 'Bucket created');

      return {
        success: true,
        bucket: {
          id: bucket.id,
          name: bucket.name,
          region: bucket.region,
          storageClass: bucket.storageClass,
          acl: bucket.acl,
          createdAt: bucket.createdAt,
        },
        message: 'Bucket created successfully',
      };
    }),

  /**
   * List all buckets for the current user
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const buckets = await prisma.bucket.findMany({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          name: true,
          region: true,
          storageClass: true,
          acl: true,
          objectCount: true,
          totalSize: true,
          versioningEnabled: true,
          websiteEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return buckets.map(bucket => ({
        ...bucket,
        totalSize: bucket.totalSize.toString(),
        formattedSize: formatBytes(bucket.totalSize),
      }));
    }),

  /**
   * Get bucket details
   */
  get: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.name },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      return {
        id: bucket.id,
        name: bucket.name,
        region: bucket.region,
        volumePath: bucket.volumePath,
        storageClass: bucket.storageClass,
        acl: bucket.acl,
        versioningEnabled: bucket.versioningEnabled,
        mfaDelete: bucket.mfaDelete,
        encryptionEnabled: bucket.encryptionEnabled,
        encryptionAlgorithm: bucket.encryptionAlgorithm,
        websiteEnabled: bucket.websiteEnabled,
        indexDocument: bucket.indexDocument,
        errorDocument: bucket.errorDocument,
        objectCount: bucket.objectCount,
        totalSize: bucket.totalSize.toString(),
        formattedSize: formatBytes(bucket.totalSize),
        createdAt: bucket.createdAt,
        updatedAt: bucket.updatedAt,
      };
    }),

  /**
   * Delete a bucket
   */
  delete: protectedProcedure
    .input(z.object({
      name: z.string(),
      force: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.name },
        include: { _count: { select: { objects: true } } },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      // Check if bucket has objects
      if (bucket._count.objects > 0 && !input.force) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Bucket contains ${bucket._count.objects} objects. Use force=true to delete anyway.`,
        });
      }

      // Delete bucket (cascade will delete objects)
      await prisma.bucket.delete({
        where: { id: bucket.id },
      });

      logger.info({ userId: ctx.user.id, bucketName: bucket.name }, 'Bucket deleted');

      return {
        success: true,
        message: 'Bucket deleted successfully',
      };
    }),

  /**
   * Update bucket configuration
   */
  updateConfig: protectedProcedure
    .input(z.object({
      name: z.string(),
      acl: z.enum(ACL_OPTIONS as [string, ...string[]]).optional(),
      versioningEnabled: z.boolean().optional(),
      websiteEnabled: z.boolean().optional(),
      indexDocument: z.string().optional(),
      errorDocument: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.name },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const updatedBucket = await prisma.bucket.update({
        where: { id: bucket.id },
        data: {
          ...(input.acl && { acl: input.acl }),
          ...(input.versioningEnabled !== undefined && { versioningEnabled: input.versioningEnabled }),
          ...(input.websiteEnabled !== undefined && { websiteEnabled: input.websiteEnabled }),
          ...(input.indexDocument && { indexDocument: input.indexDocument }),
          ...(input.errorDocument && { errorDocument: input.errorDocument }),
        },
      });

      logger.info({ userId: ctx.user.id, bucketName: bucket.name }, 'Bucket configuration updated');

      return {
        success: true,
        bucket: {
          name: updatedBucket.name,
          acl: updatedBucket.acl,
          versioningEnabled: updatedBucket.versioningEnabled,
          websiteEnabled: updatedBucket.websiteEnabled,
          indexDocument: updatedBucket.indexDocument,
          errorDocument: updatedBucket.errorDocument,
        },
        message: 'Bucket configuration updated successfully',
      };
    }),

  /**
   * Get bucket statistics
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const buckets = await prisma.bucket.findMany({
        where: { userId: ctx.user.id },
        select: {
          totalSize: true,
          objectCount: true,
        },
      });

      const totalBuckets = buckets.length;
      const totalObjects = buckets.reduce((sum, b) => sum + b.objectCount, 0);
      const totalSize = buckets.reduce((sum, b) => sum + b.totalSize, BigInt(0));

      const storageUsagePercent = calculateStorageUsagePercent(
        totalSize,
        ctx.user.storageQuota
      );

      return {
        totalBuckets,
        maxBuckets: ctx.user.maxBuckets,
        canCreateMore: totalBuckets < ctx.user.maxBuckets,
        totalObjects,
        totalSize: totalSize.toString(),
        formattedSize: formatBytes(totalSize),
        storageQuota: ctx.user.storageQuota.toString(),
        formattedQuota: formatBytes(ctx.user.storageQuota),
        storageUsagePercent,
      };
    }),

  /**
   * Check if bucket name is available
   */
  checkAvailability: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      const nameValidation = isValidBucketName(input.name);
      if (!nameValidation.valid) {
        return {
          available: false,
          reason: nameValidation.error,
        };
      }

      const existingBucket = await prisma.bucket.findUnique({
        where: { name: input.name },
      });

      return {
        available: !existingBucket,
        reason: existingBucket ? 'Bucket name already taken' : undefined,
      };
    }),
});
