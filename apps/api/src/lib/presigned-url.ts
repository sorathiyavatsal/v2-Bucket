// Presigned URL Utilities
import { createHmac } from 'crypto';

/**
 * Generate a presigned URL token
 * Uses HMAC-SHA256 signing
 */
export function generatePresignedToken(data: {
  bucketName: string;
  objectKey: string;
  operation: 'GET' | 'PUT' | 'DELETE';
  expiresAt: Date;
  secret: string;
}): string {
  const payload = `${data.bucketName}:${data.objectKey}:${data.operation}:${data.expiresAt.getTime()}`;

  const hmac = createHmac('sha256', data.secret);
  hmac.update(payload);

  return hmac.digest('hex');
}

/**
 * Verify a presigned URL token
 */
export function verifyPresignedToken(data: {
  bucketName: string;
  objectKey: string;
  operation: 'GET' | 'PUT' | 'DELETE';
  expiresAt: Date;
  token: string;
  secret: string;
}): boolean {
  const expectedToken = generatePresignedToken({
    bucketName: data.bucketName,
    objectKey: data.objectKey,
    operation: data.operation,
    expiresAt: data.expiresAt,
    secret: data.secret,
  });

  return data.token === expectedToken;
}

/**
 * Build presigned URL
 */
export function buildPresignedUrl(data: {
  baseUrl: string;
  bucketName: string;
  objectKey: string;
  operation: 'GET' | 'PUT' | 'DELETE';
  token: string;
  expiresAt: Date;
}): string {
  const url = new URL(`${data.baseUrl}/presigned/${data.bucketName}/${data.objectKey}`);

  url.searchParams.set('operation', data.operation);
  url.searchParams.set('token', data.token);
  url.searchParams.set('expires', data.expiresAt.getTime().toString());

  return url.toString();
}

/**
 * Parse presigned URL parameters
 */
export function parsePresignedUrl(url: string): {
  bucketName: string;
  objectKey: string;
  operation: 'GET' | 'PUT' | 'DELETE';
  token: string;
  expiresAt: Date;
} | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);

    // Expected format: /presigned/{bucketName}/{objectKey}
    if (pathParts[0] !== 'presigned' || pathParts.length < 3) {
      return null;
    }

    const bucketName = pathParts[1];
    const objectKey = pathParts.slice(2).join('/');

    const operation = urlObj.searchParams.get('operation') as 'GET' | 'PUT' | 'DELETE';
    const token = urlObj.searchParams.get('token');
    const expiresStr = urlObj.searchParams.get('expires');

    if (!operation || !token || !expiresStr) {
      return null;
    }

    const expiresAt = new Date(parseInt(expiresStr, 10));

    return {
      bucketName,
      objectKey,
      operation,
      token,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Check if presigned URL is expired
 */
export function isPresignedUrlExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Validate expiration duration
 * Max: 7 days (604800 seconds)
 * Min: 1 second
 */
export function validateExpirationDuration(seconds: number): { valid: boolean; error?: string } {
  const MAX_EXPIRATION = 7 * 24 * 60 * 60; // 7 days
  const MIN_EXPIRATION = 1;

  if (seconds < MIN_EXPIRATION) {
    return {
      valid: false,
      error: 'Expiration duration must be at least 1 second',
    };
  }

  if (seconds > MAX_EXPIRATION) {
    return {
      valid: false,
      error: 'Expiration duration cannot exceed 7 days (604800 seconds)',
    };
  }

  return { valid: true };
}

/**
 * Calculate expiration date from duration
 */
export function calculateExpirationDate(durationSeconds: number): Date {
  const now = new Date();
  return new Date(now.getTime() + durationSeconds * 1000);
}

/**
 * Generate unique presigned URL ID for tracking
 */
export function generatePresignedUrlId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `psu_${timestamp}_${random}`;
}

/**
 * Get presigned URL secret from environment
 */
export function getPresignedUrlSecret(): string {
  return process.env.PRESIGNED_URL_SECRET || process.env.AUTH_SECRET || 'default-secret-change-in-production';
}

/**
 * Validate operation type
 */
export function isValidOperation(operation: string): operation is 'GET' | 'PUT' | 'DELETE' {
  return ['GET', 'PUT', 'DELETE'].includes(operation);
}
