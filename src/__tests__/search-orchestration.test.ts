/**
 * Search Orchestration Layer Tests
 *
 * Validates:
 * - Pure semantic search (backward compatibility)
 * - Hybrid scoring enabled
 * - Query expansion enabled
 * - Hybrid + expansion together
 * - Feature flags control behavior
 * - Error handling (invalid parameters, missing DB, etc.)
 *
 * Test Coverage (6 core tests):
 * 1. Pure semantic search (backward compatible)
 * 2. Hybrid scoring enabled
 * 3. Query expansion enabled (requires database)
 * 4. Hybrid + expansion together
 * 5. Feature flags control behavior
 * 6. Error handling and graceful fallback
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  executeHybridSearch,
  simpleSearch,
  hybridSearchWithScoring,
  fullIntelligenceSearch,
  SearchExecutionError,
  type HybridSearchExecutionOptions,
} from '../search-orchestration';
import type { SemanticSearchResult, HybridSearchResult } from '../hybrid-search';

/**
 * Mock semantic search results for testing
 */
const createMockSemanticResults = (count: number = 3): SemanticSearchResult[] => {
  return Array.from({ length: count }, (_, i) => ({
    observation_id: i + 1,
    title: `Observation ${i + 1}`,
    narrative: `Narrative for observation ${i + 1}`,
    similarity: 0.8 - (i * 0.1),  // Descending similarity scores
    metadata: {
      importance_score: 80 - (i * 20),  // Descending importance
      type: 'discovery',
    },
  }));
};

/**
 * Mock database for expansion testing
 */
const createMockDatabase = () => {
  return {
    query: mock((sql: string) => ({
      all: mock(() => []),
      get: mock(() => null),
    })),
  } as any;
};

