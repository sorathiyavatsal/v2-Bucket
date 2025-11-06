// Security Middleware
import { Context, Next } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * Security headers middleware
 * Adds various security-related HTTP headers
 */
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  xXssProtection: '1; mode=block',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
});

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracking
 */
export async function requestId(c: Context, next: Next) {
  const id = crypto.randomUUID();
  c.set('requestId', id);
  c.header('X-Request-ID', id);
  await next();
}

/**
 * Trusted proxy middleware
 * Trusts X-Forwarded-* headers from trusted proxies
 */
export async function trustedProxy(c: Context, next: Next) {
  // In production, verify the request is from a trusted proxy
  const forwardedFor = c.req.header('X-Forwarded-For');
  const forwardedProto = c.req.header('X-Forwarded-Proto');
  const forwardedHost = c.req.header('X-Forwarded-Host');

  if (forwardedFor) {
    c.set('clientIp', forwardedFor.split(',')[0].trim());
  }
  if (forwardedProto) {
    c.set('protocol', forwardedProto);
  }
  if (forwardedHost) {
    c.set('host', forwardedHost);
  }

  await next();
}
