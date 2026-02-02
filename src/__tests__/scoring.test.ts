/**
 * Importance Scoring Tests
 *
 * Validates:
 * - Multi-dimensional scoring algorithm
 * - Tier classification (critical/high/medium/low)
 * - Individual scoring components
 * - Batch scoring operations
 * - Edge cases and boundary conditions
 */

import { describe, it, expect } from 'bun:test';
import {
  calculateImportanceScore,
  batchCalculateScores,
  type ObservationType,
  type ImportanceTier
} from '../scoring';

describe('Importance Scoring System', () => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  describe('Type-Based Scoring', () => {
    it('should assign highest score to decisions', () => {
      const result = calculateImportanceScore({
        type: 'decision',
        createdAtEpoch: now
      });
      expect(result.factors.type_score).toBe(30);
    });

    it('should assign high score to bugfixes', () => {
      const result = calculateImportanceScore({
        type: 'bugfix',
        createdAtEpoch: now
      });
      expect(result.factors.type_score).toBe(25);
    });

    it('should assign medium score to features', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: now
      });
      expect(result.factors.type_score).toBe(20);
    });

    it('should assign lowest score to discoveries', () => {
      const result = calculateImportanceScore({
        type: 'discovery',
        createdAtEpoch: now
      });
      expect(result.factors.type_score).toBe(10);
    });
  });

  describe('Content Quality Scoring', () => {
    it('should score narrative length correctly', () => {
      const longNarrative = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 600,
        createdAtEpoch: now
      });
      expect(longNarrative.factors.content_quality).toBeGreaterThanOrEqual(10);

      const shortNarrative = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 30,
        createdAtEpoch: now
      });
      expect(shortNarrative.factors.content_quality).toBeLessThan(10);
    });

    it('should score facts count correctly', () => {
      const manyFacts = calculateImportanceScore({
        type: 'feature',
        factsCount: 7,
        createdAtEpoch: now
      });
      expect(manyFacts.factors.content_quality).toBeGreaterThanOrEqual(10);

      const noFacts = calculateImportanceScore({
        type: 'feature',
        factsCount: 0,
        createdAtEpoch: now
      });
      expect(noFacts.factors.content_quality).toBe(0);
    });

    it('should score concepts count correctly', () => {
      const manyConcepts = calculateImportanceScore({
        type: 'feature',
        conceptsCount: 10,
        createdAtEpoch: now
      });
      expect(manyConcepts.factors.content_quality).toBeGreaterThanOrEqual(10);

      const noConcepts = calculateImportanceScore({
        type: 'feature',
        conceptsCount: 0,
        createdAtEpoch: now
      });
      expect(noConcepts.factors.content_quality).toBe(0);
    });

    it('should cap content quality at 30 points', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 1000,
        factsCount: 10,
        conceptsCount: 10,
        createdAtEpoch: now
      });
      expect(result.factors.content_quality).toBeLessThanOrEqual(30);
    });
  });

  describe('Recency Scoring', () => {
    it('should give full points to very recent observations', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: oneHourAgo
      });
      expect(result.factors.recency).toBeCloseTo(20, 1);
    });

    it('should decay over time', () => {
      const oneHour = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: oneHourAgo
      });
      const thirtyDays = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: thirtyDaysAgo
      });
      expect(oneHour.factors.recency).toBeGreaterThan(thirtyDays.factors.recency);
    });

    it('should cap at 20 points', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: now
      });
      expect(result.factors.recency).toBeLessThanOrEqual(20);
    });

    it('should never go negative', () => {
      const veryOld = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: now - 365 * 24 * 60 * 60 * 1000
      });
      expect(veryOld.factors.recency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ROI Scoring', () => {
    it('should score based on discovery tokens', () => {
      const highTokens = calculateImportanceScore({
        type: 'feature',
        discoveryTokens: 10000,
        createdAtEpoch: now
      });
      expect(highTokens.factors.roi).toBeGreaterThan(5);

      const lowTokens = calculateImportanceScore({
        type: 'feature',
        discoveryTokens: 1000,
        createdAtEpoch: now
      });
      expect(lowTokens.factors.roi).toBeLessThan(5);
    });

    it('should cap at 10 points', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        discoveryTokens: 100000,
        createdAtEpoch: now
      });
      expect(result.factors.roi).toBeLessThanOrEqual(10);
    });
  });

  describe('References Scoring', () => {
    it('should score based on reference count', () => {
      const manyRefs = calculateImportanceScore({
        type: 'feature',
        referenceCount: 5,
        createdAtEpoch: now
      });
      expect(manyRefs.factors.references).toBe(10);

      const fewRefs = calculateImportanceScore({
        type: 'feature',
        referenceCount: 2,
        createdAtEpoch: now
      });
      expect(fewRefs.factors.references).toBe(4);
    });

    it('should cap at 10 points', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        referenceCount: 100,
        createdAtEpoch: now
      });
      expect(result.factors.references).toBeLessThanOrEqual(10);
    });
  });

  describe('Tier Classification', () => {
    it('should classify critical observations (90+)', () => {
      const result = calculateImportanceScore({
        type: 'decision',
        narrativeLength: 600,
        factsCount: 8,
        conceptsCount: 10,
        createdAtEpoch: oneHourAgo,
        discoveryTokens: 8000,
        referenceCount: 5
      });
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.tier).toBe('critical');
    });

    it('should classify high observations (70-89)', () => {
      const result = calculateImportanceScore({
        type: 'bugfix',
        narrativeLength: 400,
        factsCount: 5,
        conceptsCount: 6,
        createdAtEpoch: oneHourAgo,
        discoveryTokens: 4000,
        referenceCount: 3
      });
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThan(90);
      expect(result.tier).toBe('high');
    });

    it('should classify medium observations (40-69)', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 300,
        factsCount: 4,
        conceptsCount: 5,
        createdAtEpoch: thirtyDaysAgo,
        discoveryTokens: 2000
      });
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
      expect(result.tier).toBe('medium');
    });

    it('should classify low observations (0-39)', () => {
      const result = calculateImportanceScore({
        type: 'discovery',
        createdAtEpoch: thirtyDaysAgo
      });
      expect(result.score).toBeLessThan(40);
      expect(result.tier).toBe('low');
    });
  });

  describe('Score Bounds', () => {
    it('should never exceed 100', () => {
      const result = calculateImportanceScore({
        type: 'decision',
        narrativeLength: 10000,
        factsCount: 100,
        conceptsCount: 100,
        createdAtEpoch: now,
        discoveryTokens: 100000,
        referenceCount: 100
      });
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should never go below 0', () => {
      const result = calculateImportanceScore({
        type: 'discovery',
        createdAtEpoch: now - 1000 * 24 * 60 * 60 * 1000 // 1000 days ago
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Scoring', () => {
    it('should score multiple observations', () => {
      const observations = [
        {
          id: '1',
          type: 'decision' as ObservationType,
          narrative: 'Important decision',
          createdAtEpoch: now
        },
        {
          id: '2',
          type: 'discovery' as ObservationType,
          narrative: 'Minor discovery',
          createdAtEpoch: thirtyDaysAgo
        }
      ];

      const scores = batchCalculateScores(observations);
      expect(scores.size).toBe(2);
      expect(scores.get('1')!.score).toBeGreaterThan(scores.get('2')!.score);
    });

    it('should handle empty observation list', () => {
      const scores = batchCalculateScores([]);
      expect(scores.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields', () => {
      expect(() => {
        calculateImportanceScore({
          type: 'feature',
          createdAtEpoch: now
        });
      }).not.toThrow();
    });

    it('should handle negative discovery tokens', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        discoveryTokens: -1000,
        createdAtEpoch: now
      });
      expect(result.factors.roi).toBeGreaterThanOrEqual(0);
    });

    it('should handle observations from the future', () => {
      const result = calculateImportanceScore({
        type: 'feature',
        createdAtEpoch: now + 1000000
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Score Distribution', () => {
    it('should produce reasonable distribution across observation types', () => {
      const types: ObservationType[] = ['decision', 'bugfix', 'feature', 'refactor', 'change', 'discovery'];
      const scores = types.map(type =>
        calculateImportanceScore({
          type,
          createdAtEpoch: now
        })
      );

      // Decision should score highest
      expect(scores[0].score).toBeGreaterThan(scores[5].score);

      // Scores should be diverse (not all in one tier)
      const tiers = new Set(scores.map(s => s.tier));
      expect(tiers.size).toBeGreaterThan(1);
    });

    it('should reward high-quality observations', () => {
      const highQuality = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 800,
        factsCount: 8,
        conceptsCount: 12,
        createdAtEpoch: oneHourAgo
      });

      const lowQuality = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 30,
        factsCount: 0,
        conceptsCount: 1,
        createdAtEpoch: thirtyDaysAgo
      });

      expect(highQuality.score).toBeGreaterThan(lowQuality.score);
    });
  });
});
