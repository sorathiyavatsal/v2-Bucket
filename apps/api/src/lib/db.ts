// Database connection management
import { prisma } from '@repo/database';
import { logger } from './logger.js';
import { ServiceUnavailableError } from './errors.js';

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection failed');
    return false;
  }
}

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    const isHealthy = await testDatabaseConnection();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize database');
    throw new ServiceUnavailableError('Database connection failed');
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from database');
  }
}

/**
 * Get database health status
 */
export async function getDatabaseHealth(): Promise<{
  connected: boolean;
  responseTime?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return {
      connected: true,
      responseTime,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { prisma };
