import { describe, it, expect } from 'bun:test';
import {
  validateMemFacilitatorInput,
  validateMemFacilitatorOutput,
} from '../validation/mem-facilitator-validator';

describe('mem-facilitator validator', () => {
  it('accepts valid input', () => {
    const payload = {
      input_type: 'observation_review',
      query: 'schema validation',
      filters: { limit: 5 },
      observations: [],
    };

    const result = validateMemFacilitatorInput(payload);
    expect(result.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    const payload = {
      input_type: 'observation_review',
      query: 'schema validation',
      filters: { limit: 5 },
      observations: [],
      unexpected: 'nope',
    };

    const result = validateMemFacilitatorInput(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid output status', () => {
    const payload = {
      status: 'ok',
    };

    const result = validateMemFacilitatorOutput(payload);
    expect(result.success).toBe(false);
  });
});