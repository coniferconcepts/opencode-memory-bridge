/**
 * Shared constants for claude-mem integration.
 * 
 * ## Rationale: Single Source of Truth (DRY)
 * 
 * These constants are consumed by:
 * - `src/integrations/claude-mem/client.ts` (TypeScript module)
 * - `src/integrations/claude-mem/lifecycle.ts` (Worker management)
 * - `.opencode/plugin/claude-mem-bridge.ts` (OpenCode plugin)
 * 
 * Centralizing prevents drift between the TypeScript module and OpenCode plugin.
 * 
 * @module src/integrations/claude-mem/constants
 * @see plans/2026-01-10-claude-mem-local-native-strategy.md
 */

// =============================================================================
// Network Configuration
// =============================================================================

/**
 * Default port for claude-mem HTTP service.
 * 
 * **Why 37777?** This is the upstream default from thedotmack/claude-mem.
 * Using the same port ensures compatibility with Claude Code's plugin.
 */
export const CLAUDE_MEM_PORT = 37777;

/**
 * Base URL for claude-mem HTTP API.
 */
export const CLAUDE_MEM_BASE_URL = `http://localhost:${CLAUDE_MEM_PORT}`;

// =============================================================================
// Timeout Configuration
// =============================================================================

/**
 * Default timeout for HTTP requests to claude-mem (milliseconds).
 * 
 * **Why 5000ms?** Balances responsiveness with allowing time for:
 * - SQLite queries on large databases
 * - Vector similarity searches
 * - Cold start scenarios
 */
export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Health check timeout (milliseconds).
 * 
 * **Why 2000ms?** Health checks should be fast. If the service
 * can't respond in 2s, it's effectively unavailable.
 */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/**
 * Worker startup timeout (milliseconds).
 * 
 * **Why 5000ms?** Bun worker needs time to:
 * - Initialize SQLite connection
 * - Load vector database
 * - Start HTTP server
 */
export const WORKER_STARTUP_TIMEOUT_MS = 5000;

/**
 * Maximum retry attempts for HTTP requests.
 */
export const DEFAULT_MAX_RETRIES = 3;

// =============================================================================
// SQLite Configuration (@gemini-pro-max feedback)
// =============================================================================

/**
 * SQLite PRAGMA settings for robust concurrent access.
 * 
 * **Why these settings?**
 * - `journal_mode=WAL`: Write-Ahead Logging enables concurrent reads during writes
 * - `busy_timeout=5000`: Wait up to 5s for locks instead of failing immediately
 * - `synchronous=NORMAL`: Balance between safety and performance
 * 
 * @see https://www.sqlite.org/wal.html
 */
export const SQLITE_PRAGMAS = {
  journal_mode: 'WAL',
  busy_timeout: 5000,
  synchronous: 'NORMAL',
} as const;

/**
 * SQLite transaction mode for write operations.
 * 
 * **Why BEGIN IMMEDIATE?** Acquires write lock at transaction start,
 * preventing deadlocks when multiple processes compete for writes.
 */
export const SQLITE_WRITE_TRANSACTION = 'BEGIN IMMEDIATE';

// =============================================================================
// Performance Configuration (@gemini-pro-max/@gpt5 feedback)
// =============================================================================

/**
 * Debounce delay for file-change observations (milliseconds).
 * 
 * **Why 500ms?** Prevents observation spam during rapid file saves
 * (e.g., auto-save, batch operations). Groups related changes.
 */
export const FILE_CHANGE_DEBOUNCE_MS = 500;

/**
 * LRU cache size for summary results.
 * 
 * **Why 100?** Balances memory usage with cache hit rate for
 * frequently accessed summaries.
 */
export const SUMMARY_CACHE_SIZE = 100;

/**
 * Summary cache TTL (milliseconds).
 * 
 * **Why 5 minutes?** Summaries are expensive to compute but
 * don't change frequently. 5 min provides good cache utilization.
 */
export const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;

// =============================================================================
// Context Manifest Configuration (v3.0 - @codex-max feedback)
// =============================================================================

/**
 * Maximum token budget for subagent Deep Memory.
 * 
 * **Why 3500?** Aligned with official Claude Mem standards.
 * Supports 50 observations with progressive disclosure (5 full + 45 index)
 * plus 10 session summaries for rich context injection.
 * 
 * @see docs/CLAUDE_MEM_IMPLEMENTATION_COMPARISON.md
 */
export const SUBAGENT_MEMORY_TOKEN_BUDGET = 3500;

