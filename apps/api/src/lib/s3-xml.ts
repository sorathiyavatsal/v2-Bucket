// S3 XML Response Utilities
import { formatAwsDate } from './aws-signature-v4.js';

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * S3 Error Codes
 */
export const S3ErrorCodes = {
  AccessDenied: 'AccessDenied',
  BucketAlreadyExists: 'BucketAlreadyExists',
  BucketAlreadyOwnedByYou: 'BucketAlreadyOwnedByYou',
  BucketNotEmpty: 'BucketNotEmpty',
  InvalidAccessKeyId: 'InvalidAccessKeyId',
  InvalidArgument: 'InvalidArgument',
  InvalidBucketName: 'InvalidBucketName',
  NoSuchBucket: 'NoSuchBucket',
  NoSuchKey: 'NoSuchKey',
  NoSuchUpload: 'NoSuchUpload',
  InternalError: 'InternalError',
  MethodNotAllowed: 'MethodNotAllowed',
  MissingContentLength: 'MissingContentLength',
  RequestTimeTooSkewed: 'RequestTimeTooSkewed',
  SignatureDoesNotMatch: 'SignatureDoesNotMatch',
  EntityTooLarge: 'EntityTooLarge',
  InvalidPart: 'InvalidPart',
  InvalidPartOrder: 'InvalidPartOrder',
} as const;

/**
 * Build S3 error response XML
 */
export function buildErrorXml(
  code: string,
  message: string,
  resource?: string,
  requestId?: string
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Error>\n';
  xml += `  <Code>${escapeXml(code)}</Code>\n`;
  xml += `  <Message>${escapeXml(message)}</Message>\n`;

  if (resource) {
    xml += `  <Resource>${escapeXml(resource)}</Resource>\n`;
  }

  if (requestId) {
    xml += `  <RequestId>${escapeXml(requestId)}</RequestId>\n`;
  }

  xml += '</Error>';
  return xml;
}

/**
 * Build ListBuckets response XML
 */
export function buildListBucketsXml(buckets: Array<{
  name: string;
  createdAt: Date;
}>, owner: { id: string; displayName: string }): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';

  xml += '  <Owner>\n';
  xml += `    <ID>${escapeXml(owner.id)}</ID>\n`;
  xml += `    <DisplayName>${escapeXml(owner.displayName)}</DisplayName>\n`;
  xml += '  </Owner>\n';

  xml += '  <Buckets>\n';
  for (const bucket of buckets) {
    xml += '    <Bucket>\n';
    xml += `      <Name>${escapeXml(bucket.name)}</Name>\n`;
    xml += `      <CreationDate>${bucket.createdAt.toISOString()}</CreationDate>\n`;
    xml += '    </Bucket>\n';
  }
  xml += '  </Buckets>\n';

  xml += '</ListAllMyBucketsResult>';
  return xml;
}

/**
 * Build ListObjects response XML (V1)
 */
