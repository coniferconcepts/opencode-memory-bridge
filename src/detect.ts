/**
 * Observation Relationship Detection
 *
 * Automatically detects semantic relationships between observations using 5 heuristics:
 * 1. Concept Overlap - shared concepts (min 3 concepts)
 * 2. File Matching - same file read/modified
 * 3. Tool Sequence - specific tool execution patterns (edit after read)
 * 4. Temporal Proximity - observations within time window (default 1 hour)
 * 5. Session Proximity - observations from same session
 *
 * Outputs relationship records with confidence scores and detection metadata.
 *
 * @module src/detect
 */

import type { RelationshipType, RelationshipMetadata, DetectionHeuristic } from './relationships';

/**
 * Observation structure for detection (subset of full observation)
 */
export interface DetectionObservation {
  id: number;
  type: string;
  session_id?: string;
  created_at_epoch: number;
  concepts?: string[];
  files_read?: string[];
  files_modified?: string[];
  source_tool?: string;
}

/**
 * Detected relationship result
 */
export interface DetectedRelationship {
  source_id: number;
  target_id: number;
  relationship_type: RelationshipType;
  confidence: number;
  metadata: RelationshipMetadata;
  heuristics: DetectionHeuristic[];
}

/**
 * Configuration for detection heuristics
 */
export interface DetectionConfig {
  // Temporal proximity window (milliseconds)
  temporalWindowMs?: number;

  // Minimum concept overlap (number of shared concepts)
  minConceptOverlap?: number;

  // Minimum confidence threshold for returning relationships
  minConfidence?: number;

  // Maximum lookback window (days)
  maxLookbackDays?: number;
}

/**
 * Default detection configuration
 */
const DEFAULT_CONFIG: Required<DetectionConfig> = {
  temporalWindowMs: 60 * 60 * 1000, // 1 hour
  minConceptOverlap: 3,
  minConfidence: 0.4,
  maxLookbackDays: 7
};

/**
 * Heuristic 1: Concept Overlap Detection
 * Finds shared concepts between observations
 * Returns confidence based on overlap ratio
 */
function detectConceptOverlap(
  source: DetectionObservation,
  target: DetectionObservation,
  minOverlap: number = 3
): { confidence: number; shared: string[] } | null {
  const sourceConcepts = source.concepts || [];
  const targetConcepts = target.concepts || [];

  if (sourceConcepts.length === 0 || targetConcepts.length === 0) {
    return null;
  }

  const sourceSet = new Set(sourceConcepts);
  const shared = targetConcepts.filter(c => sourceSet.has(c));

  if (shared.length < minOverlap) {
    return null;
  }

  // Confidence: ratio of shared to total unique concepts
  const total = new Set([...sourceConcepts, ...targetConcepts]).size;
  const confidence = Math.min(shared.length / total, 1.0);

  return { confidence, shared };
}

/**
 * Heuristic 2: File Matching Detection
 * Finds observations that access the same files
 * Returns confidence based on file overlap
 */
function detectFileMatch(
  source: DetectionObservation,
  target: DetectionObservation
): { confidence: number; sharedFiles: string[] } | null {
  const sourceFiles = new Set([
    ...(source.files_read || []),
    ...(source.files_modified || [])
  ]);

  const targetFiles = new Set([
    ...(target.files_read || []),
    ...(target.files_modified || [])
  ]);

  if (sourceFiles.size === 0 || targetFiles.size === 0) {
    return null;
  }

  const sharedFiles = Array.from(sourceFiles).filter(f => targetFiles.has(f));

  if (sharedFiles.length === 0) {
    return null;
  }

  // Confidence: higher for direct file modification
  const sourceModified = new Set(source.files_modified || []);
  const targetModified = new Set(target.files_modified || []);

  const directMatch = sharedFiles.filter(f => sourceModified.has(f) || targetModified.has(f)).length;

  // Confidence based on whether files were modified (0.9) vs just read (0.7)
  const confidence = directMatch > 0 ? 0.85 : 0.65;

  return { confidence, sharedFiles };
}

/**
 * Heuristic 3: Tool Sequence Detection
 * Identifies specific tool execution patterns
 * E.g., read followed by edit suggests modification of read content
 */
function detectToolSequence(
  source: DetectionObservation,
  target: DetectionObservation
): { confidence: number; pattern: string } | null {
  const sourceTool = source.source_tool?.toLowerCase();
  const targetTool = target.source_tool?.toLowerCase();

  if (!sourceTool || !targetTool) {
    return null;
  }

  // Pattern: read -> edit (high confidence modification)
  if (sourceTool === 'read' && targetTool === 'edit') {
    return { confidence: 0.9, pattern: 'read_then_edit' };
  }

  // Pattern: read -> write (modification)
  if (sourceTool === 'read' && targetTool === 'write') {
    return { confidence: 0.85, pattern: 'read_then_write' };
  }

  // Pattern: task -> edit (task investigation leads to edit)
  if (sourceTool === 'task' && targetTool === 'edit') {
    return { confidence: 0.75, pattern: 'task_then_edit' };
  }

  // Pattern: grep -> edit (search then modify)
  if (sourceTool === 'grep' && targetTool === 'edit') {
    return { confidence: 0.8, pattern: 'search_then_edit' };
  }

  return null;
}

