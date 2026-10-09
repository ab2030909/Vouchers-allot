interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding window rate limiter.
 * 
 * @param key Identifier for rate limiting (IP address, action)
 * @param maxHits Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds
 * @returns { success: boolean, remaining: number, resetInMs: number }
 */
export function checkRateLimit(
  key: string,
  maxHits: number = 10,
  windowMs: number = 60 * 1000
): { success: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up expired records periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: maxHits - 1, resetInMs: windowMs };
  }

  if (record.count >= maxHits) {
    return {
      success: false,
      remaining: 0,
      resetInMs: Math.max(0, record.resetTime - now),
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: maxHits - record.count,
    resetInMs: Math.max(0, record.resetTime - now),
  };
}
