/**
 * Memory Router
 *
 * Responsibility:
 * - Dispatch queries to appropriate database(s) based on scope.
 * - Handle fan-out queries for global search.
 * - Provide a unified interface for context manifest building.
 *
 * @module src/integrations/claude-mem/router
 * @see docs/MULTI_PROJECT_MEMORY_PLAN_FINAL.md
 */

import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { DEFAULT_OBSERVATION_LIMIT } from './constants';
import { logger } from './logger.js';

// Runtime detection: Are we running in Bun?
const isBun = typeof Bun !== 'undefined' && Bun.version;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * SQL parameter type for type-safe database queries
 */
export type SqlParam = string | number | boolean | null | Uint8Array;

/**
 * SQL parameters array
 */
export type SqlParams = SqlParam[];

/**
 * Application error with context
 */
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Router configuration options
 */
export interface RouterConfig {
  /** Current project path */
  currentProject: string;
  /** Current branch name (defaults to 'main') */
  currentBranch?: string;
}

/**
 * Query options for observation searches
 */
export interface QueryOptions {
  /** Query scope: branch, project, or global */
  scope: 'branch' | 'project' | 'global';
  /** Filter by observation types */
  types?: string[];
  /** Maximum number of results */
  limit?: number;
  /** Filter by creation date (ISO string) */
  since?: string;
  /** Filter by importance level */
  importance?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Observation record from the database
 */
export interface Observation {
  /** Unique observation ID */
  id: number;
  /** Memory session identifier */
  memory_session_id: string;
  /** Project name */
  project: string;
  /** Observation type */
  type: string;
  /** Observation title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Narrative content */
  narrative?: string;
  /** Text content */
  text?: string;
  /** Creation timestamp (ISO string) */
  created_at: string;
  /** OpenCode metadata */
  oc_metadata?: string;
  /** Branch name */
  meta_branch?: string;
  /** Importance level */
  meta_importance?: string;
  /** Deontic type */
  deontic_type?: string;
  /** Source project path */
  source_project?: string;
}

// =============================================================================
// Memory Router Class
// =============================================================================

/**
 * Memory Router - dispatches queries to appropriate database(s).
 *
 * Query Routing Rules:
 * - scope='branch': Query current project DB, filter by branch
 * - scope='project': Query current project DB, all branches
 * - scope='global': Query global index, then fan-out to project DBs
 *
 * @example
 * ```ts
 * const router = new MemoryRouter({
 *   currentProject: '/path/to/project',
 *   currentBranch: 'main'
 * });
 * await router.init();
 * const results = await router.query('search term', { scope: 'project' });
 * router.close();
 * ```
 */
export class MemoryRouter {
  // -------------------------------------------------------------------------
  // Private Properties
  // -------------------------------------------------------------------------

