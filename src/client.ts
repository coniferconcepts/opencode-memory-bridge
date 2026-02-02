/**
 * HTTP client for claude-mem local service integration
 * 
 * Provides a validated, type-safe interface to the claude-mem Bun worker
 * running on localhost:37777. Implements graceful degradation when the
 * service is unavailable.
 * 
 * @see https://github.com/thedotmack/claude-mem
 * @version Aligned with claude-mem v9.0.4
 */

import * as v from 'valibot';
import { logger } from './logger.js';
import { ensureWorkerRunning } from './lifecycle.js';
import type { MemoryRouter } from './router.js';
import {
  MemoryQuerySchema,
  MemorySearchResponseSchema,
  ContextQuerySchema,
  ContextResponseSchema,
  HealthResponseSchema,
  ClaudeMemConfigSchema,
  ApiErrorSchema,
  type MemoryQuery,
  type MemorySearchResponse,
  type ContextQuery,
  type ContextResponse,
  type HealthResponse,
  type ClaudeMemConfig,
} from './schemas.js';

import {
  CLAUDE_MEM_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_OBSERVATION_LIMIT,
} from './constants.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when claude-mem service is unavailable
 */
export class ClaudeMemUnavailableError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ClaudeMemUnavailableError';
  }
}

/**
 * Error thrown when claude-mem API returns an error response
 */
export class ClaudeMemApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ClaudeMemApiError';
  }
}

/**
 * Error thrown when response validation fails
 */
export class ClaudeMemValidationError extends Error {
  constructor(message: string, public readonly issues: v.BaseIssue<unknown>[]) {
    super(message);
    this.name = 'ClaudeMemValidationError';
  }
}

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * HTTP client for claude-mem local service integration
 */
