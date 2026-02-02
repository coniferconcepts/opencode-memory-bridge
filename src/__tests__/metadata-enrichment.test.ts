/**
 * ChromaSync Metadata Enrichment Tests (Task 3.3)
 *
 * Validates enrichment of observation metadata with:
 * - importance_score and importance tier extraction
 * - relationship data queries (count, types)
 * - file context flattening (files_read + files_modified)
 * - concept tag extraction from oc_metadata
 * - backward compatibility with existing metadata fields
 */

import { describe, it, expect, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { getEnrichedMetadata, EnrichedMetadata } from '../manifest';

const DB_PATH = join(tmpdir(), 'test-enrichment.db');

// Cleanup before and after tests
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    narrative TEXT,
    oc_metadata TEXT DEFAULT '{}',
    files_read TEXT,
    files_modified TEXT,
    prompt_number INTEGER,
    discovery_tokens INTEGER,
    memory_session_id TEXT,
    created_at_epoch INTEGER NOT NULL
  );

  CREATE TABLE observation_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK(relationship_type IN
      ('references', 'extends', 'conflicts_with', 'depends_on', 'follows', 'modifies')),
    confidence REAL NOT NULL DEFAULT 1.0,
    metadata TEXT,
    created_at_epoch INTEGER NOT NULL,
    FOREIGN KEY(source_id) REFERENCES observations(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES observations(id) ON DELETE CASCADE,
    UNIQUE(source_id, target_id, relationship_type)
  );

  CREATE INDEX idx_relationships_source ON observation_relationships(source_id);
  CREATE INDEX idx_relationships_target ON observation_relationships(target_id);
`);

/**
 * Helper: Create an observation with optional enriched metadata
 */
function createObservation(
  project: string,
  type: string,
  title: string,
  narrative: string,
  options: {
    importanceScore?: number;
    filesRead?: string[];
    filesModified?: string[];
    concepts?: string[];
    promptNumber?: number;
    discoveryTokens?: number;
    sessionId?: string;
  } = {}
): number {
  const ocMetadata = {
    importance_score: options.importanceScore ?? 50,
    concepts: options.concepts ?? []
  };

  const filesRead = options.filesRead ? JSON.stringify(options.filesRead) : null;
  const filesModified = options.filesModified ? JSON.stringify(options.filesModified) : null;

  const result = db.run(
    `INSERT INTO observations
      (project, type, title, narrative, oc_metadata, files_read, files_modified,
       prompt_number, discovery_tokens, memory_session_id, created_at_epoch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project,
      type,
      title,
      narrative,
      JSON.stringify(ocMetadata),
      filesRead,
      filesModified,
      options.promptNumber ?? null,
      options.discoveryTokens ?? null,
      options.sessionId ?? null,
      Date.now()
    ]
  );
  return result.lastInsertRowid as number;
}

/**
 * Helper: Create a relationship between two observations
 */
function createRelationship(
  sourceId: number,
  targetId: number,
  type: 'references' | 'extends' | 'conflicts_with' | 'depends_on' | 'follows' | 'modifies',
  confidence: number = 0.9
): number {
  const result = db.run(
    `INSERT INTO observation_relationships
      (source_id, target_id, relationship_type, confidence, created_at_epoch)
     VALUES (?, ?, ?, ?, ?)`,
    [sourceId, targetId, type, confidence, Date.now()]
  );
  return result.lastInsertRowid as number;
}