  private config: RouterConfig;
  private projectDb: any | null = null;
  private indexDb: any | null = null;
  private initialized = false;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * Create a new MemoryRouter instance.
   *
   * @param config - Router configuration
   */
  constructor(config: RouterConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Database Connection Methods
  // -------------------------------------------------------------------------

  /**
   * Execute a database query with error handling.
   *
   * @template T - The expected return type
   * @param query - SQL query string
   * @param params - SQL parameters
   * @returns Query result as type T
   * @throws {AppError} If database query fails
   */
  private async executeQuery<T>(query: string, params: SqlParams = []): Promise<T> {
    try {
      const result = this.projectDb!.prepare(query).all(...params);
      return result as T;
    } catch (error) {
      const appError = new AppError(
        'DATABASE_QUERY_ERROR',
        `Failed to execute query: ${error instanceof Error ? error.message : String(error)}`,
        500,
        { query, params, originalError: error }
      );
      logger.error('MemoryRouter', 'Database query failed', appError);
      throw appError;
    }
  }

  /**
   * Execute a database query on the index with error handling.
   *
   * @template T - The expected return type
   * @param query - SQL query string
   * @param params - SQL parameters
   * @returns Query result as type T
   * @throws {AppError} If database index query fails
   */
  private async executeIndexQuery<T>(query: string, params: SqlParams = []): Promise<T> {
    try {
      const result = this.indexDb!.prepare(query).all(...params);
      return result as T;
    } catch (error) {
      const appError = new AppError(
        'DATABASE_INDEX_QUERY_ERROR',
        `Failed to execute index query: ${error instanceof Error ? error.message : String(error)}`,
        500,
        { query, params, originalError: error }
      );
      logger.error('MemoryRouter', 'Database index query failed', appError);
      throw appError;
    }
  }

  /**
   * Initialize database connections.
   *
   * Opens connections to the project database and global index database.
   * Both databases are opened in read-only mode for safety.
   *
   * @throws {Error} If database files cannot be opened
   *
   * @example
   * ```ts
   * const router = new MemoryRouter({ currentProject: '/path/to/project' });
   * await router.init();
   * ```
   */
  async init(): Promise<void> {
    // Check if we're running in Bun
    if (!isBun) {
      this.initialized = true;
      return;
    }

    // Lazy load bun:sqlite
    const bunSqlite = eval("require('bun:sqlite')");
    const { Database } = bunSqlite;

    // Note: this router is intended for local/dev runtime contexts.
    const projectDbPath = join(this.config.currentProject, '.oc', 'memory.db');
    if (existsSync(projectDbPath)) {
      this.projectDb = new Database(projectDbPath, { readonly: true });
      this.projectDb.exec('PRAGMA busy_timeout = 5000');
    }

    const indexDbPath = join(homedir(), '.oc', 'index.db');
    if (existsSync(indexDbPath)) {
      this.indexDb = new Database(indexDbPath, { readonly: true });
      this.indexDb.exec('PRAGMA busy_timeout = 5000');
    }

    this.initialized = true;
  }

  /**
   * Query observations based on scope.
   *
   * Routes queries to the appropriate database based on the specified scope:
   * - 'branch': Query current project DB, filter by branch
   * - 'project': Query current project DB, all branches
   * - 'global': Query global index, then fan-out to project DBs
   *
   * @param searchQuery - Full-text search query (optional)
   * @param options - Query options including scope, types, limit, filters
   * @returns Array of matching observations
   * @throws {Error} If scope is invalid
   *
   * @example
   * ```ts
   * const results = await router.query('retry logic', {
   *   scope: 'project',
   *   types: ['decision', 'problem-solution'],
   *   limit: 50
   * });
   * ```
   */
  async query(
    searchQuery: string,
    options: QueryOptions = { scope: 'project' }
  ): Promise<Observation[]> {
    if (!this.initialized) {
      await this.init();
    }

    const { scope, types, limit = DEFAULT_OBSERVATION_LIMIT, since, importance } = options;

    switch (scope) {
      case 'branch':
        return this.queryBranch(searchQuery, { types, limit, since, importance });
      case 'project':
        return this.queryProject(searchQuery, { types, limit, since, importance });
      case 'global':
        return this.queryGlobal(searchQuery, { types, limit, since, importance });
      default:
        throw new Error(`Unknown scope: ${scope}`);
    }
  }

  /**
   * Query observations for a specific branch.
   *
   * @private
   * @param searchQuery - Full-text search query (optional)
   * @param opts - Query options (types, limit, since, importance)
   * @returns Array of matching observations for the branch
   */
  private async queryBranch(
    searchQuery: string,
    opts: Omit<QueryOptions, 'scope'>
  ): Promise<Observation[]> {
    if (!this.projectDb) return [];

    const branch = this.config.currentBranch ?? 'main';
    const params: SqlParams = [branch];

    // Use generated columns for O(1) performance
    let sql = `
      SELECT o.*,
             bm25(observations_fts) as relevance
      FROM observations o
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE o.meta_branch = ?
    `;

    if (searchQuery) {
      sql += ` AND observations_fts MATCH ?`;
      params.push(searchQuery);
    }

    if (opts.types?.length) {
      sql += ` AND o.type IN (${opts.types.map(() => '?').join(',')})`;
      params.push(...opts.types);
    }

    if (opts.importance) {
      sql += ` AND o.meta_importance = ?`;
      params.push(opts.importance);
    }

    if (opts.since) {
      sql += ` AND o.created_at >= ?`;
      params.push(opts.since);
    }

    sql += ` ORDER BY relevance LIMIT ?`;
    params.push(opts.limit ?? DEFAULT_OBSERVATION_LIMIT);

    return this.executeQuery<Observation[]>(sql, params);
  }

  /**
   * Query observations for the entire project.
   *
   * @private
   * @param searchQuery - Full-text search query (optional)
   * @param opts - Query options (types, limit, since, importance)
   * @returns Array of matching observations for the project
   */
  private async queryProject(
    searchQuery: string,
    opts: Omit<QueryOptions, 'scope'>
  ): Promise<Observation[]> {
    if (!this.projectDb) return [];

    const params: SqlParams = [];
    let sql = `
      SELECT o.*,
             bm25(observations_fts) as relevance
      FROM observations o
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE 1=1
    `;

    if (searchQuery) {
      sql += ` AND observations_fts MATCH ?`;
      params.push(searchQuery);
    }

    if (opts.types?.length) {
      sql += ` AND o.type IN (${opts.types.map(() => '?').join(',')})`;
      params.push(...opts.types);
    }

    if (opts.importance) {
      sql += ` AND o.meta_importance = ?`;
      params.push(opts.importance);
    }

    if (opts.since) {
      sql += ` AND o.created_at >= ?`;
      params.push(opts.since);
    }

    // Exclude archived observations by default
    sql += ` AND o.meta_archived_at IS NULL`;

    sql += ` ORDER BY relevance LIMIT ?`;
    params.push(opts.limit ?? DEFAULT_OBSERVATION_LIMIT);

    return this.executeQuery<Observation[]>(sql, params);
  }

  /**
   * Query observations across all projects globally.
   *
   * Uses the materialized global index for O(1) cross-project search.
   * Falls back to project-only query if index doesn't exist.
   *
   * @private
   * @param searchQuery - Full-text search query (optional)
   * @param opts - Query options (types, limit, since, importance)
   * @returns Array of matching observations from all projects
   */
  private async queryGlobal(
    searchQuery: string,
    opts: Omit<QueryOptions, 'scope'>
  ): Promise<Observation[]> {
    if (!this.indexDb) {
      // Fallback to project-only query if index doesn't exist
      return this.queryProject(searchQuery, opts);
    }

    // PF-002: Query the Materialized Global Index for O(1) cross-project search
    const params: SqlParams = [];
    let sql = `
      SELECT o.*,
             p.absolute_path as source_project,
             p.display_name as project_name,
             bm25(observations_fts) as relevance
      FROM observations o
      JOIN projects p ON o.project_uuid = p.project_uuid
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE 1=1
    `;

    if (searchQuery) {
      sql += ` AND observations_fts MATCH ?`;
      params.push(searchQuery);
    }

    if (opts.types?.length) {
      sql += ` AND o.type IN (${opts.types.map(() => '?').join(',')})`;
      params.push(...opts.types);
    }

    if (opts.importance) {
      sql += ` AND o.importance = ?`;
      params.push(opts.importance);
    }

    if (opts.since) {
      sql += ` AND o.created_at >= ?`;
      params.push(opts.since);
    }

    sql += ` ORDER BY relevance LIMIT ?`;
    params.push(opts.limit ?? DEFAULT_OBSERVATION_LIMIT);

    const results = await this.executeIndexQuery<Record<string, unknown>[]>(sql, params);

    // Map global index rows to Observation interface
    return results.map(r => ({
      id: r.id as number,
      memory_session_id: 'global',
      project: r.project_name as string,
      type: r.type as string,
      title: r.title as string,
      narrative: r.narrative as string | undefined,
      created_at: r.created_at as string,
      meta_importance: r.importance as string | undefined,
      meta_branch: r.branch as string | undefined,
      deontic_type: r.deontic_type as string | undefined,
      source_project: r.source_project as string | undefined
    }));
  }

  /**
   * Close database connections.
   *
   * Closes both project and index database connections and resets state.
   * Should be called when the router is no longer needed.
   *
   * @example
   * ```ts
   * const router = new MemoryRouter({ currentProject: '/path/to/project' });
   * await router.init();
   * // ... use router
   * router.close();
   * ```
   */
  close(): void {
    this.projectDb?.close();
    this.indexDb?.close();
    this.projectDb = null;
    this.indexDb = null;
    this.initialized = false;
  }
}
