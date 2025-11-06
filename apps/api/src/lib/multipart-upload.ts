// Multipart Upload Utilities
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, dirname } from 'path';
import { pipeline } from 'stream/promises';

/**
 * Generate upload ID for multipart upload
 * Format: timestamp-randomstring
 */
export function generateUploadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Get temporary directory for multipart upload parts
 */
export function getMultipartTempDir(uploadId: string): string {
  const tempBase = process.env.TEMP_PATH || './temp';
  return join(tempBase, 'multipart', uploadId);
}

/**
 * Get path for a specific part file
 */
export function getPartFilePath(uploadId: string, partNumber: number): string {
  const tempDir = getMultipartTempDir(uploadId);
  return join(tempDir, `part-${partNumber}`);
}

/**
 * Ensure multipart temp directory exists
 */
export async function ensureMultipartTempDir(uploadId: string): Promise<void> {
  const tempDir = getMultipartTempDir(uploadId);
  await fs.mkdir(tempDir, { recursive: true });
}

/**
 * Save a part file
 */
export async function savePart(
  uploadId: string,
  partNumber: number,
  sourceFilePath: string
): Promise<{ size: number; etag: string }> {
  await ensureMultipartTempDir(uploadId);

  const partPath = getPartFilePath(uploadId, partNumber);

  // Copy file to part location
  await pipeline(
    createReadStream(sourceFilePath),
    createWriteStream(partPath)
  );

  // Calculate MD5 for ETag
  const hash = createHash('md5');
  const stream = createReadStream(partPath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  const md5 = hash.digest('hex');
  const etag = `"${md5}"`;

  // Get file size
  const stats = await fs.stat(partPath);

  return {
    size: stats.size,
    etag,
  };
}

/**
 * Combine all parts into final file
 */
export async function combineParts(
  uploadId: string,
  partNumbers: number[],
  destPath: string
): Promise<{ size: number; etag: string }> {
  // Ensure destination directory exists
  const destDir = dirname(destPath);
  await fs.mkdir(destDir, { recursive: true });

  // Sort part numbers to ensure correct order
  const sortedParts = [...partNumbers].sort((a, b) => a - b);

  // Create write stream for destination
  const writeStream = createWriteStream(destPath);
  const hash = createHash('md5');
  let totalSize = 0;

  try {
    for (const partNumber of sortedParts) {
      const partPath = getPartFilePath(uploadId, partNumber);

      // Check if part exists
      try {
        await fs.access(partPath);
      } catch {
        throw new Error(`Part ${partNumber} not found`);
      }

      // Read part and write to destination
      const partStream = createReadStream(partPath);

      for await (const chunk of partStream) {
        hash.update(chunk);
        writeStream.write(chunk);
        totalSize += chunk.length;
      }
    }

    // Close write stream
    await new Promise((resolve, reject) => {
      writeStream.end((err: Error | null) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    // Calculate final ETag
    const md5 = hash.digest('hex');
    const etag = `"${md5}-${sortedParts.length}"`;

    return {
      size: totalSize,
      etag,
    };
  } catch (error) {
    // Clean up destination file on error
    try {
      await fs.unlink(destPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Clean up multipart upload temp directory
 */
export async function cleanupMultipartUpload(uploadId: string): Promise<void> {
  const tempDir = getMultipartTempDir(uploadId);

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error: any) {
    // Ignore errors if directory doesn't exist
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * List all parts for an upload
 */
export async function listParts(uploadId: string): Promise<Array<{ partNumber: number; size: number; etag: string }>> {
  const tempDir = getMultipartTempDir(uploadId);

  try {
    const files = await fs.readdir(tempDir);
    const parts = [];

    for (const file of files) {
      const match = file.match(/^part-(\d+)$/);
      if (match) {
        const partNumber = parseInt(match[1], 10);
        const partPath = join(tempDir, file);
        const stats = await fs.stat(partPath);

        // Calculate MD5 for ETag
        const hash = createHash('md5');
        const stream = createReadStream(partPath);

        for await (const chunk of stream) {
          hash.update(chunk);
        }

        const md5 = hash.digest('hex');
        const etag = `"${md5}"`;

        parts.push({
          partNumber,
          size: stats.size,
          etag,
        });
      }
    }

    return parts.sort((a, b) => a.partNumber - b.partNumber);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Validate part number
 * Part numbers must be between 1 and 10000
 */
export function isValidPartNumber(partNumber: number): boolean {
  return partNumber >= 1 && partNumber <= 10000 && Number.isInteger(partNumber);
}

/**
 * Validate part size
 * Parts must be at least 5MB except for the last part
 * Maximum part size is 5GB
 */
export function isValidPartSize(size: number, isLastPart: boolean): { valid: boolean; error?: string } {
  const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB
  const MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

  if (size > MAX_PART_SIZE) {
    return {
      valid: false,
      error: `Part size exceeds maximum of 5GB`,
    };
  }

  if (!isLastPart && size < MIN_PART_SIZE) {
    return {
      valid: false,
      error: `Part size must be at least 5MB (except for the last part)`,
    };
  }

  return { valid: true };
}

/**
 * Calculate total size from parts
 */
export async function calculateTotalSize(uploadId: string, partNumbers: number[]): Promise<number> {
  let totalSize = 0;

  for (const partNumber of partNumbers) {
    const partPath = getPartFilePath(uploadId, partNumber);
    try {
      const stats = await fs.stat(partPath);
      totalSize += stats.size;
    } catch {
      throw new Error(`Part ${partNumber} not found`);
    }
  }

  return totalSize;
}

/**
 * Verify all required parts exist
 */
export async function verifyParts(uploadId: string, partNumbers: number[]): Promise<boolean> {
  for (const partNumber of partNumbers) {
    const partPath = getPartFilePath(uploadId, partNumber);
    try {
      await fs.access(partPath);
    } catch {
      return false;
    }
  }
  return true;
}
