/**
 * Search Orchestration Layer
 *
 * Implements hybrid search execution with feature flags for:
 * - Pure semantic search (backward compatible, existing behavior)
 * - Hybrid scoring (importance weighting enabled/disabled)
 * - Query expansion (1-hop relationship augmentation)
 *
 * All options are optional with sensible defaults. Feature flags enable
 * gradual rollout of advanced capabilities without breaking existing code.
 *
 * ## API Signatures
 *
 * ```typescript
 * // Option 1: Pure semantic (backward compatible)
 * const results = await executeHybridSearch({ query, limit });
 *
 * // Option 2: Hybrid scoring (importance weighting)
 * const results = await executeHybridSearch({
 *   query, limit,
 *   useHybridScoring: true  // Enable importance weighting
 * });
 *
 * // Option 3: Full intelligence (hybrid + expansion)
 * const results = await executeHybridSearch({
 *   query, limit,
 *   useHybridScoring: true,
 *   expandByRelationships: true,
 *   maxNeighborsPerResult: 3
 * });
 *
 * // Option 4: Hybrid with importance filtering
 * const results = await executeHybridSearch({
 *   query, limit,
 *   useHybridScoring: true,
 *   minImportance: 70  // Only critical/high importance
 * });
 * ```
 *
 * @module src/search-orchestration
 */

import type { Database } from 'bun:sqlite';
import {
  hybridSearch,
  expandAndRankByRelationships,
  type HybridSearchOptions,
  type HybridSearchResult,
  type SemanticSearchResult,
  type ExpandAndRankOptions,
} from './hybrid-search.js';
import {
  HYBRID_SEARCH_CONFIG,
} from './constants.js';
import { logger } from './logger.js';

/**
 * Options for hybrid search execution with feature flags
 */
export interface HybridSearchExecutionOptions {
  /** Search query string (required) */
  query: string;

  /** Maximum number of results to return (required) */
  limit: number;

  /** Minimum semantic similarity threshold (default: 0.3) */
  minRelevance?: number;

  /** Minimum importance score (0-100 scale, default: 0) */
  minImportance?: number;

  /** Enable hybrid scoring with importance weighting (default: true) */
  useHybridScoring?: boolean;

  /** Enable query expansion with relationship neighbors (default: false, opt-in) */
  expandByRelationships?: boolean;

  /** Maximum neighbors per result for expansion (default: 3) */
  maxNeighborsPerResult?: number;

  /** Maximum results after expansion (default: 100) */
  maxExpansionResults?: number;

  /** Filter by relationship types (optional) */
  relationshipTypes?: string[];

  /** Minimum relationship confidence (default: 0.5) */
  minRelationshipConfidence?: number;

  /** Apply recency weighting to results (future enhancement) */
  boostRecent?: boolean;
}

/**
 * Error thrown when search execution fails
 */
export class SearchExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SearchExecutionError';
  }
}

/**
 * Execute hybrid search with optional feature flags for gradual rollout
 *
 * This function:
 * 1. Validates search options and parameters
 * 2. Calls semantic search API (ChromaSync or fallback)
 * 3. Applies hybrid scoring if enabled (importance weighting)
 * 4. Applies query expansion if enabled (1-hop relationship neighbors)
 * 5. Applies final filtering (importance thresholds)
 * 6. Returns ranked results
 *
 * **Backward Compatibility**: Pure semantic search (`search({ query, limit })`)
 * continues to work unchanged. New options are all opt-in.
 *
 * **Error Handling**:
 * - Invalid parameters → return error with helpful message
 * - Database connection fails → fallback to semantic only
 * - Expansion fails → return non-expanded results
 * - No metadata → use defaults (importance_score: 50)
 *
 * @param semanticResults - Results from ChromaSync semantic search
 * @param options - Execution options with feature flags
 * @param db - Optional database connection for expansion
 * @returns Hybrid search results ranked by combined score
 * @throws {SearchExecutionError} If search fails with validation errors
 *
 * @example
 * ```typescript
 * // Pure semantic (backward compatible)
 * const results = await executeHybridSearch(semanticResults, {
 *   query: 'authentication bug',
 *   limit: 10
 * });
 *
 * // Hybrid scoring enabled
 * const results = await executeHybridSearch(semanticResults, {
 *   query: 'authentication bug',
 *   limit: 10,
 *   useHybridScoring: true
 * });
 *
 * // Full intelligence with expansion
 * const results = await executeHybridSearch(semanticResults, {
 *   query: 'authentication bug',
 *   limit: 10,
 *   useHybridScoring: true,
 *   expandByRelationships: true,
 *   maxNeighborsPerResult: 3
 * }, db);
 *
 * // Importance filtering
 * const results = await executeHybridSearch(semanticResults, {
 *   query: 'authentication bug',
 *   limit: 10,
 *   useHybridScoring: true,
 *   minImportance: 70
 * });
 * ```
 */
