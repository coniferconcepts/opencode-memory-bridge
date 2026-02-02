/**
 * Ingestor Daemon
 * 
 * Responsibility:
 * - Process JSONL outbox files and write to project-local memory.db files.
 * - Update the global index with sync timestamps and project metadata.
 * - Ensure single-writer access to the global index.
 * 
 * @module src/integrations/claude-mem/ingestor
 * @see docs/MULTI_PROJECT_MEMORY_PLAN_FINAL.md
 */

import { join, basename } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, mkdirSync, renameSync, readdirSync } from 'fs';
import { acquireIndexLock, releaseIndexLock } from './index-daemon.js';
import { generateProjectUUID } from './project-uuid.js';
import { scrubData, scrubPaths } from './scrubber.js';
import { logger } from './logger.js';
import * as v from 'valibot';
import { OcMetadataSchema, type OcMetadata, defaultMetadata } from './metadata-schema.js';

// Check if we're running in Bun
const isBun = typeof Bun !== 'undefined' && Bun.version;

const OC_DIR = join(homedir(), '.oc');
const OUTBOX_DIR = join(OC_DIR, 'outbox');
const PROCESSED_DIR = join(OUTBOX_DIR, 'processed');
const INDEX_DB_PATH = join(OC_DIR, 'index.db');

export interface IngestorConfig {
  pollIntervalMs?: number;
  batchSize?: number;
}

export class Ingestor {
  private config: IngestorConfig;
  private isRunning = false;
  private indexDb: any | null = null;

