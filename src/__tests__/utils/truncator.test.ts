/**
 * Unit tests for truncator.
 *
 * @module src/__tests__/utils/truncator.test
 */

import { describe, it, expect } from 'bun:test';
import {
  truncateContent,
  truncateObservations,
  chunkObservations,
  estimateObservationTokens,
  getObservationSizeStats,
} from '../../utils/truncator';
import type { Observation } from '../../algorithms/relevance-scorer';

describe('truncator', () => {
  it('truncates content to max tokens', () => {
    const longContent = 'A'.repeat(1000);
    const truncated = truncateContent(longContent, 200);

    expect(truncated.length).toBeLessThan(1000);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('does not truncate short content', () => {
    const shortContent = 'Hello world';
    const truncated = truncateContent(shortContent, 200);

    expect(truncated).toBe(shortContent);
  });

  it('truncates observations to fit within max tokens', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'A'.repeat(1000), timestamp: Date.now() },
      { id: 2, type: 'decision', content: 'B'.repeat(1000), timestamp: Date.now() },
      { id: 3, type: 'decision', content: 'C'.repeat(1000), timestamp: Date.now() },
    ];

    const result = truncateObservations(observations, 500);

    expect(result.status).toBe('partial');
    expect(result.truncation_reason).toBe('token_budget');
    expect(result.truncated.length).toBeLessThan(3);
  });

  it('does not truncate when within budget', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'Short', timestamp: Date.now() },
      { id: 2, type: 'decision', content: 'Content', timestamp: Date.now() },
    ];

    const result = truncateObservations(observations, 1000);

    expect(result.status).toBe('complete');
    expect(result.truncated).toHaveLength(2);
  });

  it('chunks observations into batches', () => {
    const observations: Observation[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      type: 'decision',
      content: 'A'.repeat(200), // ~50 tokens each
      timestamp: Date.now(),
    }));

    const chunks = chunkObservations(observations, 1000); // ~20 obs per chunk

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length > 0)).toBe(true);
  });

  it('estimates observation tokens correctly', () => {
    const obs: Observation = {
      id: 1,
      type: 'decision',
      content: 'Hello world',
      timestamp: Date.now(),
    };

    const tokens = estimateObservationTokens(obs);
    expect(tokens).toBe(3); // 11 chars / 4 = 2.75 -> 3
  });

  it('provides observation size statistics', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'A'.repeat(100), timestamp: Date.now() },
      { id: 2, type: 'decision', content: 'B'.repeat(200), timestamp: Date.now() },
      { id: 3, type: 'decision', content: 'C'.repeat(300), timestamp: Date.now() },
    ];

    const stats = getObservationSizeStats(observations);

    expect(stats.totalObservations).toBe(3);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.averageTokensPerObservation).toBeGreaterThan(0);
    expect(stats.minTokens).toBeLessThanOrEqual(stats.maxTokens);
  });

  it('handles empty observations', () => {
    const result = truncateObservations([], 1000);

    expect(result.status).toBe('complete');
    expect(result.truncated).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('truncates individual observation content when too long', () => {
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'A'.repeat(1000), timestamp: Date.now() },
    ];

    const result = truncateObservations(observations, 10000);

    expect(result.status).toBe('complete');
    expect(result.truncated[0].content.length).toBeLessThan(1000);
    expect(result.truncated[0].content.endsWith('...')).toBe(true);
  });
});