// Access Key tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
import { generateAccessKeyPair, maskSecretKey } from '../../lib/access-keys.js';

/**
 * Access Key Router
 * Manages AWS-style access keys for S3 API authentication
 */
export const accessKeyRouter = router({
  /**
   * Create a new access key
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      logger.info({ userId: ctx.user.id }, 'Creating access key');

      // Check if user has reached maximum number of access keys (limit to 10)
      const existingKeysCount = await prisma.accessKey.count({
        where: {
          userId: ctx.user.id,
          isActive: true,
        },
      });

      if (existingKeysCount >= 10) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maximum number of access keys (10) reached. Please delete an existing key first.',
        });
      }

      // Generate access key pair
      const { accessKeyId, secretAccessKey, secretKeyHash } = await generateAccessKeyPair();

      // Create access key in database
      const accessKey = await prisma.accessKey.create({
        data: {
          userId: ctx.user.id,
          accessKeyId,
          secretKeyHash,
          name: input.name || `Access Key ${new Date().toISOString().split('T')[0]}`,
          expiresAt: input.expiresAt || null,
          isActive: true,
        },
      });

      logger.info({ userId: ctx.user.id, accessKeyId }, 'Access key created');

      return {
        success: true,
        accessKey: {
          id: accessKey.id,
          accessKeyId: accessKey.accessKeyId,
          secretAccessKey, // Only returned on creation!
          name: accessKey.name,
          isActive: accessKey.isActive,
          expiresAt: accessKey.expiresAt,
          createdAt: accessKey.createdAt,
        },
        message: 'Access key created successfully. Save the secret key now - it will not be shown again!',
      };
    }),

  /**
   * List all access keys for the current user
   */
  list: protectedProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
    }))
    .query(async ({ input, ctx }) => {
      const accessKeys = await prisma.accessKey.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        select: {
          id: true,
          accessKeyId: true,
          name: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return accessKeys;
    }),

  /**
   * Get a specific access key by ID
   */
  get: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ input, ctx }) => {
      const accessKey = await prisma.accessKey.findUnique({
        where: { id: input.id },
      });

      if (!accessKey || accessKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Access key not found',
        });
      }

      return {
        id: accessKey.id,
        accessKeyId: accessKey.accessKeyId,
        name: accessKey.name,
        isActive: accessKey.isActive,
        lastUsedAt: accessKey.lastUsedAt,
        expiresAt: accessKey.expiresAt,
        createdAt: accessKey.createdAt,
      };
    }),

  /**
   * Update access key name
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify access key belongs to user
      const accessKey = await prisma.accessKey.findUnique({
        where: { id: input.id },
      });

      if (!accessKey || accessKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Access key not found',
        });
      }

      // Update access key
      const updatedKey = await prisma.accessKey.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      logger.info({ userId: ctx.user.id, accessKeyId: updatedKey.accessKeyId }, 'Access key updated');

      return {
        success: true,
        accessKey: {
          id: updatedKey.id,
          accessKeyId: updatedKey.accessKeyId,
          name: updatedKey.name,
          isActive: updatedKey.isActive,
          expiresAt: updatedKey.expiresAt,
          createdAt: updatedKey.createdAt,
        },
        message: 'Access key updated successfully',
      };
    }),

  /**
   * Activate an access key
   */
  activate: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify access key belongs to user
      const accessKey = await prisma.accessKey.findUnique({
        where: { id: input.id },
      });

      if (!accessKey || accessKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Access key not found',
        });
      }

      if (accessKey.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Access key is already active',
        });
      }

      // Activate access key
      await prisma.accessKey.update({
        where: { id: input.id },
        data: { isActive: true },
      });

      logger.info({ userId: ctx.user.id, accessKeyId: accessKey.accessKeyId }, 'Access key activated');

      return {
        success: true,
        message: 'Access key activated successfully',
      };
    }),

  /**
   * Deactivate an access key
   */
  deactivate: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify access key belongs to user
      const accessKey = await prisma.accessKey.findUnique({
        where: { id: input.id },
      });

      if (!accessKey || accessKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Access key not found',
        });
      }

      if (!accessKey.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Access key is already inactive',
        });
      }

      // Deactivate access key
      await prisma.accessKey.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      logger.info({ userId: ctx.user.id, accessKeyId: accessKey.accessKeyId }, 'Access key deactivated');

      return {
        success: true,
        message: 'Access key deactivated successfully',
      };
    }),

  /**
   * Delete an access key
   */
  delete: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify access key belongs to user
      const accessKey = await prisma.accessKey.findUnique({
        where: { id: input.id },
      });

      if (!accessKey || accessKey.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Access key not found',
        });
      }

      // Delete access key
      await prisma.accessKey.delete({
        where: { id: input.id },
      });

      logger.info({ userId: ctx.user.id, accessKeyId: accessKey.accessKeyId }, 'Access key deleted');

      return {
        success: true,
        message: 'Access key deleted successfully',
      };
    }),

  /**
   * Get usage statistics for all access keys
   */
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const keys = await prisma.accessKey.findMany({
        where: { userId: ctx.user.id },
        select: {
          id: true,
          accessKeyId: true,
          name: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
        },
      });

      const total = keys.length;
      const active = keys.filter(k => k.isActive).length;
      const inactive = total - active;
      const neverUsed = keys.filter(k => !k.lastUsedAt).length;
      const recentlyUsed = keys.filter(k =>
        k.lastUsedAt && (new Date().getTime() - k.lastUsedAt.getTime()) < 7 * 24 * 60 * 60 * 1000
      ).length;

      return {
        total,
        active,
        inactive,
        neverUsed,
        recentlyUsed,
        maxAllowed: 10,
        canCreateMore: active < 10,
      };
    }),
});
