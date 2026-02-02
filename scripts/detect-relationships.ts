#!/usr/bin/env bun
/**
 * Relationship Detection Migration Script
 *
 * Populates observation_relationships table by detecting semantic connections
 * between observations using 5 heuristics:
 * 1. Concept Overlap - shared concepts
 * 2. File Match - same files referenced
 * 3. Tool Sequence - sequential tool usage
 * 4. Temporal Proximity - created within 1 hour
 * 5. Session Proximity - same session
 *
 * Usage: bun scripts/detect-relationships.ts
 */

import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import type { RelationshipType, DetectionHeuristic, RelationshipMetadata } from '../src/relationships';

// Types matching the database schema
interface ObservationRow {
  id: number;
  type: string;
  title: string;
  concepts: string | null;
  created_at_epoch: number;
  memory_session_id: string;
  files_read: string | null;
  files_modified: string | null;
  oc_metadata: string | null;
}

interface DetectionObservation {
  id: number;
  type: string;
  created_at_epoch: number;
  concepts?: string[];
  files_read?: string[];
  files_modified?: string[];
  source_tool?: string;
  session_id: string;
}

interface DetectedRelationship {
  source_id: number;
  target_id: number;
  relationship_type: RelationshipType;
  confidence: number;
  metadata: RelationshipMetadata;
  heuristics: DetectionHeuristic[];
}

// Configuration
const CONFIG = {
  temporalWindowMs: 60 * 60 * 1000, // 1 hour
  minConceptOverlap: 3,
  minConfidence: 0.4,
  maxLookbackDays: 7,
  batchSize: 500,
  lookbackLimit: 5000 // Process recent 5000 observations
};

// Open database
const dbPath = join(homedir(), '.claude-mem', 'claude-mem.db');
const db = new Database(dbPath);

// Enable WAL mode and set busy timeout
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA synchronous = NORMAL');

console.log('Starting relationship detection...');
console.log(`Database: ${dbPath}`);

// Get observation count
const countResult = db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number };
const totalObservations = countResult.count;
console.log(`Total observations: ${totalObservations}`);

// Fetch recent observations (limit to 5000 for manageable processing)
console.log(`Processing ${Math.min(CONFIG.lookbackLimit, totalObservations)} recent observations...`);
const stmt = db.prepare(`
  SELECT
    id,
    type,
    title,
    concepts,
    created_at_epoch,
    memory_session_id,
    files_read,
    files_modified,
    oc_metadata
  FROM observations
  ORDER BY created_at_epoch DESC
  LIMIT ?
`);

const rows = stmt.all(CONFIG.lookbackLimit) as ObservationRow[];

// Convert rows to detection observations
const observations: DetectionObservation[] = rows.map(row => {
  const ocMetadata = row.oc_metadata ? JSON.parse(row.oc_metadata) : {};

  // Parse concepts from TEXT JSON array
  let concepts: string[] = [];
  if (row.concepts) {
    try {
      const parsed = JSON.parse(row.concepts);
      concepts = Array.isArray(parsed) ? parsed : [];
    } catch {
      concepts = [];
    }
  }

  // Parse files_read from TEXT JSON array
  let filesRead: string[] = [];
  if (row.files_read) {
    try {
      const parsed = JSON.parse(row.files_read);
      filesRead = Array.isArray(parsed) ? parsed : [];
    } catch {
      filesRead = [];
    }
  }

  // Parse files_modified from TEXT JSON array
  let filesModified: string[] = [];
  if (row.files_modified) {
    try {
      const parsed = JSON.parse(row.files_modified);
      filesModified = Array.isArray(parsed) ? parsed : [];
    } catch {
      filesModified = [];
    }
  }

  return {
    id: row.id,
    type: row.type,
    created_at_epoch: row.created_at_epoch,
    session_id: row.memory_session_id,
    concepts,
    files_read: filesRead,
    files_modified: filesModified,
    source_tool: ocMetadata.source_tool
  };
});

console.log(`Loaded ${observations.length} observations for processing`);

// Detection heuristics
function detectConceptOverlap(
  source: DetectionObservation,
  target: DetectionObservation
): { confidence: number; shared: string[] } | null {
  const sourceConcepts = source.concepts || [];
  const targetConcepts = target.concepts || [];

  if (sourceConcepts.length === 0 || targetConcepts.length === 0) {
    return null;
  }

  const sourceSet = new Set(sourceConcepts);
  const shared = targetConcepts.filter(c => sourceSet.has(c));

  if (shared.length < CONFIG.minConceptOverlap) {
    return null;
  }

  const total = new Set([...sourceConcepts, ...targetConcepts]).size;
  const confidence = Math.min(shared.length / total, 1.0);

  return { confidence, shared };
}

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

  const sourceModified = new Set(source.files_modified || []);
  const targetModified = new Set(target.files_modified || []);

  const directMatch = sharedFiles.filter(f => sourceModified.has(f) || targetModified.has(f)).length;

  const confidence = directMatch > 0 ? 0.85 : 0.65;

  return { confidence, sharedFiles };
}

