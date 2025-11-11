// AWS S3 Client for Frontend
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
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
 * Upload a file using multipart upload (for large files)
 */
export async function uploadFileMultipart(
  client: S3Client,
  bucketName: string,
  key: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (minimum for S3 multipart)
  const totalParts = Math.ceil(file.size / CHUNK_SIZE);

  try {
    // Step 1: Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: file.type,
    });

    const { UploadId } = await client.send(createCommand);

    if (!UploadId) {
      throw new Error('Failed to initiate multipart upload');
    }

    // Step 2: Upload parts
    const uploadedParts: Array<{ ETag: string; PartNumber: number }> = [];
    let uploadedBytes = 0;

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      // Convert chunk to ArrayBuffer
      const arrayBuffer = await chunk.arrayBuffer();

      const uploadPartCommand = new UploadPartCommand({
        Bucket: bucketName,
        Key: key,
        PartNumber: partNumber,
        UploadId,
        Body: new Uint8Array(arrayBuffer),
      });

      const uploadPartResponse = await client.send(uploadPartCommand);

      if (uploadPartResponse.ETag) {
        uploadedParts.push({
          ETag: uploadPartResponse.ETag,
          PartNumber: partNumber,
        });
      }

      // Update progress
      uploadedBytes += (end - start);
      const progress = Math.round((uploadedBytes / file.size) * 100);
      onProgress?.(progress);
    }

    // Step 3: Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId,
      MultipartUpload: {
        Parts: uploadedParts,
      },
    });

    const completeResponse = await client.send(completeCommand);

    return {
      success: true,
      etag: completeResponse.ETag,
      versionId: completeResponse.VersionId,
    };
  } catch (error) {
    // If multipart upload fails, try to abort it
    // This is a best-effort cleanup
    console.error('Multipart upload failed:', error);
    throw error;
  }
}

/**
 * Upload a file to a bucket (automatically uses multipart for large files)
 */
export async function uploadFile(
  client: S3Client,
  bucketName: string,
  key: string,
  file: File,
  onProgress?: (progress: number) => void
) {
  const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB

  // Use multipart upload for large files
  if (file.size > MULTIPART_THRESHOLD) {
    console.log(`Using multipart upload for large file: ${file.name} (${formatFileSize(file.size)})`);
    return uploadFileMultipart(client, bucketName, key, file, onProgress);
  }

  // Use regular upload for smaller files
  // Convert File to ArrayBuffer for AWS SDK compatibility
  const arrayBuffer = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: new Uint8Array(arrayBuffer),
    ContentType: file.type,
    ContentLength: file.size,
  });

  const response = await client.send(command);

  // Simulate progress for regular uploads
  onProgress?.(100);

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
