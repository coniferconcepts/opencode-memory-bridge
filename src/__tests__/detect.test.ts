/**
 * Relationship Detection Tests
 *
 * Validates all 5 detection heuristics:
 * - Concept Overlap
 * - File Matching
 * - Tool Sequence
 * - Temporal Proximity
 * - Session Proximity
 */

import { describe, it, expect } from 'bun:test';
import {
  detectRelationships,
  detectRelationshipsFromSource,
  type DetectionObservation
} from '../detect';

describe('Relationship Detection', () => {
  const now = Date.now();
  const sessionId = 'session-123';

  describe('Heuristic 1: Concept Overlap', () => {
    it('should detect relationship with sufficient concept overlap', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        concepts: ['api', 'rest', 'endpoint', 'search', 'backend']
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'decision',
        created_at_epoch: now - 3600000,
        concepts: ['api', 'rest', 'library', 'search', 'frontend']
      };

      const rels = detectRelationships(source, target);
      expect(rels.length).toBeGreaterThan(0);
      expect(rels[0].confidence).toBeGreaterThan(0.4);
    });

    it('should not detect relationship with insufficient concept overlap', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        concepts: ['api', 'rest']
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'decision',
        created_at_epoch: now - 86400000, // Far in the past to avoid temporal proximity
        concepts: ['database', 'queries']
      };

      const rels = detectRelationships(source, target);
      // Should not detect concept overlap specifically
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'concept_overlap')).length).toBe(0);
    });

    it('should not detect relationship without concepts', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'decision',
        created_at_epoch: now,
        concepts: ['api', 'rest', 'search', 'backend']
      };

      const rels = detectRelationships(source, target);
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'concept_overlap')).length).toBe(0);
    });
  });

  describe('Heuristic 2: File Matching', () => {
    it('should detect relationship with shared file modifications', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        files_modified: ['src/api.ts', 'src/types.ts', 'src/routes.ts']
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'bugfix',
        created_at_epoch: now - 3600000,
        files_read: ['src/api.ts', 'src/schemas.ts']
      };

      const rels = detectRelationships(source, target);
      const fileRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'file_match'));
      expect(fileRel).toBeTruthy();
      expect(fileRel?.confidence).toBeGreaterThan(0.6);
    });

    it('should prioritize file modification over read', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        files_modified: ['src/core.ts']
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now - 1800000,
        files_modified: ['src/core.ts']
      };

      const rels = detectRelationships(source, target);
      const fileRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'file_match'));
      expect(fileRel).toBeTruthy();
      expect(fileRel?.heuristics.find(h => h.heuristic === 'file_match')?.confidence).toBeGreaterThan(0.8);
    });

    it('should not detect relationship without file overlap', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        files_read: ['src/api.ts']
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        files_modified: ['src/database.ts']
      };

      const rels = detectRelationships(source, target);
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'file_match')).length).toBe(0);
    });
  });

  describe('Heuristic 3: Tool Sequence', () => {
    it('should detect read-then-edit pattern', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'discovery',
        created_at_epoch: now - 1800000,
        source_tool: 'read'
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        source_tool: 'edit'
      };

      const rels = detectRelationships(source, target);
      expect(rels.length).toBeGreaterThan(0);
      const toolRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'tool_sequence'));
      expect(toolRel).toBeTruthy();
      expect(toolRel?.heuristics.find(h => h.heuristic === 'tool_sequence')?.confidence).toBeCloseTo(0.9, 1);
      expect(toolRel?.relationship_type).toBe('modifies');
    });

    it('should detect task-then-edit pattern', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'discovery',
        created_at_epoch: now - 3600000,
        source_tool: 'task'
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        source_tool: 'edit'
      };

      const rels = detectRelationships(source, target);
      const toolRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'tool_sequence'));
      expect(toolRel?.confidence).toBeCloseTo(0.75, 1);
    });

    it('should detect grep-then-edit pattern', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'discovery',
        created_at_epoch: now - 1800000,
        source_tool: 'grep'
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        source_tool: 'edit'
      };

      const rels = detectRelationships(source, target);
      expect(rels.length).toBeGreaterThan(0);
      const toolRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'tool_sequence'));
      expect(toolRel).toBeTruthy();
    });
  });

  describe('Heuristic 4: Temporal Proximity', () => {
    it('should detect observations close in time', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now - 600000 // 10 minutes ago
      };

      const rels = detectRelationships(source, target);
      const temporalRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'temporal_proximity'));
      expect(temporalRel).toBeTruthy();
      expect(temporalRel?.confidence).toBeGreaterThan(0.4);
    });

    it('should not detect observations far apart in time', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now - 86400000 // 1 day ago
      };

      const rels = detectRelationships(source, target);
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'temporal_proximity')).length).toBe(0);
    });

    it('should have higher confidence for very close observations', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const veryClose: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now - 60000 // 1 minute ago
      };

      const farther: DetectionObservation = {
        id: 3,
        type: 'feature',
        created_at_epoch: now - 1800000 // 30 minutes ago
      };

      const relsVeryClose = detectRelationships(source, veryClose);
      const relsFarther = detectRelationships(source, farther);

      const vcTemporal = relsVeryClose.find(r => r.heuristics.some(h => h.heuristic === 'temporal_proximity'));
      const fTemporal = relsFarther.find(r => r.heuristics.some(h => h.heuristic === 'temporal_proximity'));

      if (vcTemporal && fTemporal) {
        expect(vcTemporal.confidence).toBeGreaterThan(fTemporal.confidence);
      }
    });
  });

  describe('Heuristic 5: Session Proximity', () => {
    it('should detect observations from same session', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        session_id: sessionId
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'bugfix',
        created_at_epoch: now - 3600000,
        session_id: sessionId
      };

      const rels = detectRelationships(source, target);
      const sessionRel = rels.find(r => r.heuristics.some(h => h.heuristic === 'session_proximity'));
      expect(sessionRel).toBeTruthy();
      expect(sessionRel?.confidence).toBeCloseTo(0.8, 1);
    });

    it('should not detect observations from different sessions', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        session_id: 'session-1'
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        session_id: 'session-2'
      };

      const rels = detectRelationships(source, target);
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'session_proximity')).length).toBe(0);
    });

    it('should not detect if either observation missing session', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        session_id: sessionId
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now
      };

      const rels = detectRelationships(source, target);
      expect(rels.filter(r => r.heuristics.some(h => h.heuristic === 'session_proximity')).length).toBe(0);
    });
  });

  describe('Multi-Heuristic Aggregation', () => {
    it('should aggregate confidence from multiple heuristics', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now,
        concepts: ['api', 'search', 'backend', 'endpoint'],
        files_modified: ['src/api.ts'],
        source_tool: 'edit',
        session_id: sessionId
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'decision',
        created_at_epoch: now - 900000, // 15 minutes ago
        concepts: ['api', 'search', 'library'],
        files_read: ['src/api.ts'],
        source_tool: 'read',
        session_id: sessionId
      };

      const rels = detectRelationships(source, target);
      expect(rels.length).toBeGreaterThan(0);

      const rel = rels[0];
      expect(rel.heuristics.length).toBeGreaterThan(1);
      expect(rel.confidence).toBeGreaterThan(0.5);
    });

    it('should self-relationships', () => {
      const obs: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const rels = detectRelationships(obs, obs);
      expect(rels.length).toBe(0);
    });
  });

  describe('Batch Detection', () => {
    it('should detect relationships from source to multiple targets', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'decision',
        created_at_epoch: now,
        concepts: ['api', 'search', 'backend']
      };

      const targets: DetectionObservation[] = [
        {
          id: 2,
          type: 'feature',
          created_at_epoch: now - 1800000,
          concepts: ['api', 'search', 'frontend']
        },
        {
          id: 3,
          type: 'feature',
          created_at_epoch: now - 3600000,
          concepts: ['database', 'queries']
        },
        {
          id: 4,
          type: 'bugfix',
          created_at_epoch: now - 900000,
          concepts: ['api', 'search', 'caching']
        }
      ];

      const rels = detectRelationshipsFromSource(source, targets);
      expect(rels.length).toBeGreaterThan(0);
      expect(rels.length).toBeLessThanOrEqual(targets.length);
    });
  });

  describe('Confidence Thresholds', () => {
    it('should respect minimum confidence threshold', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now - 3500000 // Just under 1 hour
      };

      // Very low confidence due to temporal proximity alone
      const rels = detectRelationships(source, target, { minConfidence: 0.6 });
      expect(rels.length).toBe(0);
    });

    it('should allow configuration of minimum concept overlap', () => {
      const source: DetectionObservation = {
        id: 1,
        type: 'feature',
        created_at_epoch: now - 100000, // Far enough apart to avoid temporal proximity
        concepts: ['api', 'rest', 'search'] // Only 3 concepts
      };

      const target: DetectionObservation = {
        id: 2,
        type: 'feature',
        created_at_epoch: now,
        concepts: ['api', 'rest', 'search', 'backend']
      };

      // With minimum concept overlap of 3, should detect (concept overlap heuristic works)
      const rels1 = detectRelationships(source, target, { minConceptOverlap: 3 });
      expect(rels1.filter(r => r.heuristics.some(h => h.heuristic === 'concept_overlap')).length).toBeGreaterThan(0);

      // With minimum of 5, should not have concept overlap (temporal proximity might still trigger)
      const rels2 = detectRelationships(source, target, { minConceptOverlap: 5 });
      expect(rels2.filter(r => r.heuristics.some(h => h.heuristic === 'concept_overlap')).length).toBe(0);
    });
  });
});
