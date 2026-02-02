/**
 * Hybrid Search Module
 *
 * Combines semantic similarity search results with importance weighting to produce
 * ranked results that balance relevance with content quality.
 *
 * ## Scoring Rationale
 *
 * The 70/30 weighting (70% semantic, 30% importance) reflects:
 * - **70% Semantic Similarity**: Primary driver of relevance for user queries
 * - **30% Importance Score**: Boosts high-quality, well-referenced, recent observations
 *
 * This prevents low-importance but semantically-similar spam from ranking too high,
 * while keeping semantic relevance as the dominant factor.
 *
 * ## Scoring Formula
 *
 * Combined Score = (0.7 × semanticScore) + (0.3 × normalizedImportance)
 * Where normalizedImportance = importanceScore / 100 (converts 0-100 range to 0-1)
 *
 * The result is clamped to [0, 1] to ensure consistency.
 *
 * ## Relationship Expansion
 *
 * The `expandAndRankByRelationships()` function extends search results with 1-hop
 * relationship neighbors. Key design decisions:
 *
 * - **0.3 Multiplier for Neighbor Scores**: Ensures neighbors don't crowd out primary results
 * - **Limited Expansion**: Only expands top K/2 results to prevent explosion
 * - **Neighbor Limit**: Max 3 neighbors per result for controlled growth
 * - **Scoring Formula**: `0.3 * relationship.confidence * (importance / 100)`
 * - **Deduplication**: Automatic removal of duplicate observation IDs
 * - **Performance Target**: <100ms for full expansion + re-ranking
 *
 * @module src/hybrid-search
 */

import type { Database } from 'bun:sqlite';
import { getRelatedObservations } from './queries';

/**
 * Options for hybrid search
 */
export interface HybridSearchOptions {
  /** Search query string (passed to semantic search) */
  query: string;

  /** Maximum number of results to return */
  limit: number;

  /** Minimum semantic similarity threshold (default: 0.3) */
  minRelevance?: number;

  /** Minimum importance score threshold (default: 40, on 0-100 scale) */
  minImportance?: number;

  /** Whether to apply recency weighting (boosts recent results) */
  boostRecent?: boolean;

  /** Whether to include 1-hop neighbor observations in results */
  expandByRelationships?: boolean;
}

/**
 * Result from hybrid search
 */
export interface HybridSearchResult {
  /** Unique observation ID */
  observation_id: number;

  /** Title of the observation */
  title: string;

  /** Optional narrative/description */
  narrative?: string;

  /** Combined hybrid score (0-1) */
  score: number;

  /** Original semantic similarity score from ChromaSync (0-1) */
  semanticScore: number;

  /** Normalized importance score (0-1, originally 0-100) */
  importanceScore: number;

  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Semantic search result from ChromaSync (input format)
 *
 * This represents the structure expected from ChromaSync API or mock results.
 */
export interface SemanticSearchResult {
  /** Unique observation ID */
  observation_id: number;

  /** Title of the observation */
  title: string;

  /** Optional narrative/description */
  narrative?: string;

  /** Semantic similarity score (0-1) */
  similarity: number;

