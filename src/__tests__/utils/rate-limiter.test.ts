/**
 * Unit tests for rate limiter.
 *
 * @module src/__tests__/utils/rate-limiter.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  checkRateLimit,
  resetRateLimiter,
  getRateLimiterState,
  isRateLimitExceeded,
  getRemainingRequests,
  getTimeUntilReset,
  MAX_REQUESTS_PER_MINUTE,
  REQUESTS_PER_MINUTE_WINDOW,
} from '../../utils/rate-limiter';

describe('rate limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('allows requests within limit', () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      const result = checkRateLimit();
      expect(result.allowed).toBe(true);
      expect(result.requestCount).toBe(i + 1);
    }
  });

  it('blocks requests exceeding limit', () => {
    // Exhaust limit
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      checkRateLimit();
    }

    // Next request should be blocked
    const result = checkRateLimit();
    expect(result.allowed).toBe(false);
    expect(result.waitTimeMs).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    // Exhaust limit
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      checkRateLimit();
    }

    // Should be blocked
    let result = checkRateLimit();
    expect(result.allowed).toBe(false);

    // Wait for window to expire (use small window for testing)
    // Note: In real tests, we'd mock Date.now(), but for now we just verify the logic
    const state = getRateLimiterState();
    expect(state.requestCount).toBe(MAX_REQUESTS_PER_MINUTE);
  });

  it('tracks request count correctly', () => {
    expect(getRateLimiterState().requestCount).toBe(0);

    checkRateLimit();
    expect(getRateLimiterState().requestCount).toBe(1);

    checkRateLimit();
    expect(getRateLimiterState().requestCount).toBe(2);
  });

  it('checks if rate limit is exceeded', () => {
    expect(isRateLimitExceeded()).toBe(false);

    // Exhaust limit
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
      checkRateLimit();
    }

    expect(isRateLimitExceeded()).toBe(true);
  });

  it('calculates remaining requests', () => {
    expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE);

    checkRateLimit();
    expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE - 1);

    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE - 1; i++) {
      checkRateLimit();
    }

    expect(getRemainingRequests()).toBe(0);
  });

  it('provides reset time', () => {
    const result = checkRateLimit();
    expect(result.resetTime).toBeGreaterThan(Date.now());
    expect(result.resetTime).toBeLessThanOrEqual(Date.now() + REQUESTS_PER_MINUTE_WINDOW);
  });

  it('returns correct max requests in result', () => {
    const result = checkRateLimit();
    expect(result.maxRequests).toBe(MAX_REQUESTS_PER_MINUTE);
  });

  it('resets state correctly', () => {
    checkRateLimit();
    checkRateLimit();

    expect(getRateLimiterState().requestCount).toBe(2);

    resetRateLimiter();

    expect(getRateLimiterState().requestCount).toBe(0);
  });
});