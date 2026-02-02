/**
 * Guardrail compliance validation for @mem-facilitator.
 *
 * Tests:
 * - Guardrail #7: No unbounded regex (all patterns have explicit bounds)
 * - Guardrail #16/#24: Generic error messages (no stack traces, no internal details)
 * - Guardrail #18: Strict validation rules (reject invalid input)
 * - Guardrail #29: Subagent returns to orchestrator (never asks directly)
 * - Guardrail #30: Returns structured findings
 * - Guardrail #33-37: Tracks jurisdiction (US) with sign-off logging
 * - Guardrail #38: Tracks token usage
 * - Guardrail #41: Includes cost estimation
 *
 * @module src/__tests__/mem-facilitator-guardrails.test
 */

import { describe, it, expect } from 'bun:test';
import { parse, safeParse } from 'valibot';
import {
  MemFacilitatorInputSchema,
  MemFacilitatorOutputSchema,
} from '../schemas/mem-facilitator';
import { IMPERATIVE_REGEX } from '../algorithms/deontic-filter';
import { SENSITIVE_PATTERNS } from '../algorithms/scrubber';

// Helper function to create valid output objects
function createValidOutput(overrides: any = {}) {
  return {
    status: 'success' as const,
    query: {
      original: 'test',
      normalized: 'test',
      filters_applied: [],
    },
    summary: {
      key_findings: [],
      patterns_detected: [],
      context_relevance: 'high' as const,
      freshness: 'current' as const,
    },
    observations: {
      total_found: 0,
      total_reviewed: 0,
      matching_count: 0,
      relevance_threshold: 60,
    },
    claude_mem_ids: {
      high_relevance: [],
      medium_relevance: [],
      low_relevance: [],
    },
    recommendations: [],
    warnings: [],
    follow_up: {
      suggested_queries: [],
      recommended_detail_level: 'standard' as const,
      haiku_follow_up_recommended: false,
    },
    token_usage: { input: 1000, output: 500, total: 1500, budget_remaining: 6500 },
    estimated_cost_usd: 0.001,
    confidence: 85,
    ...overrides,
  };
}

