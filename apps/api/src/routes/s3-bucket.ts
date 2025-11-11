// S3 Bucket API Routes
import { Hono } from 'hono';
import type { AppEnv } from '../types/hono.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { s3AuthMiddleware } from '../middleware/s3-auth.js';
import {
  buildErrorXml,
  buildListObjectsXml,
  buildLocationConstraintXml,
  buildListBucketsXml,
  S3ErrorCodes,
} from '../lib/s3-xml.js';
import {
  isValidBucketName,
  generateBucketPath,
  ensureBucketDirectory,
} from '../lib/bucket-utils.js';
import { policyFromJSON } from '../lib/bucket-policy.js';
import { corsFromJSON } from '../lib/bucket-policy.js';

/**
 * Register S3 bucket routes directly on the main app
 */
export function registerS3BucketRoutes(app: Hono<AppEnv>) {

// Debug: Log when routes are registered
console.log('🔧 s3-bucket.ts: Registering routes...');

/**
 * List all buckets handler (shared between routes)
 */
const handleListBuckets = async (c: any) => {
  console.log('📍 ROOT ROUTE HIT: /api/s3 or /s3');
  try {
    const user = c.get('user');

    const buckets = await prisma.bucket.findMany({
      where: { userId: user.id },
      select: {
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const xml = buildListBucketsXml(buckets, {
      id: user.id,
      displayName: user.name || user.email,
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'List buckets error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
};

/**
 * List all buckets - GET /api/s3/
 */
app.get('/api/s3', s3AuthMiddleware, handleListBuckets);

/**
 * List all buckets - GET /s3/ (alias without /api prefix for Tailscale Serve path stripping)
 */
app.get('/s3', s3AuthMiddleware, handleListBuckets);

/**
 * Check if bucket exists handler (shared between routes)
 */
const handleHeadBucket = async (c: any) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket) {
      return c.text('', 404);
    }

    if (bucket.userId !== user.id) {
      return c.text('', 403);
    }

    return c.text('', 200, {
      'x-amz-bucket-region': bucket.region,
    });
  } catch (error) {
    logger.error({ error }, 'Head bucket error');
    return c.text('', 500);
  }
};

/**
 * Check if bucket exists - HEAD /{bucket}
 * Note: This route is NOT under /api/s3 because it's directly at bucket path
 */
app.on('HEAD', '/:bucket', s3AuthMiddleware, handleHeadBucket);

/**
 * List bucket contents or get bucket configuration - GET /{bucket}
 * Note: AWS SDK with forcePathStyle may send requests with trailing slash
 * We handle both /:bucket and /:bucket/ by extracting the logic into a shared handler
 */
const handleBucketRequest = async (c: any) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    logger.debug({ bucketName, path: c.req.path, url: c.req.url }, 'S3 Bucket GET route handler');

    // Get bucket
    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (!bucket) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchBucket,
        'The specified bucket does not exist',
        `/${bucketName}`
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (bucket.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    // Check query parameters
    const url = new URL(c.req.url);

    // GET /{bucket}?location - Get bucket region
    if (url.searchParams.has('location')) {
      const xml = buildLocationConstraintXml(bucket.region);
      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // GET /{bucket}?versioning - Get versioning status
    if (url.searchParams.has('versioning')) {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
      xml += `  <Status>${bucket.versioningEnabled ? 'Enabled' : 'Suspended'}</Status>\n`;
      if (bucket.mfaDelete) {
        xml += '  <MfaDelete>Enabled</MfaDelete>\n';
      }
      xml += '</VersioningConfiguration>';
      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // GET /{bucket}?policy - Get bucket policy
    if (url.searchParams.has('policy')) {
      if (!bucket.policy) {
        const xml = buildErrorXml(
          'NoSuchBucketPolicy',
          'The bucket policy does not exist'
        );
        return c.text(xml, 404, {
          'Content-Type': 'application/xml',
        });
      }
      // bucket.policy is a JSON field, not a relation
      return c.json(policyFromJSON(bucket.policy as any));
    }

    // GET /{bucket}?cors - Get CORS configuration
    if (url.searchParams.has('cors')) {
      if (!bucket.corsRules) {
        const xml = buildErrorXml(
          'NoSuchCORSConfiguration',
          'The CORS configuration does not exist'
        );
        return c.text(xml, 404, {
          'Content-Type': 'application/xml',
        });
      }

      // bucket.corsRules is a JSON field, not a relation
      const cors = corsFromJSON(bucket.corsRules as any);

      // Build CORS XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
      for (const rule of cors.rules) {
        xml += '  <CORSRule>\n';
        for (const origin of rule.allowedOrigins) {
          xml += `    <AllowedOrigin>${origin}</AllowedOrigin>\n`;
        }
        for (const method of rule.allowedMethods) {
          xml += `    <AllowedMethod>${method}</AllowedMethod>\n`;
        }
        if (rule.allowedHeaders) {
          for (const header of rule.allowedHeaders) {
            xml += `    <AllowedHeader>${header}</AllowedHeader>\n`;
          }
        }
        if (rule.exposeHeaders) {
          for (const header of rule.exposeHeaders) {
            xml += `    <ExposeHeader>${header}</ExposeHeader>\n`;
          }
        }
        if (rule.maxAgeSeconds !== undefined) {
          xml += `    <MaxAgeSeconds>${rule.maxAgeSeconds}</MaxAgeSeconds>\n`;
        }
        xml += '  </CORSRule>\n';
      }
      xml += '</CORSConfiguration>';

      return c.text(xml, 200, {
        'Content-Type': 'application/xml',
      });
    }

    // Default: List bucket contents (ListObjectsV2)
    const prefix = url.searchParams.get('prefix') || '';
    const delimiter = url.searchParams.get('delimiter') || undefined;
    const maxKeysParam = url.searchParams.get('max-keys');
    const maxKeys = maxKeysParam ? Math.min(parseInt(maxKeysParam, 10), 1000) : 1000;
    const marker = url.searchParams.get('marker') || undefined;
    const startAfter = url.searchParams.get('start-after') || undefined;

    // Build where clause
    const where: any = {
      bucketId: bucket.id,
      isDeleted: false,
    };

    if (prefix) {
      where.key = { startsWith: prefix };
    }

    if (startAfter) {
      where.key = { ...where.key, gt: startAfter };
    } else if (marker) {
      where.key = { ...where.key, gt: marker };
    }

    // Fetch objects
    const objects = await prisma.object.findMany({
      where,
      select: {
        key: true,
        size: true,
        etag: true,
        storageClass: true,
        updatedAt: true,
      },
      orderBy: { key: 'asc' },
      take: maxKeys + 1, // Fetch one extra to check if truncated
    });

    const isTruncated = objects.length > maxKeys;
    const contents = objects.slice(0, maxKeys);

    // Handle delimiter (common prefixes)
    let commonPrefixes: string[] | undefined;
    if (delimiter) {
      const prefixes = new Set<string>();
      const filteredContents: typeof contents = [];

      for (const obj of contents) {
        const keyAfterPrefix = obj.key.substring(prefix.length);
        const delimiterIndex = keyAfterPrefix.indexOf(delimiter);

        if (delimiterIndex !== -1) {
          // This object is in a "subdirectory"
          const commonPrefix = prefix + keyAfterPrefix.substring(0, delimiterIndex + 1);
          prefixes.add(commonPrefix);
        } else {
          // This object is at the current level
          filteredContents.push(obj);
        }
      }

      commonPrefixes = Array.from(prefixes).sort();
      contents.length = 0;
      contents.push(...filteredContents);
    }

    const xml = buildListObjectsXml({
      bucketName: bucket.name,
      prefix: prefix || undefined,
      marker: marker || startAfter,
      maxKeys,
      delimiter,
      isTruncated,
      nextMarker: isTruncated ? contents[contents.length - 1]?.key : undefined,
      contents: contents.map(obj => ({
        key: obj.key,
        lastModified: obj.updatedAt,
        etag: obj.etag,
        size: obj.size,
        storageClass: obj.storageClass,
      })),
      commonPrefixes,
    });

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
    });
  } catch (error) {
    logger.error({ error }, 'Get bucket error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
};

// Register the handler for both /api/s3/:bucket and /api/s3/:bucket/
// AWS SDK with forcePathStyle sends requests with trailing slash
console.log('🔧 s3-bucket.ts: Registering GET /api/s3/:bucket');
app.get('/api/s3/:bucket', s3AuthMiddleware, async (c) => {
  console.log('📍 BUCKET ROUTE HIT (no slash):', c.req.param('bucket'), c.req.path);
  logger.debug({ bucket: c.req.param('bucket'), path: c.req.path }, 'BUCKET ROUTE (no slash) MATCHED');
  return handleBucketRequest(c);
});

console.log('🔧 s3-bucket.ts: Registering GET /api/s3/:bucket/');
app.get('/api/s3/:bucket/', s3AuthMiddleware, async (c) => {
  console.log('📍 BUCKET ROUTE HIT (with slash):', c.req.param('bucket'), c.req.path);
  logger.debug({ bucket: c.req.param('bucket'), path: c.req.path }, 'BUCKET ROUTE (with slash) MATCHED');
  return handleBucketRequest(c);
});

// Aliases without /api prefix for Tailscale Serve path stripping
console.log('🔧 s3-bucket.ts: Registering GET /s3/:bucket (alias)');
app.get('/s3/:bucket', s3AuthMiddleware, async (c) => {
  console.log('📍 BUCKET ROUTE HIT (no slash, alias):', c.req.param('bucket'), c.req.path);
  logger.debug({ bucket: c.req.param('bucket'), path: c.req.path }, 'BUCKET ROUTE (no slash, alias) MATCHED');
  return handleBucketRequest(c);
});

console.log('🔧 s3-bucket.ts: Registering GET /s3/:bucket/ (alias)');
app.get('/s3/:bucket/', s3AuthMiddleware, async (c) => {
  console.log('📍 BUCKET ROUTE HIT (with slash, alias):', c.req.param('bucket'), c.req.path);
  logger.debug({ bucket: c.req.param('bucket'), path: c.req.path }, 'BUCKET ROUTE (with slash, alias) MATCHED');
  return handleBucketRequest(c);
});

/**
 * Create bucket handler (shared between routes)
 */
const handleCreateBucket = async (c: any) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    // Validate bucket name
    const nameValidation = isValidBucketName(bucketName);
    if (!nameValidation.valid) {
      const xml = buildErrorXml(
        S3ErrorCodes.InvalidBucketName,
        nameValidation.error || 'Invalid bucket name'
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    // Check if bucket already exists
    const existingBucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
    });

    if (existingBucket) {
      if (existingBucket.userId === user.id) {
        const xml = buildErrorXml(
          S3ErrorCodes.BucketAlreadyOwnedByYou,
          'Your previous request to create the named bucket succeeded and you already own it.'
        );
        return c.text(xml, 409, {
          'Content-Type': 'application/xml',
        });
      } else {
        const xml = buildErrorXml(
          S3ErrorCodes.BucketAlreadyExists,
          'The requested bucket name is not available.'
        );
        return c.text(xml, 409, {
          'Content-Type': 'application/xml',
        });
      }
    }

    // Check max buckets limit
    const userBucketCount = await prisma.bucket.count({
      where: { userId: user.id },
    });

    if (userBucketCount >= user.maxBuckets) {
      const xml = buildErrorXml(
        'TooManyBuckets',
        `You have attempted to create more buckets than allowed. Maximum: ${user.maxBuckets}`
      );
      return c.text(xml, 400, {
        'Content-Type': 'application/xml',
      });
    }

    // Parse region from request body (CreateBucketConfiguration)
    const url = new URL(c.req.url);
    const xAmzBucketRegion = c.req.header('x-amz-bucket-region');
    let region = xAmzBucketRegion || 'us-east-1';

    // Try to parse body for region
    try {
      const body = await c.req.text();
      if (body) {
        const regionMatch = body.match(/<LocationConstraint>(.*?)<\/LocationConstraint>/);
        if (regionMatch) {
          region = regionMatch[1];
        }
      }
    } catch {
      // Ignore body parsing errors
    }

    // Generate bucket storage path
    const volumePath = generateBucketPath(user.id, bucketName);

    // Create physical directory
    try {
      ensureBucketDirectory(volumePath);
    } catch (error) {
      logger.error({ error, volumePath }, 'Failed to create bucket directory');
      const xml = buildErrorXml(
        S3ErrorCodes.InternalError,
        'Failed to create bucket storage directory'
      );
      return c.text(xml, 500, {
        'Content-Type': 'application/xml',
      });
    }

    // Create bucket in database
    const bucket = await prisma.bucket.create({
      data: {
        name: bucketName,
        userId: user.id,
        region,
        volumePath,
        storageClass: 'STANDARD',
        acl: 'private',
      },
    });

    logger.info({ userId: user.id, bucketName: bucket.name }, 'Bucket created via S3 API');

    return c.text('', 200, {
      'Location': `/${bucketName}`,
      'x-amz-bucket-region': bucket.region,
    });
  } catch (error) {
    logger.error({ error }, 'Create bucket error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
};

/**
 * Create bucket - PUT /api/s3/{bucket}
 */
app.put('/api/s3/:bucket', s3AuthMiddleware, handleCreateBucket);

/**
 * Create bucket - PUT /s3/{bucket} (alias without /api prefix for Tailscale Serve path stripping)
 */
app.put('/s3/:bucket', s3AuthMiddleware, handleCreateBucket);

/**
 * Delete bucket handler (shared between routes)
 */
const handleDeleteBucket = async (c: any) => {
  try {
    const bucketName = c.req.param('bucket');
    const user = c.get('user');

    const bucket = await prisma.bucket.findUnique({
      where: { name: bucketName },
      include: { _count: { select: { objects: true } } },
    });

    if (!bucket) {
      const xml = buildErrorXml(
        S3ErrorCodes.NoSuchBucket,
        'The specified bucket does not exist'
      );
      return c.text(xml, 404, {
        'Content-Type': 'application/xml',
      });
    }

    if (bucket.userId !== user.id) {
      const xml = buildErrorXml(
        S3ErrorCodes.AccessDenied,
        'Access Denied'
      );
      return c.text(xml, 403, {
        'Content-Type': 'application/xml',
      });
    }

    // Check if bucket has objects
    if (bucket._count.objects > 0) {
      const xml = buildErrorXml(
        S3ErrorCodes.BucketNotEmpty,
        'The bucket you tried to delete is not empty'
      );
      return c.text(xml, 409, {
        'Content-Type': 'application/xml',
      });
    }

    // Delete bucket
    await prisma.bucket.delete({
      where: { id: bucket.id },
    });

    logger.info({ userId: user.id, bucketName: bucket.name }, 'Bucket deleted via S3 API');

    return c.body(null, 204);
  } catch (error) {
    logger.error({ error }, 'Delete bucket error');
    const xml = buildErrorXml(
      S3ErrorCodes.InternalError,
      'We encountered an internal error. Please try again.'
    );
    return c.text(xml, 500, {
      'Content-Type': 'application/xml',
    });
  }
};

/**
 * Delete bucket - DELETE /api/s3/{bucket}
 */
app.delete('/api/s3/:bucket', s3AuthMiddleware, handleDeleteBucket);

/**
 * Delete bucket - DELETE /s3/{bucket} (alias without /api prefix for Tailscale Serve path stripping)
 */
app.delete('/s3/:bucket', s3AuthMiddleware, handleDeleteBucket);

} // end registerS3BucketRoutes
