import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

/**
 * Path resolution for claude-mem global installation.
 * 
 * ## Rationale: Local-Native Strategy
 * 
 * Instead of porting claude-mem to CloudFlare Workers, we wrap the
 * upstream Bun + SQLite service. This requires locating the global
 * installation managed by Claude Code's plugin system.
 * 
 * **Why not hardcode paths?**
 * - Version numbers change with updates (9.0.4 -> 9.1.0)
 * - Installation paths vary by platform (macOS vs Linux)
 * - Users may have custom installations via CLAUDE_MEM_GLOBAL_PATH
 * 
 * **Why check multiple candidates?**
 * - Plugin cache: Standard Claude Code installation
 * - Marketplace: Alternative installation method
 * - Project-local: Development/testing scenarios
 * 
 * @module src/integrations/claude-mem/paths
 * @see plans/2026-01-10-claude-mem-local-native-strategy.md (Section 1.1)
 */
const HOME = homedir();

function listVersionedPaths(basePath: string): string[] {
  try {
    if (!existsSync(basePath)) return [];

    return readdirSync(basePath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+$/.test(entry.name))
      .map((entry) => join(basePath, entry.name))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function buildCandidatePaths(): string[] {
  const projectLocal = join(process.cwd(), '.claude', 'plugins', 'claude-mem');
  const pluginCacheBase = join(HOME, '.claude', 'plugins', 'cache', 'thedotmack', 'claude-mem');
  const marketplaceBase = join(HOME, '.claude', 'plugins', 'marketplaces', 'thedotmack', 'claude-mem');

  const candidates = [
    process.env.CLAUDE_MEM_GLOBAL_PATH,
    existsSync(projectLocal) ? projectLocal : undefined,
    ...listVersionedPaths(pluginCacheBase),
    existsSync(pluginCacheBase) ? pluginCacheBase : undefined,
    ...listVersionedPaths(marketplaceBase),
    existsSync(marketplaceBase) ? marketplaceBase : undefined,
  ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

/**
 * Claude-mem path information
 */
export interface ClaudeMemPathInfo {
  root: string;
  workerService: string;
  pluginScripts: string;
}

let cached: ClaudeMemPathInfo | null = null;

/**
 * Resolves the paths for the global or local claude-mem installation.
 * 
 * @returns Path information for the worker and scripts
 * @throws Error if no installation is found
 */
export function resolveClaudeMemPaths(): ClaudeMemPathInfo {
  if (cached) return cached;

  for (const candidate of buildCandidatePaths()) {
    // Check common entry point paths
    const possibleWorkerPaths = [
      join(candidate, 'scripts', 'worker-service.cjs'),
      join(candidate, 'plugin', 'scripts', 'worker-service.cjs'),
    ];
    
    for (const worker of possibleWorkerPaths) {
      if (existsSync(worker)) {
        cached = {
          root: candidate,
          workerService: worker,
          pluginScripts: join(candidate, worker.includes('plugin') ? 'plugin/scripts' : 'scripts'),
        };
        return cached;
      }
    }
  }

  throw new Error(
    'claude-mem installation not found. Please ensure the Claude Code plugin is installed or set CLAUDE_MEM_GLOBAL_PATH.'
  );
}
