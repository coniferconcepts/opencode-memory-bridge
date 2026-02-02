/**
 * Unit tests for token budget enforcer.
 *
 * @module src/__tests__/utils/token-budget-enforcer.test
 */

import { describe, it, expect } from 'bun:test';
import {
  enforceTokenBudget,
  fitsWithinBudget,
  getTokenBudgetSummary,
  estimateTokens,
  SUBAGENT_MEMORY_TOKEN_BUDGET,
  OBSERVATION_TOKENS_BUDGET,
} from '../../utils/token-budget-enforcer';
import type { Observation } from '../../algorithms/relevance-scorer';

describe('token budget enforcer', () => {
  it('estimates tokens correctly', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
    expect(estimateTokens('a'.repeat(100))).toBe(25); // 100 chars / 4 = 25
    expect(estimateTokens('')).toBe(0);
  });

  it('enforces token budget with small observations', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'Short content', timestamp: Date.now() },
      { id: 2, type: 'decision', content: 'Another short', timestamp: Date.now() },
    ];

    const result = enforceTokenBudget(observations);

    expect(result.status).toBe('complete');
    expect(result.truncated).toHaveLength(2);
    expect(result.totalTokens).toBeLessThanOrEqual(OBSERVATION_TOKENS_BUDGET);
  });

  it('truncates when budget exceeded', () => {
    // Create observations that exceed 6000 tokens
    const observations: Observation[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      type: 'decision',
      content: 'A'.repeat(1000), // ~250 tokens each
      timestamp: Date.now(),
    }));

    const result = enforceTokenBudget(observations);

    expect(result.status).toBe('partial');
    expect(result.truncationReason).toBe('token_budget');
    expect(result.truncated.length).toBeLessThan(100);
    expect(result.totalTokens).toBeLessThanOrEqual(OBSERVATION_TOKENS_BUDGET);
  });

  it('checks if observations fit within budget', () => {
    const smallObservations: Observation[] = [
      { id: 1, type: 'decision', content: 'Small', timestamp: Date.now() },
    ];

    const largeObservations: Observation[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      type: 'decision',
      content: 'A'.repeat(1000),
      timestamp: Date.now(),
    }));

    expect(fitsWithinBudget(smallObservations)).toBe(true);
    expect(fitsWithinBudget(largeObservations)).toBe(false);
  });

  it('provides token budget summary', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'A'.repeat(100), timestamp: Date.now() },
      { id: 2, type: 'decision', content: 'B'.repeat(200), timestamp: Date.now() },
      { id: 3, type: 'decision', content: 'C'.repeat(300), timestamp: Date.now() },
    ];

    const summary = getTokenBudgetSummary(observations);

    expect(summary.totalObservations).toBe(3);
    expect(summary.totalTokens).toBeGreaterThan(0);
    expect(summary.averageTokensPerObservation).toBeGreaterThan(0);
    expect(summary.estimatedObservationsThatFit).toBeGreaterThan(0);
  });

  it('handles empty observations', () => {
    const result = enforceTokenBudget([]);

    expect(result.status).toBe('complete');
    expect(result.truncated).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('respects custom max tokens', () => {
    const observations: Observation[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      type: 'decision',
      content: 'A'.repeat(100),
      timestamp: Date.now(),
    }));

    const result = enforceTokenBudget(observations, 1000);

    expect(result.status).toBe('partial');
    expect(result.truncationReason).toBe('token_budget');
    expect(result.totalTokens).toBeLessThanOrEqual(1000);
  });
});