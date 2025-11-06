// Object Storage Utilities
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';

/**
 * Calculate MD5 hash of a file
 */
export async function calculateMD5(filePath: string): Promise<string> {
  const hash = createHash('md5');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

/**
 * Calculate ETag for S3 object (MD5 hash in quotes)
 */
export function generateETag(md5Hash: string): string {
  return `"${md5Hash}"`;
}

/**
 * Generate physical file path for an object
 * Path format: {bucketVolumePath}/{objectKey}
 */
export function generateObjectPath(bucketVolumePath: string, objectKey: string): string {
  return join(bucketVolumePath, objectKey);
}

/**
 * Ensure directory exists for object path
 */
export async function ensureObjectDirectory(objectPath: string): Promise<void> {
  const dir = dirname(objectPath);
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Save file to disk
 */
export async function saveFile(sourcePath: string, destPath: string): Promise<void> {
  await ensureObjectDirectory(destPath);
  await pipeline(
    createReadStream(sourcePath),
    createWriteStream(destPath)
  );
}

/**
 * Delete file from disk
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string) {
  return await fs.stat(filePath);
}

/**
 * Validate object key
 * - Must not be empty
 * - Must not start with /
 * - Max 1024 characters
 */
export function isValidObjectKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.length === 0) {
    return { valid: false, error: 'Object key cannot be empty' };
  }

  if (key.startsWith('/')) {
    return { valid: false, error: 'Object key cannot start with /' };
  }

  if (key.length > 1024) {
    return { valid: false, error: 'Object key cannot exceed 1024 characters' };
  }

  return { valid: true };
}

/**
 * Determine content type from file extension
 */
export function getContentTypeFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Text
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    xml: 'application/xml',

    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',

    // Video
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Generate version ID (simple timestamp-based for now)
 */
export function generateVersionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Parse object key to extract folder structure
 */
export function parseObjectKey(key: string): { folder: string; filename: string } {
  const parts = key.split('/');
  const filename = parts.pop() || '';
  const folder = parts.join('/');
  return { folder, filename };
}
