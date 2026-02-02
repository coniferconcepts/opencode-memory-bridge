/**
 * Orchestrator round-trip pattern for @mem-facilitator.
 *
 * The orchestrator mediates all calls between @memory-bridge and @mem-facilitator.
 *
 * ## Data Flow
 *
 * 1. Orchestrator requests observation review
 * 2. Orchestrator calls @memory-bridge to retrieve observations
 * 3. @memory-bridge returns observations to orchestrator
 * 4. Orchestrator calls @mem-facilitator with observations
 * 5. @mem-facilitator performs relevance scoring
 * 6. @mem-facilitator applies deontic filtering
 * 7. @mem-facilitator applies sensitive data scrubbing
 * 8. @mem-facilitator generates structured summary
 * 9. @mem-facilitator extracts Claude Mem IDs
 * 10. @mem-facilitator returns summary + IDs to orchestrator
 * 11. Orchestrator uses IDs for Haiku follow-up (optional)
 *
 * @module src/integration/orchestrator-round-trip
 */

import type { MemoryObservation } from '../schemas';
import type { MemFacilitatorObservation } from './observation-transformer.js';
import { enforceTokenBudget, SUBAGENT_MEMORY_TOKEN_BUDGET } from '../utils/token-budget-enforcer';
import { checkRateLimit } from '../utils/rate-limiter';
import { estimateCost } from '../utils/cost-estimator';
import { transformUpstreamError } from '../utils/error-handler.js';
import { transformToMemFacilitatorFormat, filterValidObservations } from './observation-transformer.js';
import { DEFAULT_OBSERVATION_LIMIT } from '../constants.js';

/**
 * Filter options for observation retrieval.
 */
export interface ObservationFilters {
  /** Observation types to include */
  types?: string[];
  /** Time range (e.g., "7d", "30d", "all") */
  time_range?: string;
  /** Project name (default: current) */
  project?: string;
  /** Max observations to retrieve (default: 50, max 150) */
  limit?: number;
}

/**
 * Output format options.
 */
export type OutputFormat = 'summary' | 'summary_with_ids' | 'ids_only';

/**
 * Detail level options.
 */
export type DetailLevel = 'brief' | 'standard' | 'comprehensive';

/**
 * Options for observation processing.
 */
export interface ProcessOptions {
  /** Output format */
  output_format?: OutputFormat;
  /** Relevance threshold (0-100, default: 60) */
  relevance_threshold?: number;
  /** Detail level */
  detail_level?: DetailLevel;
}

/**
 * Parent context from orchestrator.
 */
export interface ParentContext {
  /** Agent ID */
  agent_id?: string;
  /** Goals */
  goals?: string[];
  /** Constraints */
  constraints?: string[];
}

/**
 * Input for orchestrator round-trip.
 */
export interface RoundTripInput {
  /** Search query */
  query: string;
  /** Filters */
  filters?: ObservationFilters;
  /** Options */
  options?: ProcessOptions;
  /** Parent context */
  parent_context?: ParentContext;
}

/**
 * Claude Mem ID with relevance information.
 */
