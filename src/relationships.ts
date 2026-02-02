/**
 * Observation Relationships Module
 *
 * Types and interfaces for observation relationship tracking.
 * Relationships represent semantic connections between observations with confidence scoring.
 *
 * @module src/relationships
 */

/**
 * Six semantic relationship types
 */
export type RelationshipType =
  | 'references'      // Observation A references content from Observation B
  | 'extends'         // Observation A extends or builds upon Observation B
  | 'conflicts_with'  // Observation A contradicts or conflicts with Observation B
  | 'depends_on'      // Observation A depends on understanding Observation B
  | 'follows'         // Observation A chronologically follows Observation B
  | 'modifies';       // Observation A modifies or changes what Observation B introduced

/**
 * Detection heuristic with evidence
 */
export interface DetectionHeuristic {
  heuristic: 'concept_overlap' | 'file_match' | 'tool_sequence' | 'temporal_proximity' | 'session_proximity';
  confidence: number;
  evidence: string;
}

/**
 * Metadata stored as JSON for each relationship
 */
export interface RelationshipMetadata {
  shared_concepts?: string[];
  shared_files?: string[];
  time_delta_ms?: number;
  detection_heuristics?: DetectionHeuristic[];
}

/**
 * Complete relationship record
 */
export interface ObservationRelationship {
  id: number;
  source_id: number;
  target_id: number;
  relationship_type: RelationshipType;
  confidence: number;
  metadata?: RelationshipMetadata;
  created_at_epoch: number;
}

/**
 * Relationship with expanded observation details
 */
export interface RelationshipWithObservations extends ObservationRelationship {
  source_title?: string;
  source_type?: string;
  target_title?: string;
  target_type?: string;
}

/**
 * Graph traversal result
 */
export interface GraphNode {
  observation_id: number;
  title: string;
  type: string;
  depth: number;
  path: number[]; // Path from root: [root_id, ..., this_id]
  relationship_type?: RelationshipType;
  confidence?: number;
}

/**
 * Relationship statistics
 */
export interface RelationshipStats {
  total_count: number;
  by_type: Record<RelationshipType, number>;
  by_confidence: {
    high: number;      // >= 0.8
    medium: number;    // 0.5-0.79
    low: number;       // < 0.5
  };
  avg_confidence: number;
}

/**
 * Validate relationship type
 */
export function isValidRelationshipType(value: string): value is RelationshipType {
  return [
    'references',
    'extends',
    'conflicts_with',
    'depends_on',
    'follows',
    'modifies'
  ].includes(value);
}

/**
 * Validate confidence score (0-1.0)
 */
export function isValidConfidence(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1.0;
}

/**
 * Classify relationship confidence level
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}