/**
 * Maximum observations in a Context Manifest.
 * 
 * **Why 50?** Matches official Claude Mem standard for context injection.
 * Fetches last 50 observations across last 10 sessions.
 * 
 * @see docs/CLAUDE_MEM_OFFICIAL_REFERENCE.md
 */
export const MANIFEST_MAX_OBSERVATIONS = 50;

/**
 * Number of observations to show with full details (progressive disclosure).
 * 
 * **Why 5?** Official Claude Mem uses progressive disclosure:
 * - Top 5 observations: Full narrative/facts (~1,500 tokens)
 * - Remaining 45: Compact index table (~800 tokens)
 * This saves ~60% tokens vs showing all 50 with full details.
 * 
 * @see docs/CLAUDE_MEM_IMPLEMENTATION_COMPARISON.md
 */
export const CONTEXT_FULL_COUNT = 5;

/**
 * Maximum number of sessions to query for context injection.
 * 
 * **Why 10?** Official Claude Mem standard - pulls observations
 * from last 10 sessions for continuity.
 */
export const CONTEXT_SESSION_COUNT = 10;

/**
 * Maximum session summaries to include in context injection.
 * 
 * **Why 10?** Official Claude Mem standard for session summaries.
 * Provides high-level context across recent sessions.
 */
export const MAX_SESSION_SUMMARIES = 10;

/**
 * Critical observation types that are always fully loaded.
 * 
 * **Why these types?** These represent hard constraints that
 * subagents must respect regardless of task focus.
 */
export const CRITICAL_OBSERVATION_TYPES = new Set([
  'decision',
  'gotcha',
  'deontic', // MUST/NEVER directives
]);

// =============================================================================
// Tool Filtering
// =============================================================================

/**
 * Tools that represent a significant state change or decision.
 * 
 * **Why these?** These tools directly modify the project or represent
 * high-level orchestration that should be remembered immediately.
 */
export const HIGH_VALUE_TOOLS = new Set([
  'write',
  'edit',
  'task',
]);

/**
 * Tools that provide context but are too noisy for individual observations.
 * 
 * **Why aggregate?** These are captured in the session transcript and
 * will be synthesized into the final session summary.
 */
export const AGGREGATE_TOOLS = new Set([
  'read',
  'grep',
  'ls',
  'glob',
  'codesearch',
  'websearch',
  'webfetch',
  'todoread',
]);

// =============================================================================
// Selective Read Operation Capture (Task 2.3)
// =============================================================================

/**
 * File patterns that should trigger immediate observation capture.
 * These represent high-value project files that reveal intent and architecture.
 *
 * **Why selective capture?** Read operations are very frequent and noisy.
 * This pattern list focuses capture on files that matter most for understanding
 * project context, architecture, and configuration.
 */
export const IMPORTANT_FILE_PATTERNS = [
  // Project documentation
  /CLAUDE\.md$/i,
  /README\.md$/i,
  /CONTRIBUTING\.md$/i,
  /ARCHITECTURE\.md$/i,
  /ADR.*\.md$/i,  // Architecture Decision Records

  // Configuration files
  /package\.json$/,
  /tsconfig\.json$/,
  /\.env$/,
  /\.env\./,
  /config\.(ts|js|json)$/,
  /wrangler\.toml$/,

  // Schema and types
  /schema\.(ts|js|sql)$/,
  /types\.(ts|js)$/,
  /\.d\.ts$/,

  // Source files (limited to avoid noise)
  /src\/.*\.(ts|js)$/,

  // Build and deployment
  /Dockerfile$/,
  /\.github\/workflows\//,
  /deploy\.(ts|js|sh)$/,
];

/**
 * File patterns that should NEVER trigger observation capture.
 * These are noisy, generated, or temporary files.
 *
 * **Priority:** SKIP_FILE_PATTERNS are checked BEFORE IMPORTANT_FILE_PATTERNS.
 * This ensures that even if a file matches an important pattern, if it's in
 * a skip directory (like node_modules), it will still be skipped.
 */
export const SKIP_FILE_PATTERNS = [
  // Dependencies
  /node_modules\//,
  /\.pnpm\//,
  /\.yarn\//,

  // Build outputs
  /dist\//,
  /build\//,
  /\.next\//,
  /\.cache\//,
  /\.turbo\//,

  // Generated files
  /\.map$/,
  /\.min\.(js|css)$/,

  // Temporary files
  /\.tmp$/,
  /\.temp$/,
  /\.bak$/,
  /\.swp$/,

  // Test snapshots and fixtures
  /__snapshots__\//,
  /fixtures\//,
  /\.test\.(ts|js)$/,
  /\.spec\.(ts|js)$/,
];

