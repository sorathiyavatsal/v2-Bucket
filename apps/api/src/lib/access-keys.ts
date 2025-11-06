// Access Key Generation Utilities
import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';

/**
 * Generate an AWS-style Access Key ID
 * Format: AKIA followed by 16 random characters (A-Z, 0-9)
 * Example: AKIAIOSFODNN7EXAMPLE
 */
export function generateAccessKeyId(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomPart = Array.from(randomBytes(16))
    .map(byte => charset[byte % charset.length])
    .join('');

  return `AKIA${randomPart}`;
}

/**
 * Generate a Secret Access Key
 * 40 characters: A-Z, a-z, 0-9, +, /
 * Example: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 */
export function generateSecretAccessKey(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const randomPart = Array.from(randomBytes(40))
    .map(byte => charset[byte % charset.length])
    .join('');

  return randomPart;
}

/**
 * Hash a secret access key for storage
 * Uses bcryptjs with 10 rounds
 */
export async function hashSecretKey(secretKey: string): Promise<string> {
  return await hash(secretKey, 10);
}

/**
 * Generate a complete access key pair
 * Returns both the access key ID and secret key (plaintext + hashed)
 */
export async function generateAccessKeyPair(): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  secretKeyHash: string;
}> {
  const accessKeyId = generateAccessKeyId();
  const secretAccessKey = generateSecretAccessKey();
  const secretKeyHash = await hashSecretKey(secretAccessKey);

  return {
    accessKeyId,
    secretAccessKey,
    secretKeyHash,
  };
}

/**
 * Mask a secret access key for display
 * Shows first 4 and last 4 characters, masks the middle
 * Example: wJal...EKEY
 */
export function maskSecretKey(secretKey: string): string {
  if (secretKey.length <= 8) {
    return '****';
  }
  const start = secretKey.substring(0, 4);
  const end = secretKey.substring(secretKey.length - 4);
  return `${start}...${end}`;
}

/**
 * Validate Access Key ID format
 * Must start with AKIA and be 20 characters long
 */
export function isValidAccessKeyIdFormat(accessKeyId: string): boolean {
  return /^AKIA[A-Z0-9]{16}$/.test(accessKeyId);
}

/**
 * Validate Secret Access Key format
 * Must be 40 characters: A-Z, a-z, 0-9, +, /
 */
export function isValidSecretKeyFormat(secretKey: string): boolean {
  return /^[A-Za-z0-9+/]{40}$/.test(secretKey);
}