export function buildListObjectsXml(data: {
  bucketName: string;
  prefix?: string;
  marker?: string;
  maxKeys: number;
  delimiter?: string;
  isTruncated: boolean;
  nextMarker?: string;
  contents: Array<{
    key: string;
    lastModified: Date;
    etag: string;
    size: bigint;
    storageClass: string;
  }>;
  commonPrefixes?: string[];
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <Name>${escapeXml(data.bucketName)}</Name>\n`;

  if (data.prefix) {
    xml += `  <Prefix>${escapeXml(data.prefix)}</Prefix>\n`;
  }

  if (data.marker) {
    xml += `  <Marker>${escapeXml(data.marker)}</Marker>\n`;
  }

  xml += `  <MaxKeys>${data.maxKeys}</MaxKeys>\n`;

  if (data.delimiter) {
    xml += `  <Delimiter>${escapeXml(data.delimiter)}</Delimiter>\n`;
  }

  xml += `  <IsTruncated>${data.isTruncated}</IsTruncated>\n`;

  if (data.nextMarker) {
    xml += `  <NextMarker>${escapeXml(data.nextMarker)}</NextMarker>\n`;
  }

  for (const obj of data.contents) {
    xml += '  <Contents>\n';
    xml += `    <Key>${escapeXml(obj.key)}</Key>\n`;
    xml += `    <LastModified>${obj.lastModified.toISOString()}</LastModified>\n`;
    xml += `    <ETag>${escapeXml(obj.etag)}</ETag>\n`;
    xml += `    <Size>${obj.size.toString()}</Size>\n`;
    xml += `    <StorageClass>${escapeXml(obj.storageClass)}</StorageClass>\n`;
    xml += '  </Contents>\n';
  }

  if (data.commonPrefixes) {
    for (const prefix of data.commonPrefixes) {
      xml += '  <CommonPrefixes>\n';
      xml += `    <Prefix>${escapeXml(prefix)}</Prefix>\n`;
      xml += '  </CommonPrefixes>\n';
    }
  }

  xml += '</ListBucketResult>';
  return xml;
}

/**
 * Build InitiateMultipartUpload response XML
 */
export function buildInitiateMultipartUploadXml(data: {
  bucketName: string;
  key: string;
  uploadId: string;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <Bucket>${escapeXml(data.bucketName)}</Bucket>\n`;
  xml += `  <Key>${escapeXml(data.key)}</Key>\n`;
  xml += `  <UploadId>${escapeXml(data.uploadId)}</UploadId>\n`;
  xml += '</InitiateMultipartUploadResult>';
  return xml;
}

/**
 * Build CompleteMultipartUpload response XML
 */
export function buildCompleteMultipartUploadXml(data: {
  location: string;
  bucketName: string;
  key: string;
  etag: string;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <Location>${escapeXml(data.location)}</Location>\n`;
  xml += `  <Bucket>${escapeXml(data.bucketName)}</Bucket>\n`;
  xml += `  <Key>${escapeXml(data.key)}</Key>\n`;
  xml += `  <ETag>${escapeXml(data.etag)}</ETag>\n`;
  xml += '</CompleteMultipartUploadResult>';
  return xml;
}

/**
 * Build ListParts response XML
 */
export function buildListPartsXml(data: {
  bucketName: string;
  key: string;
  uploadId: string;
  storageClass: string;
  partNumberMarker?: number;
  nextPartNumberMarker?: number;
  maxParts: number;
  isTruncated: boolean;
  parts: Array<{
    partNumber: number;
    lastModified: Date;
    etag: string;
    size: bigint;
  }>;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<ListPartsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <Bucket>${escapeXml(data.bucketName)}</Bucket>\n`;
  xml += `  <Key>${escapeXml(data.key)}</Key>\n`;
  xml += `  <UploadId>${escapeXml(data.uploadId)}</UploadId>\n`;
  xml += `  <StorageClass>${escapeXml(data.storageClass)}</StorageClass>\n`;

  if (data.partNumberMarker) {
    xml += `  <PartNumberMarker>${data.partNumberMarker}</PartNumberMarker>\n`;
  }

  if (data.nextPartNumberMarker) {
    xml += `  <NextPartNumberMarker>${data.nextPartNumberMarker}</NextPartNumberMarker>\n`;
  }

  xml += `  <MaxParts>${data.maxParts}</MaxParts>\n`;
  xml += `  <IsTruncated>${data.isTruncated}</IsTruncated>\n`;

  for (const part of data.parts) {
    xml += '  <Part>\n';
    xml += `    <PartNumber>${part.partNumber}</PartNumber>\n`;
    xml += `    <LastModified>${part.lastModified.toISOString()}</LastModified>\n`;
    xml += `    <ETag>${escapeXml(part.etag)}</ETag>\n`;
    xml += `    <Size>${part.size.toString()}</Size>\n`;
    xml += '  </Part>\n';
  }

  xml += '</ListPartsResult>';
  return xml;
}

/**
 * Build CopyObject response XML
 */
export function buildCopyObjectXml(data: {
  etag: string;
  lastModified: Date;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <LastModified>${data.lastModified.toISOString()}</LastModified>\n`;
  xml += `  <ETag>${escapeXml(data.etag)}</ETag>\n`;
  xml += '</CopyObjectResult>';
  return xml;
}

/**
 * Build DeleteObjects response XML
 */
export function buildDeleteObjectsXml(data: {
  deleted: Array<{ key: string; versionId?: string }>;
  errors: Array<{ key: string; code: string; message: string }>;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';

  for (const obj of data.deleted) {
    xml += '  <Deleted>\n';
    xml += `    <Key>${escapeXml(obj.key)}</Key>\n`;
    if (obj.versionId) {
      xml += `    <VersionId>${escapeXml(obj.versionId)}</VersionId>\n`;
    }
    xml += '  </Deleted>\n';
  }

  for (const err of data.errors) {
    xml += '  <Error>\n';
    xml += `    <Key>${escapeXml(err.key)}</Key>\n`;
    xml += `    <Code>${escapeXml(err.code)}</Code>\n`;
    xml += `    <Message>${escapeXml(err.message)}</Message>\n`;
    xml += '  </Error>\n';
  }

  xml += '</DeleteResult>';
  return xml;
}

/**
 * Build LocationConstraint response XML
 */
export function buildLocationConstraintXml(region: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
  if (region && region !== 'us-east-1') {
    xml += escapeXml(region);
  }
  xml += '</LocationConstraint>';
  return xml;
}

/**
 * Build ListMultipartUploads response XML
 */
export function buildListMultipartUploadsXml(data: {
  bucketName: string;
  keyMarker?: string;
  uploadIdMarker?: string;
  nextKeyMarker?: string;
  nextUploadIdMarker?: string;
  maxUploads: number;
  isTruncated: boolean;
  uploads: Array<{
    key: string;
    uploadId: string;
    initiatedAt: Date;
    storageClass: string;
  }>;
}): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<ListMultipartUploadsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">\n';
  xml += `  <Bucket>${escapeXml(data.bucketName)}</Bucket>\n`;

  if (data.keyMarker) {
    xml += `  <KeyMarker>${escapeXml(data.keyMarker)}</KeyMarker>\n`;
  }

  if (data.uploadIdMarker) {
    xml += `  <UploadIdMarker>${escapeXml(data.uploadIdMarker)}</UploadIdMarker>\n`;
  }

  if (data.nextKeyMarker) {
    xml += `  <NextKeyMarker>${escapeXml(data.nextKeyMarker)}</NextKeyMarker>\n`;
  }

  if (data.nextUploadIdMarker) {
    xml += `  <NextUploadIdMarker>${escapeXml(data.nextUploadIdMarker)}</NextUploadIdMarker>\n`;
  }

  xml += `  <MaxUploads>${data.maxUploads}</MaxUploads>\n`;
  xml += `  <IsTruncated>${data.isTruncated}</IsTruncated>\n`;

  for (const upload of data.uploads) {
    xml += '  <Upload>\n';
    xml += `    <Key>${escapeXml(upload.key)}</Key>\n`;
    xml += `    <UploadId>${escapeXml(upload.uploadId)}</UploadId>\n`;
    xml += `    <Initiated>${upload.initiatedAt.toISOString()}</Initiated>\n`;
    xml += `    <StorageClass>${escapeXml(upload.storageClass)}</StorageClass>\n`;
    xml += '  </Upload>\n';
  }

  xml += '</ListMultipartUploadsResult>';
  return xml;
}

/**
 * Parse CompleteMultipartUpload request XML
 */
export function parseCompleteMultipartUploadXml(xml: string): Array<{ partNumber: number; etag: string }> {
  const parts: Array<{ partNumber: number; etag: string }> = [];

  // Simple regex-based parsing (in production, use a proper XML parser)
  const partMatches = xml.matchAll(/<Part>[\s\S]*?<\/Part>/g);

  for (const partMatch of partMatches) {
    const partXml = partMatch[0];
    const partNumberMatch = partXml.match(/<PartNumber>(\d+)<\/PartNumber>/);
    const etagMatch = partXml.match(/<ETag>(.*?)<\/ETag>/);

    if (partNumberMatch && etagMatch) {
      parts.push({
        partNumber: parseInt(partNumberMatch[1], 10),
        etag: etagMatch[1],
      });
    }
  }

  return parts;
}

/**
 * Parse Delete request XML
 */
export function parseDeleteXml(xml: string): Array<{ key: string; versionId?: string }> {
  const objects: Array<{ key: string; versionId?: string }> = [];

  // Simple regex-based parsing
  const objectMatches = xml.matchAll(/<Object>[\s\S]*?<\/Object>/g);

  for (const objMatch of objectMatches) {
    const objXml = objMatch[0];
    const keyMatch = objXml.match(/<Key>(.*?)<\/Key>/);
    const versionIdMatch = objXml.match(/<VersionId>(.*?)<\/VersionId>/);

    if (keyMatch) {
      objects.push({
        key: keyMatch[1],
        versionId: versionIdMatch ? versionIdMatch[1] : undefined,
      });
    }
  }

  return objects;
}