export async function executeHybridSearch(
  semanticResults: SemanticSearchResult[],
  options: HybridSearchExecutionOptions,
  db?: Database
): Promise<HybridSearchResult[]> {
  try {
    // Validate required parameters
    if (!options.query || typeof options.query !== 'string' || options.query.trim().length === 0) {
      throw new SearchExecutionError('Query must be a non-empty string', undefined, { options });
    }

    if (!Number.isInteger(options.limit) || options.limit <= 0) {
      throw new SearchExecutionError('Limit must be a positive integer', undefined, { options });
    }

    if (!Array.isArray(semanticResults)) {
      throw new SearchExecutionError('Semantic results must be an array', undefined, { options });
    }

    // Apply feature flag defaults from config
    const useHybridScoring = options.useHybridScoring ?? HYBRID_SEARCH_CONFIG.defaultUseHybridScoring;
    const expandByRelationships = options.expandByRelationships ?? HYBRID_SEARCH_CONFIG.defaultExpandByRelationships;
    const minRelevance = options.minRelevance ?? HYBRID_SEARCH_CONFIG.defaultMinRelevance;
    const minImportance = options.minImportance ?? HYBRID_SEARCH_CONFIG.defaultMinImportance;
    const maxNeighborsPerResult = options.maxNeighborsPerResult ?? HYBRID_SEARCH_CONFIG.defaultMaxNeighborsPerResult;
    const maxExpansionResults = options.maxExpansionResults ?? HYBRID_SEARCH_CONFIG.maxExpansionResults;
    const minRelationshipConfidence = options.minRelationshipConfidence ?? HYBRID_SEARCH_CONFIG.defaultMinRelationshipConfidence;

    // Step 1: Apply hybrid scoring if enabled
    let results: HybridSearchResult[];

    if (useHybridScoring) {
      try {
        const hybridOptions: HybridSearchOptions = {
          query: options.query,
          limit: options.limit,
          minRelevance,
          minImportance,
          boostRecent: options.boostRecent,
        };

        results = hybridSearch(semanticResults, hybridOptions);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('search-orchestration', 'Hybrid scoring failed, using raw semantic results', {
          error: msg,
        });
        // Fallback: return raw semantic results (convert to HybridSearchResult format)
        results = semanticResults.map(r => ({
          observation_id: r.observation_id,
          title: r.title,
          narrative: r.narrative,
          score: r.similarity,
          semanticScore: r.similarity,
          importanceScore: 0.5,
          metadata: r.metadata,
        }));
      }
    } else {
      // Backward compatible: convert semantic results to HybridSearchResult without scoring
      results = semanticResults
        .slice(0, options.limit)
        .map(r => ({
          observation_id: r.observation_id,
          title: r.title,
          narrative: r.narrative,
          score: r.similarity,
          semanticScore: r.similarity,
          importanceScore: 0.5,
          metadata: r.metadata,
        }));
    }

    // Step 2: Apply query expansion if enabled and database is available
    if (expandByRelationships && db) {
      try {
        const expandOptions: ExpandAndRankOptions = {
          maxNeighborsPerResult,
          relationshipTypes: options.relationshipTypes,
          minConfidence: minRelationshipConfidence,
          limit: Math.min(options.limit, maxExpansionResults),
        };

        results = await expandAndRankByRelationships(results, db, expandOptions);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('search-orchestration', 'Relationship expansion failed, returning non-expanded results', {
          error: msg,
        });
        // Fallback: return non-expanded results (already ranked)
      }
    }

    // Step 3: Apply final limit
    return results.slice(0, options.limit);
  } catch (error) {
    if (error instanceof SearchExecutionError) {
      throw error;
    }

    const msg = error instanceof Error ? error.message : String(error);
    throw new SearchExecutionError('Search execution failed', error as Error, { options });
  }
}

/**
 * Search without feature flags (backward compatible)
 *
 * This is the simplest interface for existing code that just wants
 * semantic search without hybrid scoring.
 *
 * @param semanticResults - Results from ChromaSync semantic search
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @returns Hybrid search results (converted from semantic)
 *
 * @example
 * ```typescript
 * const results = await simpleSearch(semanticResults, 'bug', 10);
 * ```
 */
export async function simpleSearch(
  semanticResults: SemanticSearchResult[],
  query: string,
  limit: number
): Promise<HybridSearchResult[]> {
  return executeHybridSearch(semanticResults, { query, limit, useHybridScoring: false });
}

/**
 * Search with hybrid scoring enabled (importance weighting)
 *
 * @param semanticResults - Results from ChromaSync semantic search
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @param options - Optional additional parameters
 * @returns Hybrid search results with importance weighting applied
 *
 * @example
 * ```typescript
 * const results = await hybridSearchWithScoring(
 *   semanticResults,
 *   'bug fix',
 *   10,
 *   { minImportance: 50 }
 * );
 * ```
 */
export async function hybridSearchWithScoring(
  semanticResults: SemanticSearchResult[],
  query: string,
  limit: number,
  options?: Partial<HybridSearchExecutionOptions>
): Promise<HybridSearchResult[]> {
  return executeHybridSearch(semanticResults, {
    ...options,
    query,
    limit,
    useHybridScoring: true,
  });
}

/**
 * Search with full intelligence enabled (hybrid scoring + expansion)
 *
 * @param semanticResults - Results from ChromaSync semantic search
 * @param query - Search query string
 * @param limit - Maximum results to return
 * @param db - Database connection for relationship expansion
 * @param options - Optional additional parameters
 * @returns Hybrid search results with scoring and relationship expansion
 *
 * @example
 * ```typescript
 * const results = await fullIntelligenceSearch(
 *   semanticResults,
 *   'authentication',
 *   10,
 *   db,
 *   { maxNeighborsPerResult: 3 }
 * );
 * ```
 */
export async function fullIntelligenceSearch(
  semanticResults: SemanticSearchResult[],
  query: string,
  limit: number,
  db: Database,
  options?: Partial<HybridSearchExecutionOptions>
): Promise<HybridSearchResult[]> {
  return executeHybridSearch(semanticResults, {
    ...options,
    query,
    limit,
    useHybridScoring: true,
    expandByRelationships: true,
  }, db);
}
