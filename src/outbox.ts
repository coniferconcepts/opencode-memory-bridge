import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, appendFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { CLAUDE_MEM_BASE_URL } from './constants.js';
import { scrubData, scrubPaths } from './scrubber.js';
import { logger } from './logger.js';

const OUTBOX_DB_PATH = join(homedir(), '.claude-mem', 'outbox.db');

// Runtime detection: Are we running in Bun?
const isBun = typeof Bun !== 'undefined' && Bun.version;

// Lazy getter for BunSQLite - only loads when actually needed
let _BunSQLite: any = null;
function getBunSQLite(): any {
  if (_BunSQLite === null && isBun) {
    try {
      // Use indirect require to hide from static analysis
      const req = (globalThis as any).require || require;
      _BunSQLite = req('bun:sqlite');
    } catch {
      _BunSQLite = undefined;
    }
  }
  return _BunSQLite;
}

export interface OutboxObservation {
  id?: number;
  session_id: string;
  source: string;
  project: string;
  cwd?: string;
  tool: string;
  title?: string;
  type?: string;
  narrative?: string;
  concepts?: string[];
  facts?: string[];
  content: string;
  timestamp: string;
  oc_metadata?: {
    execution_time_ms?: number;
    success?: boolean;
    error_message?: string;
    started_at?: string;
    ended_at?: string;
    [key: string]: any;
  };
}

class Outbox {
  private db: any | null = null;
  private drainPromise: Promise<void> | null = null;
  private initialized = false;

  constructor() {
    // Only initialize SQLite database in Bun environment
    if (isBun) {
      this.initDatabase();
    }
  }

  /**
   * Initialize SQLite database (Bun only).
   */
  private initDatabase() {
    try {
      // Lazy load BunSQLite module
      const BunSQLite = getBunSQLite();
      if (!BunSQLite) {
        throw new Error('bun:sqlite not available');
      }
      const { Database } = BunSQLite;
      
      const dir = join(homedir(), '.claude-mem');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      this.db = new Database(OUTBOX_DB_PATH);
      this.applyPragmas();
      this.initSchema();
      this.initialized = true;
    } catch (e) {
      logger.warn('[claude-mem]', 'Failed to initialize SQLite outbox', {
        error: e instanceof Error ? e.message : String(e)
      });
      this.db = null;
    }
  }

  /**
   * Apply SQLite performance pragmas.
   */
  private applyPragmas() {
    if (!this.db) return;
    try {
      this.db.run('PRAGMA journal_mode = WAL');
      this.db.run('PRAGMA synchronous = NORMAL');
      this.db.run('PRAGMA busy_timeout = 5000');
    } catch (e) {
      // Non-critical
    }
  }

  /**
   * Initialize database schema.
   */
  private initSchema() {
    if (!this.db) return;
    
    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS pending_observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT,
          source TEXT,
          project TEXT,
          cwd TEXT,
          tool TEXT,
          title TEXT,
          type TEXT,
          narrative TEXT,
          concepts TEXT,
          facts TEXT,
          content TEXT,
          timestamp TEXT,
          attempts INTEGER DEFAULT 0,
          last_attempt TEXT,
          next_attempt_at INTEGER,
          last_error TEXT,
          status TEXT DEFAULT 'pending'
        )
      `);

      // Schema migrations for existing tables
      const migrations = [
        'ALTER TABLE pending_observations ADD COLUMN cwd TEXT',
        'ALTER TABLE pending_observations ADD COLUMN title TEXT',
        'ALTER TABLE pending_observations ADD COLUMN type TEXT',
        'ALTER TABLE pending_observations ADD COLUMN narrative TEXT',
        'ALTER TABLE pending_observations ADD COLUMN concepts TEXT',
        'ALTER TABLE pending_observations ADD COLUMN facts TEXT',
        'ALTER TABLE pending_observations ADD COLUMN next_attempt_at INTEGER',
        'ALTER TABLE pending_observations ADD COLUMN last_error TEXT',
        'ALTER TABLE pending_observations ADD COLUMN status TEXT DEFAULT "pending"',
      ];

      for (const migration of migrations) {
        try { this.db.run(migration); } catch {}
      }
    } catch (e) {
      logger.error('[claude-mem]', 'Failed to initialize outbox schema', { error: String(e) });
    }
  }

  /**
   * Push an observation to the outbox.
   * In Bun: writes to SQLite. In Node.js: writes to JSONL only.
   */
  push(obs: OutboxObservation) {
    // Validate narrative
    if (!obs.narrative || obs.narrative.trim().length < 10) {
      logger.warn('outbox', `Missing narrative for ${obs.tool}, using fallback`);
      obs.narrative = `Executed ${obs.tool || 'unknown'}. Stored minimal observation.`;
    }

    try {
      // 1. Scrub secrets and PII
      let scrubbedContent = typeof obs.content === 'string' 
        ? scrubData(obs.content) 
        : JSON.stringify(scrubData(obs.content));

      // 2. Scrub absolute paths
      const projectRoot = obs.cwd || process.cwd();
      scrubbedContent = scrubPaths(scrubbedContent, projectRoot);

      // 3. Always write to JSONL (works in both Bun and Node.js)
      this.writeToJsonl(obs, scrubbedContent);

      // 4. If in Bun, also write to SQLite
      if (isBun && this.db) {
        this.pushToSQLite(obs, scrubbedContent);
      }
    } catch (error) {
      logger.error('[claude-mem]', 'Failed to push observation to outbox', {
        error: error instanceof Error ? error.message : String(error),
        tool: obs.tool
      });
    }
  }

  /**
   * Push observation to SQLite database (Bun only).
   */
  private pushToSQLite(obs: OutboxObservation, scrubbedContent: string) {
    if (!this.db) return;

    try {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const stmt = this.db.prepare(`
          INSERT INTO pending_observations (
            session_id, source, project, cwd, tool, title, type, narrative, concepts, facts, content, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          obs.session_id,
          obs.source,
          obs.project,
          obs.cwd ?? null,
          obs.tool,
          obs.title ?? null,
          obs.type ?? null,
          obs.narrative ?? null,
          obs.concepts ? JSON.stringify(obs.concepts) : null,
          obs.facts ? JSON.stringify(obs.facts) : null,
          scrubbedContent,
          obs.timestamp
        );
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
      