  /** Additional metadata including importance_score */
  metadata: Record<string, unknown>;
}

/**
 * Normalize importance score from 0-100 range to 0-1 range
 *
 * @param importanceScore - Raw importance score (0-100)
 * @param defaultValue - Value to return if score is missing or invalid
 * @returns Normalized score in [0, 1] range
 */
export function normalizeImportanceScore(
  importanceScore: number | undefined,
  defaultValue: number = 0.5
): number {
  // Handle missing importance score
  if (importanceScore === undefined || importanceScore === null) {
    return defaultValue;
  }

  // Convert to number if string
  const score = typeof importanceScore === 'string' ? parseFloat(importanceScore) : importanceScore;

  // Handle invalid numbers (NaN, Infinity)
  if (!Number.isFinite(score)) {
    return defaultValue;
  }

  // Clamp to [0, 100] range then normalize to [0, 1]
  const clamped = Math.max(0, Math.min(score, 100));
  return clamped / 100;
}

/**
 * Calculate combined hybrid score from semantic and importance components
 *
 * Formula: 0.7 * semanticScore + 0.3 * (importanceScore / 100)
 *
 * @param semanticScore - Semantic similarity score (0-1)
 * @param importanceScore - Importance score (0-100)
 * @returns Combined score (0-1), clamped to valid range
 */
export function calculateHybridScore(
  semanticScore: number,
  importanceScore: number | undefined
): number {
  // Normalize semantic score to [0, 1] range
  const normalizedSemantic = Math.max(0, Math.min(semanticScore, 1));

  // Normalize importance score
  const normalizedImportance = normalizeImportanceScore(importanceScore);

  // Calculate weighted combination
  const combined = 0.7 * normalizedSemantic + 0.3 * normalizedImportance;

  // Ensure result is in [0, 1] range
  return Math.max(0, Math.min(combined, 1));
}

/**
 * Perform hybrid search combining semantic results with importance weighting
 *
 * This function:
 * 1. Takes semantic search results from ChromaSync
 * 2. Extracts importance_score from metadata (defaults to 0.5 if missing)
 * 3. Calculates combined score: 0.7 * semantic + 0.3 * (importance / 100)
 * 4. Re-ranks results by combined score
 * 5. Applies optional filtering (minRelevance, minImportance)
 * 6. Returns top K results
 *
 * @param semanticResults - Results from ChromaSync semantic search
 * @param options - Search options including limit and thresholds
 * @returns Hybrid search results ranked by combined score
 *
 * @example
 * const results = await hybridSearch(chromas yncResults, {
 *   query: 'authentication bug',
 *   limit: 10,
 *   minRelevance: 0.3,
 *   minImportance: 40
 * });
 */
export function hybridSearch(
  semanticResults: SemanticSearchResult[],
  options: HybridSearchOptions
): HybridSearchResult[] {
  const {
    limit,
    minRelevance = 0.3,
    minImportance = 40,
  } = options;

  // Convert semantic results to hybrid results with combined scores
  const hybridResults: HybridSearchResult[] = semanticResults
    .map((result) => {
      const importanceRaw = result.metadata?.importance_score;

      // Normalize the raw importance value
      let importanceValue: number | undefined;
      if (importanceRaw !== undefined && importanceRaw !== null) {
        importanceValue = typeof importanceRaw === 'string'
          ? parseFloat(importanceRaw)
          : typeof importanceRaw === 'number'
            ? importanceRaw
            : undefined;
      }

      const normalizedImportance = normalizeImportanceScore(importanceValue);

      const hybridScore = calculateHybridScore(result.similarity, importanceValue);

      return {
        observation_id: result.observation_id,
        title: result.title,
        narrative: result.narrative,
        score: hybridScore,
        semanticScore: Math.max(0, Math.min(result.similarity, 1)),
        importanceScore: normalizedImportance,
        metadata: result.metadata,
      };
    })
    // Apply semantic relevance threshold
    .filter((result) => result.semanticScore >= minRelevance)
    // Apply importance threshold (convert from 0-100 to 0-1 for comparison)
    .filter((result) => {
      const importanceThreshold = minImportance / 100;
      return result.importanceScore >= importanceThreshold;
    });

  // Sort by combined score (descending)
  hybridResults.sort((a, b) => b.score - a.score);

  // Return top K results
  return hybridResults.slice(0, limit);
}

/**
 * Batch hybrid search across multiple observation sets
 *
 * Useful for processing multiple search queries or comparison operations.
 *
 * @param resultBatches - Array of semantic result arrays
 * @param optionsBatches - Corresponding search options for each batch
 * @returns Array of hybrid result arrays, one per input batch
 */
export function batchHybridSearch(
  resultBatches: SemanticSearchResult[][],
  optionsBatches: HybridSearchOptions[]
): HybridSearchResult[][] {
  if (resultBatches.length !== optionsBatches.length) {
    throw new Error('Result batches and options batches must have same length');
  }

  return resultBatches.map((results, index) =>
    hybridSearch(results, optionsBatches[index])
  );
}

/**
 * Get score breakdown for analysis and debugging
 *
 * Returns detailed scoring information for a result including:
 * - Semantic component contribution
 * - Importance component contribution
 * - Total combined score
 *
 * @param semanticScore - Semantic similarity (0-1)
 * @param importanceScore - Importance score (0-100 or undefined)
 * @returns Object with component scores and combined score
 */
export interface ScoreBreakdown {
  semanticComponent: number;
  importanceComponent: number;
  combinedScore: number;
  semanticWeight: number;
  importanceWeight: number;
}

export function getScoreBreakdown(
  semanticScore: number,
  importanceScore: number | undefined
): ScoreBreakdown {
  const normalizedSemantic = Math.max(0, Math.min(semanticScore, 1));
  const normalizedImportance = normalizeImportanceScore(importanceScore);

  const semanticComponent = 0.7 * normalizedSemantic;
  const importanceComponent = 0.3 * normalizedImportance;
  const combinedScore = semanticComponent + importanceComponent;

  return {
    semanticComponent,
    importanceComponent,
    combinedScore: Math.max(0, Math.min(combinedScore, 1)),
    semanticWeight: 0.7,
    importanceWeight: 0.3,
  };
}

/**
 * Options for relationship-based expansion
 */
export interface ExpandAndRankOptions {
  /** Maximum neighbors per result (default: 3) */
  maxNeighborsPerResult?: number;

