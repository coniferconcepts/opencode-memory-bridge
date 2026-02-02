/**
 * Observation Relationship Graph Queries
 *
 * BFS-based graph traversal for finding related observations and computing paths.
 * Optimized for <50ms single-hop, <150ms depth-2, <200ms path finding.
 *
 * @module src/queries
 */

import type { Database } from 'bun:sqlite';
import type { RelationshipType, GraphNode } from './relationships';

/**
 * Options for querying related observations
 */
export interface RelatedObservationsOptions {
  type?: RelationshipType;
  minConfidence?: number;
  limit?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
}

/**
 * Graph traversal result
 */
export interface RelationshipGraphResult {
  source_id: number;
  depth: number;
  nodes: GraphNode[];
  edges: Array<{
    source_id: number;
    target_id: number;
    relationship_type: RelationshipType;
    confidence: number;
  }>;
}

/**
 * Path finding result
 */
export interface PathResult {
  found: boolean;
  source_id: number;
  target_id: number;
  distance: number;
  path: number[]; // [source_id, ..., target_id]
  edges: Array<{
    from: number;
    to: number;
    relationship_type: RelationshipType;
    confidence: number;
  }>;
}

/**
 * Get related observations for a given observation
 *
 * @param db - Database instance
 * @param sourceId - Source observation ID
 * @param options - Query options (type, minConfidence, limit, direction)
 * @returns Array of related observations with metadata
 */