describe('ChromaSync Metadata Enrichment (Task 3.3)', () => {
  describe('Basic Enrichment - Importance Scores', () => {
    it('should extract importance_score from oc_metadata and map to tier (critical)', () => {
      const obsId = createObservation(
        'test-project',
        'decision',
        'Architecture Decision',
        'Decided to use microservices for better scalability and resilience.',
        { importanceScore: 95 }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.importance_score).toBe(95);
      expect(enriched.importance).toBe('critical');
    });

    it('should map importance_score 75 to tier (high)', () => {
      const obsId = createObservation(
        'test-project',
        'feature',
        'New API Endpoint',
        'Added REST endpoint for user authentication.',
        { importanceScore: 75 }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.importance_score).toBe(75);
      expect(enriched.importance).toBe('high');
    });

    it('should map importance_score 50 to tier (medium)', () => {
      const obsId = createObservation(
        'test-project',
        'change',
        'Code Refactor',
        'Refactored authentication module for clarity.',
        { importanceScore: 50 }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.importance_score).toBe(50);
      expect(enriched.importance).toBe('medium');
    });

    it('should map importance_score 20 to tier (low)', () => {
      const obsId = createObservation(
        'test-project',
        'discovery',
        'Minor Update',
        'Updated formatting in README.',
        { importanceScore: 20 }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.importance_score).toBe(20);
      expect(enriched.importance).toBe('low');
    });

    it('should use default importance_score (50) when oc_metadata missing', () => {
      const obsId = db.run(
        `INSERT INTO observations
          (project, type, title, narrative, oc_metadata, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['test-project', 'change', 'No Metadata', 'Test observation.', null, Date.now()]
      ).lastInsertRowid as number;

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.importance_score).toBe(50);
      expect(enriched.importance).toBe('medium');
    });
  });

  describe('Relationship Data Enrichment', () => {
    it('should count relationships where observation is source', () => {
      const source = createObservation(
        'test-project',
        'decision',
        'Design Decision',
        'Use distributed architecture.'
      );
      const target1 = createObservation('test-project', 'feature', 'Feature 1', 'Build component A.');
      const target2 = createObservation('test-project', 'feature', 'Feature 2', 'Build component B.');

      createRelationship(source, target1, 'follows', 0.95);
      createRelationship(source, target2, 'follows', 0.90);

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(source) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.relationship_count).toBe(2);
    });

    it('should extract unique relationship types', () => {
      const source = createObservation(
        'test-project',
        'decision',
        'Major Refactor',
        'Restructure codebase.'
      );
      const target1 = createObservation('test-project', 'feature', 'Feature', 'New feature.');
      const target2 = createObservation('test-project', 'bugfix', 'Bugfix', 'Fix issue.');
      const target3 = createObservation('test-project', 'refactor', 'Refactor', 'Clean up code.');

      createRelationship(source, target1, 'extends', 0.85);
      createRelationship(source, target2, 'modifies', 0.80);
      createRelationship(source, target3, 'follows', 0.90);

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(source) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.relationship_count).toBe(3);
      expect(enriched.relationship_types).toContain('extends');
      expect(enriched.relationship_types).toContain('modifies');
      expect(enriched.relationship_types).toContain('follows');
      expect(enriched.relationship_types.length).toBe(3);
    });

    it('should return empty relationships for observation with no relationships', () => {
      const obs = createObservation(
        'test-project',
        'discovery',
        'Isolated Observation',
        'No relationships.'
      );

      const record = db.query('SELECT * FROM observations WHERE id = ?').get(obs) as any;
      const enriched = getEnrichedMetadata(db, record);

      expect(enriched.relationship_count).toBe(0);
      expect(enriched.relationship_types.length).toBe(0);
    });

    it('should handle multiple relationships of same type', () => {
      const source = createObservation('test-project', 'decision', 'Decision', 'Design decision.');
      const t1 = createObservation('test-project', 'feature', 'Feature 1', 'Impl 1.');
      const t2 = createObservation('test-project', 'feature', 'Feature 2', 'Impl 2.');
      const t3 = createObservation('test-project', 'feature', 'Feature 3', 'Impl 3.');

      // Create 3 relationships of type 'follows'
      createRelationship(source, t1, 'follows', 0.9);
      createRelationship(source, t2, 'follows', 0.85);
      createRelationship(source, t3, 'follows', 0.88);

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(source) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.relationship_count).toBe(3);
      expect(enriched.relationship_types).toEqual(['follows']);
    });
  });

  describe('File Context Flattening', () => {
    it('should flatten files_read array', () => {
      const obsId = createObservation(
        'test-project',
        'change',
        'File Changes',
        'Modified several files.',
        {
          filesRead: ['/src/api.ts', '/src/db.ts', '/src/utils.ts']
        }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.files_context).toContain('/src/api.ts');
      expect(enriched.files_context).toContain('/src/db.ts');
      expect(enriched.files_context).toContain('/src/utils.ts');
      expect(enriched.files_context.length).toBe(3);
    });

    it('should flatten files_modified array', () => {
      const obsId = createObservation(
        'test-project',
        'change',
        'Modifications',
        'Modified core files.',
        {
          filesModified: ['/src/core.ts', '/src/main.ts']
        }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.files_context).toContain('/src/core.ts');
      expect(enriched.files_context).toContain('/src/main.ts');
      expect(enriched.files_context.length).toBe(2);
    });

    it('should combine files_read and files_modified, removing duplicates', () => {
      const obsId = createObservation(
        'test-project',
        'change',
        'Combined Files',
        'Read and modified files.',
        {
          filesRead: ['/src/api.ts', '/src/db.ts', '/src/shared.ts'],
          filesModified: ['/src/api.ts', '/src/utils.ts', '/src/shared.ts']
        }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.files_context).toContain('/src/api.ts');
      expect(enriched.files_context).toContain('/src/db.ts');
      expect(enriched.files_context).toContain('/src/utils.ts');
      expect(enriched.files_context).toContain('/src/shared.ts');
      // Should have 4 unique files (not 5)
      expect(enriched.files_context.length).toBe(4);
    });

    it('should return empty array when no files present', () => {
      const obsId = createObservation(
        'test-project',
        'discovery',
        'No Files',
        'No file changes.'
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.files_context).toEqual([]);
    });
  });

  describe('Concept Tag Extraction', () => {
    it('should extract concept tags from oc_metadata', () => {
      const obsId = createObservation(
        'test-project',
        'decision',
        'Architecture',
        'Made architecture decision.',
        {
          concepts: ['scalability', 'performance', 'resilience', 'distributed-systems']
        }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.concept_tags).toContain('scalability');
      expect(enriched.concept_tags).toContain('performance');
      expect(enriched.concept_tags).toContain('resilience');
      expect(enriched.concept_tags).toContain('distributed-systems');
      expect(enriched.concept_tags.length).toBe(4);
    });

    it('should return empty array when no concepts in metadata', () => {
      const obsId = createObservation(
        'test-project',
        'change',
        'Simple Change',
        'Minor update.'
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      expect(enriched.concept_tags).toEqual([]);
    });

    it('should handle malformed oc_metadata gracefully', () => {
      const obsId = db.run(
        `INSERT INTO observations
          (project, type, title, narrative, oc_metadata, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['test-project', 'change', 'Bad JSON', 'Test.', '{invalid json}', Date.now()]
      ).lastInsertRowid as number;

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      // Should gracefully return empty array instead of throwing
      expect(enriched.concept_tags).toEqual([]);
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve existing metadata fields', () => {
      const obsId = createObservation(
        'test-project',
        'feature',
        'New Feature',
        'Added user dashboard.',
        {
          importanceScore: 80,
          promptNumber: 5,
          discoveryTokens: 2500,
          sessionId: 'session-12345'
        }
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched = getEnrichedMetadata(db, obs);

      // Existing fields
      expect(enriched.project).toBe('test-project');
      expect(enriched.type).toBe('feature');
      expect(enriched.prompt_number).toBe(5);
      expect(enriched.discovery_tokens).toBe(2500);
      expect(enriched.memory_session_id).toBe('session-12345');
      expect(typeof enriched.created_at_epoch).toBe('number');

      // New fields
      expect(enriched.importance_score).toBe(80);
      expect(enriched.importance).toBe('high');
    });

    it('should type-check EnrichedMetadata interface', () => {
      const obsId = createObservation(
        'test-project',
        'bugfix',
        'Bug Fix',
        'Fixed critical bug.'
      );

      const obs = db.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      const enriched: EnrichedMetadata = getEnrichedMetadata(db, obs);

      // Verify structure matches EnrichedMetadata interface
      expect(typeof enriched.project).toBe('string');
      expect(typeof enriched.type).toBe('string');
      expect(typeof enriched.created_at_epoch).toBe('number');
      expect(typeof enriched.importance_score).toBe('number');
      expect(['critical', 'high', 'medium', 'low']).toContain(enriched.importance);
      expect(Array.isArray(enriched.relationship_types)).toBe(true);
      expect(Array.isArray(enriched.files_context)).toBe(true);
      expect(Array.isArray(enriched.concept_tags)).toBe(true);
    });
  });

  describe('Edge Cases and Resilience', () => {
    it('should clamp importance_score to valid range (0-100)', () => {
      const obs1Id = db.run(
        `INSERT INTO observations
          (project, type, title, narrative, oc_metadata, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'test-project',
          'change',
          'Over 100',
          'Test.',
          JSON.stringify({ importance_score: 150 }),
          Date.now()
        ]
      ).lastInsertRowid as number;

      const obs2Id = db.run(
        `INSERT INTO observations
          (project, type, title, narrative, oc_metadata, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'test-project',
          'change',
          'Negative',
          'Test.',
          JSON.stringify({ importance_score: -10 }),
          Date.now()
        ]
      ).lastInsertRowid as number;

      const obs1 = db.query('SELECT * FROM observations WHERE id = ?').get(obs1Id) as any;
      const obs2 = db.query('SELECT * FROM observations WHERE id = ?').get(obs2Id) as any;

      const enriched1 = getEnrichedMetadata(db, obs1);
      const enriched2 = getEnrichedMetadata(db, obs2);

      expect(enriched1.importance_score).toBe(100);
      expect(enriched2.importance_score).toBe(0);
    });

    it('should handle missing relationship table gracefully', () => {
      // Create a fresh db without relationships table
      const tempDb = new Database(join(tmpdir(), 'test-no-rels.db'));
      tempDb.exec(`
        CREATE TABLE observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          narrative TEXT,
          oc_metadata TEXT DEFAULT '{}',
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          discovery_tokens INTEGER,
          memory_session_id TEXT,
          created_at_epoch INTEGER NOT NULL
        );
      `);

      const obsId = tempDb.run(
        `INSERT INTO observations
          (project, type, title, narrative, oc_metadata, created_at_epoch)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'test-project',
          'change',
          'No Rel Table',
          'Test.',
          JSON.stringify({ importance_score: 75 }),
          Date.now()
        ]
      ).lastInsertRowid as number;

      const obs = tempDb.query('SELECT * FROM observations WHERE id = ?').get(obsId) as any;
      // Should not throw even though relationships table doesn't exist
      const enriched = getEnrichedMetadata(tempDb, obs);

      expect(enriched.relationship_count).toBe(0);
      expect(enriched.relationship_types).toEqual([]);
      expect(enriched.importance_score).toBe(75);

      tempDb.close();
      if (existsSync(join(tmpdir(), 'test-no-rels.db'))) {
        unlinkSync(join(tmpdir(), 'test-no-rels.db'));
      }
    });
  });
});

afterAll(() => {
  db.close();
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
});
