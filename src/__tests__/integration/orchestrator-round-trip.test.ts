/**
 * Integration tests for orchestrator round-trip pattern.
 *
 * Tests the coordination between @memory-bridge and @mem-facilitator.
 *
 * @module src/__tests__/integration/orchestrator-round-trip.test
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  orchestratorRoundTrip,
  createMockMemoryBridge,
  createMockMemFacilitator,
  type RoundTripResult,
} from '../../integration/orchestrator-round-trip';
import type { MemoryObservation } from '../../schemas';
import { resetRateLimiter } from '../../utils/rate-limiter';

describe('orchestrator round-trip', () => {
  beforeEach(() => {
    // Reset rate limiter before each test
    resetRateLimiter();
  });

  it('coordinates memory-bridge and mem-facilitator', async () => {
    // Mock @memory-bridge
    const mockObservations: MemoryObservation[] = [
      {
        id: 1,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'decision',
        title: 'Retry Logic Decision',
        narrative: 'Retry logic decision: Use exponential backoff with max 3 retries',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
      {
        id: 2,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'problem-solution',
        title: 'Queue Immutability',
        narrative: 'Queue messages are immutable once sent',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
    ];

    // Mock @mem-facilitator
    const mockResult: Partial<RoundTripResult> = {
      status: 'success',
      summary: {
        key_findings: ['Exponential backoff implemented'],
        patterns_detected: ['Fail-fast on permanent errors'],
        context_relevance: 'high',
        freshness: 'current',
      },
      claude_mem_ids: {
        high_relevance: [
          {
            id: 1,
            ref: 'obs_1',
            type: 'decision',
            relevanceScore: 95,
            excerpt: 'Exponential backoff with max 3 retries',
            relevanceReason: 'Directly addresses retry logic',
            timestamp: Date.now(),
          },
        ],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 5000,
        output: 1500,
        total: 6500,
        budget_remaining: 1500,
      },
      estimated_cost_usd: 0.0039,
      confidence: 87,
    };

    // Test round-trip
    const result = await orchestratorRoundTrip(
      'retry logic',
      { limit: 10 },
      { output_format: 'summary_with_ids' },
      {},
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );

    expect(result.status).toBe('success');
    expect(result.summary.key_findings).toContain('Exponential backoff implemented');
    expect(result.claude_mem_ids.high_relevance).toHaveLength(1);
    expect(result.claude_mem_ids.high_relevance[0].relevanceScore).toBe(95);
  });

  it('enforces token budget', async () => {
    // Create many observations to exceed budget
    const mockObservations: MemoryObservation[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      memory_session_id: 'session-1',
      project: 'test',
      type: 'decision',
      title: `Decision ${i + 1}`,
      narrative: 'A'.repeat(1000), // ~250 tokens each
      text: null,
      facts: null,
      concepts: null,
      files_read: null,
      files_modified: null,
      created_at: '2026-01-26T10:00:00Z',
      created_at_epoch: Date.now(),
    }));

    const mockResult: Partial<RoundTripResult> = {
      status: 'partial',
      summary: {
        key_findings: ['Partial results due to token budget'],
        patterns_detected: [],
        context_relevance: 'medium',
        freshness: 'recent',
      },
      observations: {
        total_found: 100,
        total_reviewed: 24, // ~6000 tokens / 250 tokens per obs
        matching_count: 24,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 6000,
        output: 1000,
        total: 7000,
        budget_remaining: 0,
      },
      estimated_cost_usd: 0.0042,
      confidence: 75,
    };

    const result = await orchestratorRoundTrip(
      'test query',
      { limit: 100 },
      {},
      {},
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );

    expect(result.truncation_reason).toBe('token_budget');
    expect(result.warnings.some(w => w.includes('truncated due to token_budget'))).toBe(true);
  });

  it('enforces rate limiting', async () => {
    const mockObservations: MemoryObservation[] = [
      {
        id: 1,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'decision',
        title: 'Test Decision',
        narrative: 'Test observation',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
    ];

    const mockResult: Partial<RoundTripResult> = {
      status: 'success',
      summary: {
        key_findings: ['Test finding'],
        patterns_detected: [],
        context_relevance: 'medium',
        freshness: 'recent',
      },
      observations: {
        total_found: 1,
        total_reviewed: 1,
        matching_count: 1,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 1000,
        output: 500,
        total: 1500,
        budget_remaining: 6500,
      },
      estimated_cost_usd: 0.0009,
      confidence: 80,
    };

    // Make 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const result = await orchestratorRoundTrip(
        'test query',
        {},
        {},
        {},
        createMockMemoryBridge(mockObservations),
        createMockMemFacilitator(mockResult),
      );
      expect(result.status).toBe('success');
    }

    // 11th request should return error status (not throw)
    const result = await orchestratorRoundTrip(
      'test query',
      {},
      {},
      {},
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );
    expect(result.status).toBe('error');
    expect(result.warnings).toContainEqual(expect.stringContaining('Rate limit'));
  });

  it('handles empty observations', async () => {
    const mockResult: Partial<RoundTripResult> = {
      status: 'empty',
      summary: {
        key_findings: [],
        patterns_detected: [],
        context_relevance: 'low',
        freshness: 'stale',
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
      recommendations: ['Try a different query or expand time range'],
      warnings: [],
      follow_up: {
        suggested_queries: [],
        recommended_detail_level: 'standard',
        haiku_follow_up_recommended: false,
      },
      token_usage: {
        input: 0,
        output: 0,
        total: 0,
        budget_remaining: 8000,
      },
      estimated_cost_usd: 0,
      confidence: 0,
    };

    const result = await orchestratorRoundTrip(
      'nonexistent query',
      {},
      {},
      {},
      createMockMemoryBridge([]),
      createMockMemFacilitator(mockResult),
    );

    expect(result.status).toBe('empty');
    expect(result.recommendations).toContain('Try a different query or expand time range');
  });

  it('applies filters correctly', async () => {
    const mockObservations: MemoryObservation[] = [
      {
        id: 1,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'decision',
        title: 'Queue Immutability',
        narrative: 'Architecture decision about queue immutability',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
      {
        id: 2,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'problem-solution',
        title: 'Retry Logic Fix',
        narrative: 'Fixed retry logic bug',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
    ];

    const mockResult: Partial<RoundTripResult> = {
      status: 'success',
      summary: {
        key_findings: ['Queue immutability decision'],
        patterns_detected: [],
        context_relevance: 'high',
        freshness: 'current',
      },
      observations: {
        total_found: 2,
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
            relevanceScore: 90,
            timestamp: Date.now(),
          },
        ],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 2000,
        output: 800,
        total: 2800,
        budget_remaining: 5200,
      },
      estimated_cost_usd: 0.0017,
      confidence: 85,
    };

    const result = await orchestratorRoundTrip(
      'queue immutability',
      { types: ['decision'], limit: 10 },
      {},
      {},
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );

    expect(result.status).toBe('success');
    expect(result.observations.total_reviewed).toBe(1);
  });

  it('tracks token usage correctly', async () => {
    const mockObservations: MemoryObservation[] = [
      {
        id: 1,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'decision',
        title: 'Test Decision',
        narrative: 'Test observation with some content',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
    ];

    const mockResult: Partial<RoundTripResult> = {
      status: 'success',
      summary: {
        key_findings: ['Test finding'],
        patterns_detected: [],
        context_relevance: 'medium',
        freshness: 'recent',
      },
      observations: {
        total_found: 1,
        total_reviewed: 1,
        matching_count: 1,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 3000,
        output: 1200,
        total: 4200,
        budget_remaining: 3800,
      },
      estimated_cost_usd: 0.0025,
      confidence: 80,
    };

    const result = await orchestratorRoundTrip(
      'test query',
      {},
      {},
      {},
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );

    expect(result.token_usage.input).toBe(3000);
    expect(result.token_usage.output).toBe(1200);
    expect(result.token_usage.total).toBe(4200);
    expect(result.token_usage.budget_remaining).toBe(3800);
    // Cost is calculated: (3000/1M * 0.30) + (1200/1M * 0.60) = 0.0009 + 0.00072 = 0.00162
    expect(result.estimated_cost_usd).toBeCloseTo(0.00162, 5);
  });

  it('includes parent context in processing', async () => {
    const mockObservations: MemoryObservation[] = [
      {
        id: 1,
        memory_session_id: 'session-1',
        project: 'test',
        type: 'decision',
        title: 'Retry Logic',
        narrative: 'Retry logic decision',
        text: null,
        facts: null,
        concepts: null,
        files_read: null,
        files_modified: null,
        created_at: '2026-01-26T10:00:00Z',
        created_at_epoch: Date.now(),
      },
    ];

    const mockResult: Partial<RoundTripResult> = {
      status: 'success',
      summary: {
        key_findings: ['Exponential backoff'],
        patterns_detected: [],
        context_relevance: 'high',
        freshness: 'current',
      },
      observations: {
        total_found: 1,
        total_reviewed: 1,
        matching_count: 1,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      token_usage: {
        input: 2500,
        output: 1000,
        total: 3500,
        budget_remaining: 4500,
      },
      estimated_cost_usd: 0.0021,
      confidence: 90,
    };

    const parentContext = {
      agent_id: 'planner',
      goals: ['understand retry patterns', 'identify edge cases'],
      constraints: ['max 3 retries'],
    };

    const result = await orchestratorRoundTrip(
      'retry logic',
      {},
      {},
      parentContext,
      createMockMemoryBridge(mockObservations),
      createMockMemFacilitator(mockResult),
    );

    expect(result.status).toBe('success');
    expect(result.confidence).toBe(90);
  });
});