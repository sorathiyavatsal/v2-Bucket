// AWS S3 Client for Frontend
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  region?: string;
}

/**
 * Create an S3 client instance
 */
export function createS3Client(config: S3Config): S3Client {
  const endpoint = config.endpoint || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  return new S3Client({
    region: config.region || 'us-east-1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `${endpoint}/api/s3`,
    forcePathStyle: true, // Required for custom S3-compatible endpoints
  });
}

/**
 * List objects in a bucket
 */
export async function listObjects(
  client: S3Client,
  bucketName: string,
  prefix?: string,
  delimiter?: string
) {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: delimiter,
  });

  const response = await client.send(command);

  return {
    objects: response.Contents || [],
    commonPrefixes: response.CommonPrefixes || [],
    isTruncated: response.IsTruncated || false,
    nextContinuationToken: response.NextContinuationToken,
  };
}

/**
 * Upload a file to a bucket
 */
export async function uploadFile(
  client: S3Client,
  bucketName: string,
  key: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  // Convert File to ArrayBuffer for AWS SDK compatibility
  const arrayBuffer = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: new Uint8Array(arrayBuffer),
    ContentType: file.type,
    ContentLength: file.size,
  });

  // Note: Progress tracking requires additional setup with XMLHttpRequest or fetch
  // For now, we'll just upload the file
  const response = await client.send(command);

  return {
    success: true,
    etag: response.ETag,
    versionId: response.VersionId,
  };
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  client: S3Client,
  bucketName: string,
  files: Array<{ file: File; key: string }>,
  onProgress?: (fileIndex: number, progress: number) => void
) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const { file, key } = files[i];
    const result = await uploadFile(client, bucketName, key, file, (progress) => {
      onProgress?.(i, progress);
    });
    results.push({ key, result });
  }

  return results;
}

/**
 * Get a presigned URL for downloading a file
 */
export async function getDownloadUrl(
  client: S3Client,
  bucketName: string,
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete an object from a bucket
 */
export async function deleteObject(
  client: S3Client,
  bucketName: string,
  key: string
) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);

  return { success: true };
}

/**
 * Delete multiple objects
 */
export async function deleteObjects(
  client: S3Client,
  bucketName: string,
  keys: string[]
) {
  const results = [];

  for (const key of keys) {
    try {
      await deleteObject(client, bucketName, key);
      results.push({ key, success: true });
    } catch (error) {
      results.push({
        key,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

/**
 * Check if a bucket exists and is accessible
 */
export async function checkBucketAccess(
  client: S3Client,
  bucketName: string
): Promise<boolean> {
  try {
    const command = new HeadBucketCommand({
      Bucket: bucketName,
    });
    await client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file extension from key
 */
export function getFileExtension(key: string): string {
  const parts = key.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if a key represents a folder
 */
export function isFolder(key: string): boolean {
  return key.endsWith('/');
}

/**
 * Get the file name from a key (last part of path)
 */
export function getFileName(key: string): string {
  const parts = key.split('/').filter(Boolean);
  return parts[parts.length - 1] || key;
}

/**
 * Get the parent path from a key
 */
export function getParentPath(key: string): string {
  const parts = key.split('/').filter(Boolean);
  parts.pop();
  return parts.length > 0 ? parts.join('/') + '/' : '';
}