/**
 * Heuristic 4: Temporal Proximity Detection
 * Observations close in time are likely related
 */
function detectTemporalProximity(
  source: DetectionObservation,
  target: DetectionObservation,
  windowMs: number
): { confidence: number; timeDelta: number } | null {
  const timeDelta = Math.abs(target.created_at_epoch - source.created_at_epoch);

  if (timeDelta > windowMs) {
    return null;
  }

  // Confidence: higher for observations very close in time
  const confidence = 1.0 - timeDelta / windowMs;

  // Minimum confidence threshold
  if (confidence < 0.5) {
    return null;
  }

  return { confidence, timeDelta };
}

/**
 * Heuristic 5: Session Proximity Detection
 * Observations from same session are related
 */
function detectSessionProximity(
  source: DetectionObservation,
  target: DetectionObservation
): { confidence: number } | null {
  if (!source.session_id || !target.session_id) {
    return null;
  }

  if (source.session_id === target.session_id) {
    return { confidence: 0.8 };
  }

  return null;
}

/**
 * Detect all relationships between source and target observations
 * Combines all heuristics with confidence aggregation
 */
export function detectRelationships(
  source: DetectionObservation,
  target: DetectionObservation,
  config: DetectionConfig = {}
): DetectedRelationship[] {
  if (source.id === target.id) {
    return []; // Don't relate observation to itself
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const relationships: DetectedRelationship[] = [];
  const allHeuristics: DetectionHeuristic[] = [];

  // Run all 5 heuristics
  const conceptResult = detectConceptOverlap(source, target, finalConfig.minConceptOverlap);
  if (conceptResult) {
    allHeuristics.push({
      heuristic: 'concept_overlap',
      confidence: conceptResult.confidence,
      evidence: `${conceptResult.shared.length} shared concepts: ${conceptResult.shared.join(', ')}`
    });
  }

  const fileResult = detectFileMatch(source, target);
  if (fileResult) {
    allHeuristics.push({
      heuristic: 'file_match',
      confidence: fileResult.confidence,
      evidence: `${fileResult.sharedFiles.length} shared files`
    });
  }

  const toolResult = detectToolSequence(source, target);
  if (toolResult) {
    allHeuristics.push({
      heuristic: 'tool_sequence',
      confidence: toolResult.confidence,
      evidence: toolResult.pattern
    });
  }

  const temporalResult = detectTemporalProximity(source, target, finalConfig.temporalWindowMs);
  if (temporalResult) {
    allHeuristics.push({
      heuristic: 'temporal_proximity',
      confidence: temporalResult.confidence,
      evidence: `${temporalResult.timeDelta}ms apart`
    });
  }

  const sessionResult = detectSessionProximity(source, target);
  if (sessionResult) {
    allHeuristics.push({
      heuristic: 'session_proximity',
      confidence: sessionResult.confidence,
      evidence: `Same session: ${source.session_id}`
    });
  }

  if (allHeuristics.length === 0) {
    return [];
  }

  // Aggregate confidence from multiple heuristics
  // Use weighted average (tool sequence and concept overlap weighted higher)
  let totalConfidence = 0;
  let weight = 0;

  for (const h of allHeuristics) {
    let heuristicWeight = 1;
    if (h.heuristic === 'tool_sequence') heuristicWeight = 2;
    if (h.heuristic === 'concept_overlap') heuristicWeight = 1.5;

    totalConfidence += h.confidence * heuristicWeight;
    weight += heuristicWeight;
  }

  const aggregateConfidence = totalConfidence / weight;

  // Only return if meets minimum confidence threshold
  if (aggregateConfidence < finalConfig.minConfidence) {
    return [];
  }

  // Determine relationship type based on detection patterns
  let relationshipType: RelationshipType = 'follows';

  if (toolResult?.pattern === 'read_then_edit') {
    relationshipType = 'modifies';
  } else if (toolResult?.pattern === 'task_then_edit') {
    relationshipType = 'extends';
  } else if (conceptResult) {
    relationshipType = 'references';
  } else if (temporalResult && fileResult) {
    relationshipType = 'follows';
  }

  relationships.push({
    source_id: source.id,
    target_id: target.id,
    relationship_type: relationshipType,
    confidence: Math.min(aggregateConfidence, 1.0),
    metadata: {
      shared_concepts: conceptResult?.shared,
      shared_files: fileResult?.sharedFiles,
      time_delta_ms: temporalResult?.timeDelta,
      detection_heuristics: allHeuristics
    },
    heuristics: allHeuristics
  });

  return relationships;
}

/**
 * Batch detect relationships from observation to many targets
 */
export function detectRelationshipsFromSource(
  source: DetectionObservation,
  targets: DetectionObservation[],
  config: DetectionConfig = {}
): DetectedRelationship[] {
  const results: DetectedRelationship[] = [];

  for (const target of targets) {
    const rels = detectRelationships(source, target, config);
    results.push(...rels);
  }

  return results;
}