/**
 * Check if a read operation should be captured based on file path.
 *
 * **Priority order:**
 * 1. Skip patterns take precedence (return false immediately)
 * 2. Then check important patterns (return true if matched)
 * 3. Default: skip (return false)
 *
 * @param filePath - The file path to evaluate
 * @returns true if the file should be captured, false otherwise
 */
export function shouldCaptureRead(filePath: string): boolean {
  if (!filePath) return false;

  // 1. First check skip patterns (takes precedence)
  if (SKIP_FILE_PATTERNS.some(pattern => pattern.test(filePath))) {
    return false;
  }

  // 2. Then check important patterns
  if (IMPORTANT_FILE_PATTERNS.some(pattern => pattern.test(filePath))) {
    return true;
  }

  // 3. Default: skip
  return false;
}

/**
 * Tools to skip entirely.
 */
export const SKIP_TOOLS = new Set([
  'ListMcpResourcesTool',
  'SlashCommand',
  'Skill',
  'TodoWrite',
  'AskUserQuestion', 'question', 'AskUser',
]);

/**
 * Check if a tool should be skipped for observation capture.
 */
export function shouldSkipTool(toolName: string): boolean {
  return SKIP_TOOLS.has(toolName);
}

/**
 * Check if a tool execution should trigger an immediate AI-powered observation.
 *
 * **Task 2.3 Integration:** Read operations are now selectively captured based on
 * file importance, preventing noisy observations while preserving critical context.
 */
export function shouldExtractImmediately(toolName: string, args: any): boolean {
  if (HIGH_VALUE_TOOLS.has(toolName)) return true;

  // NEW: Special case for read: extract if important file
  if (toolName === 'read' && args?.file_path) {
    return shouldCaptureRead(args.file_path);
  }

  // Special case for bash: only extract if it looks like a state-changing command
  if (toolName === 'bash' && args?.command) {
    const cmd = args.command.toLowerCase();
    const stateChangingPatterns = [
      'git commit', 'git push', 'git merge', 'git branch',
      'npm install', 'npm uninstall', 'npm run deploy',
      'wrangler deploy', 'wrangler secret',
      'mkdir', 'rm ', 'mv ', 'cp ',
    ];
    return stateChangingPatterns.some(p => cmd.includes(p));
  }

  return false;
}

/**
 * File paths to completely ignore from event logging.
 *
 * **Why ignore these?** These patterns generate high-frequency events that
 * create noise without providing useful signal:
 * - .git/* files: Constant churn from git operations
 * - node_modules/: Generated dependencies, never user code
 * - Built/cache files: Temporary artifacts
 * - Editor files: Vim/Emacs swap files, LSP caches
 *
 * These will be silently skipped from file.watcher events.
 */
export const IGNORED_FILE_PATTERNS = [
  // Git internal files
  /\.git\/index\.lock$/,           // Git lock file (most noisy)
  /\.git\/objects\//,              // Git object storage
  /\.git\/refs\//,                 // Git references
  /\.git\/HEAD$/,
  /\.git\/logs\//,

  // Dependencies & build
  /node_modules\//,                // Never user code
  /\.cache\//,                     // Build cache
  /\.next\//,                      // Next.js cache
  /dist\//,                        // Build output
  /\.turbo\//,                     // Turbo build cache
  /\.vercel\//,                    // Vercel build cache

  // Editor & OS
  /\.DS_Store$/,                   // macOS folder metadata
  /Thumbs\.db$/,                   // Windows thumbnails
  /~$/,                            // Vim swap files
  /\.swp$/,                        // Vim swap files
  /\.swo$/,                        // Vim swap files
  /\.swn$/,                        // Vim swap files
  /\.emacs\.d\//,                  // Emacs cache
  /\.lsp\//,                       // LSP cache

  // IDE
  /\.vscode\//,
  /\.idea\//,
  /\.eclipse\//,

  // Misc temporary
  /\.tmp$/,
  /\.temp$/,
  /\.bak$/,
];

/**
 * Check if a file path should be ignored from event logging.
 */
export function shouldIgnoreFileEvent(filePath: string): boolean {
  return IGNORED_FILE_PATTERNS.some(pattern => pattern.test(filePath));
}


// =============================================================================
// Observation Recording Filter (Noise Reduction)
// =============================================================================

/**
 * Patterns that indicate a transactional tool operation that shouldn't be recorded.
 *
 * **Why filter these?** These are read-only operations that don't represent
 * meaningful state changes or decisions. They're captured in session summaries.
 *
 * **Note**: User prompts (Prompt:, User:) are NOT filtered - they're valuable context.
 */
