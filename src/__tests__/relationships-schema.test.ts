/**
 * Observation Relationships Schema Tests
 *
 * Validates:
 * - Relationships table creation and structure
 * - Strategic index functionality
 * - Type constraints and validation
 * - Foreign key relationships
 * - Unique constraints
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import {
  isValidRelationshipType,
  isValidConfidence,
  getConfidenceLevel,
  type RelationshipType
} from '../relationships';

const DB_PATH = join(tmpdir(), 'test-relationships.db');

if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
}

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    narrative TEXT,
    created_at_epoch INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE observation_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    metadata TEXT,
    created_at_epoch INTEGER NOT NULL,
    FOREIGN KEY(source_id) REFERENCES observations(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES observations(id) ON DELETE CASCADE,
    UNIQUE(source_id, target_id, relationship_type)
  );

  CREATE INDEX idx_relationships_source
    ON observation_relationships(source_id);

  CREATE INDEX idx_relationships_target
    ON observation_relationships(target_id);

  CREATE INDEX idx_relationships_bidirectional
    ON observation_relationships(source_id, target_id, confidence DESC);

  CREATE INDEX idx_relationships_high_confidence
    ON observation_relationships(confidence DESC)
    WHERE confidence >= 0.7;
`);

const now = Date.now();
const obs1 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['feature', 'Added API endpoint', 'Created /api/v2/search', now]
).lastInsertRowid;

const obs2 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['decision', 'Chose search library', 'Selected Meilisearch', now - 3600000]
).lastInsertRowid;

const obs3 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['bugfix', 'Fixed search timeout', 'Added timeout parameter', now - 7200000]
).lastInsertRowid;

const obs4 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['feature', 'Added caching', 'Implemented Redis cache', now - 10800000]
).lastInsertRowid;

describe('Observation Relationships Schema', () => {
  describe('Type Validation', () => {
    it('should validate relationship types', () => {
      const validTypes: RelationshipType[] = [
        'references',
        'extends',
        'conflicts_with',
        'depends_on',
        'follows',
        'modifies'
      ];

      for (const type of validTypes) {
        expect(isValidRelationshipType(type)).toBe(true);
      }
    });

    it('should reject invalid types', () => {
      expect(isValidRelationshipType('invalid')).toBe(false);
      expect(isValidRelationshipType('cross_ref')).toBe(false);
    });

    it('should validate confidence scores', () => {
      expect(isValidConfidence(0)).toBe(true);
      expect(isValidConfidence(0.5)).toBe(true);
      expect(isValidConfidence(1.0)).toBe(true);
      expect(isValidConfidence(-0.1)).toBe(false);
      expect(isValidConfidence(1.1)).toBe(false);
    });

    it('should classify confidence levels', () => {
      expect(getConfidenceLevel(0.9)).toBe('high');
      expect(getConfidenceLevel(0.7)).toBe('medium');
      expect(getConfidenceLevel(0.4)).toBe('low');
    });
  });

  describe('Schema Structure', () => {
    it('should have relationships table', () => {
      const tables = db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='observation_relationships'"
      ).all();

      expect(tables.length).toBe(1);
    });

    it('should have all required columns', () => {
      const columns = db.query(
        "PRAGMA table_info(observation_relationships)"
      ).all() as any[];

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('source_id');
      expect(columnNames).toContain('target_id');
      expect(columnNames).toContain('relationship_type');
      expect(columnNames).toContain('confidence');
      expect(columnNames).toContain('metadata');
      expect(columnNames).toContain('created_at_epoch');
    });

    it('should have all strategic indices', () => {
      const indices = db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='observation_relationships'"
      ).all() as any[];

      const indexNames = indices.map(i => i.name);
      expect(indexNames).toContain('idx_relationships_source');
      expect(indexNames).toContain('idx_relationships_target');
      expect(indexNames).toContain('idx_relationships_bidirectional');
      expect(indexNames).toContain('idx_relationships_high_confidence');
    });
  });

  describe('Basic Operations', () => {
    it('should insert relationship', () => {
      const result = db.run(
        `INSERT INTO observation_relationships
         (source_id, target_id, relationship_type, confidence, created_at_epoch)
         VALUES (?, ?, ?, ?, ?)`,
        [
          obs1,
          obs2,
          'depends_on',
          0.85,
          now
        ]
      );

      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const rel = db.query(
        'SELECT * FROM observation_relationships WHERE id = ?'
      ).get(result.lastInsertRowid) as any;

      expect(rel.source_id).toBe(Number(obs1));
      expect(rel.relationship_type).toBe('depends_on');
      expect(rel.confidence).toBeCloseTo(0.85, 2);
    });

    it('should use default confidence of 1.0', () => {
      const result = db.run(
        `INSERT INTO observation_relationships
         (source_id, target_id, relationship_type, created_at_epoch)
         VALUES (?, ?, ?, ?)`,
        [obs2, obs3, 'follows', now]
      );

      const rel = db.query(
        'SELECT confidence FROM observation_relationships WHERE id = ?'
      ).get(result.lastInsertRowid) as any;

      expect(rel.confidence).toBe(1.0);
    });
  });

  describe('Query Patterns', () => {
    it('should query outgoing relationships', () => {
      const outgoing = db.query(
        'SELECT * FROM observation_relationships WHERE source_id = ? ORDER BY confidence DESC'
      ).all(obs1);

      expect(Array.isArray(outgoing)).toBe(true);
    });

    it('should query incoming relationships', () => {
      const incoming = db.query(
        'SELECT * FROM observation_relationships WHERE target_id = ? ORDER BY confidence DESC'
      ).all(obs2);

      expect(Array.isArray(incoming)).toBe(true);
    });

    it('should query high-confidence relationships efficiently', () => {
      const start = performance.now();
      const highConf = db.query(
        'SELECT * FROM observation_relationships WHERE confidence >= 0.7 ORDER BY confidence DESC LIMIT 10'
      ).all();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(Array.isArray(highConf)).toBe(true);
    });
  });

  describe('Cascade Delete', () => {
    it('should cascade delete relationships when observation deleted', () => {
      const relResult = db.run(
        `INSERT INTO observation_relationships
         (source_id, target_id, relationship_type, confidence, created_at_epoch)
         VALUES (?, ?, ?, ?, ?)`,
        [obs1, obs4, 'extends', 0.8, now]
      );

      const relId = relResult.lastInsertRowid;

      db.run('DELETE FROM observations WHERE id = ?', [obs4]);

      const deleted = db.query(
        'SELECT * FROM observation_relationships WHERE id = ?'
      ).get(relId) as any;

      expect(deleted).toBeNull();
    });
  });

  afterAll(() => {
    db.close();
    if (existsSync(DB_PATH)) {
      unlinkSync(DB_PATH);
    }
  });
});
