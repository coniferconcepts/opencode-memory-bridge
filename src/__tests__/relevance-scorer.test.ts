import { describe, it, expect } from 'bun:test';
import {
  calculateScore,
  scoreRelevance,
  type Observation,
} from '../algorithms/relevance-scorer';

describe('relevance scoring', () => {
  it('produces deterministic scores for identical inputs', () => {
    const now = 1738000000000;
    const obs: Observation = {
      id: 1,
      type: 'decision',
      content: 'alpha beta gamma',
      timestamp: now - 1000,
      metadata: {},
    };

    const score1 = calculateScore(obs, 'alpha beta', ['decision'], { now });
    const score2 = calculateScore(obs, 'alpha beta', ['decision'], { now });

    expect(score1).toBe(score2);
    expect(score1).toBeGreaterThanOrEqual(0);
    expect(score1).toBeLessThanOrEqual(100);
  });

  it('sorts by score, then recency, then memId', () => {
    const now = 1738000000000;
    const observations: Observation[] = [
      { id: 1, type: 'decision', content: 'alpha beta', timestamp: now - 2000 },
      { id: 2, type: 'decision', content: 'alpha beta', timestamp: now - 1000 },
      { id: 3, type: 'decision', content: 'alpha beta', timestamp: now - 1000 },
    ];

    const ranked = scoreRelevance(observations, 'alpha', ['decision'], { now });

    expect(ranked[0].memId).toBe(3); // tie on score & timestamp → memId desc
    expect(ranked[1].memId).toBe(2);
    expect(ranked[2].memId).toBe(1);
  });

  it('rewards query overlap over unrelated content', () => {
    const now = 1738000000000;
    const obsMatch: Observation = {
      id: 1,
      type: 'decision',
      content: 'queue retry logic decision',
      timestamp: now - 1000,
      metadata: {},
    };
    const obsNoMatch: Observation = {
      id: 2,
      type: 'decision',
      content: 'unrelated gardening notes',
      timestamp: now - 1000,
    };

    const scoreMatch = calculateScore(obsMatch, 'retry logic', [], { now });
    const scoreNoMatch = calculateScore(obsNoMatch, 'retry logic', [], { now });

    expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
  });
});