/**
 * Rate limiter for @mem-facilitator.
 *
 * Enforces a maximum of 10 requests per minute.
 *
 * ## Rate Limiting
 *
 * - MAX_REQUESTS_PER_MINUTE: 10
 * - REQUESTS_PER_MINUTE_WINDOW: 60 seconds
 *
 * @module src/utils/rate-limiter
 */

import { logger } from '../logger.js';

const rateLimitLogger = logger.child('[rate-limiter]');

/** Maximum requests per minute */
export const MAX_REQUESTS_PER_MINUTE = 10;

/** Request window in milliseconds (1 minute) */
export const REQUESTS_PER_MINUTE_WINDOW = 60_000;

/**
 * Rate limiter state.
 */
interface RateLimiterState {
  /** Request count in current window */
  requestCount: number;
  /** Window start timestamp */
  windowStart: number;
}

/** Global rate limiter state */
const state: RateLimiterState = {
  requestCount: 0,
  windowStart: Date.now(),
};

/**
 * Rate limit check result.
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Reset time (timestamp) */
  resetTime: number;
  /** Wait time in milliseconds */
  waitTimeMs: number;
  /** Current request count */
  requestCount: number;
  /** Maximum requests per minute */
  maxRequests: number;
}

/**
 * Check rate limit.
 *
 * Returns whether a request is allowed based on the rate limit.
 *
 * @returns Rate limit check result
 */
export function checkRateLimit(): RateLimitResult {
  const now = Date.now();
  const windowStart = state.windowStart;

  // Reset window if expired
  if (now - windowStart > REQUESTS_PER_MINUTE_WINDOW) {
    state.requestCount = 0;
    state.windowStart = now;
  }

  // Check if limit exceeded
  if (state.requestCount >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = REQUESTS_PER_MINUTE_WINDOW - (now - windowStart);
    return {
      allowed: false,
      resetTime: windowStart + REQUESTS_PER_MINUTE_WINDOW,
      waitTimeMs: waitTime,
      requestCount: state.requestCount,
      maxRequests: MAX_REQUESTS_PER_MINUTE,
    };
  }

  // Increment request count
  state.requestCount++;

  return {
    allowed: true,
    resetTime: windowStart + REQUESTS_PER_MINUTE_WINDOW,
    waitTimeMs: 0,
    requestCount: state.requestCount,
    maxRequests: MAX_REQUESTS_PER_MINUTE,
  };
}

/**
 * Reset rate limiter state.
 *
 * Useful for testing or manual reset.
 */
export function resetRateLimiter(): void {
  state.requestCount = 0;
  state.windowStart = Date.now();
}

/**
 * Get current rate limiter state.
 *
 * @returns Current rate limiter state
 */
export function getRateLimiterState(): RateLimiterState {
  return { ...state };
}

/**
 * Check if rate limit is exceeded.
 *
 * @returns True if rate limit is exceeded
 */
export function isRateLimitExceeded(): boolean {
  const now = Date.now();
  const windowStart = state.windowStart;

  // Reset window if expired
  if (now - windowStart > REQUESTS_PER_MINUTE_WINDOW) {
    return false;
  }

  return state.requestCount >= MAX_REQUESTS_PER_MINUTE;
}

/**
 * Get remaining requests in current window.
 *
 * @returns Remaining requests
 */
export function getRemainingRequests(): number {
  const now = Date.now();
  const windowStart = state.windowStart;

  // Reset window if expired
  if (now - windowStart > REQUESTS_PER_MINUTE_WINDOW) {
    return MAX_REQUESTS_PER_MINUTE;
  }

  return Math.max(0, MAX_REQUESTS_PER_MINUTE - state.requestCount);
}

/**
 * Get time until window reset.
 *
 * @returns Time until reset in milliseconds
 */
export function getTimeUntilReset(): number {
  const now = Date.now();
  const windowStart = state.windowStart;

  // Reset window if expired
  if (now - windowStart > REQUESTS_PER_MINUTE_WINDOW) {
    return 0;
  }

  return REQUESTS_PER_MINUTE_WINDOW - (now - windowStart);
}

/**
 * Log rate limit event for monitoring.
 */
export function logRateLimitEvent(event: {
  type: 'check' | 'exceeded' | 'reset';
  requestCount: number;
  maxRequests: number;
  waitTimeMs?: number;
}): void {
  if (event.type === 'exceeded') {
    rateLimitLogger.warn('Rate limit exceeded', {
      requestCount: event.requestCount,
      maxRequests: event.maxRequests,
      waitTimeMs: event.waitTimeMs,
    });
  } else if (event.type === 'reset') {
    rateLimitLogger.debug('Rate limit window reset', {
      requestCount: event.requestCount,
      maxRequests: event.maxRequests,
    });
  }
}