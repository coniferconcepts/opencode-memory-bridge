/**
 * OpenCode Metadata Schema
 * 
 * Responsibility:
 * - Define the schema for OpenCode-specific metadata stored in JSONB.
 * - Provide validation and default values for metadata fields.
 * 
 * @module src/integrations/claude-mem/metadata-schema
 * @see docs/MULTI_PROJECT_MEMORY_PLAN_FINAL.md
 */

import * as v from 'valibot';

/**
 * OpenCode metadata schema for observations.
 * Stored in oc_metadata JSONB column.
 */
export const OcMetadataSchema = v.object({
  // Branch lifecycle
  branch: v.optional(v.string()),
  scope: v.optional(v.picklist(['branch', 'project', 'global'])),
  promoted_at: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  archived_at: v.optional(v.pipe(v.string(), v.isoTimestamp())),

  // Importance classification
  importance: v.optional(v.picklist(['low', 'medium', 'high', 'critical'])),

  // Deontic markers
  deontic_type: v.optional(v.picklist(['must', 'should', 'may', 'never'])),
  deontic_source: v.optional(v.picklist(['root', 'user', 'memory'])),

  // Source tracking
  source_tool: v.optional(v.string()),
  source_file: v.optional(v.string()),
  source_line: v.optional(v.number()),

  // Execution metadata (Phase 2.2)
  execution_time_ms: v.optional(v.number()),
  success: v.optional(v.boolean()),
  error_message: v.optional(v.string()),
  started_at: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  ended_at: v.optional(v.pipe(v.string(), v.isoTimestamp())),

  // Team sync (Phase 2)
  sync_version: v.optional(v.number()),
  sync_origin: v.optional(v.string()), // R2 bucket origin

  // Vectorization (Phase 3)
  embedding_model: v.optional(v.string()),
  embedding_version: v.optional(v.number()),
});

export type OcMetadata = v.InferOutput<typeof OcMetadataSchema>;

/**
 * Default metadata for new observations.
 */
export function defaultMetadata(branch?: string): OcMetadata {
  return {
    branch: branch ?? 'main',
    scope: 'branch',
    importance: 'medium',
  };
}
