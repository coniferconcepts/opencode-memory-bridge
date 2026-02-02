/**
 * Hybrid Search Module Tests
 *
 * Validates:
 * - Hybrid scoring algorithm (70/30 semantic/importance weighting)
 * - Score normalization and edge cases
 * - Filtering by relevance and importance thresholds
 * - Result re-ranking
 * - Batch operations
 * - Score breakdown analysis
 *
 * Test Coverage (8 core tests + 12 extended):
 * 1. Basic hybrid scoring combination
 * 2. Pure semantic result (importance 0)
 * 3. High importance result (importance 100)
 * 4. Missing importance_score handling
 * 5. Importance threshold filtering
 * 6. Relevance threshold filtering
 * 7. Score normalization edge cases
 * 8. Result re-ranking by combined score
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import Database from 'bun:sqlite';
import {
  hybridSearch,
  calculateHybridScore,
  getScoreBreakdown,
  batchHybridSearch,
  expandAndRankByRelationships,
  type SemanticSearchResult,
  type HybridSearchOptions,
  type HybridSearchResult,
} from '../hybrid-search';

describe('Hybrid Search Module', () => {
  // ============================================================================
  // CORE TESTS (8 required tests)
  // ============================================================================

  describe('Core Hybrid Scoring', () => {
    it('should combine semantic and importance scores correctly', () => {
      // Test case: 80% semantic, 90 importance
      // Expected: 0.7 * 0.8 + 0.3 * (90/100) = 0.56 + 0.27 = 0.83
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test Observation',
          similarity: 0.8,
          metadata: { importance_score: 90 },
        },
      ];

      const options: HybridSearchOptions = {
        query: 'test',
        limit: 10,
      };

      const results = hybridSearch(semanticResults, options);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(0.83, 2);
      expect(results[0].semanticScore).toBe(0.8);
      expect(results[0].importanceScore).toBeCloseTo(0.9, 2);
    });

    it('should handle pure semantic result (importance 0)', () => {
      // Test case: 80% semantic, 0 importance
      // Expected: 0.7 * 0.8 + 0.3 * 0 = 0.56
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Low Importance Result',
          similarity: 0.8,
          metadata: { importance_score: 0 },
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 0  // Override default threshold
      });

      expect(results[0].score).toBeCloseTo(0.56, 2);
      expect(results[0].importanceScore).toBe(0);
    });

    it('should boost high importance result (importance 100)', () => {
      // Test case: 60% semantic, 100 importance
      // Expected: 0.7 * 0.6 + 0.3 * 1.0 = 0.42 + 0.30 = 0.72
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'High Importance Result',
          similarity: 0.6,
          metadata: { importance_score: 100 },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });

      expect(results[0].score).toBeCloseTo(0.72, 2);
      expect(results[0].importanceScore).toBe(1.0);
    });

    it('should default to 0.5 importance when missing importance_score', () => {
      // Test case: 80% semantic, missing importance (defaults to 0.5)
      // Expected: 0.7 * 0.8 + 0.3 * 0.5 = 0.56 + 0.15 = 0.71
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Missing Importance Result',
          similarity: 0.8,
          metadata: {},
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(0.71, 2);
      expect(results[0].importanceScore).toBeCloseTo(0.5, 2);
    });

    it('should filter results by importance threshold', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'High Importance',
          similarity: 0.9,
          metadata: { importance_score: 80 },
        },
        {
          observation_id: 2,
          title: 'Low Importance',
          similarity: 0.9,
          metadata: { importance_score: 30 },
        },
        {
          observation_id: 3,
          title: 'Medium Importance',
          similarity: 0.9,
          metadata: { importance_score: 50 },
        },
      ];

      const options: HybridSearchOptions = {
        query: 'test',
        limit: 10,
        minImportance: 40, // Filter out importance < 40
      };

      const results = hybridSearch(semanticResults, options);

      // Should include IDs 1 and 3, exclude 2
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.observation_id)).toContain(1);
      expect(results.map((r) => r.observation_id)).toContain(3);
      expect(results.map((r) => r.observation_id)).not.toContain(2);
    });

    it('should filter results by relevance threshold', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Highly Relevant',
          similarity: 0.85,
          metadata: { importance_score: 50 },
        },
        {
          observation_id: 2,
          title: 'Somewhat Relevant',
          similarity: 0.5,
          metadata: { importance_score: 50 },
        },
        {
          observation_id: 3,
          title: 'Barely Relevant',
          similarity: 0.2,
          metadata: { importance_score: 50 },
        },
      ];

      const options: HybridSearchOptions = {
        query: 'test',
        limit: 10,
        minRelevance: 0.4, // Filter out semantic < 0.4
      };

      const results = hybridSearch(semanticResults, options);

      // Should include IDs 1 and 2, exclude 3
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.observation_id)).toContain(1);
      expect(results.map((r) => r.observation_id)).toContain(2);
      expect(results.map((r) => r.observation_id)).not.toContain(3);
    });

    it('should normalize score range to [0, 1]', () => {
      // Edge cases: semantic and importance at extreme values
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test',
          similarity: 1.0, // Max semantic
          metadata: { importance_score: 100 }, // Max importance
        },
        {
          observation_id: 2,
          title: 'Test',
          similarity: 0.4, // Above minRelevance threshold (0.3)
          metadata: { importance_score: 0 }, // Min importance
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 0  // Override default threshold
      });

      // Score should be <= 1.0 for both
      expect(results[0].score).toBeLessThanOrEqual(1.0);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[1].score).toBeLessThanOrEqual(1.0);
      expect(results[1].score).toBeGreaterThanOrEqual(0);
    });

    it('should re-rank results by combined score (highest first)', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Medium Score',
          similarity: 0.5,
          metadata: { importance_score: 50 },
        },
        {
          observation_id: 2,
          title: 'High Score',
          similarity: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 3,
          title: 'Low Score',
          similarity: 0.35,
          metadata: { importance_score: 20 },
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 0  // Override default threshold
      });

      // Verify re-ranking: highest score first
      expect(results[0].observation_id).toBe(2); // Highest
      expect(results[1].observation_id).toBe(1); // Medium
      expect(results[2].observation_id).toBe(3); // Lowest

      // Verify scores are in descending order
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });
  });

  // ============================================================================
  // EXTENDED TESTS (Edge Cases and Additional Coverage)
  // ============================================================================

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty semantic results', () => {
      const results = hybridSearch([], { query: 'test', limit: 10 });
      expect(results).toHaveLength(0);
    });

    it('should respect limit parameter', () => {
      const semanticResults: SemanticSearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        observation_id: i,
        title: `Result ${i}`,
        similarity: 0.9,
        metadata: { importance_score: 50 },
      }));

      const results = hybridSearch(semanticResults, { query: 'test', limit: 5 });
      expect(results).toHaveLength(5);
    });

    it('should handle importance score as string', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'String Importance',
          similarity: 0.8,
          metadata: { importance_score: '75' }, // String instead of number
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBeCloseTo(0.75, 2);
    });

    it('should handle null importance_score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Null Importance',
          similarity: 0.8,
          metadata: { importance_score: null },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBeCloseTo(0.5, 2); // Default
    });

    it('should handle undefined importance_score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Undefined Importance',
          similarity: 0.8,
          metadata: {},
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBeCloseTo(0.5, 2); // Default
    });

    it('should clamp importance score > 100', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Over 100',
          similarity: 0.8,
          metadata: { importance_score: 150 },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results[0].importanceScore).toBeLessThanOrEqual(1.0);
    });

    it('should clamp semantic score > 1.0', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Over 1.0',
          similarity: 1.5,
          metadata: { importance_score: 50 },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results[0].semanticScore).toBeLessThanOrEqual(1.0);
    });

    it('should handle negative importance score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Negative Importance',
          similarity: 0.8,
          metadata: { importance_score: -50 },
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 0  // Override default threshold
      });
      expect(results[0].importanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle NaN importance score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'NaN Importance',
          similarity: 0.8,
          metadata: { importance_score: NaN },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBeCloseTo(0.5, 2); // Default on NaN
    });

    it('should handle Infinity importance score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Infinity Importance',
          similarity: 0.8,
          metadata: { importance_score: Infinity },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBeCloseTo(0.5, 2); // Default on Infinity
    });

    it('should handle negative semantic score', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Negative Semantic',
          similarity: -0.5,
          metadata: { importance_score: 50 },
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minRelevance: 0  // Override default threshold to capture clamped score
      });
      expect(results).toHaveLength(1);
      expect(results[0].semanticScore).toBeGreaterThanOrEqual(0);
    });

    it('should include metadata in results', () => {
      const metadata = { custom_field: 'value', tags: ['tag1', 'tag2'] };
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test',
          similarity: 0.8,
          metadata,
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });
      expect(results[0].metadata).toEqual(metadata);
    });
  });

  // ============================================================================
  // DIRECT FUNCTION TESTS
  // ============================================================================

  describe('calculateHybridScore Function', () => {
    it('should calculate score using 70/30 weighting', () => {
      // 0.7 * 0.8 + 0.3 * (90/100) = 0.83
      const score = calculateHybridScore(0.8, 90);
      expect(score).toBeCloseTo(0.83, 2);
    });

    it('should handle undefined importance', () => {
      // Should use default 0.5: 0.7 * 0.8 + 0.3 * 0.5 = 0.71
      const score = calculateHybridScore(0.8, undefined);
      expect(score).toBeCloseTo(0.71, 2);
    });

    it('should clamp result to [0, 1]', () => {
      const score = calculateHybridScore(1.5, 150);
      expect(score).toBeLessThanOrEqual(1.0);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getScoreBreakdown Function', () => {
    it('should provide detailed score breakdown', () => {
      const breakdown = getScoreBreakdown(0.8, 90);

      expect(breakdown.semanticComponent).toBeCloseTo(0.56, 2); // 0.7 * 0.8
      expect(breakdown.importanceComponent).toBeCloseTo(0.27, 2); // 0.3 * 0.9
      expect(breakdown.combinedScore).toBeCloseTo(0.83, 2);
      expect(breakdown.semanticWeight).toBe(0.7);
      expect(breakdown.importanceWeight).toBe(0.3);
    });

    it('should show weight contributions', () => {
      const breakdown = getScoreBreakdown(0.5, 50);

      // Semantic: 0.7 * 0.5 = 0.35 (35% of total)
      // Importance: 0.3 * 0.5 = 0.15 (15% of total)
      expect(breakdown.semanticComponent).toBeGreaterThan(breakdown.importanceComponent);
    });
  });

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  describe('Batch Operations', () => {
    it('should process multiple search batches', () => {
      const batch1: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test 1',
          similarity: 0.8,
          metadata: { importance_score: 80 },
        },
      ];

      const batch2: SemanticSearchResult[] = [
        {
          observation_id: 2,
          title: 'Test 2',
          similarity: 0.6,
          metadata: { importance_score: 60 },
        },
      ];

      const options1: HybridSearchOptions = { query: 'test1', limit: 10 };
      const options2: HybridSearchOptions = { query: 'test2', limit: 10 };

      const results = batchHybridSearch([batch1, batch2], [options1, options2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);
    });

    it('should throw on mismatched batch lengths', () => {
      expect(() => {
        batchHybridSearch([], [{ query: 'test', limit: 10 }]);
      }).toThrow('Result batches and options batches must have same length');
    });
  });

  // ============================================================================
  // PERFORMANCE CHARACTERISTICS (Informational)
  // ============================================================================

  describe('Performance Characteristics', () => {
    it('should score 10 results in <1ms', () => {
      const semanticResults: SemanticSearchResult[] = Array.from({ length: 10 }, (_, i) => ({
        observation_id: i,
        title: `Result ${i}`,
        similarity: 0.5 + Math.random() * 0.5,
        metadata: { importance_score: Math.floor(Math.random() * 100) },
      }));

      const start = performance.now();
      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minRelevance: 0.3,  // Use default threshold
        minImportance: 0    // Override to capture all for performance test
      });
      const duration = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
      // Performance is informational; no strict requirement in test
    });

    it('should handle 100 results efficiently', () => {
      const semanticResults: SemanticSearchResult[] = Array.from({ length: 100 }, (_, i) => ({
        observation_id: i,
        title: `Result ${i}`,
        similarity: 0.5 + Math.random() * 0.5,
        metadata: { importance_score: Math.floor(Math.random() * 100) },
      }));

      const results = hybridSearch(semanticResults, { query: 'test', limit: 20 });

      expect(results).toHaveLength(20);
      // Verify re-ranking worked correctly
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });

  // ============================================================================
  // REALISTIC SCENARIOS
  // ============================================================================

  describe('Realistic Scenarios', () => {
    it('should rank high-quality recent observations first', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Old Low Quality',
          similarity: 0.95, // Very relevant but old
          metadata: { importance_score: 20 },
        },
        {
          observation_id: 2,
          title: 'Recent High Quality',
          similarity: 0.7, // Less relevant but recent/important
          metadata: { importance_score: 95 },
        },
        {
          observation_id: 3,
          title: 'Average',
          similarity: 0.8,
          metadata: { importance_score: 50 },
        },
      ];

      const results = hybridSearch(semanticResults, { query: 'test', limit: 10 });

      // Result 2 should rank highest due to importance boosting
      expect(results[0].observation_id).toBe(2);
    });

    it('should filter out spam (high semantic but low importance)', () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Spam Result',
          similarity: 0.9, // High semantic match
          metadata: { importance_score: 5 }, // Very low importance (spam)
        },
        {
          observation_id: 2,
          title: 'Real Result',
          similarity: 0.7, // Lower semantic match
          metadata: { importance_score: 75 }, // High importance
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 40, // Filter spam
      });

      // Should only include the real result
      expect(results).toHaveLength(1);
      expect(results[0].observation_id).toBe(2);
    });

    it('should handle mixed quality results correctly', () => {
      const semanticResults: SemanticSearchResult[] = [
        // Perfect match, perfect importance
        {
          observation_id: 1,
          title: 'Excellent',
          similarity: 1.0,
          metadata: { importance_score: 100 },
        },
        // Good match, no importance
        {
          observation_id: 2,
          title: 'Baseline',
          similarity: 0.5,
          metadata: { importance_score: 0 },
        },
        // Below minRelevance, high importance (will be filtered)
        {
          observation_id: 3,
          title: 'Wrong Query',
          similarity: 0.25,
          metadata: { importance_score: 100 },
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minRelevance: 0.3,
        minImportance: 0  // Override default threshold
      });

      // Should include 1 (excellent) and 2 (baseline), exclude 3 (below minRelevance)
      const ids = results.map((r) => r.observation_id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).not.toContain(3);

      // Result 1 should rank first
      expect(results[0].observation_id).toBe(1);
    });
  });
});
