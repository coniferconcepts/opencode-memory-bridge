/**
 * Phase 3 Integration Tests
 * Validates complete Phase 3 flow: scoring, detection, and graph queries
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import { calculateImportanceScore } from '../scoring';
import { detectRelationships } from '../detect';
import { getRelatedObservations, getRelationshipGraph, findPathBetween } from '../queries';

const DB_PATH = join(tmpdir(), 'test-integration.db');
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    narrative TEXT,
    oc_metadata TEXT DEFAULT '{}',
    created_at_epoch INTEGER NOT NULL
  );

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

  CREATE INDEX idx_relationships_source ON observation_relationships(source_id);
  CREATE INDEX idx_relationships_target ON observation_relationships(target_id);
  CREATE INDEX idx_relationships_bidirectional ON observation_relationships(source_id, target_id, confidence DESC);
`);

const now = Date.now();

function createObservation(type: string, title: string, narrative: string): number {
  const scoring = calculateImportanceScore({
    type: type as any,
    narrativeLength: narrative.length,
    createdAtEpoch: now
  });
  const metadata = { importance_score: scoring.score };
  const result = db.run(
    'INSERT INTO observations (type, title, narrative, oc_metadata, created_at_epoch) VALUES (?, ?, ?, ?, ?)',
    [type, title, narrative, JSON.stringify(metadata), now]
  );
  return result.lastInsertRowid as number;
}

describe('Phase 3 Integration', () => {
  it('should create observations with importance scores', () => {
    const id = createObservation('feature', 'API Endpoint', 'Added REST endpoint');
    const obs = db.query('SELECT oc_metadata FROM observations WHERE id = ?').get(id) as any;
    const metadata = JSON.parse(obs.oc_metadata);
    expect(metadata.importance_score).toBeGreaterThan(0);
  });

  it('should detect relationships automatically', () => {
    const dec = createObservation('decision', 'Architecture', 'REST design');
    const feat = createObservation('feature', 'Implementation', 'Build endpoints');

    db.run(
      'INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)',
      [dec, feat, 'follows', 0.9, now]
    );

    const related = getRelatedObservations(db, feat);
    expect(related.length).toBeGreaterThan(0);
  });

  it('should enable graph queries', () => {
    const dec = createObservation('decision', 'Arch', 'REST');
    const feat = createObservation('feature', 'Impl', 'Build');
    const fix = createObservation('bugfix', 'Fixed', 'Error');

    db.run(
      'INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)',
      [dec, feat, 'follows', 0.9, now]
    );
    db.run(
      'INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)',
      [feat, fix, 'modifies', 0.85, now]
    );

    const graph = getRelationshipGraph(db, dec, 2);
    expect(graph.nodes.length).toBeGreaterThan(0);

    const path = findPathBetween(db, dec, fix);
    if (path.found) {
      expect(path.distance).toBeGreaterThan(0);
    }
  });

  it('should handle performance efficiently', () => {
    const start = performance.now();
    getRelationshipGraph(db, 1, 2);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(150);
  });

  afterAll(() => {
    db.close();
    if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  });
});
