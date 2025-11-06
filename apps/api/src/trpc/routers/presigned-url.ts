// Presigned URL tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
import {
  generatePresignedToken,
  buildPresignedUrl,
  getPresignedUrlSecret,
  validateExpirationDuration,
  calculateExpirationDate,
  generatePresignedUrlId,
  isValidOperation,
} from '../../lib/presigned-url.js';
import { isValidObjectKey } from '../../lib/object-storage.js';

/**
 * Presigned URL Router
 * Manages temporary signed URLs for object access
 */
export const presignedUrlRouter = router({
  /**
   * Generate a presigned URL for GET operation (download)
   */
  generateGetUrl: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      expiresIn: z.number().int().min(1).max(604800).default(3600), // Default 1 hour, max 7 days
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

      // Validate expiration duration
      const expirationValidation = validateExpirationDuration(input.expiresIn);
      if (!expirationValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: expirationValidation.error,
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

      // Verify object exists
      const object = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      if (!object || object.isDeleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Object not found',
        });
      }

      // Calculate expiration date
      const expiresAt = calculateExpirationDate(input.expiresIn);

      // Generate token
      const secret = getPresignedUrlSecret();
      const token = generatePresignedToken({
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'GET',
        expiresAt,
        secret,
      });

      // Generate URL
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
      const url = buildPresignedUrl({
        baseUrl,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'GET',
        token,
        expiresAt,
      });

      // Create presigned URL record
      const presignedUrlId = generatePresignedUrlId();
      await prisma.presignedUrl.create({
        data: {
          id: presignedUrlId,
          bucketId: bucket.id,
          objectKey: input.key,
          operation: 'GET',
          token,
          expiresAt,
          userId: ctx.user.id,
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'GET',
        expiresIn: input.expiresIn,
      }, 'Presigned GET URL generated');

      return {
        success: true,
        url,
        expiresAt,
        expiresIn: input.expiresIn,
        message: 'Presigned GET URL generated successfully',
      };
    }),

  /**
   * Generate a presigned URL for PUT operation (upload)
   */
  generatePutUrl: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      expiresIn: z.number().int().min(1).max(604800).default(3600), // Default 1 hour, max 7 days
      contentType: z.string().optional(),
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

      // Validate expiration duration
      const expirationValidation = validateExpirationDuration(input.expiresIn);
      if (!expirationValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: expirationValidation.error,
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

      // Calculate expiration date
      const expiresAt = calculateExpirationDate(input.expiresIn);

      // Generate token
      const secret = getPresignedUrlSecret();
      const token = generatePresignedToken({
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'PUT',
        expiresAt,
        secret,
      });

      // Generate URL
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
      const url = buildPresignedUrl({
        baseUrl,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'PUT',
        token,
        expiresAt,
      });

      // Create presigned URL record
      const presignedUrlId = generatePresignedUrlId();
      await prisma.presignedUrl.create({
        data: {
          id: presignedUrlId,
          bucketId: bucket.id,
          objectKey: input.key,
          operation: 'PUT',
          token,
          expiresAt,
          userId: ctx.user.id,
          metadata: input.contentType ? { contentType: input.contentType } : {},
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'PUT',
        expiresIn: input.expiresIn,
      }, 'Presigned PUT URL generated');

      return {
        success: true,
        url,
        expiresAt,
        expiresIn: input.expiresIn,
        message: 'Presigned PUT URL generated successfully',
      };
    }),

  /**
   * Generate a presigned URL for DELETE operation
   */
  generateDeleteUrl: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      key: z.string(),
      expiresIn: z.number().int().min(1).max(604800).default(3600), // Default 1 hour, max 7 days
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

      // Validate expiration duration
      const expirationValidation = validateExpirationDuration(input.expiresIn);
      if (!expirationValidation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: expirationValidation.error,
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

      // Verify object exists
      const object = await prisma.object.findUnique({
        where: {
          bucketId_key: {
            bucketId: bucket.id,
            key: input.key,
          },
        },
      });

      if (!object || object.isDeleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Object not found',
        });
      }

      // Calculate expiration date
      const expiresAt = calculateExpirationDate(input.expiresIn);

      // Generate token
      const secret = getPresignedUrlSecret();
      const token = generatePresignedToken({
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'DELETE',
        expiresAt,
        secret,
      });

      // Generate URL
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
      const url = buildPresignedUrl({
        baseUrl,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'DELETE',
        token,
        expiresAt,
      });

      // Create presigned URL record
      const presignedUrlId = generatePresignedUrlId();
      await prisma.presignedUrl.create({
        data: {
          id: presignedUrlId,
          bucketId: bucket.id,
          objectKey: input.key,
          operation: 'DELETE',
          token,
          expiresAt,
          userId: ctx.user.id,
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
        objectKey: input.key,
        operation: 'DELETE',
        expiresIn: input.expiresIn,
      }, 'Presigned DELETE URL generated');

      return {
        success: true,
        url,
        expiresAt,
        expiresIn: input.expiresIn,
        message: 'Presigned DELETE URL generated successfully',
      };
    }),

  /**
   * List presigned URLs for a bucket
   */
  list: protectedProcedure
    .input(z.object({
      bucketName: z.string().optional(),
      includeExpired: z.boolean().default(false),
      maxUrls: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        userId: ctx.user.id,
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

      if (!input.includeExpired) {
        where.expiresAt = { gt: new Date() };
      }

      const presignedUrls = await prisma.presignedUrl.findMany({
        where,
        include: {
          bucket: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: input.maxUrls,
      });

      return {
        bucketName: input.bucketName,
        maxUrls: input.maxUrls,
        includeExpired: input.includeExpired,
        urls: presignedUrls.map(url => ({
          id: url.id,
          bucketName: url.bucket.name,
          objectKey: url.objectKey,
          operation: url.operation,
          expiresAt: url.expiresAt,
          isExpired: new Date() > url.expiresAt,
          usedCount: url.usedCount,
          lastUsedAt: url.lastUsedAt,
          createdAt: url.createdAt,
        })),
      };
    }),

  /**
   * Revoke a presigned URL
   */
  revoke: protectedProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const presignedUrl = await prisma.presignedUrl.findUnique({
        where: { id: input.id },
      });

      if (!presignedUrl || presignedUrl.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Presigned URL not found',
        });
      }

      await prisma.presignedUrl.update({
        where: { id: input.id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        presignedUrlId: input.id,
      }, 'Presigned URL revoked');

      return {
        success: true,
        message: 'Presigned URL revoked successfully',
      };
    }),

  /**
   * Get statistics for presigned URLs
   */
  getStats: protectedProcedure
    .input(z.object({
      bucketName: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        userId: ctx.user.id,
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

      const total = await prisma.presignedUrl.count({ where });

      const active = await prisma.presignedUrl.count({
        where: {
          ...where,
          expiresAt: { gt: new Date() },
          isRevoked: false,
        },
      });

      const expired = await prisma.presignedUrl.count({
        where: {
          ...where,
          expiresAt: { lte: new Date() },
        },
      });

      const revoked = await prisma.presignedUrl.count({
        where: {
          ...where,
          isRevoked: true,
        },
      });

      const totalUsage = await prisma.presignedUrl.aggregate({
        where,
        _sum: {
          usedCount: true,
        },
      });

      return {
        bucketName: input.bucketName,
        total,
        active,
        expired,
        revoked,
        totalUsage: totalUsage._sum.usedCount || 0,
      };
    }),
});