function detectToolSequence(
  source: DetectionObservation,
  target: DetectionObservation
): { confidence: number; pattern: string } | null {
  const sourceTool = source.source_tool?.toLowerCase();
  const targetTool = target.source_tool?.toLowerCase();

  if (!sourceTool || !targetTool) {
    return null;
  }

  if (sourceTool === 'read' && targetTool === 'edit') {
    return { confidence: 0.9, pattern: 'read_then_edit' };
  }

  if (sourceTool === 'read' && targetTool === 'write') {
    return { confidence: 0.85, pattern: 'read_then_write' };
  }

  if (sourceTool === 'task' && targetTool === 'edit') {
    return { confidence: 0.75, pattern: 'task_then_edit' };
  }

  if (sourceTool === 'grep' && targetTool === 'edit') {
    return { confidence: 0.8, pattern: 'search_then_edit' };
  }

  return null;
}

function detectTemporalProximity(
  source: DetectionObservation,
  target: DetectionObservation,
  windowMs: number
): { confidence: number; timeDelta: number } | null {
  const timeDelta = Math.abs(target.created_at_epoch - source.created_at_epoch);

  if (timeDelta > windowMs) {
    return null;
  }

  const confidence = 1.0 - timeDelta / windowMs;

  if (confidence < 0.5) {
    return null;
  }

  return { confidence, timeDelta };
}

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

// Main detection function
function detectRelationships(
  source: DetectionObservation,
  target: DetectionObservation
): DetectedRelationship | null {
  if (source.id === target.id) {
    return null;
  }

  const allHeuristics: DetectionHeuristic[] = [];

  const conceptResult = detectConceptOverlap(source, target);
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

  const temporalResult = detectTemporalProximity(source, target, CONFIG.temporalWindowMs);
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
    return null;
  }

  // Aggregate confidence from multiple heuristics
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

  if (aggregateConfidence < CONFIG.minConfidence) {
    return null;
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

  return {
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
  };
}

// Process observations and detect relationships
const relationships: DetectedRelationship[] = [];
const relationshipsByType: Record<RelationshipType, number> = {
  references: 0,
  extends: 0,
  conflicts_with: 0,
  depends_on: 0,
  follows: 0,
  modifies: 0
};

console.log('Detecting relationships...');

for (let i = 0; i < observations.length; i++) {
  const source = observations[i];

  // Look back at previous observations (within lookback window)
  const maxLookback = Math.min(i + 100, observations.length); // Check up to 100 recent observations
  for (let j = i + 1; j < maxLookback; j++) {
    const target = observations[j];

    // Skip if time difference exceeds 7 days
    const timeDiffMs = Math.abs(source.created_at_epoch - target.created_at_epoch);
    if (timeDiffMs > CONFIG.maxLookbackDays * 24 * 60 * 60 * 1000) {
      continue;
    }

    const relationship = detectRelationships(source, target);
    if (relationship) {
      relationships.push(relationship);
      relationshipsByType[relationship.relationship_type]++;
    }
  }

  // Log progress
  if ((i + 1) % CONFIG.batchSize === 0) {
    console.log(`[${i + 1}/${observations.length}] Processed, ${relationships.length} relationships found...`);
  }
}

console.log(`\nComplete! Processed ${observations.length} observations.`);
console.log(`Total relationships detected: ${relationships.length}`);

// Insert relationships into database
if (relationships.length > 0) {
  console.log('\nInserting relationships into database...');

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO observation_relationships
      (source_id, target_id, relationship_type, confidence, metadata, created_at_epoch)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let startTime = Date.now();

  // Use transaction for batch inserts
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const rel of relationships) {
      insertStmt.run(
        rel.source_id,
        rel.target_id,
        rel.relationship_type,
        rel.confidence,
        JSON.stringify(rel.metadata),
        Math.floor(Date.now() / 1000)
      );
      inserted++;

      if (inserted % CONFIG.batchSize === 0) {
        console.log(`Inserted ${inserted}/${relationships.length} relationships...`);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log(`\nInsertion complete in ${duration.toFixed(2)}s`);
}

// Print statistics
console.log('\nRelationship Distribution by Type:');
console.log(`  - references: ${relationshipsByType.references}`);
console.log(`  - extends: ${relationshipsByType.extends}`);
console.log(`  - conflicts_with: ${relationshipsByType.conflicts_with}`);
console.log(`  - depends_on: ${relationshipsByType.depends_on}`);
console.log(`  - follows: ${relationshipsByType.follows}`);
console.log(`  - modifies: ${relationshipsByType.modifies}`);

// Verify insertion
const verifyResult = db.prepare(
  'SELECT COUNT(*) as count FROM observation_relationships'
).get() as { count: number };

console.log(`\nVerification: ${verifyResult.count} relationships in database`);

db.close();
console.log('\nDone!');
