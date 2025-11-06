// Authentication tRPC Router
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../init.js';
import { prisma } from '../../lib/db.js';
import { TRPCError } from '@trpc/server';
import { hash, compare } from 'bcryptjs';
import { logger } from '../../lib/logger.js';

/**
 * Authentication Router
 * Handles user registration, login, profile management, and sessions
 */
export const authRouter = router({
  /**
   * Register a new user
   */
  register: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      logger.info({ email: input.email }, 'User registration attempt');

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        logger.warn({ email: input.email }, 'Registration failed: User already exists');
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User with this email already exists',
        });
      }

      // Hash password
      const hashedPassword = await hash(input.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name || null,
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          isAdmin: true,
          isActive: true,
          createdAt: true,
        },
      });

      logger.info({ userId: user.id, email: user.email }, 'User registered successfully');

      return {
        success: true,
        user,
        message: 'Registration successful',
      };
    }),

  /**
   * Login user
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    }))
    .mutation(async ({ input, ctx }) => {
      logger.info({ email: input.email }, 'Login attempt');

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (!user || !user.password) {
        logger.warn({ email: input.email }, 'Login failed: Invalid credentials');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        logger.warn({ email: input.email }, 'Login failed: User account is inactive');
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Account is inactive. Please contact support.',
        });
      }

      // Verify password
      const isValidPassword = await compare(input.password, user.password);

      if (!isValidPassword) {
        logger.warn({ email: input.email }, 'Login failed: Invalid password');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        });
      }

      // Create session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: crypto.randomUUID(),
          expiresAt,
          ipAddress: ctx.clientIp || null,
          userAgent: ctx.userAgent || null,
        },
      });

      logger.info({ userId: user.id, sessionId: session.id }, 'User logged in successfully');

      return {
        success: true,
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          isAdmin: user.isAdmin,
        },
        message: 'Login successful',
      };
    }),

  /**
   * Logout user
   */
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.session) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No active session',
        });
      }

      // Delete session
      await prisma.session.delete({
        where: { id: ctx.session.id },
      });

      logger.info({ userId: ctx.user.id, sessionId: ctx.session.id }, 'User logged out');

      return {
        success: true,
        message: 'Logged out successfully',
      };
    }),

  /**
   * Get current user profile
   */
  me: protectedProcedure
    .query(async ({ ctx }) => {
      return {
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        image: ctx.user.image,
        emailVerified: ctx.user.emailVerified,
        isAdmin: ctx.user.isAdmin,
        isActive: ctx.user.isActive,
        storageQuota: ctx.user.storageQuota.toString(),
        usedStorage: ctx.user.usedStorage.toString(),
        maxBuckets: ctx.user.maxBuckets,
        createdAt: ctx.user.createdAt,
      };
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).optional(),
      image: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const updatedUser = await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          name: input.name,
          image: input.image,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          isAdmin: true,
          createdAt: true,
        },
      });

      logger.info({ userId: ctx.user.id }, 'User profile updated');

      return {
        success: true,
        user: updatedUser,
        message: 'Profile updated successfully',
      };
    }),

  /**
   * Change password
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { password: true },
      });

      if (!user || !user.password) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await compare(input.currentPassword, user.password);

      if (!isValidPassword) {
        logger.warn({ userId: ctx.user.id }, 'Password change failed: Invalid current password');
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const hashedPassword = await hash(input.newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { password: hashedPassword },
      });

      // Invalidate all sessions except current
      await prisma.session.deleteMany({
        where: {
          userId: ctx.user.id,
          id: { not: ctx.session!.id },
        },
      });

      logger.info({ userId: ctx.user.id }, 'Password changed successfully');

      return {
        success: true,
        message: 'Password changed successfully. All other sessions have been logged out.',
      };
    }),

  /**
   * Get user's active sessions
   */
  getSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await prisma.session.findMany({
        where: {
          userId: ctx.user.id,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map(session => ({
        ...session,
        isCurrent: session.id === ctx.session?.id,
      }));
    }),

  /**
   * Revoke a specific session
   */
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string().cuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify session belongs to user
      const session = await prisma.session.findUnique({
        where: { id: input.sessionId },
      });

      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        });
      }

      // Don't allow revoking current session
      if (session.id === ctx.session?.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot revoke current session. Use logout instead.',
        });
      }

      // Delete session
      await prisma.session.delete({
        where: { id: input.sessionId },
      });

      logger.info({ userId: ctx.user.id, sessionId: input.sessionId }, 'Session revoked');

      return {
        success: true,
        message: 'Session revoked successfully',
      };
    }),

  /**
   * Revoke all sessions except current
   */
  revokeAllSessions: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await prisma.session.deleteMany({
        where: {
          userId: ctx.user.id,
          id: { not: ctx.session!.id },
        },
      });

      logger.info({ userId: ctx.user.id, count: result.count }, 'All other sessions revoked');

      return {
        success: true,
        count: result.count,
        message: `${result.count} session(s) revoked successfully`,
      };
    }),
});
