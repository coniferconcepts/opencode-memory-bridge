/**
 * Importance Scoring Performance Benchmarks
 *
 * Validates performance targets:
 * - Single score calculation: <1ms
 * - Batch scoring: <1ms per observation
 * - Database queries: <50ms
 */

import { describe, it, expect } from 'bun:test';
import { calculateImportanceScore, batchCalculateScores, type ObservationType } from '../scoring';

describe('Importance Scoring Performance', () => {
  const now = Date.now();
  const types: ObservationType[] = ['decision', 'bugfix', 'feature', 'refactor', 'change', 'discovery'];

  describe('Algorithm Performance (<1ms target)', () => {
    it('should calculate scores with <1ms average per score', () => {
      const start = performance.now();
      let result;
      for (let i = 0; i < 100; i++) {
        result = calculateImportanceScore({
          type: 'feature',
          narrativeLength: 300 + (i % 200),
          factsCount: 5 + (i % 5),
          conceptsCount: 6 + (i % 4),
          createdAtEpoch: now - (i * 1000),
          discoveryTokens: 5000 + (i * 100),
          referenceCount: 3 + (i % 3)
        });
      }
      const elapsed = performance.now() - start;
      const avgPerScore = elapsed / 100;

      expect(result!.score).toBeGreaterThan(0);
      expect(avgPerScore).toBeLessThan(1);
    });

    it('should batch score 1000 observations efficiently', () => {
      const observations = Array.from({ length: 1000 }, (_, i) => ({
        id: `obs-${i}`,
        type: types[i % types.length],
        narrative: `Test observation ${i}`,
        facts: Array(i % 10).fill('fact'),
        concepts: Array(i % 8).fill('concept'),
        createdAtEpoch: now - (i % 30) * 24 * 60 * 60 * 1000,
        discoveryTokens: i * 100,
        referenceCount: i % 5
      }));

      const start = performance.now();
      const scores = batchCalculateScores(observations);
      const elapsed = performance.now() - start;
      const avgPerObservation = elapsed / observations.length;

      expect(scores.size).toBe(1000);
      expect(avgPerObservation).toBeLessThan(1);
    });
  });

  describe('Score Distribution Quality', () => {
    it('should produce reasonable score distribution across observation types', () => {
      const typeScores = new Map<ObservationType, number[]>();

      for (const type of types) {
        typeScores.set(type, []);
      }

      // Score 100 observations of each type
      for (let i = 0; i < 100; i++) {
        for (const type of types) {
          const result = calculateImportanceScore({
            type,
            narrativeLength: 200,
            factsCount: 3,
            conceptsCount: 5,
            createdAtEpoch: now - (i % 30) * 24 * 60 * 60 * 1000,
            discoveryTokens: 3000,
            referenceCount: 1
          });
          typeScores.get(type)!.push(result.score);
        }
      }

      // Analyze distribution
      const avgScores = new Map<ObservationType, number>();
      for (const [type, scores] of typeScores.entries()) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        avgScores.set(type, avg);
      }

      // Decision should score higher than discovery on average
      expect(avgScores.get('decision')!).toBeGreaterThan(avgScores.get('discovery')!);

      // All scores should be in valid range
      for (const scores of typeScores.values()) {
        for (const score of scores) {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    });

    it('should distribute observations across tiers reasonably', () => {
      const tierCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      const samples = 1000;

      for (let i = 0; i < samples; i++) {
        const result = calculateImportanceScore({
          type: types[i % types.length],
          narrativeLength: 50 + (i % 500),
          factsCount: i % 10,
          conceptsCount: i % 8,
          createdAtEpoch: now - (i % 90) * 24 * 60 * 60 * 1000,
          discoveryTokens: i * 100,
          referenceCount: i % 5
        });
        tierCounts[result.tier]++;
      }

      // Verify reasonable distribution (not excessively skewed)
      // With varied inputs, should see multiple tiers represented
      const totalDistributed = Object.values(tierCounts).reduce((a, b) => a + b, 0);
      expect(totalDistributed).toBe(samples);

      // At least 2 tiers should be represented
      const nonEmptyTiers = Object.values(tierCounts).filter(count => count > 0).length;
      expect(nonEmptyTiers).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle extreme values efficiently', () => {
      const extremeCases = [
        {
          type: 'decision' as ObservationType,
          narrativeLength: 1000000,
          factsCount: 1000,
          conceptsCount: 1000,
          discoveryTokens: 1000000,
          referenceCount: 1000
        },
        {
          type: 'discovery' as ObservationType,
          narrativeLength: 0,
          factsCount: 0,
          conceptsCount: 0,
          discoveryTokens: 0,
          referenceCount: 0
        },
        {
          type: 'feature' as ObservationType,
          narrativeLength: 250,
          factsCount: 5,
          conceptsCount: 5,
          discoveryTokens: -1000,
          referenceCount: -5
        }
      ];

      for (const testCase of extremeCases) {
        const start = performance.now();
        const result = calculateImportanceScore({
          ...testCase,
          createdAtEpoch: now
        });
        const elapsed = performance.now() - start;

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(elapsed).toBeLessThan(1);
      }
    });
  });
});
