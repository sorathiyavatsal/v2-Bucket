// Redis connection management
import { createClient } from 'redis';
import { logger } from './logger.js';
import { ServiceUnavailableError } from './errors.js';

// Create Redis client
export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: false, // Disable auto reconnect for now
  },
});

// Error handling
redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redis.on('connect', () => {
  logger.info('Redis connecting...');
});

redis.on('ready', () => {
  logger.info('✅ Redis ready');
});

redis.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

redis.on('end', () => {
  logger.info('Redis connection closed');
});

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  try {
    if (!redis.isOpen) {
      await redis.connect();
      logger.info('Redis connected');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Redis');
    throw new ServiceUnavailableError('Redis connection failed');
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  try {
    if (redis.isOpen) {
      await redis.quit();
      logger.info('Redis disconnected');
    }
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from Redis');
  }
}

/**
 * Get Redis health status
 */
export async function getRedisHealth(): Promise<{
  connected: boolean;
  responseTime?: number;
  error?: string;
}> {
  try {
    if (!redis.isOpen) {
      return {
        connected: false,
        error: 'Redis not connected',
      };
    }

    const start = Date.now();
    await redis.ping();
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

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    if (!redis.isOpen) {
      await redis.connect();
    }
    const result = await redis.ping();
    logger.info('✅ Redis connection successful:', result);
    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Redis connection failed');
    return false;
  }
}
