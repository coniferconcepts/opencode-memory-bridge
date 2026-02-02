#!/usr/bin/env bun
/**
 * Populate Importance Scores for All Observations
 *
 * Migration script to calculate and populate importance_score in oc_metadata
 * for all observations in the claude-mem database.
 *
 * Usage: bun ./scripts/populate-importance-scores.ts
 */

import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import { calculateImportanceScore, type ObservationType } from '../src/scoring';

const db = new Database(join(homedir(), '.claude-mem', 'claude-mem.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA synchronous = NORMAL');

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

interface Observation {
  id: number;
  type: ObservationType;
  narrative: string | null;
  facts: string | null;
  concepts: string | null;
  oc_metadata: string | null;
  created_at_epoch: number;
  discovery_tokens: number | null;
}

/**
 * Parse JSON safely, returning empty object on failure
 */
function safeJsonParse(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Parse array JSON safely
 */
function safeJsonParseArray(json: string | null): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Count items in an array
 */
function countArray(json: string | null): number {
  return safeJsonParseArray(json).length;
}

/**
 * Main migration function
 */
async function populateImportanceScores() {
  console.log('Starting importance score population...');
  const startTime = Date.now();

  try {
    // Get total count
    const countResult = db.query('SELECT COUNT(*) as count FROM observations').get() as { count: number };
    const totalCount = countResult.count;
    console.log(`Processing ${totalCount} observations...`);

    // Fetch all observations
    const observations = db.query(`
      SELECT
        id,
        type,
        narrative,
        facts,
        concepts,
        oc_metadata,
        created_at_epoch,
        discovery_tokens
      FROM observations
      ORDER BY id ASC
    `).all() as Observation[];

    // Start transaction for efficiency
    const transaction = db.transaction((observations: Observation[]) => {
      let processed = 0;
      const distribution = { critical: 0, high: 0, medium: 0, low: 0 };

      for (const obs of observations) {
        // Skip if importance_score already exists
        const ocMetadata = safeJsonParse(obs.oc_metadata);
        if (ocMetadata.importance_score !== undefined) {
          processed++;
          continue;
        }

        // Calculate importance score
        const result = calculateImportanceScore({
          type: obs.type,
          narrativeLength: obs.narrative?.length || 0,
          factsCount: countArray(obs.facts),
          conceptsCount: countArray(obs.concepts),
          createdAtEpoch: obs.created_at_epoch,
          discoveryTokens: obs.discovery_tokens || 0,
          referenceCount: 0 // References not populated yet
        });

        // Update oc_metadata with importance score
        ocMetadata.importance_score = result.score;
        ocMetadata.importance_tier = result.tier;

        db.query(`
          UPDATE observations
          SET oc_metadata = ?
          WHERE id = ?
        `).run(JSON.stringify(ocMetadata), obs.id);

        // Track distribution
        distribution[result.tier]++;
        processed++;

        // Log progress every 1000 observations
        if (processed % 1000 === 0) {
          console.log(`[${processed}/${totalCount}] Processed...`);
        }
      }

      return { processed, distribution };
    });

    // Execute transaction
    const result = transaction(observations);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\nComplete! ${result.processed} observations scored.`);
    console.log('Distribution:');
    console.log(`  - Critical (90+): ${result.distribution.critical}`);
    console.log(`  - High (70-89): ${result.distribution.high}`);
    console.log(`  - Medium (40-69): ${result.distribution.medium}`);
    console.log(`  - Low (0-39): ${result.distribution.low}`);
    console.log(`Total time: ${duration}s`);

    // Verify update
    const verifyResult = db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN json_extract(oc_metadata, '$.importance_score') IS NOT NULL THEN 1 ELSE 0 END) as scored
      FROM observations
    `).get() as { total: number; scored: number };

    console.log(`\nVerification: ${verifyResult.scored}/${verifyResult.total} observations have importance_score`);

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the migration
await populateImportanceScores();
