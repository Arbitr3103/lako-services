/**
 * Simple in-memory rate limiter for Cloudflare Workers.
 *
 * Each limiter instance tracks request counts per IP using a Map.
 * Expired entries are cleaned up opportunistically during requests.
 *
 * Note: Since Cloudflare Workers may run multiple isolates,
 * this provides per-isolate rate limiting. Cloudflare WAF
 * provides the global layer; this is a defence-in-depth measure.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed within the window */
  maxRequests: number;
}

class RateLimiter {
  private readonly hits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private nextCleanupAt = 0;

  constructor({ windowMs, maxRequests }: RateLimiterOptions) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check whether the given IP is rate-limited.
   * Returns `true` if the request should be blocked (429).
   */
  isRateLimited(ip: string): boolean {
    const now = Date.now();
    this.cleanupIfNeeded(now);

    const entry = this.hits.get(ip);

    if (!entry || now >= entry.resetAt) {
      // First request in a new window
      this.hits.set(ip, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    entry.count += 1;
    return entry.count > this.maxRequests;
  }

  private cleanupIfNeeded(now: number): void {
    if (now < this.nextCleanupAt) return;

    this.nextCleanupAt = now + 60_000;
    this.cleanup(now);
  }

  /** Remove entries whose window has expired */
  private cleanup(now: number): void {
    for (const [ip, entry] of this.hits) {
      if (now >= entry.resetAt) {
        this.hits.delete(ip);
      }
    }
  }
}

/**
 * Create a rate limiter with the given options.
 *
 * Usage:
 * ```ts
 * const limiter = createRateLimiter({ windowMs: 5 * 60_000, maxRequests: 5 });
 *
 * if (limiter.isRateLimited(ip)) {
 *   return new Response(JSON.stringify({ error: '...' }), { status: 429 });
 * }
 * ```
 */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  return new RateLimiter(opts);
}

/**
 * Extract the real client IP on Cloudflare Workers.
 * Falls back to a generic key so rate limiting still works locally.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
