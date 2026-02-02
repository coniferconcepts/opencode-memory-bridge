/**
 * Error handling utilities for @mem-facilitator.
 *
 * Guardrails:
 * - #16/#24: Never expose stack traces or internal details externally
 * - #17: Never log sensitive data (scrubbed)
 *
 * @module src/utils/error-handler
 */

import { logger } from '../logger.js';
import { scrubSecrets } from '../scrubber.js';
import { MAX_ERROR_MESSAGE_LEN } from '../constants.js';

const GENERIC_ERROR_MESSAGE = 'An error occurred while processing your request';
const errorLogger = logger.child('[error-handler]');

/**
 * Check if error is a rate limit error from upstream API.
 *
 * @param error - Error to check
 * @returns True if rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as Record<string, unknown>;

  // Check for rate_limit_exceeded code in nested error
  if (err.error && typeof err.error === 'object') {
    const innerError = err.error as Record<string, unknown>;
    if (innerError.code === 'rate_limit_exceeded') return true;
    if (innerError.type === 'rate_limit_error') return true;
  }

  // Check for 429 status code
  if (err.statusCode === 429 || err.status === 429) return true;

  // Check for rate limit in message
  if (typeof err.message === 'string') {
    const msg = err.message.toLowerCase();
    if (msg.includes('rate limit') || msg.includes('too many requests')) return true;
  }

  return false;
}

/**
 * Check if error is a server error (5xx).
 *
 * @param error - Error to check
 * @returns True if server error
 */
export function isServerError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as Record<string, unknown>;
  const status = err.statusCode ?? err.status;

  if (typeof status === 'number' && status >= 500 && status < 600) return true;

  if (err.error && typeof err.error === 'object') {
    const innerError = err.error as Record<string, unknown>;
    if (innerError.type === 'server_error') return true;
  }

  return false;
}

/**
 * Transform upstream API error into user-friendly format.
 *
 * @param error - Raw error from upstream API
 * @returns User-friendly error response
 */
export function transformUpstreamError(error: unknown): {
  status: 'error';
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
} {
  if (isRateLimitError(error)) {
    return {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit reached. Please wait a moment before trying again.',
      retryable: true,
      retryAfterMs: 60000, // Default 1 minute
    };
  }

  if (isServerError(error)) {
    return {
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'The service is temporarily unavailable. Please try again later.',
      retryable: true,
      retryAfterMs: 30000, // Default 30 seconds
    };
  }

  return {
    status: 'error',
    code: 'UNKNOWN_ERROR',
    message: 'An error occurred while processing your request.',
    retryable: false,
  };
}

/**
 * Log upstream error for monitoring.
 *
 * @param error - Error to log
 * @param context.operation - Operation being performed
 * @param context.query - Query string (optional)
 * @param context.attempt - Attempt number (optional)
 */
export function logUpstreamError(error: unknown, context: {
  operation: string;
  query?: string;
  attempt?: number;
}): void {
  const transformed = transformUpstreamError(error);

  errorLogger.error('Upstream error', {
    code: transformed.code,
    message: transformed.message,
    retryable: transformed.retryable,
    operation: context.operation,
    query: context.query,
    attempt: context.attempt,
    rawError: process.env.NODE_ENV === 'development' ? error : undefined,
  });
}

/**
 * Normalize and scrub an error message.
 */
export function getErrorMessage(error: unknown): string {
  let message = 'Unknown error';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  const scrubbed = scrubSecrets(message);
  return scrubbed.length > MAX_ERROR_MESSAGE_LEN ? scrubbed.slice(0, MAX_ERROR_MESSAGE_LEN) : scrubbed;
}

/**
 * Scrub stack traces to remove paths and line numbers.
 * Simple string replacement (Guardrail #7: bounded operations only).
 */
export function scrubStack(stack?: string): string {
  if (!stack) return '';

  let scrubbed = scrubSecrets(stack);

  // Remove file paths (bounded to 200 chars)
  // Handles both Windows (C:\) and Unix (/Users/) paths
  const windowsPathPattern = /[A-Za-z]:[\\/][^\s]{1,200}/g;
  const unixPathPattern = /\/[^\s]{1,200}/g;
  scrubbed = scrubbed.replace(windowsPathPattern, '[path]');
  scrubbed = scrubbed.replace(unixPathPattern, '[path]');
  
  // Remove line:col patterns (bounded)
  const linePattern = /:\d{1,6}:\d{1,6}/g;
  scrubbed = scrubbed.replace(linePattern, ':[line]:[col]');
  
  // Remove standalone numbers (bounded)
  const numPattern = /\b\d{1,6}\b/g;
  scrubbed = scrubbed.replace(numPattern, '[line]');

  return scrubbed.slice(0, 200);
}

/**
 * Handle errors with safe logging and generic outward response.
 */
export function handleError(error: unknown, context = 'mem-facilitator'): {
  status: 'error';
  message: string;
} {
  const errorMessage = getErrorMessage(error);
  const stack = error instanceof Error ? scrubStack(error.stack) : '';
  const shouldLogStack = process.env.NODE_ENV !== 'production' && process.env.CLAUDE_MEM_DEBUG === 'true';

  logger.error(context, 'MemFacilitator error', {
    error: errorMessage,
    ...(shouldLogStack && stack ? { stack } : {}),
  });

  return {
    status: 'error',
    message: GENERIC_ERROR_MESSAGE,
  };
}