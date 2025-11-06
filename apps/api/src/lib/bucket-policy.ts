// Bucket Policy and CORS Utilities

/**
 * S3-compatible bucket policy structure
 */
export interface BucketPolicy {
  Version: string;
  Statement: PolicyStatement[];
}

export interface PolicyStatement {
  Sid?: string;
  Effect: 'Allow' | 'Deny';
  Principal: PolicyPrincipal;
  Action: string | string[];
  Resource: string | string[];
  Condition?: PolicyCondition;
}

export interface PolicyPrincipal {
  AWS?: string | string[];
  CanonicalUser?: string | string[];
  Service?: string | string[];
  [key: string]: any;
}

export interface PolicyCondition {
  [operator: string]: {
    [key: string]: string | string[] | number | number[];
  };
}

/**
 * CORS configuration structure
 */
export interface CORSConfiguration {
  CORSRules: CORSRule[];
}

export interface CORSRule {
  ID?: string;
  AllowedOrigins: string[];
  AllowedMethods: ('GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD')[];
  AllowedHeaders?: string[];
  ExposeHeaders?: string[];
  MaxAgeSeconds?: number;
}

/**
 * Supported S3 actions
 */
export const S3_ACTIONS = [
  's3:GetObject',
  's3:PutObject',
  's3:DeleteObject',
  's3:ListBucket',
  's3:GetBucketLocation',
  's3:ListBucketMultipartUploads',
  's3:ListMultipartUploadParts',
  's3:AbortMultipartUpload',
  's3:GetObjectVersion',
  's3:GetBucketVersioning',
  's3:GetBucketAcl',
  's3:PutBucketAcl',
  's3:GetBucketCors',
  's3:PutBucketCors',
  's3:GetBucketPolicy',
  's3:PutBucketPolicy',
  's3:DeleteBucketPolicy',
] as const;

export type S3Action = typeof S3_ACTIONS[number];

/**
 * Validate bucket policy structure
 */
