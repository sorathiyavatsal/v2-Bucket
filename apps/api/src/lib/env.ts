// Environment Variable Validation
import { logger } from './logger.js';

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  AUTH_SECRET?: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: string;
}

/**
 * Validate and parse environment variables
 */
export function validateEnv(): EnvConfig {
  const errors: string[] = [];

  // Required variables
  const requiredVars = [
    'DATABASE_URL',
   'REDIS_URL',
  ];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'development';
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(nodeEnv)) {
    errors.push(`Invalid NODE_ENV: ${nodeEnv}. Must be one of: ${validEnvs.join(', ')}`);
  }

  // Validate PORT
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
  }

  // Warn about production without AUTH_SECRET
  if (nodeEnv === 'production' && !process.env.AUTH_SECRET) {
    logger.warn('AUTH_SECRET not set in production environment');
  }

  if (errors.length > 0) {
    logger.error({ errors }, 'Environment validation failed');
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  const config: EnvConfig = {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    AUTH_SECRET: process.env.AUTH_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };

  logger.info({
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    CORS_ORIGIN: config.CORS_ORIGIN,
    LOG_LEVEL: config.LOG_LEVEL,
  }, 'Environment validated successfully');

  return config;
}

/**
 * Get current environment
 */
export function getEnv(): EnvConfig {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    AUTH_SECRET: process.env.AUTH_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}
