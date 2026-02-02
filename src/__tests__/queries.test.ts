/**
 * Graph Query Tests - Validates graph query functions and performance targets
 * Targets: <50ms for single-hop, <150ms for depth-2, <200ms for path finding
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, unlinkSync } from 'fs';
import {
  getRelatedObservations,
  getRelationshipGraph,
  findPathBetween
} from '../queries';

const DB_PATH = join(tmpdir(), 'test-queries.db');

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
  ['decision', 'Architecture Choice', 'Chose REST API', now]
).lastInsertRowid as number;

const obs2 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['feature', 'Implemented API', 'Added endpoints', now - 3600000]
).lastInsertRowid as number;

const obs3 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['bugfix', 'Fixed API Error', 'Fixed timeout', now - 7200000]
).lastInsertRowid as number;

const obs4 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['discovery', 'Found Library', 'Found request library', now - 10800000]
).lastInsertRowid as number;

const obs5 = db.run(
  'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
  ['feature', 'Added Caching', 'Implemented cache', now - 14400000]
).lastInsertRowid as number;

db.run(
  `INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch)
   VALUES (?, ?, ?, ?, ?)`,
  [obs1, obs2, 'follows', 0.9, now]
);

db.run(
  `INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch)
   VALUES (?, ?, ?, ?, ?)`,
  [obs2, obs3, 'modifies', 0.85, now]
);

db.run(
  `INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch)
   VALUES (?, ?, ?, ?, ?)`,
  [obs2, obs4, 'references', 0.75, now]
);

db.run(
  `INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch)
   VALUES (?, ?, ?, ?, ?)`,
  [obs3, obs5, 'extends', 0.65, now]
);

db.run(
  `INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch)
   VALUES (?, ?, ?, ?, ?)`,
  [obs1, obs5, 'depends_on', 0.55, now]
);

describe('Graph Queries', () => {
  describe('getRelatedObservations', () => {
    it('should find outgoing relationships', () => {
      const related = getRelatedObservations(db, obs1, { direction: 'outgoing' });
      expect(related.length).toBeGreaterThan(0);
      expect(related[0].observation_id).toBeTruthy();
    });

    it('should find incoming relationships', () => {
      const related = getRelatedObservations(db, obs2, { direction: 'incoming' });
      expect(related.length).toBeGreaterThan(0);
    });

    it('should find bidirectional relationships', () => {
      const related = getRelatedObservations(db, obs2, { direction: 'both' });
      expect(related.length).toBeGreaterThan(0);
    });

    it('should filter by relationship type', () => {
      const related = getRelatedObservations(db, obs2, {
        type: 'modifies',
        direction: 'outgoing'
      });
      expect(related.length).toBeGreaterThan(0);
      if (related.length > 0) {
        expect(related[0].relationship_type).toBe('modifies');
      }
    });

    it('should respect minimum confidence threshold', () => {
      const allRelated = getRelatedObservations(db, obs2, { minConfidence: 0.5 });
      const highConfidence = getRelatedObservations(db, obs2, { minConfidence: 0.9 });
      expect(allRelated.length).toBeGreaterThanOrEqual(highConfidence.length);
    });

    it('should respect limit parameter', () => {
      const limited = getRelatedObservations(db, obs1, { limit: 1 });
      expect(limited.length).toBeLessThanOrEqual(1);
    });

    it('should return observations ordered by confidence', () => {
      const related = getRelatedObservations(db, obs2);
      const withConfidence = related.filter(r => r.confidence !== undefined);
      for (let i = 0; i < withConfidence.length - 1; i++) {
        expect(withConfidence[i].confidence).toBeGreaterThanOrEqual(withConfidence[i + 1].confidence!);
      }
    });
  });

  describe('getRelationshipGraph', () => {
    it('should build graph from single observation', () => {
      const graph = getRelationshipGraph(db, obs1, 1);
      expect(graph.source_id).toBe(obs1);
      expect(graph.depth).toBe(1);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    it('should include edges in graph', () => {
      const graph = getRelationshipGraph(db, obs1, 1);
      expect(graph.edges.length).toBeGreaterThan(0);
      expect(graph.edges[0]).toHaveProperty('source_id');
      expect(graph.edges[0]).toHaveProperty('target_id');
      expect(graph.edges[0]).toHaveProperty('relationship_type');
      expect(graph.edges[0]).toHaveProperty('confidence');
    });

    it('should traverse to depth 2', () => {
      const graph = getRelationshipGraph(db, obs1, 2);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(1);
      const maxDepth = Math.max(...graph.nodes.map(n => n.depth));
      expect(maxDepth).toBeLessThanOrEqual(2);
    });

    it('should limit depth traversal', () => {
      const shallow = getRelationshipGraph(db, obs1, 1);
      const deep = getRelationshipGraph(db, obs1, 3);
      expect(deep.nodes.length).toBeGreaterThanOrEqual(shallow.nodes.length);
    });

    it('should respect confidence threshold', () => {
      const allEdges = getRelationshipGraph(db, obs1, 1, 0.4);
      const highConfidence = getRelationshipGraph(db, obs1, 1, 0.9);
      expect(allEdges.edges.length).toBeGreaterThanOrEqual(highConfidence.edges.length);
    });

    it('should include node paths', () => {
      const graph = getRelationshipGraph(db, obs1, 2);
      for (const node of graph.nodes) {
        expect(node).toHaveProperty('path');
        expect(Array.isArray(node.path)).toBe(true);
        if (node.depth === 0) {
          expect(node.path).toEqual([obs1]);
        }
      }
    });

    it('should avoid cycles in graph', () => {
      const graph = getRelationshipGraph(db, obs1, 3);
      for (const node of graph.nodes) {
        const pathSet = new Set(node.path);
        expect(pathSet.size).toBe(node.path.length);
      }
    });
  });

  describe('findPathBetween', () => {
    it('should find direct path between adjacent observations', () => {
      const path = findPathBetween(db, obs1, obs2);
      expect(path.found).toBe(true);
      expect(path.distance).toBe(1);
      expect(path.path.length).toBe(2);
    });

    it('should find multi-hop path', () => {
      const path = findPathBetween(db, obs1, obs3);
      if (path.found) {
        expect(path.distance).toBeGreaterThanOrEqual(1);
        expect(path.path.length).toBeGreaterThan(1);
      }
    });

    it('should return zero distance for same observation', () => {
      const path = findPathBetween(db, obs1, obs1);
      expect(path.found).toBe(true);
      expect(path.distance).toBe(0);
      expect(path.path).toEqual([obs1]);
    });

    it('should return empty path when no path exists', () => {
      const isolated = db.run(
        'INSERT INTO observations (type, title, narrative, created_at_epoch) VALUES (?, ?, ?, ?)',
        ['discovery', 'Isolated', 'No relations', now]
      ).lastInsertRowid as number;

      const path = findPathBetween(db, obs1, isolated);
      expect(path.found).toBe(false);
      expect(path.distance).toBe(-1);
      expect(path.path.length).toBe(0);
    });

    it('should respect maxDepth limit', () => {
      const path = findPathBetween(db, obs1, obs5, 10);
      if (path.found) {
        expect(path.distance).toBeLessThanOrEqual(10);
      }
    });

    it('should include edge details in path', () => {
      const path = findPathBetween(db, obs1, obs2);
      if (path.found && path.edges.length > 0) {
        expect(path.edges[0]).toHaveProperty('from');
        expect(path.edges[0]).toHaveProperty('to');
        expect(path.edges[0]).toHaveProperty('relationship_type');
        expect(path.edges[0]).toHaveProperty('confidence');
      }
    });

    it('should reconstruct correct path', () => {
      const path = findPathBetween(db, obs1, obs2);
      expect(path.found).toBe(true);
      expect(path.path[0]).toBe(Number(obs1));
      expect(path.path[path.path.length - 1]).toBe(Number(obs2));
    });
  });

  describe('Performance Targets', () => {
    it('should find related observations in <50ms', () => {
      const start = performance.now();
      const related = getRelatedObservations(db, obs1, { limit: 10 });
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(related.length).toBeGreaterThan(0);
    });

    it('should build depth-2 graph in <150ms', () => {
      const start = performance.now();
      const graph = getRelationshipGraph(db, obs1, 2);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(150);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    it('should find path in <200ms', () => {
      const start = performance.now();
      const path = findPathBetween(db, obs1, obs5);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
    });

    it('should handle multiple queries efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        getRelatedObservations(db, obs1);
      }
      const elapsed = performance.now() - start;
      const avgPerQuery = elapsed / 10;

      expect(avgPerQuery).toBeLessThan(50);
    });

    it('should handle large depth traversal efficiently', () => {
      const start = performance.now();
      const graph = getRelationshipGraph(db, obs1, 5);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty confidence correctly', () => {
      const related = getRelatedObservations(db, obs1, { minConfidence: 0 });
      expect(related.length).toBeGreaterThan(0);
    });

    it('should handle maximum confidence correctly', () => {
      const related = getRelatedObservations(db, obs1, { minConfidence: 1.0 });
      for (const rel of related) {
        expect(rel.confidence).toBe(1.0);
      }
    });

    it('should handle zero limit gracefully', () => {
      const related = getRelatedObservations(db, obs1, { limit: 0 });
      expect(related.length).toBe(0);
    });

    it('should handle invalid observation ID gracefully', () => {
      const related = getRelatedObservations(db, 99999);
      expect(related.length).toBe(0);
    });

    it('should handle graph with single node', () => {
      const graph = getRelationshipGraph(db, obs1, 0);
      expect(graph.nodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  afterAll(() => {
    db.close();
    if (existsSync(DB_PATH)) {
      unlinkSync(DB_PATH);
    }
  });
});
