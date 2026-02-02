import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { resolveClaudeMemPaths } from './paths.js';
import { logger } from './logger.js';
import { spawn } from 'child_process';
import { acquireLock, releaseLock } from './lockfile.js';

import {
  CLAUDE_MEM_PORT,
  HEALTH_CHECK_TIMEOUT_MS,
  WORKER_STARTUP_TIMEOUT_MS,
} from './constants.js';

const SETTINGS_PATH = join(homedir(), '.claude-mem', 'settings.json');

/**
 * Lifecycle management for claude-mem worker process.
 * 
 * ## Rationale: Co-Owner Architecture
 * 
 * Both Claude Code and OpenCode can start the claude-mem worker.
 * This module implements idempotent startup to prevent conflicts.
 * 
 * **Why idempotent startup?**
 * - Multiple processes may try to start the worker simultaneously
 * - Port 37777 can only be bound by one process
 * - Health check before start prevents "address in use" errors
 * 
 * **Why detached process?**
 * - Worker should survive parent process termination
 * - Enables shared service across multiple terminals
 * - Matches Claude Code's plugin behavior
 * 
 * @module src/integrations/claude-mem/lifecycle
 * @see plans/2026-01-10-claude-mem-local-native-strategy.md (Appendix G.3)
 */
export async function isWorkerHealthy(): Promise<boolean> {
  try {
    const settings = existsSync(SETTINGS_PATH) 
      ? JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) 
      : {};
    const port = settings.CLAUDE_MEM_WORKER_PORT || CLAUDE_MEM_PORT;
    
    const response = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS)
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ensures the claude-mem worker is running.
 * Idempotent: checks health before attempting to start.
 */
export async function ensureWorkerRunning(): Promise<boolean> {
  if (await isWorkerHealthy()) {
    return true;
  }

  // Attempt to acquire startup lock
  const lockAcquired = acquireLock('opencode');
  
  if (!lockAcquired) {
    logger.info('[claude-mem]', 'Startup lock held by another process, waiting...');
    
    // Wait and retry loop
    const retryStartTime = Date.now();
    const retryTimeout = 5000; // 5 seconds
    
    while (Date.now() - retryStartTime < retryTimeout) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (await isWorkerHealthy()) {
        logger.info('[claude-mem]', 'Worker started by another process');
        return true;
      }
      
      // Try to acquire lock again in case the other process failed
      if (acquireLock('opencode')) {
        logger.info('[claude-mem]', 'Acquired lock after waiting');
        break; 
      }
    }
    
    // If we still don't have the lock and worker isn't healthy
    if (!await isWorkerHealthy() && !acquireLock('opencode')) {
      logger.warn('[claude-mem]', 'Could not acquire startup lock after timeout');
      return false;
    }
  }

  // If we reach here, we hold the lock
  try {
    let paths;
    try {
      paths = resolveClaudeMemPaths();
    } catch (error) {
      logger.error('[claude-mem]', 'Could not find claude-mem installation', { error: String(error) });
      return false;
    }

    logger.info('[claude-mem]', `Starting global worker at ${paths.workerService}`);

    // Check if bun is available
    const bunPath = await getBunPath();
    if (!bunPath) {
      logger.error('[claude-mem]', 'Bun is not installed or not in PATH. Please install Bun (https://bun.sh).');
      return false;
    }

    // Use spawn to start the worker as a detached background process
    const child = spawn(bunPath, [paths.workerService, 'start'], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        CLAUDE_MEM_MANAGED: 'true'
      }
    });

    child.on('error', (error) => {
      logger.error('[claude-mem]', 'Failed to spawn worker process', { error: String(error) });
    });

    child.unref();

    // Wait for health check
    const startTime = Date.now();
    while (Date.now() - startTime < WORKER_STARTUP_TIMEOUT_MS) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (await isWorkerHealthy()) {
        logger.info('[claude-mem]', 'Worker started successfully');
        return true;
      }
    }

    logger.warn('[claude-mem]', 'Worker failed to start within timeout');
    return false;
  } catch (error) {
    logger.error('[claude-mem]', 'Unexpected error during worker startup', { error: String(error) });
    return false;
  } finally {
    releaseLock();
  }
}

/**
 * Helper to find bun executable
 */
async function getBunPath(): Promise<string | null> {
  try {
    const { execSync } = await import('child_process');
    return execSync('which bun').toString().trim();
  } catch {
    // Fallback to common paths
    const commonPaths = [
      join(homedir(), '.bun', 'bin', 'bun'),
      '/usr/local/bin/bun',
      '/opt/homebrew/bin/bun'
    ];
    for (const p of commonPaths) {
      if (existsSync(p)) return p;
    }
    return null;
  }
}

/**
 * Restarts the worker process.
 */
export async function restartWorker(): Promise<boolean> {
  const paths = resolveClaudeMemPaths();
  logger.info('[claude-mem]', 'Restarting worker...');

  return new Promise((resolve) => {
    const child = spawn('bun', [paths.workerService, 'restart', '--force'], {
      stdio: 'inherit'
    });

    child.on('close', async (code) => {
      if (code === 0) {
        resolve(await isWorkerHealthy());
      } else {
        resolve(false);
      }
    });
  });
}