export class ClaudeMemClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly debug: boolean;
  private readonly project?: string;
  private readonly logger = logger.child('[claude-mem]');

  // Lazily used for fallback when worker API is unavailable.
  private memoryRouter?: MemoryRouter;

  constructor(config?: ClaudeMemConfig) {
    const validated = v.parse(ClaudeMemConfigSchema, config ?? {});
    
    this.baseUrl = validated.baseUrl ?? CLAUDE_MEM_BASE_URL;
    this.timeout = validated.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = validated.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.debug = validated.debug ?? false;
    this.project = validated.project;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Check claude-mem service health
   * 
   * @returns Health status including version, uptime, and database stats
   * @throws {ClaudeMemUnavailableError} If service is not reachable
   */
  async health(): Promise<HealthResponse> {
    const response = await this.fetch('/api/health');
    return this.validate(HealthResponseSchema, response);
  }

  /**
   * Check if claude-mem service is available
   * 
   * @returns true if service is healthy, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.health();
      return health.status === 'ok' || health.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Search memory observations (structured data)
   * 
   * @param query - Search parameters
   * @returns Matching observations with metadata
   * @throws {ClaudeMemUnavailableError} If service is not reachable
   * @throws {ClaudeMemValidationError} If response validation fails
   */
  async search(query: MemoryQuery): Promise<MemorySearchResponse> {
    const validated = v.parse(MemoryQuerySchema, query);

    // Add default project if not specified
    if (!validated.project && this.project) {
      validated.project = this.project;
    }

    // Prefer worker API (ChromaDB). If it can't be started/reached, fall back to
    // local FTS5 via MemoryRouter.
    const workerReady = await ensureWorkerRunning();
    if (workerReady) {
      try {
        const params = new URLSearchParams();
        if (validated.query) params.append('query', validated.query);
        if (validated.project) params.append('project', validated.project);
        if (validated.limit) params.append('limit', String(validated.limit));
        if (validated.types) params.append('types', validated.types.join(','));

        const response = await this.fetch(`/api/search/observations?${params.toString()}`);

        // The response from /api/search/observations is {"content": [{"type": "text", "text": "..."}]}
        return this.validate(MemorySearchResponseSchema, response);
      } catch (error) {
        if (!(error instanceof ClaudeMemUnavailableError)) {
          throw error;
        }

        if (this.debug) {
          this.logger.warn('Worker search unavailable; falling back to router', {
            error: error.message,
          });
        }
        // fall through to router
      }
    }

    // Fallback: native router (Bun-only). Best-effort: if router isn't usable in
    // the current runtime, rethrow the worker error.
    try {
      return this.searchViaRouter(validated);
    } catch (error) {
      throw new ClaudeMemUnavailableError(
        'claude-mem worker unavailable and native router fallback failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Record a new observation in memory.
   * 
   * ## Rationale: Source Tagging
   * 
   * All OpenCode observations include `source: 'opencode'` to:
   * 1. Distinguish from Claude Code observations in shared database
   * 2. Enable source-based filtering in queries
   * 3. Track observation origin for debugging
   * 4. Support gradual migration between environments
   * 
   * The `facts` JSON field contains:
   * - `source`: 'opencode' (constant)
   * - `source_version`: 'opencode/2.0.0' (for compatibility tracking)
   * - User-provided metadata
   * 
   * @see plans/2026-01-10-claude-mem-local-native-strategy.md (Appendix G.5)
   * @param observation - Observation data
   */
  async observe(observation: {
    type: string;
    title: string;
    content: string;
    project?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const workerReady = await ensureWorkerRunning();
    if (!workerReady) {
      throw new ClaudeMemUnavailableError(
        'claude-mem worker is not available; observe() requires the worker API'
      );
    }

    const now = new Date().toISOString();
    const sessionId = `opencode-manual-${Date.now()}`;
    
    const payload = {
      sessions: [{
        content_session_id: sessionId,
        memory_session_id: sessionId,
        project: observation.project ?? this.project ?? 'unknown',
        user_prompt: observation.title,
        started_at: now,
        started_at_epoch: Date.now(),
        completed_at: null,
        completed_at_epoch: null,
        status: 'completed'
      }],
      observations: [{
        memory_session_id: sessionId,
        project: observation.project ?? this.project ?? 'unknown',
        type: observation.type,
        title: observation.title,
        subtitle: null,
        narrative: observation.content,
        text: null,
        facts: JSON.stringify({
          source: 'opencode',
          ...observation.metadata
        }),
        concepts: null,
        files_read: null,
        files_modified: null,
        prompt_number: 1,
        discovery_tokens: 0,
        created_at: now,
        created_at_epoch: Date.now(),
      }]
    };

    await this.fetch('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Search memory and return markdown content
   * 
   * @param query - Search query string
   * @returns Markdown content items
   */
  async searchMarkdown(query: string, limit = 20): Promise<ContextResponse> {
    const workerReady = await ensureWorkerRunning();
    if (workerReady) {
      try {
        const params = new URLSearchParams({ query, limit: String(limit) });
        const response = await this.fetch(`/api/search?${params.toString()}`);
        return this.validate(ContextResponseSchema, response);
      } catch (error) {
        if (!(error instanceof ClaudeMemUnavailableError)) {
          throw error;
        }

        if (this.debug) {
          this.logger.warn('Worker markdown search unavailable; falling back to router', {
            error: error.message,
          });
        }
        // fall through
      }
    }

    // Best-effort fallback: render results from router.
    const obsResp = await this.searchViaRouter({ query, limit });
    return {
      content: obsResp.content,
    };
  }

  /**
   * Get formatted context for injection into agent prompts
   * 
   * @param query - Context retrieval parameters
   * @returns Formatted context string with metadata
   * @throws {ClaudeMemUnavailableError} If service is not reachable
   */
  async getContext(query: ContextQuery): Promise<ContextResponse> {
    const validated = v.parse(ContextQuerySchema, query);

    const workerReady = await ensureWorkerRunning();
    if (workerReady) {
      try {
        const params = new URLSearchParams({
          project: validated.project,
          limit: String(validated.limit ?? DEFAULT_OBSERVATION_LIMIT),
        });

        const response = await this.fetch(`/api/context/recent?${params.toString()}`);
        return this.validate(ContextResponseSchema, response);
      } catch (error) {
        if (!(error instanceof ClaudeMemUnavailableError)) {
          throw error;
        }

        if (this.debug) {
          this.logger.warn('Worker context unavailable; falling back to router', {
            error: error.message,
          });
        }
        // fall through to router
      }
    }

    try {
      return this.getContextViaRouter(validated);
    } catch (error) {
      throw new ClaudeMemUnavailableError(
        'claude-mem worker unavailable and native router fallback failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Assemble full context (Spatial + Deep) in parallel.
   * 
   * **New in v3.0 (@gemini-pro-max feedback)**
   * 
   * @param project - Project name
   * @param limit - Deep memory observation limit
   * @returns Combined context object
   */
  async assembleContext(project: string, limit = DEFAULT_OBSERVATION_LIMIT) {
    const [spatial, deep] = await Promise.all([
      this.getSpatialContext(),
      this.getContext({ project, limit })
    ]);

    return {
      spatial,
      deep,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get spatial context from local CLAUDE.md files.
   */
  private async getSpatialContext(): Promise<string> {
    // Spatial context is purely file-based and should be available even if the
    // worker is down.
    try {
      const { cwd, root } = await this.findProjectRoot();
      const paths = await this.getClaudeMdPathsUpToRoot(cwd, root);
      // Use project root for stable path headings.
      return await this.readAndFormatClaudeMdFiles(paths, root);
    } catch (error) {
      if (this.debug) {
        this.logger.warn('Failed to read spatial CLAUDE.md context', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return '';
    }
  }

  // ===========================================================================
  // Fallback: native router (FTS5)
  // ===========================================================================

  private async getOrCreateRouter(projectPath?: string): Promise<MemoryRouter> {
    if (!this.memoryRouter) {
      // Dynamic import to avoid loading local router dependencies in non-local runtimes.
      // NOTE: If this is executed under Workers or unsupported contexts, it may throw.
      // Callers should wrap fallback usage and degrade gracefully.
      const mod = await import('./router.js');

      const rootPath = projectPath ?? (await this.findProjectRoot()).root;

      this.memoryRouter = new mod.MemoryRouter({
        // MemoryRouter expects a filesystem path to the project root (where .oc lives).
        currentProject: rootPath,
        // TODO: plumb in currentBranch if/when we have it.
      });
      // init() is idempotent, but query() also self-inits now.
      await this.memoryRouter.init();
    }

    return this.memoryRouter;
  }

  private normalizeTypes(types?: string[]): string[] | undefined {
    const cleaned = types?.map((t) => t.trim()).filter(Boolean);
    return cleaned?.length ? cleaned : undefined;
  }

  private async searchViaRouter(query: MemoryQuery): Promise<MemorySearchResponse> {
    const router = await this.getOrCreateRouter();
    const observations = await router.query(query.query, {
      scope: 'project',
      types: this.normalizeTypes(query.types),
      limit: query.limit,
      since: query.since,
    });

    // Shape into the same contract as the worker: { content: [{type:'text', text:'...'}] }
    // Keep it simple: render a compact list (title + narrative).
    const lines = observations.map((o: any) => {
      const title = o?.title ? String(o.title) : '(untitled)';
      const type = o?.type ? String(o.type) : 'observation';
      const createdAt = o?.created_at ? String(o.created_at) : '';
      const narrative = o?.narrative ?? o?.text ?? '';
      const body = narrative ? String(narrative) : '';

      const headerParts = [type, createdAt].filter(Boolean).join(' · ');
      return `- **${title}**${headerParts ? ` (${headerParts})` : ''}\n  ${body}`.trimEnd();
    });

    return {
      content: [
        {
          type: 'text',
          text: lines.length
            ? `## Memory Search (fallback: FTS5)\n\n${lines.join('\n\n')}`
            : `## Memory Search (fallback: FTS5)\n\n_No results._`,
        },
      ],
    };
  }

  private async getContextViaRouter(query: ContextQuery): Promise<ContextResponse> {
    const router = await this.getOrCreateRouter();

    // NOTE: ContextQuery in this client currently only supports project + limit.
    // For fallback, treat "context" as a recency view by searching with empty query.
    const observations = await router.query('', {
      scope: 'project',
      limit: query.limit ?? DEFAULT_OBSERVATION_LIMIT,
    });

    const lines = observations.map((o: any) => {
      const title = o?.title ? String(o.title) : '(untitled)';
      const type = o?.type ? String(o.type) : 'observation';
      const createdAt = o?.created_at ? String(o.created_at) : '';
      const narrative = o?.narrative ?? o?.text ?? '';
      const body = narrative ? String(narrative) : '';

      const headerParts = [type, createdAt].filter(Boolean).join(' · ');
      return `- **${title}**${headerParts ? ` (${headerParts})` : ''}\n  ${body}`.trimEnd();
    });

    return {
      content: [
        {
          type: 'text',
          text: lines.length
            ? `## Recent Memory (fallback: FTS5)\n\n${lines.join('\n\n')}`
            : `## Recent Memory (fallback: FTS5)\n\n_No observations found._`,
        },
      ],
    };
  }

  // ===========================================================================
  // Spatial context helpers
  // ===========================================================================

  /**
   * Identify project root for spatial CLAUDE.md discovery.
   *
   * Missing info: how the "project root" is defined in your environment.
   * Current heuristic (best-effort):
   * - Prefer nearest ancestor containing .git
   * - Else nearest ancestor containing package.json
   * - Else stop at filesystem root
   */
  private async findProjectRoot(): Promise<{ cwd: string; root: string }> {
    const { existsSync } = await import('fs');
    const { dirname, join } = await import('path');

    const cwd = process.cwd();
    let current = cwd;

    while (true) {
      if (existsSync(join(current, '.git'))) return { cwd, root: current };
      if (existsSync(join(current, 'package.json'))) return { cwd, root: current };

      const parent = dirname(current);
      if (parent === current) {
        return { cwd, root: current };
      }
      current = parent;
    }
  }

  /**
   * Collect CLAUDE.md files from cwd upward to root.
   *
   * Order: root -> ... -> cwd (so deeper folder instructions override/augment).
   */
  private async getClaudeMdPathsUpToRoot(cwd: string, root: string): Promise<string[]> {
    // Keep logic deterministic (no fs reads), but avoid `require()` in ESM.
    const { dirname, join } = await import('path');

    const chain: string[] = [];
    let current = cwd;

    while (true) {
      chain.push(current);
      if (current === root) break;

      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }

    // Convert directories to CLAUDE.md file paths and reverse.
    return chain
      .map((dir) => join(dir, 'CLAUDE.md'))
      .reverse();
  }

  /**
   * Read multiple CLAUDE.md files and format as a single markdown block.
   *
   * Formatting:
   * - Each file is wrapped in a heading with its relative path from cwd.
   * - Empty/missing files are skipped.
   */
  private async readAndFormatClaudeMdFiles(filePaths: string[], baseDir: string): Promise<string> {
    const { readFileSync, existsSync } = await import('fs');
    const { relative } = await import('path');

    const sections: string[] = [];

    for (const p of filePaths) {
      if (!existsSync(p)) continue;

      const raw = readFileSync(p, 'utf-8');
      const content = raw.trim();
      if (!content) continue;

      // Use a stable relative path label for the file.
      const rel = relative(baseDir, p) || 'CLAUDE.md';
      sections.push(`### ${rel}\n\n${content}`);
    }

    if (!sections.length) return '';

    return `## Spatial Context (CLAUDE.md)\n\n${sections.join('\n\n')}`;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Make HTTP request to claude-mem service with retry logic
   */
  private async fetch(path: string, options?: RequestInit): Promise<unknown> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.fetchOnce(path, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on validation errors or API errors
        if (
          error instanceof ClaudeMemValidationError ||
          error instanceof ClaudeMemApiError
        ) {
          throw error;
        }
        
        // Exponential backoff for retries
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          if (this.debug) {
            this.logger.warn(`Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          }
          await this.sleep(delay);
        }
      }
    }
    
    throw new ClaudeMemUnavailableError(
      `claude-mem service unavailable after ${this.maxRetries + 1} attempts`,
      lastError
    );
  }

  /**
   * Make single HTTP request with timeout
   */
  private async fetchOnce(path: string, options?: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseUrl}${path}`;
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Try to parse as API error
        const parseResult = v.safeParse(ApiErrorSchema, data);
        if (parseResult.success) {
          throw new ClaudeMemApiError(
            parseResult.output.message,
            parseResult.output.code,
            response.status,
            parseResult.output.details
          );
        }
        
        throw new ClaudeMemApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ClaudeMemApiError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ClaudeMemUnavailableError(
            `Request timeout after ${this.timeout}ms`
          );
        }
        
        // Connection refused, network error, etc.
        if (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('fetch failed') ||
          error.message.includes('network')
        ) {
          throw new ClaudeMemUnavailableError(
            'claude-mem service not running. Start with: npm run claude-mem:start',
            error
          );
        }
      }
      
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Validate response against schema
   */
  private validate<T>(schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>, data: unknown): T {
    const result = v.safeParse(schema, data);
    
    if (!result.success) {
      throw new ClaudeMemValidationError(
        `Invalid response from claude-mem: ${result.issues.map(i => i.message).join(', ')}`,
        result.issues
      );
    }
    
    return result.output;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a claude-mem client with default configuration
 */
export function createClaudeMemClient(config?: ClaudeMemConfig): ClaudeMemClient {
  return new ClaudeMemClient(config);
}

/**
 * Create a claude-mem client configured for the current project
 * 
 * @param projectName - Project name (defaults to directory name)
 */
export function createProjectClient(projectName?: string): ClaudeMemClient {
  const project = projectName ?? process.cwd().split('/').pop() ?? 'unknown';
  return new ClaudeMemClient({ project });
}
