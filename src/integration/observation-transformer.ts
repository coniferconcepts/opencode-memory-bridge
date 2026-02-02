/**
 * Observation transformer for @mem-facilitator.
 *
 * Transforms observations from claude-mem service format to mem-facilitator schema format.
 *
 * ## Field Mappings
 *
 * | Service Field | Facilitator Field | Notes |
 * |---------------|-------------------|-------|
 * | narrative/text/title | content | Fallback chain |
 * | created_at_epoch | timestamp | Direct mapping |
 * | title, subtitle, project, etc. | metadata | Nested object |
 *
 * @module src/integration/observation-transformer
 */

import type { MemoryObservation } from '../schemas.js';

/**
 * Observation format expected by @mem-facilitator.
 */
export interface MemFacilitatorObservation {
  id: number;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

/**
 * Transform a single observation from service format to facilitator format.
 *
 * @param obs - Observation from claude-mem service
 * @returns Observation in mem-facilitator format
 */
export function transformObservation(obs: MemoryObservation): MemFacilitatorObservation {
  // Build content from narrative, text, or title (fallback chain)
  const content = obs.narrative ?? obs.text ?? obs.title ?? '';

  // Parse JSON fields safely
  let facts: unknown;
  let concepts: unknown;

  try {
    facts = obs.facts ? JSON.parse(obs.facts) : undefined;
  } catch {
    facts = obs.facts; // Keep as string if parse fails
  }

  try {
    concepts = obs.concepts ? JSON.parse(obs.concepts) : undefined;
  } catch {
    concepts = obs.concepts; // Keep as string if parse fails
  }

  return {
    id: obs.id,
    type: obs.type,
    content,
    metadata: {
      title: obs.title,
      subtitle: obs.subtitle ?? undefined,
      project: obs.project,
      session_id: obs.memory_session_id,
      facts,
      concepts,
      files_read: obs.files_read ?? undefined,
      files_modified: obs.files_modified ?? undefined,
      prompt_number: obs.prompt_number ?? undefined,
      created_at: obs.created_at,
    },
    timestamp: obs.created_at_epoch,
  };
}

/**
 * Transform multiple observations from service format to facilitator format.
 *
 * @param observations - Observations from claude-mem service
 * @returns Observations in mem-facilitator format
 */
export function transformToMemFacilitatorFormat(
  observations: MemoryObservation[]
): MemFacilitatorObservation[] {
  return observations.map(transformObservation);
}

/**
 * Validate that an observation has minimum required content.
 *
 * @param obs - Observation to validate
 * @returns True if observation has content
 */
export function hasValidContent(obs: MemoryObservation): boolean {
  return !!(obs.narrative || obs.text || obs.title);
}

/**
 * Filter observations to only those with valid content.
 *
 * @param observations - Observations to filter
 * @returns Observations with valid content
 */
export function filterValidObservations(
  observations: MemoryObservation[]
): MemoryObservation[] {
  return observations.filter(hasValidContent);
}