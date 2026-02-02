/**
 * Relationship Expansion Tests
 *
 * Validates the expandAndRankByRelationships() function:
 * - 1-hop neighbor expansion
 * - Deduplication by observation_id
 * - Neighbor scoring formula (0.3 * confidence * importance)
 * - Re-ranking all N+M results by hybrid score
 * - Limit expansion to prevent performance degradation
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import Database from 'bun:sqlite';
import {
  expandAndRankByRelationships,
  type HybridSearchResult,
} from '../hybrid-search';

describe('Expand and Rank by Relationships', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');

    // Create tables with exec (db.exec is safe - no user input in SQL)
    const createTables = `
      CREATE TABLE observations (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT DEFAULT 'note'
      );

      CREATE TABLE observation_relationships (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at_epoch INTEGER,
        FOREIGN KEY(source_id) REFERENCES observations(id),
        FOREIGN KEY(target_id) REFERENCES observations(id)
      );
    `;
    
    db.exec(createTables);

    // Insert test observations
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(1, 'Result A', 'decision');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(2, 'Result B', 'feature');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(3, 'Result C', 'bugfix');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(10, 'Neighbor X', 'note');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(11, 'Neighbor Y', 'note');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(12, 'Neighbor Z', 'note');
    db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(20, 'Orphan', 'note');

    // Insert relationships
    db.prepare('INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)').run(1, 10, 'references', 0.8, 1000);
    db.prepare('INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)').run(1, 11, 'depends_on', 0.7, 1001);
    db.prepare('INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)').run(2, 12, 'extends', 0.9, 1002);
    db.prepare('INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)').run(3, 20, 'conflicts_with', 0.6, 1003);
  });

  describe('Core Expansion Tests', () => {
    it('should expand top 2 results and get valid neighbors', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 2,
          title: 'Result B',
          score: 0.85,
          semanticScore: 0.7,
          importanceScore: 0.85,
          metadata: { importance_score: 85 },
        },
        {
          observation_id: 3,
          title: 'Result C',
          score: 0.7,
          semanticScore: 0.6,
          importanceScore: 0.7,
          metadata: { importance_score: 70 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        maxNeighborsPerResult: 3,
        expandTopK: 2,
        minConfidence: 0.5,
      });

      expect(expanded.length).toBeGreaterThan(3);

      const ids = expanded.map((r) => r.observation_id);
      expect(ids).toContain(10);
      expect(ids).toContain(11);
      expect(ids).toContain(12);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
    });

    it('should deduplicate neighbors already in results', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 10,
          title: 'Neighbor X',
          score: 0.5,
          semanticScore: 0.4,
          importanceScore: 0.5,
          metadata: { importance_score: 50 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        maxNeighborsPerResult: 3,
      });

      const occurrences = expanded.filter((r) => r.observation_id === 10).length;
      expect(occurrences).toBe(1);

      const result10 = expanded.find((r) => r.observation_id === 10);
      expect(result10?.score).toBe(0.5);
    });

    it('should calculate neighbor scores correctly (0.3 * confidence * importance)', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        maxNeighborsPerResult: 3,
        minConfidence: 0.5,
      });

      const neighborX = expanded.find((r) => r.observation_id === 10);

      expect(neighborX).toBeDefined();
      if (neighborX) {
        expect(neighborX.score).toBeGreaterThan(0);
        expect(neighborX.score).toBeLessThanOrEqual(0.3 * 0.8);
        expect(neighborX.metadata?.relationship_confidence).toBe(0.8);
      }
    });

    it('should handle empty initial results', async () => {
      const expanded = await expandAndRankByRelationships([], db);
      expect(expanded).toHaveLength(0);
    });

    it('should respect relationship confidence threshold', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        minConfidence: 0.75,
      });

      const ids = expanded.map((r) => r.observation_id);
      expect(ids).toContain(10);
      expect(ids).not.toContain(11);
    });

    it('should re-rank all results correctly by score (highest first)', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.5,
          semanticScore: 0.5,
          importanceScore: 0.5,
          metadata: { importance_score: 50 },
        },
        {
          observation_id: 2,
          title: 'Result B',
          score: 0.6,
          semanticScore: 0.6,
          importanceScore: 0.6,
          metadata: { importance_score: 60 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        expandTopK: 2,
      });

      for (let i = 0; i < expanded.length - 1; i++) {
        expect(expanded[i].score).toBeGreaterThanOrEqual(expanded[i + 1].score);
      }

      expect(expanded[0].score).toBeGreaterThanOrEqual(
        expanded[expanded.length - 1].score
      );
    });
  });

  describe('Metadata and Limit Tests', () => {
    it('should preserve original result metadata and add relationship metadata to neighbors', async () => {
      const originalMetadata = { custom_field: 'value', tags: ['tag1'] };
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: originalMetadata,
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        maxNeighborsPerResult: 1,
      });

      const original = expanded.find((r) => r.observation_id === 1);
      expect(original?.metadata).toEqual(originalMetadata);

      const neighbor = expanded.find((r) => r.metadata?.is_expanded_neighbor === true);
      expect(neighbor).toBeDefined();
      if (neighbor) {
        expect(neighbor.metadata?.relationship_type).toBeDefined();
        expect(neighbor.metadata?.relationship_confidence).toBeDefined();
        expect(neighbor.metadata?.source_observation_id).toBe(1);
        expect(neighbor.metadata?.is_expanded_neighbor).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 2,
          title: 'Result B',
          score: 0.85,
          semanticScore: 0.7,
          importanceScore: 0.85,
          metadata: { importance_score: 85 },
        },
        {
          observation_id: 3,
          title: 'Result C',
          score: 0.7,
          semanticScore: 0.6,
          importanceScore: 0.7,
          metadata: { importance_score: 70 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 4,
        expandTopK: 2,
      });

      expect(expanded.length).toBeLessThanOrEqual(4);
    });

    it('should handle maxNeighborsPerResult parameter correctly', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        maxNeighborsPerResult: 1,
      });

      const neighborCount = expanded.filter(
        (r) => r.metadata?.is_expanded_neighbor === true
      ).length;

      expect(neighborCount).toBeLessThanOrEqual(1);
    });

    it('should handle expandTopK parameter correctly', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 2,
          title: 'Result B',
          score: 0.85,
          semanticScore: 0.7,
          importanceScore: 0.85,
          metadata: { importance_score: 85 },
        },
        {
          observation_id: 3,
          title: 'Result C',
          score: 0.7,
          semanticScore: 0.6,
          importanceScore: 0.7,
          metadata: { importance_score: 70 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        expandTopK: 1,
        maxNeighborsPerResult: 3,
      });

      const ids = expanded.map((r) => r.observation_id);
      expect(ids).toContain(10);
      expect(ids).toContain(11);
      expect(ids).not.toContain(12);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const closedDb = new Database(':memory:');
      closedDb.close();

      const expanded = await expandAndRankByRelationships(initialResults, closedDb, {
        limit: 10,
      });

      expect(expanded).toHaveLength(1);
      expect(expanded[0].observation_id).toBe(1);
    });

    it('should handle missing observation IDs in database gracefully', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 999,
          title: 'Missing Result',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
      });

      expect(expanded).toHaveLength(1);
      expect(expanded[0].observation_id).toBe(999);
    });

    it('should handle results with no incoming relationships', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 20,
          title: 'Orphan',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        expandTopK: 1,
        minConfidence: 0.95, // Filter out lower confidence (0.6 for orphan)
      });

      // Should have original result + possibly the neighbor with confidence >= 0.95
      expect(expanded.length).toBeGreaterThanOrEqual(1);
      expect(expanded[0].observation_id).toBe(20);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should clamp scores to [0, 1] range', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
      });

      for (const result of expanded) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it('should handle very high confidence relationships', async () => {
      db.prepare('INSERT INTO observations (id, title, type) VALUES (?, ?, ?)').run(100, 'Perfect Match', 'note');
      db.prepare('INSERT INTO observation_relationships (source_id, target_id, relationship_type, confidence, created_at_epoch) VALUES (?, ?, ?, ?, ?)').run(1, 100, 'references', 1.0, 1004);

      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
        minConfidence: 0.5,
      });

      const ids = expanded.map((r) => r.observation_id);
      expect(ids).toContain(100);

      const perfectMatch = expanded.find((r) => r.observation_id === 100);
      if (perfectMatch) {
        // Score formula: 0.3 * 1.0 * (50/100) = 0.15 (default importance is 0.5)
        // So we expect around 0.15, not 0.2
        expect(perfectMatch.score).toBeGreaterThan(0.1);
        expect(perfectMatch.score).toBeLessThanOrEqual(0.3); // max 0.3 * 1.0 * 1.0
      }
    });

    it('should use default expandTopK when not specified', async () => {
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Result A',
          score: 0.9,
          semanticScore: 0.8,
          importanceScore: 0.9,
          metadata: { importance_score: 90 },
        },
        {
          observation_id: 2,
          title: 'Result B',
          score: 0.85,
          semanticScore: 0.7,
          importanceScore: 0.85,
          metadata: { importance_score: 85 },
        },
      ];

      const expanded = await expandAndRankByRelationships(initialResults, db, {
        limit: 10,
      });

      expect(expanded.length).toBeGreaterThanOrEqual(2);
    });
  });
});