  /** Only expand top K results (default: K/2 of initial results) */
  expandTopK?: number;

  /** Filter by relationship types (optional) */
  relationshipTypes?: string[];

  /** Minimum relationship confidence threshold (default: 0.5) */
  minConfidence?: number;

  /** Total limit after expansion (default: same as initial limit) */
  limit?: number;
}

/**
 * Expand hybrid search results with 1-hop relationship neighbors and re-rank all results
 *
 * ## Algorithm
 *
 * 1. Create Map<observation_id, HybridSearchResult> from initial results
 * 2. For each result in top `expandTopK` (defaults to K/2):
 *    - Query related observations using `getRelatedObservations()`
 *    - Get up to `maxNeighborsPerResult` neighbors (default 3)
 * 3. Deduplicate by observation_id (skip neighbors already in results)
 * 4. Score neighbors: `0.3 * relationship.confidence * (importance / 100)`
 *    - 0.3 multiplier ensures neighbors score lower than direct results
 *    - Weighted by relationship confidence (0-1)
 *    - Normalized by importance score
 * 5. Combine results: Add new neighbors to Map, preserve existing
 * 6. Re-rank: Sort all by score descending
 * 7. Return: Top `limit` results
 *
 * ## Performance
 *
 * Target: <100ms for full expansion + re-ranking with typical result sets
 * - Database lookups are optimized via prepared statements
 * - Deduplication is O(1) via Map lookup
 * - Re-ranking is O(n log n) where n = initial results + neighbors
 *
 * ## Deduplication Strategy
 *
 * - Uses Map<observation_id, HybridSearchResult> for O(1) lookup
 * - Neighbors already in initial results are skipped (no duplicate scoring)
 * - Automatic via Map insertion (later entries don't overwrite earlier ones for neighbors)
 *
 * ## Edge Cases Handled
 *
 * - Empty initial results → return empty array
 * - Database connection fails → return original results (graceful fallback)
 * - Observation not in database → skip, continue with others
 * - No relationships found → return original results
 * - Neighbor already in results → deduplicate, skip
 *
 * @param results - Initial hybrid search results to expand
 * @param db - SQLite database connection
 * @param options - Expansion options with defaults
 * @returns Promise resolving to expanded and re-ranked results
 *
 * @example
 * ```typescript
 * const initial = await hybridSearch(semanticResults, options);
 * const expanded = await expandAndRankByRelationships(
 *   initial,
 *   db,
 *   { limit: 10, maxNeighborsPerResult: 3 }
 * );
 * // Result: up to 10 results including original + 1-hop neighbors
 * ```
 */
export async function expandAndRankByRelationships(
  results: HybridSearchResult[],
  db: Database,
  options: ExpandAndRankOptions = {}
): Promise<HybridSearchResult[]> {
  // Handle edge case: empty results
  if (!results || results.length === 0) {
    return [];
  }

  const {
    maxNeighborsPerResult = 3,
    expandTopK = Math.max(1, Math.floor(results.length / 2)),
    minConfidence = 0.5,
    limit = results.length,
  } = options;

  try {
    // Step 1: Create Map from initial results for deduplication
    const resultMap = new Map<number, HybridSearchResult>();
    results.forEach((result) => {
      resultMap.set(result.observation_id, result);
    });

    // Step 2: Expand top K results with neighbors
    const topK = results.slice(0, Math.min(expandTopK, results.length));

    for (const result of topK) {
      try {
        // Query related observations (1-hop neighbors)
        const neighbors = getRelatedObservations(db, result.observation_id, {
          minConfidence,
          limit: maxNeighborsPerResult,
          direction: 'both',
        });

        // Step 3: Deduplicate and score neighbors
        for (const neighbor of neighbors) {
          // Skip if already in results
          if (resultMap.has(neighbor.observation_id)) {
            continue;
          }

          // Query importance score from observations table if available
          let neighborImportance = 0.5; // Default importance
          try {
            const obsData = db.query(
              'SELECT metadata FROM observations WHERE id = ?'
            ).get(neighbor.observation_id) as any;

            if (obsData?.metadata) {
              try {
                const metadata = JSON.parse(obsData.metadata);
                if (metadata.importance_score !== undefined) {
                  neighborImportance = normalizeImportanceScore(metadata.importance_score);
                }
              } catch {
                // If metadata is not JSON, use default
              }
            }
          } catch {
            // If query fails, use default importance
          }

          // Step 4: Calculate neighbor score
          // Formula: 0.3 * relationship.confidence * (importance / 100)
          // The 0.3 multiplier ensures neighbors rank lower than direct results
          const relationshipConfidence = neighbor.confidence ?? 0.5;
          const neighborScore = 0.3 * relationshipConfidence * neighborImportance;

          // Create HybridSearchResult for neighbor
          const neighborResult: HybridSearchResult = {
            observation_id: neighbor.observation_id,
            title: neighbor.title,
            narrative: undefined, // Not available from relationship query
            score: Math.max(0, Math.min(neighborScore, 1)), // Clamp to [0, 1]
            semanticScore: 0, // Not available for neighbors (not semantically searched)
            importanceScore: neighborImportance,
            metadata: {
              relationship_type: neighbor.relationship_type,
              relationship_confidence: relationshipConfidence,
              source_observation_id: result.observation_id,
              is_expanded_neighbor: true,
            },
          };

          // Step 5: Add to results map
          resultMap.set(neighbor.observation_id, neighborResult);
        }
      } catch (error) {
        // Graceful fallback: skip this result's expansion on error
        // Log but continue with other results
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(
          `Failed to expand relationships for observation ${result.observation_id}: ${msg}`
        );
        continue;
      }
    }

    // Step 6: Re-rank all results by score (descending)
    const allResults = Array.from(resultMap.values());
    allResults.sort((a, b) => b.score - a.score);

    // Step 7: Return top limit results
    return allResults.slice(0, Math.max(1, limit));
  } catch (error) {
    // Graceful fallback: database error → return original results
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to expand relationships: ${msg}`);
    return results.slice(0, Math.max(1, limit));
  }
}
