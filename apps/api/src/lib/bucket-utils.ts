// Bucket Utility Functions
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Validate bucket name according to S3 naming rules
 *
 * Rules:
 * - Between 3 and 63 characters long
 * - Only lowercase letters, numbers, dots (.), and hyphens (-)
 * - Must begin and end with a letter or number
 * - Must not be formatted as an IP address
 * - Must not contain consecutive periods (..)
 * - Must not contain period-dash (.-) or dash-period (-.)
 */
export function isValidBucketName(name: string): { valid: boolean; error?: string } {
  // Length check
  if (name.length < 3 || name.length > 63) {
    return { valid: false, error: 'Bucket name must be between 3 and 63 characters' };
  }

  // Character check
  if (!/^[a-z0-9.-]+$/.test(name)) {
    return { valid: false, error: 'Bucket name can only contain lowercase letters, numbers, dots, and hyphens' };
  }

  // Start and end check
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name)) {
    return { valid: false, error: 'Bucket name must begin and end with a letter or number' };
  }

  // IP address check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
    return { valid: false, error: 'Bucket name must not be formatted as an IP address' };
  }

  // Consecutive periods check
  if (/\.\./.test(name)) {
    return { valid: false, error: 'Bucket name must not contain consecutive periods' };
  }

  // Period-dash or dash-period check
  if (/\.-|-\./.test(name)) {
    return { valid: false, error: 'Bucket name must not contain period-dash or dash-period' };
  }

  return { valid: true };
}

/**
 * Generate physical storage path for a bucket
 * Creates directory structure: {STORAGE_PATH}/{userId}/{bucketName}/
 */
export function generateBucketPath(userId: string, bucketName: string): string {
  const basePath = process.env.STORAGE_PATH || './storage';
  return resolve(basePath, userId, bucketName);
}

/**
 * Ensure bucket directory exists
 * Creates the directory if it doesn't exist
 */
export function ensureBucketDirectory(volumePath: string): void {
  if (!existsSync(volumePath)) {
    mkdirSync(volumePath, { recursive: true });
  }
}

/**
 * Valid S3 regions (subset for now, can be expanded)
 */
export const S3_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
] as const;

export type S3Region = typeof S3_REGIONS[number];

/**
 * Storage classes
 */
export const STORAGE_CLASSES = [
  'STANDARD',
  'REDUCED_REDUNDANCY',
  'STANDARD_IA',
  'ONEZONE_IA',
  'INTELLIGENT_TIERING',
  'GLACIER',
  'DEEP_ARCHIVE',
] as const;

export type StorageClass = typeof STORAGE_CLASSES[number];

/**
 * ACL (Access Control List) options
 */
export const ACL_OPTIONS = [
  'private',
  'public-read',
  'public-read-write',
  'authenticated-read',
] as const;

export type ACL = typeof ACL_OPTIONS[number];

/**
 * Validate storage class
 */
export function isValidStorageClass(storageClass: string): storageClass is StorageClass {
  return STORAGE_CLASSES.includes(storageClass as StorageClass);
}

/**
 * Validate ACL
 */
export function isValidACL(acl: string): acl is ACL {
  return ACL_OPTIONS.includes(acl as ACL);
}

/**
 * Validate region
 */
export function isValidRegion(region: string): region is S3Region {
  return S3_REGIONS.includes(region as S3Region);
}

/**
 * Calculate storage usage percentage
 */
export function calculateStorageUsagePercent(used: bigint, quota: bigint): number {
  if (quota === BigInt(0)) return 0;
  return Number((used * BigInt(100)) / quota);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
