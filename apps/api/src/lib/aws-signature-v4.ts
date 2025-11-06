// AWS Signature Version 4 Utilities
import { createHash, createHmac } from 'crypto';

/**
 * AWS Signature V4 request components
 */
export interface SignatureV4Request {
  method: string;
  uri: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  payload: string | Buffer;
  region?: string;
  service?: string;
}

/**
 * AWS Signature V4 credentials
 */
export interface SignatureV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Parsed authorization header
 */
export interface ParsedAuthorization {
  accessKeyId: string;
  credential: string;
  signedHeaders: string[];
  signature: string;
  algorithm: string;
  date: string;
  region: string;
  service: string;
}

/**
 * Hash data using SHA256
 */
function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * HMAC SHA256
 */
function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * Calculate SHA256 hash of payload
 */
export function calculatePayloadHash(payload: string | Buffer): string {
  if (!payload || payload.length === 0) {
    return sha256('');
  }
  return sha256(payload);
}

/**
 * Create canonical URI (URL-encoded path)
 */
export function createCanonicalUri(uri: string): string {
  // Normalize the URI path
  let path = uri;

  // Remove query string if present
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) {
    path = path.substring(0, queryIndex);
  }

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // URL encode each path segment
  const segments = path.split('/');
  const encodedSegments = segments.map(segment => {
    if (segment === '') return '';
    return encodeURIComponent(segment).replace(/%2F/g, '/');
  });

  return encodedSegments.join('/');
}

/**
 * Create canonical query string
 */
export function createCanonicalQueryString(query: Record<string, string>): string {
  const keys = Object.keys(query).sort();
  const pairs = keys.map(key => {
    const value = query[key];
    return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  });
  return pairs.join('&');
}

/**
 * Create canonical headers
 */
export function createCanonicalHeaders(headers: Record<string, string>, signedHeaders: string[]): string {
  const canonical: string[] = [];

  for (const header of signedHeaders) {
    const value = headers[header.toLowerCase()];
    if (value !== undefined) {
      // Trim whitespace and convert to lowercase
      const trimmedValue = value.trim().replace(/\s+/g, ' ');
      canonical.push(`${header.toLowerCase()}:${trimmedValue}`);
    }
  }

  return canonical.join('\n') + '\n';
}

/**
 * Create canonical request
 */
export function createCanonicalRequest(req: SignatureV4Request, signedHeaders: string[], payloadHash: string): string {
  const canonicalUri = createCanonicalUri(req.uri);
  const canonicalQuery = createCanonicalQueryString(req.query);
  const canonicalHeaders = createCanonicalHeaders(req.headers, signedHeaders);
  const signedHeadersString = signedHeaders.join(';');

  return [
    req.method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeadersString,
    payloadHash,
  ].join('\n');
}

/**
 * Create string to sign
 */
export function createStringToSign(
  algorithm: string,
  requestDate: string,
  credentialScope: string,
  canonicalRequest: string
): string {
  const hashedCanonicalRequest = sha256(canonicalRequest);

  return [
    algorithm,
    requestDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');
}

/**
 * Derive signing key
 */
export function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

/**
 * Calculate signature
 */
export function calculateSignature(
  stringToSign: string,
  signingKey: Buffer
): string {
  return hmacSha256(signingKey, stringToSign).toString('hex');
}

/**
 * Parse authorization header
 */
export function parseAuthorizationHeader(authHeader: string): ParsedAuthorization | null {
  // Format: AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-date, Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024

  const match = authHeader.match(/^(AWS4-HMAC-SHA256)\s+Credential=([^,]+),\s*SignedHeaders=([^,]+),\s*Signature=(.+)$/);

  if (!match) {
    return null;
  }

  const [, algorithm, credential, signedHeadersStr, signature] = match;

  // Parse credential: accessKeyId/date/region/service/aws4_request
  const credentialParts = credential.split('/');
  if (credentialParts.length !== 5) {
    return null;
  }

  const [accessKeyId, date, region, service] = credentialParts;

  const signedHeaders = signedHeadersStr.split(';').map(h => h.trim());

  return {
    accessKeyId,
    credential,
    signedHeaders,
    signature,
    algorithm,
    date,
    region,
    service,
  };
}

/**
 * Verify AWS Signature V4
 */
export function verifySignatureV4(
  req: SignatureV4Request,
  credentials: SignatureV4Credentials,
  authorization: ParsedAuthorization
): boolean {
  try {
    // Calculate payload hash
    const payloadHash = calculatePayloadHash(req.payload);

    // Create canonical request
    const canonicalRequest = createCanonicalRequest(req, authorization.signedHeaders, payloadHash);

    // Get request date from x-amz-date header
    const requestDate = req.headers['x-amz-date'];
    if (!requestDate) {
      return false;
    }

    // Extract date stamp (YYYYMMDD)
    const dateStamp = requestDate.substring(0, 8);

    // Create credential scope
    const credentialScope = `${dateStamp}/${authorization.region}/${authorization.service}/aws4_request`;

    // Create string to sign
    const stringToSign = createStringToSign(
      authorization.algorithm,
      requestDate,
      credentialScope,
      canonicalRequest
    );

    // Derive signing key
    const signingKey = deriveSigningKey(
      credentials.secretAccessKey,
      dateStamp,
      authorization.region,
      authorization.service
    );

    // Calculate signature
    const calculatedSignature = calculateSignature(stringToSign, signingKey);

    // Compare signatures
    return calculatedSignature === authorization.signature;
  } catch (error) {
    return false;
  }
}

/**
 * Extract signed headers from request
 */
export function extractSignedHeaders(req: SignatureV4Request, headerNames: string[]): Record<string, string> {
  const signedHeaders: Record<string, string> = {};

  for (const headerName of headerNames) {
    const value = req.headers[headerName.toLowerCase()];
    if (value !== undefined) {
      signedHeaders[headerName.toLowerCase()] = value;
    }
  }

  return signedHeaders;
}

/**
 * Validate request date (must be within 15 minutes)
 */
export function validateRequestDate(requestDate: string): boolean {
  try {
    // Parse date: 20130524T000000Z
    const year = parseInt(requestDate.substring(0, 4), 10);
    const month = parseInt(requestDate.substring(4, 6), 10) - 1;
    const day = parseInt(requestDate.substring(6, 8), 10);
    const hour = parseInt(requestDate.substring(9, 11), 10);
    const minute = parseInt(requestDate.substring(11, 13), 10);
    const second = parseInt(requestDate.substring(13, 15), 10);

    const requestDateTime = new Date(Date.UTC(year, month, day, hour, minute, second));
    const now = new Date();

    // Allow 15 minutes clock skew
    const fifteenMinutes = 15 * 60 * 1000;
    const timeDiff = Math.abs(now.getTime() - requestDateTime.getTime());

    return timeDiff <= fifteenMinutes;
  } catch {
    return false;
  }
}

/**
 * Format date for AWS (ISO 8601 format: YYYYMMDD'T'HHMMSS'Z')
 */
export function formatAwsDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * Get date stamp (YYYYMMDD)
 */
export function getDateStamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}
