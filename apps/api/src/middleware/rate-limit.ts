// Rate Limiting Middleware
import { rateLimiter } from 'hono-rate-limiter';
import { RateLimitError } from '../lib/errors.js';

// Import redis lazily to avoid initialization issues
let redis: any = null;
try {
  const redisModule = await import('../lib/redis.js');
  redis = redisModule.redis;
} catch (error) {
  console.warn('Redis module not available for rate limiting, using in-memory fallback');
}

/**
 * Redis-based rate limiter store
 * Falls back to in-memory if Redis is unavailable
 */
class RedisStore {
  private prefix: string;
  private fallbackStore: Map<string, { count: number; resetTime: number }>;

  constructor(prefix = 'ratelimit:') {
    this.prefix = prefix;
    this.fallbackStore = new Map();
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const redisKey = `${this.prefix}${key}`;

    // Always use in-memory fallback since Redis may not be ready
    // This prevents rate limiter from blocking all requests
    const now = Date.now();
    const windowMs = 60000;

    try {
      // Try Redis first - but only if redis client is defined, has isOpen property, and is actually open
      if (redis && redis.isOpen === true) {
        const resetTime = new Date(now + windowMs);

        // Use Redis INCR with expiry
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.expire(redisKey, 60); // Expire in 60 seconds
        }

        return { totalHits: count, resetTime };
      }
    } catch (error) {
      // Redis failed, fall back to in-memory (continue below)
      console.warn('Redis rate limiter failed, using in-memory fallback:', error instanceof Error ? error.message : error);
    }

    // Fallback to in-memory store
    const existing = this.fallbackStore.get(key);

    if (existing && existing.resetTime > now) {
      existing.count++;
      return {
        totalHits: existing.count,
        resetTime: new Date(existing.resetTime),
      };
    }

    const resetTime = now + windowMs;
    this.fallbackStore.set(key, { count: 1, resetTime });

    // Cleanup old entries
    this.cleanup();

    return { totalHits: 1, resetTime: new Date(resetTime) };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.fallbackStore.entries()) {
      if (value.resetTime <= now) {
        this.fallbackStore.delete(key);
      }
    }
  }
}

const store = new RedisStore();

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => {
    // Use client IP from trusted proxy headers or direct connection
    return c.get('clientIp') || c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP') || 'unknown';
  },
  handler: (c) => {
    throw new RateLimitError('Too many requests, please try again later');
  },
  store: {
    async increment(key: string) {
      return store.increment(key);
    },
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per minute per IP
 */
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => {
    return c.get('clientIp') || c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP') || 'unknown';
  },
  handler: (c) => {
    throw new RateLimitError('Too many authentication attempts, please try again later');
  },
  store: {
    async increment(key: string) {
      return store.increment(`auth:${key}`);
    },
  },
});

/**
 * Relaxed rate limiter for public read operations
 * 300 requests per minute per IP
 */
export const publicRateLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 300,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => {
    return c.get('clientIp') || c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP') || 'unknown';
  },
  handler: (c) => {
    throw new RateLimitError('Too many requests, please try again later');
  },
  store: {
    async increment(key: string) {
      return store.increment(`public:${key}`);
    },
  },
});