export function getRelatedObservations(
  db: Database,
  sourceId: number,
  options: RelatedObservationsOptions = {}
): GraphNode[] {
  const {
    type,
    minConfidence = 0.4,
    limit = 10,
    direction = 'both'
  } = options;

  const params: any[] = [];

  // Build query based on direction
  let query = '';
  if (direction === 'outgoing') {
    query = `SELECT DISTINCT
      r.target_id as observation_id,
      o.title,
      o.type,
      r.relationship_type,
      r.confidence
      FROM observation_relationships r
      JOIN observations o ON r.target_id = o.id
      WHERE r.source_id = ? AND r.confidence >= ?`;
    params.push(sourceId, minConfidence);
  } else if (direction === 'incoming') {
    query = `SELECT DISTINCT
      r.source_id as observation_id,
      o.title,
      o.type,
      r.relationship_type,
      r.confidence
      FROM observation_relationships r
      JOIN observations o ON r.source_id = o.id
      WHERE r.target_id = ? AND r.confidence >= ?`;
    params.push(sourceId, minConfidence);
  } else {
    // both - return either source or target depending on which isn't the source
    query = `SELECT DISTINCT
      CASE
        WHEN r.source_id = ? THEN r.target_id
        ELSE r.source_id
      END as observation_id,
      o.title,
      o.type,
      r.relationship_type,
      r.confidence
      FROM observation_relationships r
      JOIN observations o ON (
        (r.source_id = ? AND r.target_id = o.id) OR
        (r.target_id = ? AND r.source_id = o.id)
      )
      WHERE r.confidence >= ?`;
    params.push(sourceId, sourceId, sourceId, minConfidence);
  }

  // Add type filter if specified
  if (type) {
    query += ` AND r.relationship_type = ?`;
    params.push(type);
  }

  query += ` ORDER BY r.confidence DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];

  return results.map(row => ({
    observation_id: row.observation_id,
    title: row.title,
    type: row.type,
    depth: 1,
    path: [sourceId, row.observation_id],
    relationship_type: row.relationship_type as RelationshipType,
    confidence: row.confidence
  }));
}

/**
 * Build relationship graph using BFS traversal
 *
 * @param db - Database instance
 * @param sourceId - Source observation ID to traverse from
 * @param maxDepth - Maximum depth to traverse (default 2)
 * @param minConfidence - Minimum confidence threshold (default 0.4)
 * @returns Graph with nodes and edges up to maxDepth
 */
export function getRelationshipGraph(
  db: Database,
  sourceId: number,
  maxDepth: number = 2,
  minConfidence: number = 0.4
): RelationshipGraphResult {
  const nodes: Map<number, GraphNode> = new Map();
  const edges: Array<{
    source_id: number;
    target_id: number;
    relationship_type: RelationshipType;
    confidence: number;
  }> = [];

  // BFS traversal
  const queue: Array<{ id: number; depth: number; parentPath: number[] }> = [
    { id: sourceId, depth: 0, parentPath: [sourceId] }
  ];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const { id, depth, parentPath } = queue.shift()!;

    if (visited.has(id) || depth > maxDepth) {
      continue;
    }

    visited.add(id);

    // Add node if not root or if has additional metadata
    if (depth > 0 || !nodes.has(id)) {
      const obsResult = db.query(
        'SELECT id, title, type FROM observations WHERE id = ?'
      ).get(id) as any;

      if (obsResult) {
        nodes.set(id, {
          observation_id: id,
          title: obsResult.title,
          type: obsResult.type,
          depth,
          path: parentPath
        });
      }
    }

    // Get adjacent nodes at next depth
    if (depth < maxDepth) {
      const relResult = db.query(`
        SELECT
          source_id, target_id, relationship_type, confidence
        FROM observation_relationships
        WHERE (source_id = ? OR target_id = ?)
          AND confidence >= ?
        ORDER BY confidence DESC
      `).all(id, id, minConfidence) as any[];

      for (const rel of relResult) {
        const adjacentId = rel.source_id === id ? rel.target_id : rel.source_id;

        // Skip if already visited at same or lower depth
        if (!visited.has(adjacentId)) {
          const obsResult = db.query(
            'SELECT id, title, type FROM observations WHERE id = ?'
          ).get(adjacentId) as any;

          if (obsResult) {
            const newPath = [...parentPath, adjacentId];
            nodes.set(adjacentId, {
              observation_id: adjacentId,
              title: obsResult.title,
              type: obsResult.type,
              depth: depth + 1,
              path: newPath
            });

            edges.push({
              source_id: rel.source_id,
              target_id: rel.target_id,
              relationship_type: rel.relationship_type as RelationshipType,
              confidence: rel.confidence
            });

            queue.push({
              id: adjacentId,
              depth: depth + 1,
              parentPath: newPath
            });
          }
        }
      }
    }
  }

  return {
    source_id: sourceId,
    depth: maxDepth,
    nodes: Array.from(nodes.values()),
    edges
  };
}

/**
 * Find shortest path between two observations using BFS
 *
 * Uses simple BFS for clarity and correctness over bidirectional complexity.
 *
 * @param db - Database instance
 * @param sourceId - Starting observation ID
 * @param targetId - Destination observation ID
 * @param maxDepth - Maximum path length to search (default 5)
 * @param minConfidence - Minimum relationship confidence (default 0.4)
 * @returns Path result with found status and path details
 */
export function findPathBetween(
  db: Database,
  sourceId: number,
  targetId: number,
  maxDepth: number = 5,
  minConfidence: number = 0.4
): PathResult {
  // Early return if same observation
  if (sourceId === targetId) {
    return {
      found: true,
      source_id: sourceId,
      target_id: targetId,
      distance: 0,
      path: [sourceId],
      edges: []
    };
  }

  // BFS with parent tracking for path reconstruction
  interface SearchNode {
    id: number;
    depth: number;
    parent: number | null;
  }

  const visited = new Map<number, SearchNode>();
  const queue: SearchNode[] = [{ id: sourceId, depth: 0, parent: null }];

  visited.set(sourceId, { id: sourceId, depth: 0, parent: null });

  let targetNode: SearchNode | null = null;

  while (queue.length > 0) {
    const node = queue.shift()!;

    if (node.id === targetId) {
      targetNode = node;
      break;
    }

    if (node.depth < maxDepth) {
      const relResult = db.query(`
        SELECT source_id, target_id, relationship_type, confidence
        FROM observation_relationships
        WHERE (source_id = ? OR target_id = ?)
          AND confidence >= ?
        ORDER BY confidence DESC
      `).all(node.id, node.id, minConfidence) as any[];

      for (const rel of relResult) {
        const adjacentId = rel.source_id === node.id ? rel.target_id : rel.source_id;

        if (!visited.has(adjacentId)) {
          const newNode: SearchNode = {
            id: adjacentId,
            depth: node.depth + 1,
            parent: node.id
          };
          visited.set(adjacentId, newNode);
          queue.push(newNode);
        }
      }
    }
  }

  // If target not found, no path exists
  if (!targetNode) {
    return {
      found: false,
      source_id: sourceId,
      target_id: targetId,
      distance: -1,
      path: [],
      edges: []
    };
  }

  // Reconstruct path from target to source
  const path: number[] = [];
  let current: SearchNode | null = targetNode;
  while (current !== null) {
    path.unshift(current.id);
    current = current.parent ? visited.get(current.parent) || null : null;
  }

  const distance = path.length - 1; // Number of edges in path

  // Retrieve edge details for the path
  const edges: Array<{
    from: number;
    to: number;
    relationship_type: RelationshipType;
    confidence: number;
  }> = [];

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const relResult = db.query(`
      SELECT source_id, target_id, relationship_type, confidence
      FROM observation_relationships
      WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)
      LIMIT 1
    `).get(from, to, to, from) as any;

    if (relResult) {
      edges.push({
        from,
        to,
        relationship_type: relResult.relationship_type as RelationshipType,
        confidence: relResult.confidence
      });
    }
  }

  return {
    found: true,
    source_id: sourceId,
    target_id: targetId,
    distance,
    path,
    edges
  };
}
