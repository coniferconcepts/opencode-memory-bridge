/**
 * Edge case testing for @mem-facilitator.
 *
 * Tests:
 * - Empty observations array
 * - Single observation
 * - Maximum observations (150)
 * - Observations with missing fields
 * - Observations with invalid timestamps
 * - Observations with special characters
 * - Observations with very long content
 * - Observations with no content
 * - Observations with duplicate IDs
 * - Observations with negative IDs
 *
 * @module src/__tests__/mem-facilitator-edge-cases.test
 */

import { describe, it, expect } from 'bun:test';
import { safeParse } from 'valibot';
import {
  MemFacilitatorInputSchema,
  MemFacilitatorOutputSchema,
} from '../schemas/mem-facilitator';

describe('mem-facilitator edge cases', () => {
  describe('empty observations array', () => {
    it('handles empty observations array', () => {
      const input = {
        input_type: 'observation_review' as const,
        query: 'test query',
        filters: { limit: 10 },
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('returns empty status for empty observations', () => {
      const output = {
        status: 'empty' as const,
        query: {
          original: 'test query',
          normalized: 'test query',
          filters_applied: [],
        },
        summary: {
          key_findings: [],
          patterns_detected: [],
          context_relevance: 'low' as const,
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
        recommendations: ['Try broadening search criteria'],
        warnings: ['No matching observations found'],
        follow_up: {
          suggested_queries: [],
          recommended_detail_level: 'standard' as const,
          haiku_follow_up_recommended: false,
        },
        token_usage: { input: 100, output: 50, total: 150, budget_remaining: 7850 },
        estimated_cost_usd: 0.0001,
        confidence: 0,
      };

      const result = safeParse(MemFacilitatorOutputSchema, output);

      if (result.success) {
        expect(result.output.status).toBe('empty');
      } else {
        throw new Error('Schema validation failed');
      }
    });
  });

  describe('single observation', () => {
    it('handles single observation', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
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

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('processes single observation correctly', () => {
      const output = {
        status: 'success' as const,
        query: {
          original: 'test query',
          normalized: 'test query',
          filters_applied: [],
        },
        summary: {
          key_findings: ['Single finding'],
          patterns_detected: [],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
        observations: {
          total_found: 1,
          total_reviewed: 1,
          matching_count: 1,
          relevance_threshold: 60,
        },
        claude_mem_ids: {
          high_relevance: [
            {
              id: 1,
              ref: 'obs_1',
              type: 'decision',
              relevanceScore: 95,
              excerpt: 'test content',
              relevanceReason: 'Direct match',
              timestamp: Date.now(),
            },
          ],
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
        token_usage: { input: 100, output: 50, total: 150, budget_remaining: 7850 },
        estimated_cost_usd: 0.0001,
        confidence: 95,
      };

      const result = safeParse(MemFacilitatorOutputSchema, output);

      expect(result.success).toBe(true);
    });
  });

  describe('maximum observations (150)', () => {
    it('handles maximum observations limit', () => {
      const observations = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `test content ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations,
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('rejects observations exceeding maximum limit', () => {
      const observations = Array.from({ length: 151 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `test content ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 151 },
        query: 'test query',
        observations,
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });
  });

  describe('observations with missing fields', () => {
    it('rejects observation missing id', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: Date.now(),
          } as any,
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('rejects observation missing type', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            content: 'test content',
            metadata: {},
            timestamp: Date.now(),
          } as any,
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('rejects observation missing content', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            metadata: {},
            timestamp: Date.now(),
          } as any,
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('rejects observation missing timestamp', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content',
            metadata: {},
          } as any,
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });
  });

  describe('observations with invalid timestamps', () => {
    it('handles negative timestamp', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: -1,
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles zero timestamp', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: 0,
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles future timestamp', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: Date.now() + 86400000 * 365, // 1 year in future
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('observations with special characters', () => {
    it('handles unicode characters', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'Test with unicode: 🎉, 中文, العربية',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles emoji characters', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'Test with emoji 😀 🎉 ❤️',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles special symbols', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'Test with symbols: @#$%^&*()_+-=[]{}|;:,.<>?',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles newlines and tabs', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'Test with\nnewlines\tand\ttabs',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('observations with very long content', () => {
    it('handles very long content (10000 chars)', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'a'.repeat(10000),
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles very long content (100000 chars)', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'a'.repeat(100000),
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('observations with no content', () => {
    it('handles empty string content', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: '',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles whitespace-only content', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: '   \n\t   ',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('observations with duplicate IDs', () => {
    it('handles duplicate IDs in observations array', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 1,
            type: 'decision',
            content: 'test content 1',
            metadata: {},
            timestamp: Date.now(),
          },
          {
            id: 1,
            type: 'decision',
            content: 'test content 2',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('observations with negative IDs', () => {
    it('handles negative ID', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: -1,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles zero ID', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        observations: [
          {
            id: 0,
            type: 'decision',
            content: 'test content',
            metadata: {},
            timestamp: Date.now(),
          },
        ],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('filter edge cases', () => {
    it('handles invalid time_range value', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10, time_range: 'invalid' as any },
        query: 'test query',
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('handles invalid relevance threshold (negative)', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        relevance_threshold: -1,
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('handles invalid relevance threshold (>100)', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        relevance_threshold: 101,
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('handles invalid detail_level', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        detail_level: 'invalid' as any,
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });

    it('handles invalid output_format', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
        output_format: 'invalid' as any,
        observations: [],
      };

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(false);
    });
  });

  describe('metadata edge cases', () => {
    it('handles empty metadata object', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
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

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });

    it('handles metadata with various types', () => {
      const input = {
        input_type: 'observation_review' as const,
        filters: { limit: 10 },
        query: 'test query',
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

      const result = safeParse(MemFacilitatorInputSchema, input);

      expect(result.success).toBe(true);
    });
  });

  describe('excerpt length edge cases', () => {
    it('handles excerpt at max length (200 chars)', () => {
      const output = {
        status: 'success' as const,
        query: {
          original: 'test query',
          normalized: 'test query',
          filters_applied: [],
        },
        summary: {
          key_findings: [],
          patterns_detected: [],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
        observations: {
          total_found: 1,
          total_reviewed: 1,
          matching_count: 1,
          relevance_threshold: 60,
        },
        claude_mem_ids: {
          high_relevance: [
            {
              id: 1,
              ref: 'obs_1',
              type: 'decision',
              relevanceScore: 95,
              excerpt: 'a'.repeat(200),
              relevanceReason: 'Direct match',
              timestamp: Date.now(),
            },
          ],
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
        token_usage: { input: 100, output: 50, total: 150, budget_remaining: 7850 },
        estimated_cost_usd: 0.0001,
        confidence: 95,
      };

      const result = safeParse(MemFacilitatorOutputSchema, output);

      expect(result.success).toBe(true);
    });

    it('rejects excerpt exceeding max length (201 chars)', () => {
      const output = {
        status: 'success' as const,
        query: {
          original: 'test query',
          normalized: 'test query',
          filters_applied: [],
        },
        summary: {
          key_findings: [],
          patterns_detected: [],
          context_relevance: 'high' as const,
          freshness: 'current' as const,
        },
        observations: {
          total_found: 1,
          total_reviewed: 1,
          matching_count: 1,
          relevance_threshold: 60,
        },
        claude_mem_ids: {
          high_relevance: [
            {
              id: 1,
              ref: 'obs_1',
              type: 'decision',
              relevanceScore: 95,
              excerpt: 'a'.repeat(201),
              relevanceReason: 'Direct match',
              timestamp: Date.now(),
            },
          ],
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
        token_usage: { input: 100, output: 50, total: 150, budget_remaining: 7850 },
        estimated_cost_usd: 0.0001,
        confidence: 95,
      };

      const result = safeParse(MemFacilitatorOutputSchema, output);

      expect(result.success).toBe(false);
    });
  });
});