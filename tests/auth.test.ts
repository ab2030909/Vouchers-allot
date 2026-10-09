import { describe, it, expect } from 'vitest';
import { verifyAdminPassword } from '../src/lib/auth';
import { checkRateLimit } from '../src/lib/rate-limit';

describe('Authentication & Security Unit Tests', () => {
  it('verifies admin password correctly and rejects invalid password', () => {
    expect(verifyAdminPassword('test_admin_password')).toBe(true);
    expect(verifyAdminPassword('wrong_password')).toBe(false);
    expect(verifyAdminPassword('')).toBe(false);
  });

  it('enforces rate limiting sliding window', () => {
    const key = 'test_ip_rate_limit';
    // Max 3 hits
    const hit1 = checkRateLimit(key, 3, 60000);
    const hit2 = checkRateLimit(key, 3, 60000);
    const hit3 = checkRateLimit(key, 3, 60000);
    const hit4 = checkRateLimit(key, 3, 60000);

    expect(hit1.success).toBe(true);
    expect(hit2.success).toBe(true);
    expect(hit3.success).toBe(true);
    expect(hit4.success).toBe(false); // 4th request rate limited
    expect(hit4.remaining).toBe(0);
  });
});