export interface ClaudeMemId {
  /** Numeric observation ID */
  id: number;
  /** Reference string (derived) */
  ref: string;
  /** Observation type */
  type: string;
  /** Relevance score (0-100) */
  relevanceScore: number;
  /** Excerpt (for high relevance) */
  excerpt?: string;
  /** Reason for relevance */
  relevanceReason?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Summary information.
 */
export interface Summary {
  /** Key findings */
  key_findings: string[];
  /** Patterns detected */
  patterns_detected: string[];
  /** Context relevance */
  context_relevance: 'high' | 'medium' | 'low';
  /** Freshness */
  freshness: 'current' | 'recent' | 'stale';
}

/**
 * Observations metadata.
 */
export interface ObservationsMeta {
  /** Total found */
  total_found: number;
  /** Total reviewed */
  total_reviewed: number;
  /** Matching count */
  matching_count: number;
  /** Relevance threshold */
  relevance_threshold: number;
}

/**
 * Claude Mem IDs grouped by relevance.
 */
export interface ClaudeMemIds {
  /** High relevance (>=80) */
  high_relevance: ClaudeMemId[];
  /** Medium relevance (60-79) */
  medium_relevance: ClaudeMemId[];
  /** Low relevance (<60) */
  low_relevance: ClaudeMemId[];
}

/**
 * Follow-up recommendations.
 */
export interface FollowUp {
  /** Suggested queries */
  suggested_queries: string[];
  /** Recommended detail level */
  recommended_detail_level: DetailLevel;
  /** Haiku follow-up recommended */
  haiku_follow_up_recommended: boolean;
}

/**
 * Token usage information.
 */
export interface TokenUsage {
  /** Input tokens */
  input: number;
  /** Output tokens */
  output: number;
  /** Total tokens */
  total: number;
  /** Budget remaining */
  budget_remaining: number;
}

/**
 * Round-trip result.
 */
export interface RoundTripResult {
  /** Status */
  status: 'success' | 'partial' | 'empty' | 'error';
  /** Query information */
  query: {
    original: string;
    normalized: string;
    filters_applied: string[];
  };
  /** Summary */
  summary: Summary;
  /** Observations metadata */
  observations: ObservationsMeta;
  /** Claude Mem IDs */
  claude_mem_ids: ClaudeMemIds;
  /** Recommendations */
  recommendations: string[];
  /** Warnings */
  warnings: string[];
  /** Follow-up */
  follow_up: FollowUp;
  /** Token usage */
  token_usage: TokenUsage;
  /** Estimated cost in USD */
  estimated_cost_usd: number;
  /** Confidence (0-100) */
  confidence: number;
  /** Truncation reason (if applicable) */
  truncation_reason?: 'token_budget' | 'observation_limit' | 'time_budget';
}

/**
 * Memory bridge interface (mock for now, will be implemented separately).
 */
export interface MemoryBridge {
  retrieveObservations(params: {
    query: string;
    filters?: ObservationFilters;
    limit?: number;
  }): Promise<MemoryObservation[]>;
}

/**
 * Mem facilitator interface (mock for now, will be implemented separately).
 */
export interface MemFacilitator {
  processObservations(params: {
    observations: MemFacilitatorObservation[];
    query: string;
    filters?: ObservationFilters;
    options?: ProcessOptions;
    parent_context?: ParentContext;
  }): Promise<RoundTripResult>;
}

/**
 * Orchestrator round-trip pattern.
 *
 * Coordinates calls between @memory-bridge and @mem-facilitator.
 *
 * @param query - Search query
 * @param filters - Observation filters
 * @param options - Processing options
 * @param parentContext - Parent context from orchestrator
 * @param memoryBridge - Memory bridge instance
 * @param memFacilitator - Mem facilitator instance
 * @returns Round-trip result
 */
export async function orchestratorRoundTrip(
  query: string,
  filters: ObservationFilters = {},
  options: ProcessOptions = {},
  parentContext: ParentContext = {},
  memoryBridge: MemoryBridge,
  memFacilitator: MemFacilitator,
): Promise<RoundTripResult> {
  try {
    // Step 1: Check rate limit
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
      throw new Error(
        `[RATE_LIMIT_EXCEEDED] Too many requests. Please wait ${Math.ceil(rateLimit.waitTimeMs / 1000)} seconds.`,
      );
    }

    // Step 2: Call @memory-bridge to retrieve observations
    const rawObservations = await memoryBridge.retrieveObservations({
      query,
      filters,
      limit: filters.limit || DEFAULT_OBSERVATION_LIMIT,
    });

// Step 3: Filter and transform observations
    const validObservations = filterValidObservations(rawObservations);
    const transformedObservations = transformToMemFacilitatorFormat(validObservations);

    // Step 4: Enforce token budget
    const budgetResult = enforceTokenBudget(transformedObservations);

    // Step 5: Call @mem-facilitator with observations
    const result = await memFacilitator.processObservations({
      observations: budgetResult.truncated,
      query,
      filters,
      options,
      parent_context: {
        ...parentContext,
        constraints: parentContext.constraints ?? [],  // Ensure constraints is always present
      },
    });

    // Step 6: Add truncation reason if applicable
    if (budgetResult.status === 'partial' && budgetResult.truncationReason) {
      result.truncation_reason = budgetResult.truncationReason;
      result.warnings.push(
        `Observations truncated due to ${budgetResult.truncationReason}. Showing ${budgetResult.truncated.length} of ${transformedObservations.length} observations.`,
      );
    }

    // Step 7: Update token usage with budget enforcement
    result.token_usage.budget_remaining = Math.max(
      0,
      SUBAGENT_MEMORY_TOKEN_BUDGET - result.token_usage.total,
    );

    // Step 8: Update cost estimate
    const costEstimate = estimateCost(
      result.token_usage.input,
      result.token_usage.output,
    );
    result.estimated_cost_usd = costEstimate.totalCost;

    return result;
  } catch (error) {
    // Transform upstream errors into user-friendly format
    const transformed = transformUpstreamError(error);

    return {
      status: 'error',
      query: {
        original: query,
        normalized: query.toLowerCase().trim(),
        filters_applied: [],
      },
      summary: {
        key_findings: [],
        patterns_detected: [],
        context_relevance: 'low',
        freshness: 'stale',
      },
      observations: {
        total_found: 0,
        total_reviewed: 0,
        matching_count: 0,
        relevance_threshold: options.relevance_threshold ?? 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      recommendations: transformed.retryable
        ? ['Try again in a few moments']
        : ['Check your query and try again'],
      warnings: [transformed.message],
      follow_up: {
        suggested_queries: [],
        recommended_detail_level: 'standard',
        haiku_follow_up_recommended: false,
      },
      token_usage: {
        input: 0,
        output: 0,
        total: 0,
        budget_remaining: 8000,
      },
      estimated_cost_usd: 0,
      confidence: 0,
    };
  }
}

/**
 * Create a mock memory bridge for testing.
 */
export function createMockMemoryBridge(
  observations: MemoryObservation[],
): MemoryBridge {
  return {
    retrieveObservations: async () => observations,
  };
}

/**
 * Create a mock mem facilitator for testing.
 */
export function createMockMemFacilitator(
  result: Partial<RoundTripResult>,
): MemFacilitator {
  return {
    processObservations: async () => ({
      status: 'success',
      query: {
        original: '',
        normalized: '',
        filters_applied: [],
      },
      summary: {
        key_findings: [],
        patterns_detected: [],
        context_relevance: 'medium',
        freshness: 'recent',
      },
      observations: {
        total_found: 0,
        total_reviewed: 0,
        matching_count: 0,
        relevance_threshold: 60,
      },
      claude_mem_ids: {
        high_relevance: [],
        medium_relevance: [],
        low_relevance: [],
      },
      recommendations: [],
      warnings: [],
      follow_up: {
        suggested_queries: [],
        recommended_detail_level: 'standard',
        haiku_follow_up_recommended: false,
      },
      token_usage: {
        input: 0,
        output: 0,
        total: 0,
        budget_remaining: 8000,
      },
      estimated_cost_usd: 0,
      confidence: 0,
      ...result,
    }),
  };
}