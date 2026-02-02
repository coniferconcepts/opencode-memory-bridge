/**
 * Valibot schemas for claude-mem HTTP API integration
 *
 * These schemas validate inputs/outputs when communicating with the
 * local claude-mem Bun service (http://localhost:37777).
 *
 * @see https://github.com/thedotmack/claude-mem
 * @version Aligned with claude-mem v9.0.4
 */

import * as v from 'valibot';
import { DEFAULT_OBSERVATION_LIMIT, MAX_OBSERVATION_LIMIT, MIN_OBSERVATION_LIMIT } from './constants.js';

// =============================================================================
// Observation Types (from claude-mem)
// =============================================================================

/**
 * Observation type enum matching claude-mem's classification system
 */
export const ObservationTypeSchema = v.picklist([
  'bugfix',
  'feature',
  'refactor',
  'discovery',
  'decision',
  'change',
  'session-request',
  'learning',
  'file-change',
  'error',
  'tool-use',
]);

/**
 * Observation type classification
 */
export type ObservationType = v.InferOutput<typeof ObservationTypeSchema>;

// =============================================================================
// Input Schemas (OpenCode -> claude-mem)
// =============================================================================

/**
 * Memory search query parameters
 */
export const MemoryQuerySchema = v.object({
  /** Search query string */
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),

  /** Filter by project name (defaults to current project) */
  project: v.optional(v.string()),

  /** Maximum number of results to return */
  limit: v.optional(
    v.pipe(v.number(), v.minValue(MIN_OBSERVATION_LIMIT), v.maxValue(MAX_OBSERVATION_LIMIT)),
    DEFAULT_OBSERVATION_LIMIT
  ),

  /** Filter by observation types */
  types: v.optional(v.array(ObservationTypeSchema)),

  /** Filter by date range (ISO 8601) */
  since: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  until: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

/**
 * Memory search query input type
 */
export type MemoryQuery = v.InferInput<typeof MemoryQuerySchema>;

/**
 * Context retrieval parameters
 */
export const ContextQuerySchema = v.object({
  /** Project name for context filtering */
  project: v.string(),
  
  /** Maximum number of observations to include */
  limit: v.optional(v.pipe(v.number(), v.minValue(MIN_OBSERVATION_LIMIT), v.maxValue(MAX_OBSERVATION_LIMIT)), DEFAULT_OBSERVATION_LIMIT),
  
  /** Include session summaries */
  includeSummaries: v.optional(v.boolean(), true),
});

/**
 * Context retrieval query input type
 */
export type ContextQuery = v.InferInput<typeof ContextQuerySchema>;

// =============================================================================
// Response Schemas (claude-mem -> OpenCode)
// =============================================================================

/**
 * Single memory observation from claude-mem
 */
export const MemoryObservationSchema = v.object({
  /** Unique observation ID */
  id: v.number(),
  
  /** Associated session ID */
  memory_session_id: v.string(),
  
  /** Project name */
  project: v.string(),
  
  /** Observation type classification */
  type: v.string(),
  
  /** Short title */
  title: v.string(),
  
  /** Subtitle or secondary summary */
  subtitle: v.optional(v.nullable(v.string())),
  
  /** Full narrative description */
  narrative: v.optional(v.nullable(v.string())),
  
  /** Raw text content */
  text: v.optional(v.nullable(v.string())),
  
  /** Key facts (JSON string) */
  facts: v.optional(v.nullable(v.string())),
  
  /** Associated concepts (JSON string) */
  concepts: v.optional(v.nullable(v.string())),
  
  /** Files read during observation (JSON string) */
  files_read: v.optional(v.nullable(v.string())),
  
  /** Files modified during observation (JSON string) */
  files_modified: v.optional(v.nullable(v.string())),
  
  /** Prompt number in session */
  prompt_number: v.optional(v.number()),
  
  /** Creation timestamp (ISO 8601) */
  created_at: v.string(),
  
  /** Creation timestamp (epoch ms) */
  created_at_epoch: v.number(),
});

/**
 * Memory observation output type
 */
export type MemoryObservation = v.InferOutput<typeof MemoryObservationSchema>;

/**
 * Outbox observation for sending to claude-mem
 * Validates observations early to catch incomplete data before transmission
 * Enforces narrative requirement and minimum length to prevent null/empty entries
 */
export const OutboxObservationSchema = v.object({
  /** Associated session ID */
  session_id: v.string(),

  /** Source of the observation (e.g., 'opencode', 'claude-code') */
  source: v.string(),

  /** Project name */
  project: v.string(),

  /** Current working directory (optional) */
  cwd: v.optional(v.string()),

  /** Tool that generated the observation */
  tool: v.string(),

  /** Short title (max 80 characters, optional) */
  title: v.optional(v.pipe(v.string(), v.maxLength(80))),

  /** Observation type classification (optional) */
  type: v.optional(v.picklist([
    'decision',
    'bugfix',
    'feature',
    'refactor',
    'discovery',
    'change',
  ])),

  /** Full narrative description (REQUIRED, minimum 10 characters) */
  narrative: v.pipe(v.string(), v.minLength(10)),

  /** Associated concepts (optional array of strings) */
  concepts: v.optional(v.array(v.string())),

  /** Key facts (optional array of strings) */
  facts: v.optional(v.array(v.string())),

  /** Raw text content */
  content: v.string(),

  /** Creation timestamp (ISO 8601) */
  timestamp: v.string(),
});

/**
 * Outbox observation output type
 */
export type OutboxObservation = v.InferOutput<typeof OutboxObservationSchema>;

/**
 * Markdown content item
 */
export const ContentItemSchema = v.object({
  type: v.literal('text'),
  text: v.string(),
});

/**
 * Content item output type
 */
export type ContentItem = v.InferOutput<typeof ContentItemSchema>;

/**
 * Response containing markdown content (for context/search endpoints)
 */
export const ContextResponseSchema = v.object({
  /** Array of content items */
  content: v.array(ContentItemSchema),
});

/**
 * Context response output type
 */
export type ContextResponse = v.InferOutput<typeof ContextResponseSchema>;

/**
 * Paginated response for observations
 */
export const MemorySearchResponseSchema = v.object({
  /** Array of content items */
  content: v.array(ContentItemSchema),
});

/**
 * Memory search response output type
 */
export type MemorySearchResponse = v.InferOutput<typeof MemorySearchResponseSchema>;

// =============================================================================
// Health & Status Schemas
// =============================================================================

/**
 * Service health status
 */
export const HealthStatusSchema = v.picklist(['ok', 'healthy', 'degraded', 'unhealthy']);

/**
 * Health status output type
 */
export type HealthStatus = v.InferOutput<typeof HealthStatusSchema>;

/**
 * Health check response from claude-mem
 */
export const HealthResponseSchema = v.object({
  /** Overall service status */
  status: HealthStatusSchema,
  
  /** Build ID */
  build: v.optional(v.string()),
  
  /** Whether service is initialized */
  initialized: v.optional(v.boolean()),
  
  /** Whether MCP is ready */
  mcpReady: v.optional(v.boolean()),
  
  /** Timestamp */
  timestamp: v.optional(v.number()),
});

/**
 * Health response output type
 */
export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;

// =============================================================================
// Error Schemas
// =============================================================================

/**
 * API error response
 */
export const ApiErrorSchema = v.object({
  /** Error code */
  code: v.string(),
  
  /** Human-readable error message */
  message: v.string(),
  
  /** Additional error details */
  details: v.optional(v.record(v.string(), v.unknown())),
});

/**
 * API error output type
 */
export type ApiError = v.InferOutput<typeof ApiErrorSchema>;

// =============================================================================
// Configuration Schema
// =============================================================================

/**
 * OpenCode-specific claude-mem configuration
 */
export const ClaudeMemConfigSchema = v.object({
  /** Base URL for claude-mem HTTP API */
  baseUrl: v.optional(v.pipe(v.string(), v.url())),
  
  /** Port for local service (used if baseUrl not provided) */
  port: v.optional(v.pipe(v.number(), v.minValue(1024), v.maxValue(65535)), 37777),
  
  /** Request timeout in milliseconds */
  timeout: v.optional(v.pipe(v.number(), v.minValue(1000), v.maxValue(30000)), 5000),
  
  /** Maximum retry attempts */
  maxRetries: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(5)), 3),
  
  /** Enable debug logging */
  debug: v.optional(v.boolean(), false),
  
  /** Verbosity level for user-facing logs ('quiet' | 'normal' | 'verbose') */
  verbosity: v.optional(v.picklist(['quiet', 'normal', 'verbose']), 'normal'),
  
  /** Project name override (defaults to current directory name) */
  project: v.optional(v.string()),
});

/**
 * Claude-mem configuration input type
 */
export type ClaudeMemConfig = v.InferInput<typeof ClaudeMemConfigSchema>;

