import { describe, it, expect } from 'bun:test';
import { handleError, scrubStack } from '../utils/error-handler';

describe('error-handler', () => {
  it('returns generic message without leakage', () => {
    const error = new Error('token=sk-1234567890');
    const result = handleError(error);
    expect(result.status).toBe('error');
    expect(result.message).toBe('An error occurred while processing your request');
  });

  it('scrubs stack paths and line numbers', () => {
    const stack = 'Error: fail\nat /Users/test/project/src/file.ts:12:34';
    const scrubbed = scrubStack(stack);
    expect(scrubbed).not.toContain('/Users');
    expect(scrubbed).toContain('[path]');
  });
});