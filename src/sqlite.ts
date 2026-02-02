/**
 * SQLite connection management for claude-mem.
 *
 * ## Rationale: Robust Concurrent Access
 *
 * claude-mem uses SQLite for observation storage. Multiple processes
 * (OpenCode, Claude Code) may access the database concurrently.
 *
 * This module ensures:
 * 1. WAL mode for concurrent reads during writes
 * 2. Busy timeout to handle lock contention gracefully
 * 3. Single persistent connection (connection pooling)
 * 4. BEGIN IMMEDIATE for write transactions
 *
 * @module src/integrations/claude-mem/sqlite
 */

import { SQLITE_PRAGMAS, SQLITE_WRITE_TRANSACTION } from './constants.js';

// Runtime detection: Are we running in Bun?
const isBun = typeof Bun !== 'undefined' && Bun.version;

/**
 * SQLite connection configuration.
 */
export interface SQLiteConfig {
  /** Path to the database file */
  dbPath: string;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

/**
 * Initialize SQLite connection with recommended pragmas.
 *
 * **Called by claude-mem worker on startup.**
 *
 * @param db - The SQLite database instance
 */
export function initializeSQLite(db: any): void {
  // Apply pragmas for robust concurrent access
  db.exec(`PRAGMA journal_mode = ${SQLITE_PRAGMAS.journal_mode}`);
  db.exec(`PRAGMA busy_timeout = ${SQLITE_PRAGMAS.busy_timeout}`);
  db.exec(`PRAGMA synchronous = ${SQLITE_PRAGMAS.synchronous}`);
}

/**
 * Create a new SQLite database instance with Bun's SQLite API.
 *
 * **Used by tests and initialization code.**
 *
 * @param dbPath - Path to the database file
 * @returns Database instance
 */
export function createDatabase(dbPath: string): any {
  // Check if we're running in Bun
  if (!isBun) {
    throw new Error('bun:sqlite not available. Are you running in a Bun environment?');
  }

  // Lazy load bun:sqlite
  const bunSqlite = eval("require('bun:sqlite')");
  const { Database } = bunSqlite;
  const db = new Database(dbPath);
  initializeSQLite(db);
  return db;
}

/**
 * Execute a write transaction with BEGIN IMMEDIATE.
 * 
 * **Why BEGIN IMMEDIATE?**
 * Acquires write lock at transaction start, preventing deadlocks
 * when multiple processes compete for writes.
 * 
 * @param db - The SQLite database instance
 * * @param fn - The transaction function
 */
export async function writeTransaction<T>(
  db: any,
  fn: () => Promise<T>
): Promise<T> {
  db.exec(SQLITE_WRITE_TRANSACTION);
  try {
    const result = await fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Check if the database is healthy.
 */
export function isDatabaseHealthy(db: any): boolean {
  try {
    const result = db.prepare('SELECT 1').get();
    return result !== undefined;
  } catch {
    return false;
  }
}