export const SKIP_TITLE_PATTERNS = [
  /^read:/i,
  /^grep:/i,
  /^bash:/i,
  /^glob:/i,
  /^write:/i,       // Write is high-value for AI extraction, but fallback titles are noisy
  /^edit:/i,        // Same - AI extraction captures the value, not the fallback
  /^ls:/i,
  /^TodoWrite:/i,
  /^Untitled \(/,   // Generic fallback titles
];

/**
 * Tools that represent user input and should ALWAYS be recorded.
 *
 * **Why?** User prompts are valuable context for understanding session flow
 * and reviewing what was asked. This matches official Claude Mem behavior.
 */
export const ALWAYS_RECORD_TOOLS = new Set([
  'user_prompt',
  'command',        // Slash commands
  'session_summary', // Session summaries are always valuable
]);

/**
 * Minimum narrative length to be considered substantive.
 *
 * **Why 100 chars?** Short narratives like "Read a file" or "Executed bash"
 * don't provide meaningful context. Substantive observations explain WHY.
 */
export const MIN_NARRATIVE_LENGTH = 100;

/**
 * Observation types that are always recorded regardless of narrative length.
 *
 * **Why?** Decisions, bugfixes, and features represent critical state changes
 * that should never be filtered out.
 */
export const ALWAYS_RECORD_TYPES = new Set([
  'decision',
  'bugfix',
  'feature',
]);

/**
 * Counter for tracking filtered observations (debugging/monitoring).
 */
let filteredObservationCount = 0;

/**
 * Get the count of filtered observations for monitoring.
 */
export function getFilteredObservationCount(): number {
  return filteredObservationCount;
}

/**
 * Reset the filtered observation counter (for testing).
 */
export function resetFilteredObservationCount(): void {
  filteredObservationCount = 0;
}

/**
 * Filter function to determine if an observation should be recorded.
 *
 * Called BEFORE outbox.push() to prevent low-value observations from
 * polluting the memory database.
 *
 * @param tool - Tool name (e.g., 'read', 'user_prompt')
 * @param title - Observation title
 * @param narrative - Observation narrative
 * @param type - Observation type (decision, discovery, etc.)
 * @returns true if observation should be recorded, false to skip
 */
export function shouldRecordObservation(
  tool?: string,
  title?: string,
  narrative?: string,
  type?: string
): boolean {
  // Always record user input (prompts, commands) - valuable context
  if (tool && ALWAYS_RECORD_TOOLS.has(tool)) {
    return true;
  }

  // Always record critical types regardless of other filters
  if (type && ALWAYS_RECORD_TYPES.has(type)) {
    return true;
  }

  // Skip observations with transactional/noisy titles
  if (title && SKIP_TITLE_PATTERNS.some(p => p.test(title))) {
    filteredObservationCount++;
    return false;
  }

  // Require minimum narrative length for substance
  if (!narrative || narrative.trim().length < MIN_NARRATIVE_LENGTH) {
    filteredObservationCount++;
    return false;
  }

  return true;
}

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Prefix for OpenCode session IDs.
 *
 * **Why prefix?** Distinguishes OpenCode sessions from Claude Code sessions
 * in the shared database, enabling source-based filtering.
 */
export const OPENCODE_SESSION_PREFIX = 'opencode';

/**
 * Session stop hook name constant.
 *
 * **Why constant?** Prevents typos and enables IDE autocomplete for hook names.
 * Used for the explicit session termination event (user-initiated stop).
 */
export const HOOK_SESSION_STOP = 'session.stop';

/**
 * Source identifier for OpenCode observations.
 */
export const OPENCODE_SOURCE = 'opencode';

/**
 * Source version string for OpenCode observations.
 */
export const OPENCODE_SOURCE_VERSION = 'opencode/3.0.0';

// =============================================================================
// Content Limits
// =============================================================================

/**
 * Maximum observation content size (characters).
 *
 * **Why 10000?** Balances capturing useful context with:
 * - SQLite storage efficiency
 * - Token limits for summarization
 * - Memory footprint
 */
export const MAX_OBSERVATION_CONTENT_SIZE = 10000;

// =============================================================================
// Observation Limits
// =============================================================================

/**
 * Default number of observations to retrieve.
 */
export const DEFAULT_OBSERVATION_LIMIT = 50;

/**
 * Maximum number of observations allowed per request.
 */
export const MAX_OBSERVATION_LIMIT = 150;

/**
 * Minimum number of observations allowed per request.
 */
export const MIN_OBSERVATION_LIMIT = 1;

/**
 * Maximum error message length for execution metadata (characters).
 *
 * **Why 500?** Limits error message length to prevent memory bloat while
 * preserving enough detail for debugging and analysis.
 */
export const MAX_ERROR_MESSAGE_LEN = 500;

// =============================================================================
// OpenCode Bridge Tuning (Magic Numbers)
// =============================================================================

/**
 * Trigger the local ingestor after this many observations.
 *
 * **Why 25?** Keeps per-project memory reasonably fresh without spawning
 * the ingestor too frequently.
 */
export const INGESTOR_TRIGGER_EVERY_N_OBSERVATIONS = 25;

/**
 * Session checkpoint time-to-live (milliseconds).
 *
 * Checkpoints older than this are ignored to prevent resuming a stale session.
 */
export const CHECKPOINT_TTL_MS = 5 * 60 * 1000;

/**
 * Idle timeout before attempting summarization/flush (minutes).
 */
export const IDLE_TIMEOUT_MINUTES = 15;

/**
 * Default context retrieval limit.
 */
export const DEFAULT_CONTEXT_LIMIT = 50;

// =============================================================================
// Provenance Headers (@gpt5 feedback)
// =============================================================================

/**
 * Header marker for auto-generated CLAUDE.md files.
 * 
 * **Why provenance headers?** Enables safe deletion of generated files
 * while protecting manually-authored documentation.
 */
export const GENERATED_FILE_HEADER = '<!-- AUTO-GENERATED BY claude-mem -->';

/**
 * Check if a file was auto-generated by claude-mem.
 */
export function isGeneratedFile(content: string): boolean {
  return content.trimStart().startsWith(GENERATED_FILE_HEADER);
}

// =============================================================================
// Injection Configuration (@gpt5 feedback)
// =============================================================================

/**
 * Default setting for context injection.
 * 
 * Why false? Prevents accidental memory steering in projects that
 * aren't yet OpenCode-ready (e.g., BounceWorkouts).
 */
export const INJECTION_ENABLED_DEFAULT = false;

/**
 * Default verbosity level for the OpenCode bridge.
 */
export const DEFAULT_VERBOSITY = 'normal';


// =============================================================================
// Deontic Precedence Configuration (v3.0 - @gpt5 feedback)
// =============================================================================

/**
 * Deontic precedence ladder for conflicting directives.
 * 
 * **Why this order?**
 * 1. Root CLAUDE.md: Project-level constraints (highest authority)
 * 2. User directives: Explicit user instructions in current session
 * 3. Memory directives: Historical decisions and patterns
 * 
 * Lower numbers = higher precedence.
 */
export const DEONTIC_PRECEDENCE = {
  root: 1,
  user: 2,
  memory: 3,
} as const;

export type DeonticSource = keyof typeof DEONTIC_PRECEDENCE;

/**
 * Resolve conflicting deontic directives.
 *
 * @param directives - Array of directives with sources
 * @returns Directives sorted by precedence (highest first)
 */
export function resolveDeonticConflicts<T extends { source: DeonticSource }>(
  directives: T[]
): T[] {
  return [...directives].sort(
    (a, b) => DEONTIC_PRECEDENCE[a.source] - DEONTIC_PRECEDENCE[b.source]
  );
}

// =============================================================================
// Hybrid Search Configuration (Task 3.3 - API Layer Integration)
// =============================================================================

/**
 * Feature flags and defaults for hybrid search execution.
 *
 * Controls gradual rollout of advanced search capabilities:
 * - Hybrid scoring: Importance-weighted semantic results (default: enabled)
 * - Relationship expansion: 1-hop neighbor augmentation (default: opt-in for safety)
 *
 * **Why these defaults?**
 * - Hybrid scoring is safe and always beneficial (importance filtering)
 * - Relationship expansion is opt-in to prevent performance surprises
 * - Opt-in approach allows controlled rollout and performance monitoring
 */
export const HYBRID_SEARCH_CONFIG = {
  /** Enable hybrid scoring by default (importance weighting enabled) */
  defaultUseHybridScoring: true,

  /** Relationship expansion is opt-in (careful with performance) */
  defaultExpandByRelationships: false,

  /** Default maximum neighbors per result (limits expansion explosion) */
  defaultMaxNeighborsPerResult: 3,

  /** Safety limit to prevent explosion in result set growth */
  maxExpansionResults: 100,

  /** Default minimum relationship confidence for expansion */
  defaultMinRelationshipConfidence: 0.5,

  /** Default minimum importance score (0-100 scale) */
  defaultMinImportance: 0,

  /** Default minimum semantic relevance (0-1 scale) */
  defaultMinRelevance: 0.3,
} as const;