  constructor(config: IngestorConfig = {}) {
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 1000,
      batchSize: config.batchSize ?? 100,
    };
  }

  /**
   * Start the ingestor daemon.
   */
  async start(once = false): Promise<boolean> {
    // Check if we're running in Bun
    if (!isBun) {
      logger.warn('[claude-mem][ingestor]', 'Ingestor requires Bun runtime. Skipping.');
      return false;
    }

    if (!acquireIndexLock()) {
      logger.warn('[claude-mem][ingestor]', 'Another instance is running. Exiting.', {
        outboxDir: OUTBOX_DIR,
        indexDbPath: INDEX_DB_PATH,
        once,
      });
      return false;
    }

    // Ensure directories exist
    mkdirSync(OUTBOX_DIR, { recursive: true });
    mkdirSync(PROCESSED_DIR, { recursive: true });

    // Initialize global index with lazy loading
    const bunSqlite = eval("require('bun:sqlite')");
    const { Database } = bunSqlite;
    this.indexDb = new Database(INDEX_DB_PATH);
    this.indexDb.exec('PRAGMA journal_mode = WAL');
    this.indexDb.exec('PRAGMA busy_timeout = 5000');
    this.initIndexSchema();

    this.isRunning = true;
    logger.info('[claude-mem][ingestor]', `Started${once ? ' (once mode)' : ''}. Watching for outbox files...`, {
      outboxDir: OUTBOX_DIR,
      processedDir: PROCESSED_DIR,
      indexDbPath: INDEX_DB_PATH,
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
    });

    // Main processing loop
    while (this.isRunning) {
      try {
        await this.processOutbox();
      } catch (error) {
        logger.error('[claude-mem][ingestor]', 'Error processing outbox (loop iteration)', {
          error: error instanceof Error ? error.message : String(error),
          outboxDir: OUTBOX_DIR,
        });
      }
      
      if (once) {
        this.stop();
        break;
      }

      // Use a simple sleep for the loop
      await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
    }

    return true;
  }

  stop(): void {
    this.isRunning = false;
    this.indexDb?.close();
    releaseIndexLock();
    logger.info('[claude-mem][ingestor]', 'Stopped.');
  }

  /**
   * Initialize the global index database schema.
   */
  private initIndexSchema(): void {
    if (!this.indexDb) return;
    
    // 1. Projects table
    this.indexDb.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        project_uuid TEXT PRIMARY KEY,
        absolute_path TEXT NOT NULL UNIQUE,
        display_name TEXT,
        last_sync_at TEXT,
        observation_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 2. Materialized Global Index (Denormalized observations)
    // This allows O(1) cross-project search without opening per-project DBs.
    this.indexDb.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT UNIQUE NOT NULL, -- project_uuid:project_obs_id
        project_uuid TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        narrative TEXT,
        importance TEXT,
        branch TEXT,
        created_at TEXT NOT NULL,
        oc_metadata TEXT,  -- JSON: {importance_score, importance_tier, ...}
        meta_importance_score INTEGER GENERATED ALWAYS AS (
          CAST(json_extract(oc_metadata, '$.importance_score') AS INTEGER)
        ) STORED,
        FOREIGN KEY(project_uuid) REFERENCES projects(project_uuid)
      );

      CREATE INDEX IF NOT EXISTS idx_global_obs_type ON observations(type);
      CREATE INDEX IF NOT EXISTS idx_global_obs_created ON observations(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_global_obs_importance ON observations(importance) WHERE importance = 'high';
      CREATE INDEX IF NOT EXISTS idx_high_importance_score
        ON observations(meta_importance_score DESC)
        WHERE meta_importance_score >= 70;

      CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
        title, narrative,
        content='observations', content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS global_obs_fts_insert AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, title, narrative)
        VALUES (NEW.id, NEW.title, NEW.narrative);
      END;

      -- 3. Observation Relationships Table (Task 3.1)
      -- Tracks connections between observations with confidence scores
      CREATE TABLE IF NOT EXISTS observation_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        target_id INTEGER NOT NULL,
        relationship_type TEXT NOT NULL CHECK(relationship_type IN
          ('references', 'extends', 'conflicts_with', 'depends_on', 'follows', 'modifies')),
        confidence REAL NOT NULL DEFAULT 1.0 CHECK(confidence >= 0.0 AND confidence <= 1.0),
        metadata TEXT,  -- JSON: {shared_concepts[], shared_files[], time_delta_ms, detection_heuristics}
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(source_id) REFERENCES observations(id) ON DELETE CASCADE,
        FOREIGN KEY(target_id) REFERENCES observations(id) ON DELETE CASCADE,
        UNIQUE(source_id, target_id, relationship_type)
      );

      -- Strategic Indices for <50ms Graph Queries
      -- Index 1: Fast outgoing relationship lookup (source_id)
      CREATE INDEX IF NOT EXISTS idx_relationships_source
        ON observation_relationships(source_id);

      -- Index 2: Fast incoming relationship lookup (target_id)
      CREATE INDEX IF NOT EXISTS idx_relationships_target
        ON observation_relationships(target_id);

      -- Index 3: Bidirectional lookup with ordering by confidence
      CREATE INDEX IF NOT EXISTS idx_relationships_bidirectional
        ON observation_relationships(source_id, target_id, confidence DESC);

      -- Index 4: Partial index for high-confidence relationships only (0.7+)
      -- Optimizes graph traversal by filtering low-confidence noise
      CREATE INDEX IF NOT EXISTS idx_relationships_high_confidence
        ON observation_relationships(confidence DESC)
        WHERE confidence >= 0.7;
    `);
  }

  private async processOutbox(): Promise<void> {
    let files: string[] = [];
    try {
      files = readdirSync(OUTBOX_DIR);
    } catch (error) {
      logger.error('[claude-mem][ingestor]', 'Failed to read outbox directory', {
        error: error instanceof Error ? error.message : String(error),
        outboxDir: OUTBOX_DIR,
      });
      return;
    }

    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl') && !f.startsWith('.'));

    for (const file of jsonlFiles) {
      try {
        await this.processFile(join(OUTBOX_DIR, file));
      } catch (error) {
        // Do not stop the loop if one file fails
        logger.error('[claude-mem][ingestor]', 'Failed to process outbox file', {
          error: error instanceof Error ? error.message : String(error),
          file,
          outboxDir: OUTBOX_DIR,
        });
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const fileName = basename(filePath);

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (error) {
      logger.error('[claude-mem][ingestor]', 'Failed to read outbox file', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
      });
      return;
    }

    const lines = content.trim().split('\n').filter(Boolean);

    // Group by project
    const byProject = new Map<string, any[]>();
    let malformedLineCount = 0;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const projectPath = event.project_path;
        if (!projectPath) {
          malformedLineCount++;
          continue;
        }

        if (!byProject.has(projectPath)) {
          byProject.set(projectPath, []);
        }
        byProject.get(projectPath)!.push(event);
      } catch {
        malformedLineCount++;
      }
    }

    if (malformedLineCount > 0) {
      logger.warn('[claude-mem][ingestor]', 'Skipping malformed JSONL lines', {
        filePath,
        malformedLineCount,
        totalLines: lines.length,
      });
    }

    // Process each project batch (do not fail the whole file if one project fails)
    let projectFailureCount = 0;
    for (const [projectPath, events] of byProject) {
      try {
        await this.ingestToProject(projectPath, events);
      } catch (error) {
        projectFailureCount++;
        logger.error('[claude-mem][ingestor]', 'Failed to ingest project batch from outbox file', {
          error: error instanceof Error ? error.message : String(error),
          projectPath,
          filePath,
          eventCount: events.length,
        });
      }
    }

    // If everything failed, keep the file in-place to retry later.
    if (byProject.size > 0 && projectFailureCount === byProject.size) {
      logger.error('[claude-mem][ingestor]', 'All projects failed for outbox file; leaving file for retry', {
        filePath,
        projectCount: byProject.size,
        fileName,
      });
      return;
    }

    // Move to processed even if some projects failed, to avoid infinite retry loops.
    const processedPath = join(PROCESSED_DIR, `${Date.now()}-${fileName}`);
    try {
      renameSync(filePath, processedPath);
    } catch (error) {
      logger.error('[claude-mem][ingestor]', 'Failed to move outbox file to processed', {
        error: error instanceof Error ? error.message : String(error),
        filePath,
        processedPath,
      });
    }
  }

  private async ingestToProject(projectPath: string, events: any[]): Promise<any[]> {
    // SEC-001: Harden path validation using resolve() and allowlist
    const { resolve } = require('path');
    const normalizedPath = resolve(projectPath);
    
    // ARCH-001: Add Windows path support
    const isWindows = process.platform === 'win32';
    const allowedRoots = isWindows 
      ? [homedir(), 'C:\\', 'D:\\'] 
      : [homedir(), '/Users', '/home', '/var/folders'];
    
    const isAllowed = allowedRoots.some(root => normalizedPath.startsWith(root));
    if (!isAllowed || normalizedPath.includes('..')) {
      logger.error('[claude-mem][ingestor]', 'Invalid project path detected', { projectPath, normalizedPath });
      return [];
    }

    const dbDir = join(normalizedPath, '.oc');
    const dbPath = join(dbDir, 'memory.db');

    if (!existsSync(dbDir)) {
      try {
        mkdirSync(dbDir, { recursive: true });
      } catch (error) {
        logger.error('[claude-mem][ingestor]', 'Failed to create project .oc directory', {
          error: error instanceof Error ? error.message : String(error),
          projectPath,
          dbDir,
        });
        throw error;
      }
    }

    let db: any | null = null;
    const highValueSummaries: any[] = [];

    try {
      // Lazy load bun:sqlite
      const bunSqlite = eval("require('bun:sqlite')");
      const { Database } = bunSqlite;
      db = new Database(dbPath);
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA busy_timeout = 5000');

      this.ensureProjectSchema(db);

      // Begin transaction
      db.exec('BEGIN IMMEDIATE');

      try {
        const insertStmt = db.prepare(`
          INSERT INTO observations (
            memory_session_id, project, type, title, subtitle, narrative,
            text, facts, concepts, files_read, files_modified,
            prompt_number, created_at, created_at_epoch, oc_metadata,
            source_tool
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `);

        let inserted = 0;
        for (const event of events) {
          // 1. Scrub secrets and PII
          const scrubbed = scrubData(event);
          
          // 2. Scrub absolute paths
          if (scrubbed.text) scrubbed.text = scrubPaths(scrubbed.text, normalizedPath);
          if (scrubbed.narrative) scrubbed.narrative = scrubPaths(scrubbed.narrative, normalizedPath);
          if (scrubbed.content) scrubbed.content = scrubPaths(scrubbed.content, normalizedPath);

          // Metadata handling
          let metadata: OcMetadata = defaultMetadata(scrubbed.branch);
          if (scrubbed.oc_metadata) {
            try {
              metadata = { ...metadata, ...v.parse(OcMetadataSchema, scrubbed.oc_metadata) };
            } catch (error) {
              logger.warn('[claude-mem][ingestor]', 'Invalid oc_metadata; using defaults', {
                error: error instanceof Error ? error.message : String(error),
                projectPath,
              });
            }
          }

          // Map tool-use to valid types for better visibility
          const type = scrubbed.type || 'discovery';

          const result = insertStmt.get(
            scrubbed.session_id ?? 'unknown',
            scrubbed.project ?? projectPath.split('/').pop(),
            type,
            scrubbed.title ?? `Untitled (${scrubbed.tool})`,
            scrubbed.subtitle ?? null,
            scrubbed.narrative ?? null,
            scrubbed.text ?? null,
            scrubbed.facts ? (typeof scrubbed.facts === 'string' ? scrubbed.facts : JSON.stringify(scrubbed.facts)) : null,
            scrubbed.concepts ? (typeof scrubbed.concepts === 'string' ? scrubbed.concepts : JSON.stringify(scrubbed.concepts)) : null,
            scrubbed.files_read ? JSON.stringify(scrubbed.files_read) : null,
            scrubbed.files_modified ? JSON.stringify(scrubbed.files_modified) : null,
            scrubbed.prompt_number ?? null,
            scrubbed.created_at ?? new Date().toISOString(),
            scrubbed.created_at_epoch ?? Date.now(),
            JSON.stringify(metadata),
            scrubbed.tool ?? null
          ) as { id: number };

          // Collect high-value summaries for global index
          if (scrubbed.narrative) {
            highValueSummaries.push({
              project_obs_id: result.id,
              type,
              title: scrubbed.title ?? `Untitled (${scrubbed.tool})`,
              narrative: scrubbed.narrative,
              importance: metadata.importance,
              branch: metadata.branch,
              created_at: scrubbed.created_at ?? new Date().toISOString()
            });
          }

          inserted++;
        }

        db.exec('COMMIT');

        logger.info('[claude-mem][ingestor]', 'Ingested observations into project db', {
          projectPath,
          dbPath,
          inserted,
        });

        // Update global index best-effort
        this.updateGlobalIndex(projectPath, inserted, highValueSummaries);
      } catch (error) {
        db.exec('ROLLBACK');
        logger.error('[claude-mem][ingestor]', 'Transaction failed while ingesting project batch', {
          error: error instanceof Error ? error.message : String(error),
          projectPath,
          dbPath,
          eventCount: events.length,
        });
        throw error;
      }
    } finally {
      db?.close();
    }

    return highValueSummaries;
  }

  private ensureProjectSchema(db: any): void {
    // LC-001: Move version check inside the transaction to prevent TOCTOU race
    db.exec('BEGIN IMMEDIATE');
    try {
      // 1. Create meta table for version tracking
      db.exec(`
        CREATE TABLE IF NOT EXISTS oc_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      const versionRow = db.prepare("SELECT value FROM oc_meta WHERE key = 'schema_version'").get() as { value: string } | undefined;
      const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;
      const TARGET_VERSION = 3;

      if (currentVersion < TARGET_VERSION) {
        this.migrateSchemaInTransaction(db, currentVersion, TARGET_VERSION);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      logger.error('[claude-mem][ingestor]', 'Failed to ensure project schema', { error: String(error) });
      throw error;
    }
  }

  /**
   * Perform schema migration within an existing transaction.
   */
  private migrateSchemaInTransaction(db: any, from: number, to: number): void {
    logger.info('[claude-mem][ingestor]', `Migrating project schema from v${from} to v${to}...`);
    
    if (from < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memory_session_id TEXT NOT NULL,
          project TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          subtitle TEXT,
          narrative TEXT,
          text TEXT,
          facts TEXT,
          concepts TEXT,
          files_read TEXT,
          files_modified TEXT,
          prompt_number INTEGER,
          created_at TEXT DEFAULT (datetime('now')),
          created_at_epoch INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(memory_session_id);
        CREATE INDEX IF NOT EXISTS idx_obs_project ON observations(project);
        CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type);
        CREATE INDEX IF NOT EXISTS idx_obs_created ON observations(created_at DESC);

        CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
          title, subtitle, narrative, text,
          content='observations', content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS obs_fts_insert AFTER INSERT ON observations BEGIN
          INSERT INTO observations_fts(rowid, title, subtitle, narrative, text)
          VALUES (NEW.id, NEW.title, NEW.subtitle, NEW.narrative, NEW.text);
        END;
      `);
    }

    if (from < 2) {
      // Use STORED generated columns for O(1) performance as per ADR-041
      db.exec(`
        ALTER TABLE observations ADD COLUMN oc_metadata TEXT DEFAULT '{}';
        ALTER TABLE observations ADD COLUMN meta_branch TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.branch')) STORED;
        ALTER TABLE observations ADD COLUMN meta_importance TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.importance')) STORED;
        ALTER TABLE observations ADD COLUMN meta_scope TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.scope')) STORED;
        ALTER TABLE observations ADD COLUMN meta_promoted_at TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.promoted_at')) STORED;
        ALTER TABLE observations ADD COLUMN meta_archived_at TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.archived_at')) STORED;
        
        CREATE INDEX IF NOT EXISTS idx_obs_branch ON observations(meta_branch) WHERE meta_branch IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_obs_importance ON observations(meta_importance) WHERE meta_importance = 'high';
      `);
    }

    if (from < 3) {
      db.exec(`
        ALTER TABLE observations ADD COLUMN deontic_type TEXT GENERATED ALWAYS AS (json_extract(oc_metadata, '$.deontic_type')) STORED;
        CREATE INDEX IF NOT EXISTS idx_obs_deontic ON observations(deontic_type) WHERE deontic_type IS NOT NULL;
      `);
    }

    db.prepare("INSERT OR REPLACE INTO oc_meta (key, value) VALUES ('schema_version', ?)").run(to.toString());
  }

  private updateGlobalIndex(projectPath: string, count: number, summaries: any[] = []): void {
    if (!this.indexDb) return;

    const projectUuid = generateProjectUUID(projectPath);
    const displayName = projectPath.split('/').pop() ?? 'unknown';

    this.indexDb.exec('BEGIN IMMEDIATE');
    try {
      // 1. Handle UUID migration (SHA256 -> HMAC)
      // If path exists with different UUID, delete old entries to maintain integrity
      const existing = this.indexDb.prepare('SELECT project_uuid FROM projects WHERE absolute_path = ?').get(projectPath) as { project_uuid: string } | undefined;
      
      if (existing && existing.project_uuid !== projectUuid) {
        logger.info('[claude-mem][ingestor]', 'Migrating project UUID (SHA256 -> HMAC)', { projectPath });
        this.indexDb.prepare('DELETE FROM observations WHERE project_uuid = ?').run(existing.project_uuid);
        this.indexDb.prepare('DELETE FROM projects WHERE project_uuid = ?').run(existing.project_uuid);
      }

      // 2. Update project metadata
      this.indexDb
        .prepare(`
          INSERT INTO projects (project_uuid, absolute_path, display_name, last_sync_at, observation_count)
          VALUES (?, ?, ?, datetime('now'), ?)
          ON CONFLICT(project_uuid) DO UPDATE SET
            last_sync_at = datetime('now'),
            observation_count = observation_count + excluded.observation_count,
            updated_at = datetime('now')
        `)
        .run(projectUuid, projectPath, displayName, count);

      // 3. Insert denormalized observations into global index
      if (summaries.length > 0) {
        const insertStmt = this.indexDb.prepare(`
          INSERT OR REPLACE INTO observations (
            external_id, project_uuid, type, title, narrative, importance, branch, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of summaries) {
          const externalId = `${projectUuid}:${s.project_obs_id}`;
          insertStmt.run(
            externalId,
            projectUuid,
            s.type,
            s.title,
            s.narrative,
            s.importance,
            s.branch,
            s.created_at
          );
        }
      }

      this.indexDb.exec('COMMIT');
    } catch (error) {
      this.indexDb.exec('ROLLBACK');
      logger.error('[claude-mem][ingestor]', 'Failed to update global index', {
        error: error instanceof Error ? error.message : String(error),
        projectPath,
        projectUuid,
        count,
        indexDbPath: INDEX_DB_PATH,
      });
    }
  }
}

// Main entry point
if (import.meta.main) {
  const once = process.argv.includes('--once');
  const ingestor = new Ingestor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('[claude-mem][ingestor]', 'Shutting down (SIGINT)');
    ingestor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('[claude-mem][ingestor]', 'Shutting down (SIGTERM)');
    ingestor.stop();
    process.exit(0);
  });

  if (once) {
    ingestor.start(true).catch((err) => {
      logger.error('[claude-mem][ingestor]', 'Fatal error', {
        error: err instanceof Error ? err.message : String(err),
        once: true,
      });
      process.exit(1);
    });
  } else {
    ingestor.start().catch((err) => {
      logger.error('[claude-mem][ingestor]', 'Fatal error', {
        error: err instanceof Error ? err.message : String(err),
        once: false,
      });
      process.exit(1);
    });
  }
}