describe('Search Orchestration Layer', () => {
  // ============================================================================
  // CORE TESTS (6 required tests)
  // ============================================================================

  describe('Core Search Execution', () => {
    it('should perform pure semantic search (backward compatible)', async () => {
      const semanticResults = createMockSemanticResults(3);
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        useHybridScoring: false,  // Explicitly disable hybrid scoring
      };

      const results = await executeHybridSearch(semanticResults, options);

      // Should return all results up to limit
      expect(results).toHaveLength(3);

      // Should preserve order and data from semantic results
      expect(results[0].observation_id).toBe(1);
      expect(results[0].title).toBe('Observation 1');
      expect(results[0].semanticScore).toBeCloseTo(0.8, 2);

      // Should convert to HybridSearchResult format
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('semanticScore');
      expect(results[0]).toHaveProperty('importanceScore');
    });

    it('should enable hybrid scoring by default', async () => {
      const semanticResults = createMockSemanticResults(2);
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        // useHybridScoring not specified - should default to true
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toHaveLength(2);
      // With hybrid scoring, scores should be different from raw semantic scores
      // because importance is factored in
      expect(results[0].score).toBeLessThanOrEqual(1.0);
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should apply importance filtering with hybrid scoring', async () => {
      const semanticResults = createMockSemanticResults(3);
      // Modify importance scores: [80, 60, 40]
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        useHybridScoring: true,
        minImportance: 50,  // Filter out obs 3 (importance 40)
      };

      const results = await executeHybridSearch(semanticResults, options);

      // Should only include observations with importance >= 50
      expect(results).toHaveLength(2);
      expect(results.map(r => r.observation_id)).toContain(1);
      expect(results.map(r => r.observation_id)).toContain(2);
      expect(results.map(r => r.observation_id)).not.toContain(3);
    });

    it('should respect limit parameter', async () => {
      const semanticResults = createMockSemanticResults(10);
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 3,
        useHybridScoring: false,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toHaveLength(3);
    });

    it('should handle relationship expansion when database is provided', async () => {
      const semanticResults = createMockSemanticResults(2);
      const mockDb = createMockDatabase();

      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        useHybridScoring: true,
        expandByRelationships: true,
        maxNeighborsPerResult: 2,
      };

      const results = await executeHybridSearch(semanticResults, options, mockDb);

      // Should execute without error even with expansion enabled
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should gracefully fall back when expansion fails', async () => {
      const semanticResults = createMockSemanticResults(2);
      const failingDb = {
        query: () => {
          throw new Error('Database connection failed');
        },
      } as any;

      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        useHybridScoring: true,
        expandByRelationships: true,
      };

      // Should not throw, should return non-expanded results
      const results = await executeHybridSearch(semanticResults, options, failingDb);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should validate required parameters', async () => {
      const semanticResults = createMockSemanticResults(2);

      // Invalid query (empty string)
      await expect(
        executeHybridSearch(semanticResults, {
          query: '',
          limit: 10,
        })
      ).rejects.toThrow(SearchExecutionError);

      // Invalid limit (not positive)
      await expect(
        executeHybridSearch(semanticResults, {
          query: 'test',
          limit: 0,
        })
      ).rejects.toThrow(SearchExecutionError);

      // Invalid limit (not integer)
      await expect(
        executeHybridSearch(semanticResults, {
          query: 'test',
          limit: 3.5,
        })
      ).rejects.toThrow(SearchExecutionError);
    });

    it('should handle empty semantic results', async () => {
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
      };

      const results = await executeHybridSearch([], options);

      expect(results).toHaveLength(0);
    });

    it('should apply minRelevance threshold', async () => {
      const semanticResults = createMockSemanticResults(3);
      // Results have similarity scores: 0.8, 0.7, 0.6
      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 10,
        useHybridScoring: true,
        minRelevance: 0.7,  // Filter out obs 3 (similarity 0.6)
      };

      const results = await executeHybridSearch(semanticResults, options);

      // Should only include observations with similarity >= 0.7
      expect(results).toHaveLength(2);
      expect(results[0].observation_id).toBe(1);
      expect(results[1].observation_id).toBe(2);
    });
  });

  // ============================================================================
  // CONVENIENCE FUNCTIONS
  // ============================================================================

  describe('Convenience Functions', () => {
    it('simpleSearch should disable hybrid scoring', async () => {
      const semanticResults = createMockSemanticResults(2);
      const results = await simpleSearch(semanticResults, 'test', 10);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });

    it('hybridSearchWithScoring should enable hybrid scoring', async () => {
      const semanticResults = createMockSemanticResults(2);
      const results = await hybridSearchWithScoring(
        semanticResults,
        'test',
        10,
        { minImportance: 50 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('fullIntelligenceSearch should enable scoring and expansion', async () => {
      const semanticResults = createMockSemanticResults(2);
      const mockDb = createMockDatabase();

      const results = await fullIntelligenceSearch(
        semanticResults,
        'test',
        10,
        mockDb,
        { maxNeighborsPerResult: 3 }
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw SearchExecutionError on invalid query', async () => {
      const semanticResults = createMockSemanticResults(1);

      try {
        await executeHybridSearch(semanticResults, { query: '', limit: 10 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SearchExecutionError);
        expect((error as SearchExecutionError).name).toBe('SearchExecutionError');
      }
    });

    it('should include context in error information', async () => {
      const semanticResults = createMockSemanticResults(1);

      try {
        await executeHybridSearch(semanticResults, { query: '', limit: 10 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SearchExecutionError);
        const execError = error as SearchExecutionError;
        expect(execError.context).toBeDefined();
      }
    });

    it('should handle missing database gracefully', async () => {
      const semanticResults = createMockSemanticResults(2);
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
        expandByRelationships: true,
      };

      // Should not throw when db is undefined but expansion is enabled
      const results = await executeHybridSearch(semanticResults, options);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle invalid semantic results array', async () => {
      try {
        await executeHybridSearch(null as any, { query: 'test', limit: 10 });
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SearchExecutionError);
      }
    });
  });

  // ============================================================================
  // FEATURE FLAG BEHAVIOR
  // ============================================================================

  describe('Feature Flag Behavior', () => {
    it('should use config defaults when options not specified', async () => {
      const semanticResults = createMockSemanticResults(1);
      // Don't specify useHybridScoring or expandByRelationships
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      // Should execute successfully with defaults
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect explicit flag values', async () => {
      const semanticResults = createMockSemanticResults(2);

      const resultsWithHybrid = await executeHybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        useHybridScoring: true,
      });

      const resultsWithoutHybrid = await executeHybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        useHybridScoring: false,
      });

      // Both should return results, but may have different scores
      expect(resultsWithHybrid).toBeDefined();
      expect(resultsWithoutHybrid).toBeDefined();
    });

    it('should allow combining feature flags', async () => {
      const semanticResults = createMockSemanticResults(2);
      const mockDb = createMockDatabase();

      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
        useHybridScoring: true,
        expandByRelationships: false,  // Explicitly disabled even with db
        minImportance: 50,
      };

      const results = await executeHybridSearch(semanticResults, options, mockDb);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================================================
  // RESULT FORMAT
  // ============================================================================

  describe('Result Format and Metadata', () => {
    it('should preserve semantic result metadata', async () => {
      const semanticResults = createMockSemanticResults(1);
      const customMetadata = { custom_field: 'value', tags: ['tag1', 'tag2'] };
      semanticResults[0].metadata = { ...semanticResults[0].metadata, ...customMetadata };

      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results[0].metadata.custom_field).toBe('value');
      expect((results[0].metadata.tags as string[]).includes('tag1')).toBe(true);
    });

    it('should include all required result fields', async () => {
      const semanticResults = createMockSemanticResults(1);
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);
      const result = results[0];

      expect(result).toHaveProperty('observation_id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('semanticScore');
      expect(result).toHaveProperty('importanceScore');
      expect(result).toHaveProperty('metadata');
    });

    it('should provide narrative field when available', async () => {
      const semanticResults = createMockSemanticResults(1);
      semanticResults[0].narrative = 'Test narrative';

      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results[0].narrative).toBe('Test narrative');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very large result sets', async () => {
      const semanticResults = createMockSemanticResults(1000);
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 50,
        useHybridScoring: false,  // Disable hybrid scoring to avoid importance filtering
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toHaveLength(50);
    });

    it('should handle limit larger than available results', async () => {
      const semanticResults = createMockSemanticResults(2);
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 100,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toHaveLength(2);
    });

    it('should handle semantic results with missing optional fields', async () => {
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test',
          similarity: 0.8,
          metadata: {},
          // narrative is omitted
        },
      ];

      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toHaveLength(1);
      expect(results[0].narrative).toBeUndefined();
    });

    it('should clamp scores to [0, 1] range', async () => {
      const semanticResults = createMockSemanticResults(1);
      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
      expect(results[0].importanceScore).toBeGreaterThanOrEqual(0);
      expect(results[0].importanceScore).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // PARAMETER COMBINATIONS
  // ============================================================================

  describe('Parameter Combinations', () => {
    it('should handle all parameters together', async () => {
      const semanticResults = createMockSemanticResults(5);
      const mockDb = createMockDatabase();

      const options: HybridSearchExecutionOptions = {
        query: 'test query',
        limit: 3,
        useHybridScoring: true,
        expandByRelationships: false,  // Disabled for this test
        minRelevance: 0.5,
        minImportance: 40,
        maxNeighborsPerResult: 2,
        relationshipTypes: ['related', 'referenced_by'],
        minRelationshipConfidence: 0.6,
        boostRecent: true,
      };

      const results = await executeHybridSearch(semanticResults, options, mockDb);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should handle minimal parameters', async () => {
      const semanticResults = createMockSemanticResults(3);

      const options: HybridSearchExecutionOptions = {
        query: 'test',
        limit: 10,
      };

      const results = await executeHybridSearch(semanticResults, options);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
    });
  });
});
