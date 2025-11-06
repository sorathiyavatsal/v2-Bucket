// Rate Limiting Middleware
import { rateLimiter } from 'hono-rate-limiter';
import { redis } from '../lib/redis.js';
import { RateLimitError } from '../lib/errors.js';

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

    try {
      // Try Redis first
      if (redis.isOpen) {
        const now = Date.now();
        const windowMs = 60000; // 1 minute window
        const resetTime = new Date(now + windowMs);

        // Use Redis INCR with expiry
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.expire(redisKey, 60); // Expire in 60 seconds
        }

        return { totalHits: count, resetTime };
      }
    } catch (error) {
      // Redis failed, fall back to in-memory
    }

    // Fallback to in-memory store
    const now = Date.now();
    const windowMs = 60000;
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
