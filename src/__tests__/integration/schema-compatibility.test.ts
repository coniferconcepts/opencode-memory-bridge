import { describe, it, expect, beforeEach } from 'bun:test';
import * as v from 'valibot';
import { MemoryObservationSchema } from '../../schemas';
import { MemFacilitatorInputSchema, MemFacilitatorObservationSchema } from '../../schemas/mem-facilitator';
import { transformToMemFacilitatorFormat } from '../../integration/observation-transformer';
import { resetRateLimiter } from '../../utils/rate-limiter';

describe('schema compatibility', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('transforms service observations to facilitator format', () => {
    // Service observation (from claude-mem)
    const serviceObs = {
      id: 1,
      memory_session_id: 'session-123',
      project: 'test-project',
      type: 'decision',
      title: 'Test Decision',
      subtitle: null,
      narrative: 'This is the narrative content.',
      text: null,
      facts: null,
      concepts: null,
      files_read: null,
      files_modified: null,
      prompt_number: 1,
      created_at: '2026-01-26T10:00:00Z',
      created_at_epoch: 1737885600000,
    };

    // Validate service observation
    const serviceResult = v.safeParse(MemoryObservationSchema, serviceObs);
    expect(serviceResult.success).toBe(true);

    // Transform to facilitator format
    const [transformed] = transformToMemFacilitatorFormat([serviceObs]);

    // Validate transformed observation
    const facilitatorResult = v.safeParse(MemFacilitatorObservationSchema, transformed);
    expect(facilitatorResult.success).toBe(true);
  });

  it('handles parent_context without constraints', () => {
    const input = {
      input_type: 'observation_review',
      query: 'test query',
      filters: { limit: 10 },
      observations: [{
        id: 1,
        type: 'decision',
        content: 'Test content',
        metadata: {},
        timestamp: Date.now(),
      }],
      parent_context: {
        agent_id: 'planner',
        goals: ['test goal'],
        // constraints intentionally omitted
      },
    };

    const result = v.safeParse(MemFacilitatorInputSchema, input);
    expect(result.success).toBe(true);
  });

  it('uses default limit when not specified', () => {
    const input = {
      input_type: 'observation_review',
      query: 'test query',
      filters: {},  // limit not specified
      observations: [],
    };

    const result = v.safeParse(MemFacilitatorInputSchema, input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.filters.limit).toBe(50);  // DEFAULT_OBSERVATION_LIMIT
    }
  });
});