import { describe, it, expect } from 'bun:test';
import * as v from 'valibot';
import {
  MemFacilitatorInputSchema,
  MemFacilitatorOutputSchema,
} from '../schemas/mem-facilitator';

describe('MemFacilitatorInputSchema', () => {
  it('accepts valid input', () => {
    const payload = {
      input_type: 'observation_review',
      query: 'queue retry logic decisions',
      filters: { limit: 25 },
      observations: [
        {
          id: 101,
          type: 'decision',
          content: 'Adopted exponential backoff with jitter.',
          metadata: {},
          timestamp: 1737820800000,
        },
      ],
    };

    const result = v.safeParse(MemFacilitatorInputSchema, payload);
    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const payload = {
      input_type: 'observation_review',
      query: '',
      filters: { limit: 10 },
      observations: [],
    };

    const result = v.safeParse(MemFacilitatorInputSchema, payload);
    expect(result.success).toBe(false);
  });
});

describe('MemFacilitatorOutputSchema', () => {
  it('accepts valid output', () => {
    const payload = {
      status: 'success',
      query: {
        original: 'retry logic',
        normalized: 'retry logic',
        filters_applied: [],
      },
      summary: {
        key_findings: [],
        patterns_detected: [],
        context_relevance: 'low',
        freshness: 'current',
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
        recommended_detail_level: 'brief',
        haiku_follow_up_recommended: false,
      },
      token_usage: {
        input: 0,
        output: 0,
        total: 0,
        budget_remaining: 8000,
      },
      estimated_cost_usd: 0,
      confidence: 50,
    };

    const result = v.safeParse(MemFacilitatorOutputSchema, payload);
    expect(result.success).toBe(true);
  });

  it('rejects invalid relevance score', () => {
    const payload = {
      status: 'success',
      query: {
        original: 'retry logic',
        normalized: 'retry logic',
        filters_applied: [],
      },
      summary: {
        key_findings: [],
        patterns_detected: [],
        context_relevance: 'low',
        freshness: 'current',
      },
      observations: {
        total_found: 0,
        total_reviewed: 0,
        matching_count: 0,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [
          {
            id: 10,
            ref: 'obs_10',
            type: 'decision',
            relevanceScore: 101,
            excerpt: 'Exceeded bounds',
            relevanceReason: 'Invalid score',
            timestamp: 1737820800000,
          },
        ],
        medium_relevance: [],
        low_relevance: [],
      },
      recommendations: [],
      warnings: [],
      follow_up: {
        suggested_queries: [],
        recommended_detail_level: 'brief',
        haiku_follow_up_recommended: false,
      },
      token_usage: {
        input: 0,
        output: 0,
        total: 0,
        budget_remaining: 8000,
      },
      estimated_cost_usd: 0,
      confidence: 50,
    };

    const result = v.safeParse(MemFacilitatorOutputSchema, payload);
    expect(result.success).toBe(false);
  });
});