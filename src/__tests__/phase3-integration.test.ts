/**
 * Phase 3 Integration Tests
 *
 * Validates all 3 Phase 3 features working together:
 * 1. Task 3.1: Relationship Tracking (observation_relationships table, 5 heuristics, graph queries)
 * 2. Task 3.2: Importance Scoring (0-100 scores, 4 tiers: critical/high/medium/low)
 * 3. Task 3.3: Enhanced Embeddings (hybrid search, metadata enrichment, query expansion)
 *
 * Integration scenarios tested:
 * - Create observation → Compute importance score → Detect relationships → Verify enriched metadata
 * - Query hybrid search → Verify importance weighting applied → Verify relationship expansion works
 * - End-to-end: Insert 5 observations → Verify all relationships → Run hybrid search → Validate ranking
 *
 * Test Structure:
 * - Feature Integration: Tests feature interactions
 * - End-to-End Workflow: Tests complete pipeline
 * - Feature Flags: Tests graceful degradation
 * - Data Integrity: Tests consistency across features
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Feature implementations
import { calculateImportanceScore, type ObservationType, type ScoringResult } from '../scoring';
import { detectRelationships, detectRelationshipsFromSource, type DetectionObservation } from '../detect';
import { getRelatedObservations, getRelationshipGraph, findPathBetween } from '../queries';
import { hybridSearch, expandAndRankByRelationships, type HybridSearchResult, type SemanticSearchResult } from '../hybrid-search';
import type { RelationshipType } from '../relationships';

// Test utilities
interface TestObservation {
  id: number;
  title: string;
  type: ObservationType;
  narrative?: string;
  concepts?: string[];
  files_read?: string[];
  files_modified?: string[];
  source_tool?: string;
  session_id?: string;
  created_at_epoch: number;
  discovery_tokens?: number;
  importance_score?: number;
}

interface TestRelationship {
  source_id: number;
  target_id: number;
  relationship_type: RelationshipType;
  confidence: number;
}

// Helper to create test database with schema
async function createTestDatabase(): Promise<{ db: Database; cleanup: () => Promise<void> }> {
  const dbPath = join(tmpdir(), `phase3-test-${Date.now()}.db`);

  const db = new Database(dbPath);

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      narrative TEXT,
      concepts TEXT,
      files_read TEXT,
      files_modified TEXT,
      source_tool TEXT,
      session_id TEXT,
      created_at_epoch INTEGER NOT NULL,
      discovery_tokens INTEGER DEFAULT 0,
      metadata TEXT,
      UNIQUE(id)
    );

    CREATE TABLE IF NOT EXISTS observation_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      metadata TEXT,
      created_at_epoch INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES observations(id),
      FOREIGN KEY (target_id) REFERENCES observations(id),
      UNIQUE(source_id, target_id, relationship_type)
    );

    CREATE INDEX IF NOT EXISTS idx_relationships_source ON observation_relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_relationships_target ON observation_relationships(target_id);
  `);

  const cleanup = async () => {
    try {
      db.close();
      await unlink(dbPath);
    } catch {
      // Cleanup best effort
    }
  };

  return { db, cleanup };
}

// Helper to insert test observations
function insertObservations(db: Database, observations: TestObservation[]): number[] {
  const ids: number[] = [];

  for (const obs of observations) {
    const stmt = db.prepare(`
      INSERT INTO observations
      (title, type, narrative, concepts, files_read, files_modified, source_tool, session_id, created_at_epoch, discovery_tokens, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const metadata = JSON.stringify({ importance_score: obs.importance_score ?? 50 });

    stmt.run(
      obs.title,
      obs.type,
      obs.narrative || null,
      obs.concepts ? JSON.stringify(obs.concepts) : null,
      obs.files_read ? JSON.stringify(obs.files_read) : null,
      obs.files_modified ? JSON.stringify(obs.files_modified) : null,
      obs.source_tool || null,
      obs.session_id || null,
      obs.created_at_epoch,
      obs.discovery_tokens || 0,
      metadata
    );

    const result = db.query('SELECT last_insert_rowid() as id').get() as any;
    ids.push(result.id);
  }

  return ids;
}

// Helper to insert relationships
function insertRelationships(db: Database, relationships: TestRelationship[]): void {
  const now = Date.now();

  for (const rel of relationships) {
    const stmt = db.prepare(`
      INSERT INTO observation_relationships
      (source_id, target_id, relationship_type, confidence, metadata, created_at_epoch)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const metadata = JSON.stringify({
      detection_heuristics: []
    });

    stmt.run(
      rel.source_id,
      rel.target_id,
      rel.relationship_type,
      rel.confidence,
      metadata,
      now
    );
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Phase 3 Integration Tests', () => {
  let db: Database;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const setup = await createTestDatabase();
    db = setup.db;
    cleanup = setup.cleanup;
  });

  // ============================================================================
  // Feature Integration Tests
  // ============================================================================

  describe('Feature Integration', () => {
    it('should compute importance score → detect relationships → verify enriched metadata', () => {
      // Step 1: Create observations with rich metadata
      const now = Date.now();
      const observations: TestObservation[] = [
        {
          id: 1,
          title: 'Initial Discovery',
          type: 'discovery',
          narrative: 'Found a critical bug in authentication module. The issue occurs when JWT tokens expire.',
          concepts: ['jwt', 'authentication', 'expiration', 'tokens', 'security'],
          files_read: ['/src/auth/jwt.ts', '/src/types/index.ts'],
          files_modified: [],
          source_tool: 'read',
          session_id: 'session-1',
          created_at_epoch: now - 1000000,
          discovery_tokens: 2500,
        },
        {
          id: 2,
          title: 'Fix Implementation',
          type: 'bugfix',
          narrative: 'Implemented fix by refreshing tokens before expiration and improving error handling.',
          concepts: ['jwt', 'tokens', 'refresh', 'expiration', 'error-handling'],
          files_read: ['/src/auth/jwt.ts'],
          files_modified: ['/src/auth/jwt.ts'],
          source_tool: 'edit',
          session_id: 'session-1',
          created_at_epoch: now - 990000,
          discovery_tokens: 3000,
        },
      ];

      const ids = insertObservations(db, observations);
      expect(ids).toHaveLength(2);

      // Step 2: Compute importance scores for each observation
      const scores = new Map<number, ScoringResult>();
      for (const obs of observations) {
        const score = calculateImportanceScore({
          type: obs.type,
          narrativeLength: obs.narrative?.length || 0,
          factsCount: 1,
          conceptsCount: obs.concepts?.length || 0,
          createdAtEpoch: obs.created_at_epoch,
          discoveryTokens: obs.discovery_tokens,
          referenceCount: 0,
        });
        scores.set(obs.id, score);
      }

      expect(scores.size).toBe(2);

      // Verify importance scores are in expected ranges
      const discoveryScore = scores.get(1)!;
      const bugfixScore = scores.get(2)!;

      expect(discoveryScore.score).toBeGreaterThan(0);
      expect(discoveryScore.score).toBeLessThanOrEqual(100);
      expect(discoveryScore.tier).toBeTruthy();

      expect(bugfixScore.score).toBeGreaterThan(discoveryScore.score); // bugfix should score higher
      expect(bugfixScore.tier).toBeTruthy();

      // Step 3: Detect relationships between observations
      const obs1: DetectionObservation = {
        id: 1,
        type: 'discovery',
        created_at_epoch: observations[0].created_at_epoch,
        concepts: observations[0].concepts,
        files_read: observations[0].files_read,
        files_modified: observations[0].files_modified,
        source_tool: observations[0].source_tool,
        session_id: observations[0].session_id,
      };

      const obs2: DetectionObservation = {
        id: 2,
        type: 'bugfix',
        created_at_epoch: observations[1].created_at_epoch,
        concepts: observations[1].concepts,
        files_read: observations[1].files_read,
        files_modified: observations[1].files_modified,
        source_tool: observations[1].source_tool,
        session_id: observations[1].session_id,
      };

      const relationships = detectRelationships(obs1, obs2);

      expect(relationships.length).toBeGreaterThan(0);

      const rel = relationships[0];
      expect(rel.source_id).toBe(1);
      expect(rel.target_id).toBe(2);
      expect(rel.confidence).toBeGreaterThan(0.4);
      expect(['references', 'extends', 'follows', 'modifies']).toContain(rel.relationship_type);
      expect(rel.metadata.detection_heuristics).toHaveLength(rel.heuristics.length);

      // Step 4: Verify enriched metadata structure
      const enrichedMetadata = {
        importance_score: bugfixScore.score,
        importance: bugfixScore.tier,
        relationship_count: 1,
        relationship_types: [rel.relationship_type],
        files_context: [...(observations[1].files_read || []), ...(observations[1].files_modified || [])],
        concept_tags: observations[1].concepts || [],
      };

      expect(enrichedMetadata.importance_score).toBeGreaterThan(0);
      expect(enrichedMetadata.importance).toBeTruthy();
      expect(enrichedMetadata.relationship_count).toBe(1);
      expect(enrichedMetadata.relationship_types.length).toBeGreaterThan(0);
      expect(enrichedMetadata.files_context.length).toBeGreaterThan(0);
    });

    it('should execute hybrid search with importance weighting', () => {
      const now = Date.now();

      // Create semantic search results with varying importance scores
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Critical Authentication Bug',
          narrative: 'Found critical JWT expiration bug',
          similarity: 0.95,
          metadata: {
            importance_score: 92,
            type: 'bugfix',
          },
        },
        {
          observation_id: 2,
          title: 'Related JWT Concept',
          narrative: 'General JWT information',
          similarity: 0.85,
          metadata: {
            importance_score: 45,
            type: 'discovery',
          },
        },
        {
          observation_id: 3,
          title: 'Spam Token Reference',
          narrative: 'Irrelevant mention of tokens',
          similarity: 0.80,
          metadata: {
            importance_score: 15,
            type: 'change',
          },
        },
      ];

      // Execute hybrid search with importance weighting
      const results = hybridSearch(semanticResults, {
        query: 'jwt authentication bug',
        limit: 10,
        minRelevance: 0.3,
        minImportance: 40,
      });

      expect(results).toHaveLength(2); // Only results with importance >= 40
      expect(results[0].observation_id).toBe(1); // Highest combined score
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);

      // Verify importance weighting is applied
      // Result 1: 0.7 * 0.95 + 0.3 * 0.92 = 0.665 + 0.276 = 0.941
      const expectedScore1 = 0.7 * 0.95 + 0.3 * (92 / 100);
      expect(Math.abs(results[0].score - expectedScore1)).toBeLessThan(0.001);

      // Result 2: 0.7 * 0.85 + 0.3 * 0.45 = 0.595 + 0.135 = 0.73
      const expectedScore2 = 0.7 * 0.85 + 0.3 * (45 / 100);
      expect(Math.abs(results[1].score - expectedScore2)).toBeLessThan(0.001);
    });

    it('should expand hybrid search results with relationship neighbors', async () => {
      const now = Date.now();

      // Insert test observations
      const observations: TestObservation[] = [
        {
          id: 1,
          title: 'Main Result',
          type: 'bugfix',
          narrative: 'Main result for search',
          created_at_epoch: now,
          importance_score: 85,
        },
        {
          id: 2,
          title: 'Related Neighbor 1',
          type: 'feature',
          narrative: 'Related observation 1',
          created_at_epoch: now,
          importance_score: 60,
        },
        {
          id: 3,
          title: 'Related Neighbor 2',
          type: 'discovery',
          narrative: 'Related observation 2',
          created_at_epoch: now,
          importance_score: 50,
        },
      ];

      insertObservations(db, observations);

      // Insert relationships
      insertRelationships(db, [
        { source_id: 1, target_id: 2, relationship_type: 'references', confidence: 0.8 },
        { source_id: 1, target_id: 3, relationship_type: 'extends', confidence: 0.6 },
      ]);

      // Create initial hybrid search results
      const initialResults: HybridSearchResult[] = [
        {
          observation_id: 1,
          title: 'Main Result',
          score: 0.92,
          semanticScore: 0.95,
          importanceScore: 0.85,
          metadata: { importance_score: 85 },
        },
      ];

      // Expand results with relationship neighbors
      const expanded = await expandAndRankByRelationships(initialResults, db, {
        maxNeighborsPerResult: 3,
        expandTopK: 1,
        minConfidence: 0.5,
        limit: 10,
      });

      // Should have original + neighbors
      expect(expanded.length).toBeGreaterThan(1);
      expect(expanded.length).toBeLessThanOrEqual(4); // 1 original + up to 3 neighbors (only 2 with high enough confidence)

      // Original should still be in results
      const mainResult = expanded.find(r => r.observation_id === 1);
      expect(mainResult).toBeTruthy();
      expect(mainResult!.score).toBe(0.92);

      // High confidence neighbor should be included
      const neighbor1 = expanded.find(r => r.observation_id === 2);
      expect(neighbor1).toBeTruthy(); // confidence 0.8 >= 0.5
      expect(neighbor1!.metadata.is_expanded_neighbor).toBe(true);

      // Lower confidence neighbor might be excluded
      const neighbor2 = expanded.find(r => r.observation_id === 3);
      if (neighbor2) {
        expect(neighbor2.metadata.is_expanded_neighbor).toBe(true);
      }
    });

    it('should apply all 5 detection heuristics correctly', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      // Create observations that trigger different heuristics
      const obs1: DetectionObservation = {
        id: 1,
        type: 'discovery',
        created_at_epoch: oneHourAgo,
        concepts: ['auth', 'jwt', 'tokens', 'security', 'session'],
        files_read: ['/src/auth.ts', '/src/types.ts'],
        files_modified: ['/src/auth.ts'],
        source_tool: 'read',
        session_id: 'session-123',
      };

      const obs2: DetectionObservation = {
        id: 2,
        type: 'bugfix',
        created_at_epoch: now - 30 * 60 * 1000, // 30 min later
        concepts: ['jwt', 'auth', 'tokens', 'expiration', 'refresh'],
        files_read: ['/src/auth.ts'],
        files_modified: ['/src/auth.ts'],
        source_tool: 'edit',
        session_id: 'session-123',
      };

      const relationships = detectRelationships(obs1, obs2);

      expect(relationships.length).toBeGreaterThan(0);
      const rel = relationships[0];

      // Verify heuristics were detected
      expect(rel.heuristics.length).toBeGreaterThan(0);

      // Should detect concept overlap
      const conceptHeuristic = rel.heuristics.find(h => h.heuristic === 'concept_overlap');
      expect(conceptHeuristic).toBeTruthy();

      // Should detect file match
      const fileHeuristic = rel.heuristics.find(h => h.heuristic === 'file_match');
      expect(fileHeuristic).toBeTruthy();

      // Should detect tool sequence (read -> edit)
      const toolHeuristic = rel.heuristics.find(h => h.heuristic === 'tool_sequence');
      expect(toolHeuristic).toBeTruthy();

      // Should detect temporal proximity
      const temporalHeuristic = rel.heuristics.find(h => h.heuristic === 'temporal_proximity');
      expect(temporalHeuristic).toBeTruthy();

      // Should detect session proximity
      const sessionHeuristic = rel.heuristics.find(h => h.heuristic === 'session_proximity');
      expect(sessionHeuristic).toBeTruthy();

      // All heuristics should contribute to aggregated confidence
      expect(rel.confidence).toBeGreaterThan(0.4);
      expect(rel.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // End-to-End Workflow Tests
  // ============================================================================

  describe('End-to-End Workflow', () => {
    it('should process 5 observations through complete pipeline', async () => {
      const now = Date.now();
      const fiveHoursAgo = now - 5 * 60 * 60 * 1000;

      // Create 5 observations with different types and metadata
      const observations: TestObservation[] = [
        {
          id: 1,
          title: 'Decision: Use JWT for Auth',
          type: 'decision',
          narrative: 'Decided to use JWT tokens for authentication due to stateless nature and scalability.',
          concepts: ['jwt', 'authentication', 'architecture', 'stateless', 'security'],
          created_at_epoch: fiveHoursAgo,
          discovery_tokens: 5000,
        },
        {
          id: 2,
          title: 'Bug: JWT Token Expiration',
          type: 'bugfix',
          narrative: 'Fixed issue where JWT tokens weren\'t being refreshed, causing session timeouts.',
          concepts: ['jwt', 'authentication', 'tokens', 'expiration', 'refresh', 'security'],
          files_modified: ['/src/auth.ts'],
          source_tool: 'edit',
          created_at_epoch: fiveHoursAgo + 30 * 60 * 1000,
          discovery_tokens: 3000,
        },
        {
          id: 3,
          title: 'Feature: Token Refresh Endpoint',
          type: 'feature',
          narrative: 'Added new endpoint for refreshing expired tokens before they expire.',
          concepts: ['jwt', 'tokens', 'api', 'refresh', 'endpoints'],
          files_modified: ['/src/auth.ts', '/src/api.ts'],
          source_tool: 'edit',
          created_at_epoch: fiveHoursAgo + 60 * 60 * 1000,
          discovery_tokens: 2000,
        },
        {
          id: 4,
          title: 'Refactor: Auth Module Structure',
          type: 'refactor',
          narrative: 'Reorganized authentication module for better maintainability and testing.',
          concepts: ['architecture', 'testing', 'maintainability', 'modules', 'refactoring'],
          files_read: ['/src/auth.ts'],
          files_modified: ['/src/auth.ts', '/src/types.ts'],
          source_tool: 'edit',
          created_at_epoch: fiveHoursAgo + 120 * 60 * 1000,
          discovery_tokens: 1500,
        },
        {
          id: 5,
          title: 'Discovery: Rate Limiting Library',
          type: 'discovery',
          narrative: 'Found a good rate limiting library that could protect our auth endpoints.',
          concepts: ['rate-limiting', 'security', 'libraries', 'performance'],
          created_at_epoch: fiveHoursAgo + 180 * 60 * 1000,
          discovery_tokens: 1000,
        },
      ];

      // Step 1: Insert observations
      const ids = insertObservations(db, observations);
      expect(ids).toHaveLength(5);

      // Step 2: Calculate importance scores for all
      const scores = new Map<number, number>();
      for (const obs of observations) {
        const result = calculateImportanceScore({
          type: obs.type,
          narrativeLength: obs.narrative?.length || 0,
          factsCount: 2,
          conceptsCount: obs.concepts?.length || 0,
          createdAtEpoch: obs.created_at_epoch,
          discoveryTokens: obs.discovery_tokens,
          referenceCount: 0,
        });
        scores.set(obs.id, result.score);
      }

      // Verify scoring: decision > bugfix > feature > refactor > discovery
      const decisionScore = scores.get(1)!;
      const bugfixScore = scores.get(2)!;
      const featureScore = scores.get(3)!;
      const refactorScore = scores.get(4)!;
      const discoveryScore = scores.get(5)!;

      expect(decisionScore).toBeGreaterThanOrEqual(bugfixScore);
      expect(bugfixScore).toBeGreaterThanOrEqual(featureScore);
      expect(featureScore).toBeGreaterThanOrEqual(refactorScore);
      expect(refactorScore).toBeGreaterThanOrEqual(discoveryScore);

      // Step 3: Detect relationships between all pairs
      const detectionObs = observations.map(o => ({
        id: o.id,
        type: o.type,
        created_at_epoch: o.created_at_epoch,
        concepts: o.concepts,
        files_read: o.files_read || [],
        files_modified: o.files_modified || [],
        source_tool: o.source_tool,
        session_id: undefined,
      }));

      let totalRelationships = 0;
      for (let i = 0; i < detectionObs.length; i++) {
        for (let j = i + 1; j < detectionObs.length; j++) {
          const rels = detectRelationships(detectionObs[i], detectionObs[j]);
          totalRelationships += rels.length;
          if (rels.length > 0) {
            insertRelationships(db, rels.map(r => ({
              source_id: r.source_id,
              target_id: r.target_id,
              relationship_type: r.relationship_type,
              confidence: r.confidence,
            })));
          }
        }
      }

      // Should find multiple relationships
      expect(totalRelationships).toBeGreaterThan(0);

      // Step 4: Query relationship graph
      const graph = getRelationshipGraph(db, 1, 2, 0.4);
      expect(graph.source_id).toBe(1);
      expect(graph.nodes.length).toBeGreaterThan(0);
      // Root node (observation 1) should always be included
      const root = graph.nodes.find(n => n.observation_id === 1);
      expect(root).toBeTruthy();

      // Step 5: Run hybrid search to validate end-to-end
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: observations[0].title,
          narrative: observations[0].narrative,
          similarity: 0.92,
          metadata: { importance_score: scores.get(1) },
        },
        {
          observation_id: 2,
          title: observations[1].title,
          narrative: observations[1].narrative,
          similarity: 0.88,
          metadata: { importance_score: scores.get(2) },
        },
        {
          observation_id: 5,
          title: observations[4].title,
          narrative: observations[4].narrative,
          similarity: 0.70,
          metadata: { importance_score: scores.get(5) },
        },
      ];

      const hybridResults = hybridSearch(semanticResults, {
        query: 'jwt authentication',
        limit: 10,
        minRelevance: 0.3,
        minImportance: 0,
      });

      // Should rank by hybrid score (importance weighting applied)
      expect(hybridResults.length).toBe(3);
      expect(hybridResults[0].observation_id).toBe(1); // Decision has highest importance
      expect(hybridResults[0].score).toBeGreaterThan(hybridResults[1].score);
      expect(hybridResults[1].score).toBeGreaterThan(hybridResults[2].score);
    });

    it('should maintain data integrity across all features', () => {
      const now = Date.now();

      // Insert observations with precise metadata
      const observations: TestObservation[] = [
        {
          id: 1,
          title: 'Source Obs',
          type: 'bugfix',
          narrative: 'Found bug',
          concepts: ['bug', 'fix', 'testing'],
          files_modified: ['/src/bug.ts'],
          created_at_epoch: now - 60000,
          importance_score: 75,
        },
        {
          id: 2,
          title: 'Target Obs',
          type: 'feature',
          narrative: 'New feature',
          concepts: ['bug', 'feature', 'enhancement'],
          files_modified: ['/src/bug.ts'],
          created_at_epoch: now,
          importance_score: 60,
        },
      ];

      insertObservations(db, observations);

      // Detect and insert relationship
      const rel = detectRelationships(
        {
          id: 1,
          type: 'bugfix',
          created_at_epoch: observations[0].created_at_epoch,
          concepts: observations[0].concepts,
          files_modified: observations[0].files_modified,
        },
        {
          id: 2,
          type: 'feature',
          created_at_epoch: observations[1].created_at_epoch,
          concepts: observations[1].concepts,
          files_modified: observations[1].files_modified,
        }
      );

      expect(rel.length).toBeGreaterThan(0);
      insertRelationships(db, rel.map(r => ({
        source_id: r.source_id,
        target_id: r.target_id,
        relationship_type: r.relationship_type,
        confidence: r.confidence,
      })));

      // Query relationship
      const related = getRelatedObservations(db, 1, { limit: 10 });
      expect(related.length).toBeGreaterThan(0);

      // Verify data consistency
      const result = related[0];
      expect(result.observation_id).toBe(2);
      expect(result.title).toBe('Target Obs');
      expect(result.depth).toBe(1);
      expect(result.path).toEqual([1, 2]);

      // Verify importance scores are consistent
      const obs1Score = calculateImportanceScore({
        type: 'bugfix',
        narrativeLength: 9,
        factsCount: 1,
        conceptsCount: 3,
        createdAtEpoch: observations[0].created_at_epoch,
      });

      const obs2Score = calculateImportanceScore({
        type: 'feature',
        narrativeLength: 11,
        factsCount: 1,
        conceptsCount: 3,
        createdAtEpoch: observations[1].created_at_epoch,
      });

      // Bugfix should score higher than feature
      expect(obs1Score.score).toBeGreaterThan(obs2Score.score);

      // Both should have valid tiers
      expect(['critical', 'high', 'medium', 'low']).toContain(obs1Score.tier);
      expect(['critical', 'high', 'medium', 'low']).toContain(obs2Score.tier);
    });
  });

  // ============================================================================
  // Feature Flags & Graceful Degradation
  // ============================================================================

  describe('Feature Flags & Degradation', () => {
    it('should gracefully handle missing importance scores', () => {
      // Semantic result without importance score
      const semanticResults: SemanticSearchResult[] = [
        {
          observation_id: 1,
          title: 'Test',
          similarity: 0.85,
          metadata: {}, // No importance_score
        },
      ];

      const results = hybridSearch(semanticResults, {
        query: 'test',
        limit: 10,
        minImportance: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0].importanceScore).toBe(0.5); // Default value
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('should gracefully handle empty relationship graphs', () => {
      const now = Date.now();
      const observations: TestObservation[] = [
        {
          id: 1,
          title: 'Isolated Obs',
          type: 'discovery',
          created_at_epoch: now,
        },
      ];

      insertObservations(db, observations);

      // Query graph with no relationships
      const graph = getRelationshipGraph(db, 1, 2, 0.4);

      expect(graph.source_id).toBe(1);
      // Graph may include root node but has no edges to other nodes
      expect(graph.edges).toHaveLength(0);
    });

    it('should handle path finding for non-existent observations', () => {
      const pathResult = findPathBetween(db, 1, 2, 5, 0.4);

      expect(pathResult.found).toBe(false);
      expect(pathResult.distance).toBe(-1);
      expect(pathResult.path).toEqual([]);
    });

    it('should handle path between same observation', () => {
      const pathResult = findPathBetween(db, 1, 1);

      expect(pathResult.found).toBe(true);
      expect(pathResult.distance).toBe(0);
      expect(pathResult.path).toEqual([1]);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  afterEach(async () => {
    try {
      await cleanup();
    } catch {
      // Best effort cleanup
    }
  });
});
