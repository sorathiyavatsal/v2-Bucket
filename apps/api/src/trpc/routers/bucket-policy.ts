// Bucket Policy and CORS tRPC Router
import { z } from 'zod';
import { router, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger.js';
import {
  validateBucketPolicy,
  validateCORSConfiguration,
  createDefaultPolicy,
  createPublicReadPolicy,
  createDefaultCORS,
  policyToJSON,
  policyFromJSON,
  corsToJSON,
  corsFromJSON,
  type BucketPolicy,
  type CORSConfiguration,
} from '../../lib/bucket-policy.js';

/**
 * Bucket Policy and CORS Router
 * Manages access control policies and CORS configurations
 */
export const bucketPolicyRouter = router({
  /**
   * Get bucket policy
   */
  getPolicy: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
        include: { policy: true },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      if (!bucket.policy) {
        return {
          hasPolicy: false,
          policy: null,
        };
      }

      const policy = policyFromJSON(bucket.policy.policyDocument);

      return {
        hasPolicy: true,
        policy,
        policyJson: bucket.policy.policyDocument,
        createdAt: bucket.policy.createdAt,
        updatedAt: bucket.policy.updatedAt,
      };
    }),

  /**
   * Set bucket policy
   */
  setPolicy: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      policy: z.any(), // Will be validated
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate policy
      const validation = validateBucketPolicy(input.policy);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error,
        });
      }

      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const policyDocument = policyToJSON(input.policy);

      // Create or update policy
      await prisma.bucketPolicy.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          policyDocument,
        },
        update: {
          policyDocument,
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'Bucket policy set');

      return {
        success: true,
        message: 'Bucket policy set successfully',
      };
    }),

  /**
   * Delete bucket policy
   */
  deletePolicy: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
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

      await prisma.bucketPolicy.deleteMany({
        where: { bucketId: bucket.id },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'Bucket policy deleted');

      return {
        success: true,
        message: 'Bucket policy deleted successfully',
      };
    }),

  /**
   * Set default private policy
   */
  setPrivatePolicy: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
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

      const policy = createDefaultPolicy(input.bucketName, ctx.user.id);
      const policyDocument = policyToJSON(policy);

      await prisma.bucketPolicy.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          policyDocument,
        },
        update: {
          policyDocument,
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'Private bucket policy set');

      return {
        success: true,
        policy,
        message: 'Private bucket policy set successfully',
      };
    }),

  /**
   * Set public read policy
   */
  setPublicReadPolicy: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
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

      const policy = createPublicReadPolicy(input.bucketName, ctx.user.id);
      const policyDocument = policyToJSON(policy);

      await prisma.bucketPolicy.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          policyDocument,
        },
        update: {
          policyDocument,
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'Public read bucket policy set');

      return {
        success: true,
        policy,
        message: 'Public read bucket policy set successfully',
      };
    }),

  /**
   * Get CORS configuration
   */
  getCORS: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
        include: { corsConfiguration: true },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      if (!bucket.corsConfiguration) {
        return {
          hasCORS: false,
          cors: null,
        };
      }

      const cors = corsFromJSON(bucket.corsConfiguration.configuration);

      return {
        hasCORS: true,
        cors,
        corsJson: bucket.corsConfiguration.configuration,
        createdAt: bucket.corsConfiguration.createdAt,
        updatedAt: bucket.corsConfiguration.updatedAt,
      };
    }),

  /**
   * Set CORS configuration
   */
  setCORS: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
      cors: z.any(), // Will be validated
    }))
    .mutation(async ({ input, ctx }) => {
      // Validate CORS
      const validation = validateCORSConfiguration(input.cors);
      if (!validation.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error,
        });
      }

      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      const corsDocument = corsToJSON(input.cors);

      // Create or update CORS
      await prisma.bucketCorsConfiguration.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          configuration: corsDocument,
        },
        update: {
          configuration: corsDocument,
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'CORS configuration set');

      return {
        success: true,
        message: 'CORS configuration set successfully',
      };
    }),

  /**
   * Delete CORS configuration
   */
  deleteCORS: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
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

      await prisma.bucketCorsConfiguration.deleteMany({
        where: { bucketId: bucket.id },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'CORS configuration deleted');

      return {
        success: true,
        message: 'CORS configuration deleted successfully',
      };
    }),

  /**
   * Set default CORS configuration
   */
  setDefaultCORS: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
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

      const cors = createDefaultCORS();
      const corsDocument = corsToJSON(cors);

      await prisma.bucketCorsConfiguration.upsert({
        where: { bucketId: bucket.id },
        create: {
          bucketId: bucket.id,
          configuration: corsDocument,
        },
        update: {
          configuration: corsDocument,
          updatedAt: new Date(),
        },
      });

      logger.info({
        userId: ctx.user.id,
        bucketName: input.bucketName,
      }, 'Default CORS configuration set');

      return {
        success: true,
        cors,
        message: 'Default CORS configuration set successfully',
      };
    }),

  /**
   * Get policy and CORS status for a bucket
   */
  getStatus: protectedProcedure
    .input(z.object({
      bucketName: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const bucket = await prisma.bucket.findUnique({
        where: { name: input.bucketName },
        include: {
          policy: true,
          corsConfiguration: true,
        },
      });

      if (!bucket || bucket.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bucket not found',
        });
      }

      return {
        bucketName: bucket.name,
        hasPolicy: !!bucket.policy,
        hasCORS: !!bucket.corsConfiguration,
        policyUpdatedAt: bucket.policy?.updatedAt,
        corsUpdatedAt: bucket.corsConfiguration?.updatedAt,
      };
    }),
});
