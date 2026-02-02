/**
 * Valibot schemas for @mem-facilitator input/output contracts.
 *
 * Guardrails:
 * - #18: Always validate input before processing (strict schemas)
 * - #7: No unbounded regex (not used here)
 *
 * @module src/schemas/mem-facilitator
 */

import * as v from 'valibot';
import { DEFAULT_OBSERVATION_LIMIT, MAX_OBSERVATION_LIMIT, MIN_OBSERVATION_LIMIT } from '../constants.js';

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Filters applied to observation retrieval.
 */
export const MemFacilitatorFiltersSchema = v.strictObject({
  types: v.optional(v.array(v.string())),
  time_range: v.optional(v.picklist(['7d', '30d', 'all'])),
  project: v.optional(v.string()),
  limit: v.optional(
    v.pipe(v.number(), v.minValue(MIN_OBSERVATION_LIMIT), v.maxValue(MAX_OBSERVATION_LIMIT)),
    DEFAULT_OBSERVATION_LIMIT
  ),
});

/**
 * Optional parent context supplied by orchestrator.
 */
export const MemFacilitatorParentContextSchema = v.strictObject({
  agent_id: v.string(),
  goals: v.array(v.string()),
  constraints: v.optional(v.array(v.string()), []),  // Optional with default []
});

/**
 * Observation payload supplied by the orchestrator.
 */
export const MemFacilitatorObservationSchema = v.strictObject({
  id: v.number(),
  type: v.string(),
  content: v.string(),
  metadata: v.record(v.string(), v.unknown()),
  timestamp: v.number(),
});

/**
 * Mem-facilitator input schema.
 */
export const MemFacilitatorInputSchema = v.strictObject({
  input_type: v.literal('observation_review'),
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  filters: MemFacilitatorFiltersSchema,
  output_format: v.optional(v.picklist(['summary', 'summary_with_ids', 'ids_only'])),
  relevance_threshold: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
  detail_level: v.optional(v.picklist(['brief', 'standard', 'comprehensive'])),
  parent_context: v.optional(MemFacilitatorParentContextSchema),
  observations: v.array(MemFacilitatorObservationSchema),
});

export type MemFacilitatorInput = v.InferOutput<typeof MemFacilitatorInputSchema>;

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * High relevance ID entry (includes excerpt + relevance reason).
 */
export const MemFacilitatorHighRelevanceIdSchema = v.strictObject({
  id: v.number(),
  ref: v.string(),
  type: v.string(),
  relevanceScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  excerpt: v.pipe(v.string(), v.maxLength(200)),
  relevanceReason: v.string(),
  timestamp: v.number(),
});

/**
 * Medium relevance ID entry.
 */
export const MemFacilitatorMediumRelevanceIdSchema = v.strictObject({
  id: v.number(),
  ref: v.string(),
  type: v.string(),
  relevanceScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  timestamp: v.number(),
});

/**
 * Low relevance ID entry.
 */
export const MemFacilitatorLowRelevanceIdSchema = v.strictObject({
  id: v.number(),
  ref: v.string(),
  type: v.string(),
  relevanceScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  timestamp: v.number(),
});

/**
 * Mem-facilitator output schema.
 */
export const MemFacilitatorOutputSchema = v.strictObject({
  status: v.picklist(['success', 'partial', 'empty', 'error']),
  query: v.strictObject({
    original: v.string(),
    normalized: v.string(),
    filters_applied: v.array(v.string()),
  }),
  summary: v.strictObject({
    key_findings: v.array(v.string()),
    patterns_detected: v.array(v.string()),
    context_relevance: v.picklist(['high', 'medium', 'low']),
    freshness: v.picklist(['current', 'recent', 'stale']),
  }),
  observations: v.strictObject({
    total_found: v.number(),
    total_reviewed: v.number(),
    matching_count: v.number(),
    relevance_threshold: v.number(),
  }),
  claude_mem_ids: v.strictObject({
    high_relevance: v.array(MemFacilitatorHighRelevanceIdSchema),
    medium_relevance: v.array(MemFacilitatorMediumRelevanceIdSchema),
    low_relevance: v.array(MemFacilitatorLowRelevanceIdSchema),
  }),
  recommendations: v.array(v.string()),
  warnings: v.array(v.string()),
  follow_up: v.strictObject({
    suggested_queries: v.array(v.string()),
    recommended_detail_level: v.picklist(['brief', 'standard', 'comprehensive']),
    haiku_follow_up_recommended: v.boolean(),
  }),
  token_usage: v.strictObject({
    input: v.number(),
    output: v.number(),
    total: v.number(),
    budget_remaining: v.number(),
  }),
  estimated_cost_usd: v.number(),
  confidence: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  truncation_reason: v.optional(v.picklist(['token_budget', 'observation_limit', 'time_budget'])),
});

export type MemFacilitatorOutput = v.InferOutput<typeof MemFacilitatorOutputSchema>;