      // Trigger drain in background
      this.drain().catch((error) => {
        logger.error('[claude-mem]', 'Outbox drain failed after push', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      logger.error('[claude-mem]', 'Failed to push to SQLite', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Write observation to JSONL outbox (works in all environments).
   */
  private writeToJsonl(obs: OutboxObservation, scrubbedContent: string) {
    let jsonlPath: string | undefined;
    let lockPath: string | undefined;

    const projectPath = obs.cwd ?? obs.project;

    const sleepSync = (ms: number) => {
      try {
        const sab = new SharedArrayBuffer(4);
        const ia = new Int32Array(sab);
        Atomics.wait(ia, 0, 0, ms);
      } catch {
        // Fallback for environments without Atomics
        const start = Date.now();
        while (Date.now() - start < ms) {
          // Busy wait
        }
      }
    };

    try {
      const ocOutboxDir = join(homedir(), '.oc', 'outbox');
      if (!existsSync(ocOutboxDir)) {
        mkdirSync(ocOutboxDir, { recursive: true });
      }

      jsonlPath = join(ocOutboxDir, `observations-${new Date().toISOString().split('T')[0]}.jsonl`);
      lockPath = `${jsonlPath}.lock`;

      const LOCK_STALE_MS = 30_000;
      const LOCK_MAX_WAIT_MS = 2_000;
      const start = Date.now();

      while (true) {
        try {
          writeFileSync(
            lockPath,
            JSON.stringify({ pid: process.pid, timestamp: Date.now() }),
            { flag: 'wx', mode: 0o600 }
          );
          break;
        } catch (err: any) {
          if (err?.code !== 'EEXIST') throw err;
          try {
            const stat = statSync(lockPath);
            if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
              unlinkSync(lockPath);
              continue;
            }
          } catch {}
          if (Date.now() - start > LOCK_MAX_WAIT_MS) {
            throw new Error(`Timed out waiting for JSONL lock: ${lockPath}`);
          }
          sleepSync(25 + Math.floor(Math.random() * 25));
        }
      }

      try {
        const entry = JSON.stringify({
          project_path: projectPath,
          project: obs.project,
          session_id: obs.session_id,
          source: obs.source,
          tool: obs.tool,
          title: obs.title,
          type: obs.type,
          narrative: obs.narrative,
          concepts: obs.concepts,
          facts: obs.facts,
          content: scrubbedContent,
          timestamp: obs.timestamp,
          oc_metadata: {
            source: obs.source,
            project: obs.project,
            ...(obs.oc_metadata || {}),
          },
        });
        appendFileSync(jsonlPath, entry + '\n');
      } finally {
        if (lockPath) {
          try { unlinkSync(lockPath); } catch {}
        }
      }
    } catch (e) {
      logger.error('[claude-mem]', 'Failed to write to JSONL outbox', {
        error: e instanceof Error ? e.message : String(e),
        tool: obs.tool,
      });
    }
  }

  /**
   * Drain the outbox by sending pending observations to the worker.
   * In Bun: drains from SQLite. In Node.js: drains from JSONL.
   */
  async drain() {
    if (this.drainPromise) return this.drainPromise;
    
    this.drainPromise = this._drainInternal().finally(() => {
      this.drainPromise = null;
    });
    
    return this.drainPromise;
  }

  private async _drainInternal() {
    // In Bun with SQLite: drain from database
    if (isBun && this.db) {
      await this._drainFromSQLite();
    }
    
    // Always drain from JSONL (works in all environments)
    await this._drainFromJsonl();
  }

  /**
   * Drain observations from SQLite (Bun only).
   */
  private async _drainFromSQLite() {
    if (!this.db) return;

    try {
      while (true) {
        const now = Date.now();
        let pending: any[] = [];
        try {
          pending = this.db.query(`
            SELECT * FROM pending_observations 
            WHERE status = 'pending' 
            AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
            ORDER BY id ASC LIMIT 10
          `).all(now) as any[];
        } catch (e) {
          logger.error('[claude-mem]', 'Failed to query outbox', { error: String(e) });
          break;
        }

        if (pending.length === 0) break;

        const success = await this._sendBatchToWorker(pending);
        if (!success) break;

        // Delete successfully sent observations
        const ids = pending.map(p => p.id);
        const placeholders = ids.map(() => '?').join(',');
        this.db.run(`DELETE FROM pending_observations WHERE id IN (${placeholders})`, ids);
      }
    } catch (error) {
      logger.warn('[claude-mem]', 'SQLite drain error', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Drain observations from JSONL files (all environments).
   */
  private async _drainFromJsonl() {
    // Implementation for JSONL draining would go here
    // For now, this is a placeholder - JSONL files are processed by the ingestor
  }

  /**
   * Send a batch of observations to the worker.
   */
  private async _sendBatchToWorker(pending: any[]): Promise<boolean> {
    try {
      // Batch unique sessions for import
      const sessionsToImport = Array.from(new Set(pending.map(p => p.session_id))).map(sid => {
        const obs = pending.find(p => p.session_id === sid);
        return {
          content_session_id: sid,
          memory_session_id: sid,
          project: obs.project,
          user_prompt: 'OpenCode Session',
          started_at: obs.timestamp,
          started_at_epoch: new Date(obs.timestamp).getTime(),
          status: 'active'
        };
      });

      // 1. Batch session import
      const sessionImportResp = await fetch(`${CLAUDE_MEM_BASE_URL}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: sessionsToImport })
      });

      if (!sessionImportResp.ok) {
        throw new Error(`Failed to import sessions: ${sessionImportResp.status}`);
      }

      // 2. Batch observation import
      const observationsToImport = pending
        .filter(obs => obs.narrative)
        .map(obs => ({
          memory_session_id: obs.session_id,
          project: obs.project,
          type: obs.type || 'discovery',
          title: obs.title || `Untitled (${obs.tool})`,
          narrative: obs.narrative,
          concepts: typeof obs.concepts === 'string' ? obs.concepts : JSON.stringify(obs.concepts || []),
          facts: typeof obs.facts === 'string' ? obs.facts : JSON.stringify(obs.facts || []),
          files_read: '[]',
          files_modified: '[]',
          created_at: obs.timestamp,
          created_at_epoch: new Date(obs.timestamp).getTime(),
          source_tool: obs.tool,
          discovery_tokens: 0
        }));

      if (observationsToImport.length > 0) {
        const importResp = await fetch(`${CLAUDE_MEM_BASE_URL}/api/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ observations: observationsToImport })
        });

        if (!importResp.ok) {
          const errorText = await importResp.text();
          const status = importResp.status;
          
          // Handle failures with retry logic
          if (isBun && this.db) {
            this._markFailedForRetry(pending, status, errorText);
          }
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.warn('[claude-mem]', 'Outbox drain failed (network/worker error)', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Mark failed observations for retry (SQLite only).
   */
  private _markFailedForRetry(pending: any[], status: number, errorText: string) {
    if (!this.db) return;

    try {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const updateStmt = this.db.prepare(`
          UPDATE pending_observations 
          SET attempts = attempts + 1, 
              last_attempt = ?, 
              next_attempt_at = ?, 
              last_error = ?,
              status = ?
          WHERE id = ?
        `);
        
        for (const obs of pending) {
          const isPermanent = status >= 400 && status < 500 && status !== 429;
          const nextStatus = (obs.attempts + 1 >= 10 || isPermanent) ? 'dead' : 'pending';
          const backoff = Math.min(Math.pow(2, obs.attempts + 1) * 5000, 30 * 60 * 1000);
          const nextAttempt = nextStatus === 'dead' ? null : Date.now() + backoff;
          
          updateStmt.run(new Date().toISOString(), nextAttempt, errorText.slice(0, 500), nextStatus, obs.id);
        }
        this.db.exec('COMMIT');
      } catch (e) {
        this.db.exec('ROLLBACK');
        throw e;
      }
    } catch (e) {
      logger.error('[claude-mem]', 'Failed to mark observations for retry', { error: String(e) });
    }
  }

  /**
   * Query pending observations (for testing/debugging).
   */
  queryPending(): any[] {
    if (!isBun || !this.db) return [];
    
    try {
      return this.db.query(`
        SELECT * FROM pending_observations 
        WHERE status = 'pending'
        ORDER BY id ASC
      `).all();
    } catch (e) {
      return [];
    }
  }

  /**
   * Get database instance (for testing).
   */
  getDatabase(): any | null {
    return this.db;
  }
}

// Export singleton instance
export const outbox = new Outbox();