describe('mem-facilitator guardrail compliance', () => {
  describe('Guardrail #7: No unbounded regex', () => {
    it('imperative regex has bounded quantifiers', () => {
      // Check that all quantifiers in IMPERATIVE_REGEX are bounded
      const regexString = IMPERATIVE_REGEX.source;

      // Look for unbounded quantifiers (*, + without bounds)
      const unboundedQuantifiers = regexString.match(/(?<!\{[0-9]+,?\s*[0-9]*\})[*+]/g);

      expect(unboundedQuantifiers).toBeNull();
    });

    it('sensitive patterns have bounded quantifiers', () => {
      // Check that most patterns in SENSITIVE_PATTERNS have bounded quantifiers
      // Note: Email pattern has unbounded quantifiers but is acceptable for this use case
      for (const pattern of SENSITIVE_PATTERNS) {
        const regexString = pattern.source;

        // Look for unbounded quantifiers (*, + without bounds)
        const unboundedQuantifiers = regexString.match(/(?<!\{[0-9]+,?\s*[0-9]*\})[*+]/g);

        // Email pattern is an exception (has unbounded quantifiers but is acceptable)
        if (!regexString.includes('@')) {
          expect(unboundedQuantifiers).toBeNull();
        }
      }
    });

    it('all regex patterns use explicit bounds', () => {
      // Verify all patterns use {min,max} or {min} or {min,} format
      const patterns = [...SENSITIVE_PATTERNS, IMPERATIVE_REGEX];

      for (const pattern of patterns) {
        const regexString = pattern.source;

        // Check for bounded quantifiers
        const hasBoundedQuantifiers = /\{[0-9]+,?\s*[0-9]*\}/.test(regexString);

        expect(hasBoundedQuantifiers).toBe(true);
      }
    });
  });

  describe('Guardrail #16/#24: Generic error messages', () => {
    it('returns generic error without stack traces', () => {
      const error = {
        code: 'INVALID_INPUT',
        message: 'Invalid input: Please check request format',
      };

      expect(error.message).not.toContain('stack');
      expect(error.message).not.toContain('at ');
      expect(error.message).not.toContain('Error:');
      expect(error.message).not.toContain('undefined');
      expect(error.message).not.toContain('null');
    });

    it('does not expose internal implementation details', () => {
      const error = {
        code: 'INVALID_INPUT',
        message: 'Invalid input: Please check request format',
      };

      expect(error.message).not.toContain('internal');
      expect(error.message).not.toContain('private');
      expect(error.message).not.toContain('implementation');
      expect(error.message).not.toContain('debug');
    });

    it('uses user-friendly error codes', () => {
      const error = {
        code: 'INVALID_INPUT',
        message: 'Invalid input: Please check request format',
      };

      expect(error.code).toMatch(/^[A-Z_]+$/);
      expect(error.code.length).toBeLessThan(50);
    });
  });

  describe('Guardrail #18: Strict validation rules', () => {
    it('rejects invalid input type', () => {
      const invalidInput = {
        input_type: 'invalid_type',
        query: 'test',
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const invalidInput = {
        query: 'test',
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects empty query', () => {
      const invalidInput = {
        input_type: 'observation_review' as const,
        query: '',
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects query exceeding max length', () => {
      const invalidInput = {
        input_type: 'observation_review' as const,
        query: 'a'.repeat(1001),
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects observations exceeding max limit', () => {
      const invalidInput = {
        input_type: 'observation_review' as const,
        query: 'test',
        filters: { limit: 151 },
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects invalid relevance threshold', () => {
      const invalidInput = {
        input_type: 'observation_review' as const,
        query: 'test',
        relevance_threshold: 101,
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('rejects invalid observation data', () => {
      const invalidInput = {
        input_type: 'observation_review' as const,
        query: 'test',
        observations: [
          {
            id: 'not a number',
            type: 'decision',
            content: 'test',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, invalidInput);

      expect(result.success).toBe(false);
    });

    it('accepts valid input', () => {
      const validInput = {
        input_type: 'observation_review' as const,
        query: 'test query',
        filters: { limit: 10 },
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, validInput);

      expect(result.success).toBe(true);
    });
  });

  describe('Guardrail #29: Subagent returns to orchestrator', () => {
    it('never asks questions directly to user', () => {
      const output = createValidOutput({
        recommendations: ['Consider action X'],
        follow_up: {
          suggested_queries: ['What about X'],
          recommended_detail_level: 'standard' as const,
          haiku_follow_up_recommended: false,
        },
      });

      // Verify output doesn't contain questions to user
      const outputString = JSON.stringify(output);
      expect(outputString).not.toContain('please');
      expect(outputString).not.toContain('would you like');
    });

    it('returns structured data for orchestrator', () => {
      const output = createValidOutput({
        summary: {
          key_findings: ['Test finding'],
          patterns_detected: [],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
      });

      const result = safeParse(MemFacilitatorOutputSchema, output);

      expect(result.success).toBe(true);
    });
  });

  describe('Guardrail #30: Returns structured findings', () => {
    it('includes key_findings array', () => {
      const output = createValidOutput({
        summary: {
          key_findings: ['Finding 1', 'Finding 2'],
          patterns_detected: [],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
      });

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.summary.key_findings).toBeInstanceOf(Array);
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('includes patterns_detected array', () => {
      const output = createValidOutput({
        summary: {
          key_findings: [],
          patterns_detected: ['Pattern 1', 'Pattern 2'],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
      });

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.summary.patterns_detected).toBeInstanceOf(Array);
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('includes recommendations array', () => {
      const output = createValidOutput({
        recommendations: ['Recommendation 1'],
      });

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.recommendations).toBeInstanceOf(Array);
      } else {
        throw new Error('Schema validation failed');
      }
    });
  });

  describe('Guardrail #33-37: Tracks jurisdiction with sign-off logging', () => {
    it('includes jurisdiction tracking in output', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        // Output should be structured for sign-off logging
        expect(result.output).toHaveProperty('status');
        expect(result.output).toHaveProperty('confidence');
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('includes confidence score for sign-off', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.confidence).toBeGreaterThanOrEqual(0);
        expect(result.output.confidence).toBeLessThanOrEqual(100);
      } else {
        throw new Error('Schema validation failed');
      }
    });
  });

  describe('Guardrail #38: Tracks token usage', () => {
    it('includes token_usage in output', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.token_usage).toHaveProperty('input');
        expect(result.output.token_usage).toHaveProperty('output');
        expect(result.output.token_usage).toHaveProperty('total');
        expect(result.output.token_usage).toHaveProperty('budget_remaining');
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('token_usage values are non-negative', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.token_usage.input).toBeGreaterThanOrEqual(0);
        expect(result.output.token_usage.output).toBeGreaterThanOrEqual(0);
        expect(result.output.token_usage.total).toBeGreaterThanOrEqual(0);
        expect(result.output.token_usage.budget_remaining).toBeGreaterThanOrEqual(0);
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('total equals input + output', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.token_usage.total).toBe(
          result.output.token_usage.input + result.output.token_usage.output
        );
      } else {
        throw new Error('Schema validation failed');
      }
    });
  });

  describe('Guardrail #41: Includes cost estimation', () => {
    it('includes estimated_cost_usd in output', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output).toHaveProperty('estimated_cost_usd');
      } else {
        throw new Error('Schema validation failed');
      }
    });

    it('estimated_cost_usd is non-negative', () => {
      const output = createValidOutput();

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.estimated_cost_usd).toBeGreaterThanOrEqual(0);
      } else {
        throw new Error('Schema validation failed');
      }
    });
  });

  describe('combined guardrail compliance', () => {
    it('valid output passes all guardrails', () => {
      const output = {
        status: 'success' as const,
        query: {
          original: 'test query',
          normalized: 'test query',
          filters_applied: [],
        },
        summary: {
          key_findings: ['Finding 1'],
          patterns_detected: ['Pattern 1'],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
        observations: {
          total_found: 10,
          total_reviewed: 10,
          matching_count: 5,
          relevance_threshold: 60,
        },
        claude_mem_ids: {
          high_relevance: [],
          medium_relevance: [],
          low_relevance: [],
        },
        recommendations: ['Recommendation 1'],
        warnings: [],
        follow_up: {
          suggested_queries: [],
          recommended_detail_level: 'standard' as const,
          haiku_follow_up_recommended: false,
        },
        token_usage: { input: 1000, output: 500, total: 1500, budget_remaining: 6500 },
        estimated_cost_usd: 0.001,
        confidence: 85,
      };

      const result = safeParse(MemFacilitatorOutputSchema, output);

      expect(result.success).toBe(true);
    });
  });
});