export function validateBucketPolicy(policy: any): { valid: boolean; error?: string } {
  if (!policy || typeof policy !== 'object') {
    return { valid: false, error: 'Policy must be an object' };
  }

  if (!policy.Version) {
    return { valid: false, error: 'Policy must have a Version field' };
  }

  if (!Array.isArray(policy.Statement)) {
    return { valid: false, error: 'Policy must have a Statement array' };
  }

  if (policy.Statement.length === 0) {
    return { valid: false, error: 'Policy must have at least one statement' };
  }

  // Validate each statement
  for (let i = 0; i < policy.Statement.length; i++) {
    const statement = policy.Statement[i];

    if (!statement.Effect || !['Allow', 'Deny'].includes(statement.Effect)) {
      return { valid: false, error: `Statement ${i}: Effect must be 'Allow' or 'Deny'` };
    }

    if (!statement.Principal) {
      return { valid: false, error: `Statement ${i}: Principal is required` };
    }

    if (!statement.Action) {
      return { valid: false, error: `Statement ${i}: Action is required` };
    }

    if (!statement.Resource) {
      return { valid: false, error: `Statement ${i}: Resource is required` };
    }

    // Validate actions
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    for (const action of actions) {
      if (action !== '*' && !S3_ACTIONS.includes(action as S3Action)) {
        return { valid: false, error: `Statement ${i}: Invalid action '${action}'` };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate CORS configuration
 */
export function validateCORSConfiguration(cors: any): { valid: boolean; error?: string } {
  if (!cors || typeof cors !== 'object') {
    return { valid: false, error: 'CORS configuration must be an object' };
  }

  if (!Array.isArray(cors.CORSRules)) {
    return { valid: false, error: 'CORS configuration must have a CORSRules array' };
  }

  if (cors.CORSRules.length === 0) {
    return { valid: false, error: 'CORS configuration must have at least one rule' };
  }

  if (cors.CORSRules.length > 100) {
    return { valid: false, error: 'CORS configuration cannot have more than 100 rules' };
  }

  // Validate each rule
  for (let i = 0; i < cors.CORSRules.length; i++) {
    const rule = cors.CORSRules[i];

    if (!Array.isArray(rule.AllowedOrigins) || rule.AllowedOrigins.length === 0) {
      return { valid: false, error: `Rule ${i}: AllowedOrigins is required and must be a non-empty array` };
    }

    if (!Array.isArray(rule.AllowedMethods) || rule.AllowedMethods.length === 0) {
      return { valid: false, error: `Rule ${i}: AllowedMethods is required and must be a non-empty array` };
    }

    // Validate methods
    const validMethods = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'];
    for (const method of rule.AllowedMethods) {
      if (!validMethods.includes(method)) {
        return { valid: false, error: `Rule ${i}: Invalid method '${method}'` };
      }
    }

    // Validate MaxAgeSeconds if provided
    if (rule.MaxAgeSeconds !== undefined) {
      if (typeof rule.MaxAgeSeconds !== 'number' || rule.MaxAgeSeconds < 0) {
        return { valid: false, error: `Rule ${i}: MaxAgeSeconds must be a non-negative number` };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if policy allows action for principal
 */
export function evaluatePolicy(
  policy: BucketPolicy,
  action: string,
  resource: string,
  principal: string
): boolean {
  let allowed = false;

  for (const statement of policy.Statement) {
    // Check if action matches
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    const actionMatches = actions.includes('*') || actions.includes(action);

    if (!actionMatches) continue;

    // Check if resource matches
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
    const resourceMatches = resources.some(r => {
      if (r === '*') return true;
      // Support wildcards
      const pattern = r.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(resource);
    });

    if (!resourceMatches) continue;

    // Check if principal matches
    const principalMatches = checkPrincipalMatch(statement.Principal, principal);

    if (!principalMatches) continue;

    // Apply effect
    if (statement.Effect === 'Allow') {
      allowed = true;
    } else if (statement.Effect === 'Deny') {
      return false; // Explicit deny always wins
    }
  }

  return allowed;
}

/**
 * Check if principal matches
 */
function checkPrincipalMatch(policyPrincipal: PolicyPrincipal, principal: string): boolean {
  // Check for wildcard
  if (policyPrincipal === '*' || (policyPrincipal as any) === '*') {
    return true;
  }

  // Check AWS principals
  if (policyPrincipal.AWS) {
    const awsPrincipals = Array.isArray(policyPrincipal.AWS) ? policyPrincipal.AWS : [policyPrincipal.AWS];
    if (awsPrincipals.includes('*') || awsPrincipals.includes(principal)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if CORS allows request
 */
export function evaluateCORS(
  cors: CORSConfiguration,
  origin: string,
  method: string
): {
  allowed: boolean;
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
} {
  for (const rule of cors.CORSRules) {
    // Check if origin matches
    const originMatches = rule.AllowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === '*') return true;
      // Support wildcards
      const pattern = allowedOrigin.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    });

    if (!originMatches) continue;

    // Check if method matches
    const methodMatches = rule.AllowedMethods.includes(method as any);

    if (!methodMatches) continue;

    // Return CORS headers
    return {
      allowed: true,
      allowedHeaders: rule.AllowedHeaders,
      exposeHeaders: rule.ExposeHeaders,
      maxAge: rule.MaxAgeSeconds,
    };
  }

  return { allowed: false };
}

/**
 * Create default bucket policy (private)
 */
export function createDefaultPolicy(bucketName: string, userId: string): BucketPolicy {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'OwnerFullControl',
        Effect: 'Allow',
        Principal: {
          AWS: userId,
        },
        Action: '*',
        Resource: [
          `arn:aws:s3:::${bucketName}`,
          `arn:aws:s3:::${bucketName}/*`,
        ],
      },
    ],
  };
}

/**
 * Create public read policy
 */
export function createPublicReadPolicy(bucketName: string, userId: string): BucketPolicy {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'OwnerFullControl',
        Effect: 'Allow',
        Principal: {
          AWS: userId,
        },
        Action: '*',
        Resource: [
          `arn:aws:s3:::${bucketName}`,
          `arn:aws:s3:::${bucketName}/*`,
        ],
      },
      {
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: '*' as any,
        Action: ['s3:GetObject', 's3:ListBucket'],
        Resource: [
          `arn:aws:s3:::${bucketName}`,
          `arn:aws:s3:::${bucketName}/*`,
        ],
      },
    ],
  };
}

/**
 * Create default CORS configuration (permissive for development)
 */
export function createDefaultCORS(): CORSConfiguration {
  return {
    CORSRules: [
      {
        ID: 'default-rule',
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
        MaxAgeSeconds: 3600,
      },
    ],
  };
}

/**
 * Convert policy to JSON string
 */
export function policyToJSON(policy: BucketPolicy): string {
  return JSON.stringify(policy, null, 2);
}

/**
 * Parse policy from JSON string
 */
export function policyFromJSON(json: string): BucketPolicy {
  return JSON.parse(json);
}

/**
 * Convert CORS to JSON string
 */
export function corsToJSON(cors: CORSConfiguration): string {
  return JSON.stringify(cors, null, 2);
}

/**
 * Parse CORS from JSON string
 */
export function corsFromJSON(json: string): CORSConfiguration {
  return JSON.parse(json);
}
