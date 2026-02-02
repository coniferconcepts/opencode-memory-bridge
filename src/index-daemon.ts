/**
 * Global Index Daemon & Locking
 * 
 * Responsibility:
 * - Manage exclusive write access to the global index database.
 * - Implement atomic lock file protocol with heartbeat.
 * - Prevent data corruption during concurrent writes.
 * 
 * @module src/integrations/claude-mem/index-daemon
 * @see docs/MULTI_PROJECT_MEMORY_PLAN_FINAL.md
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, hostname } from 'os';
import { logger } from './logger.js';

const OC_DIR = join(homedir(), '.oc');
const INDEX_LOCK_PATH = join(OC_DIR, 'index.lock');
const HEARTBEAT_INTERVAL_MS = 5000;
const LOCK_STALE_THRESHOLD_MS = 15000;

interface IndexLock {
  pid: number;
  hostname: string;
  timestamp: number;
}

/**
 * Check if a process is still running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Start the heartbeat to keep the lock alive.
 */
function startHeartbeat(): void {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(() => {
    try {
      const lock: IndexLock = {
        pid: process.pid,
        hostname: hostname(),
        timestamp: Date.now(),
      };
      writeFileSync(INDEX_LOCK_PATH, JSON.stringify(lock));
    } catch (error) {
      logger.error('[Ingestor]', 'Heartbeat failed, releasing lock', { error: String(error) });
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      // In a real daemon, we might want to signal the main loop to stop here
      process.emit('SIGTERM');
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Acquire exclusive write access to the global index.
 * Uses atomic file creation (wx flag) to prevent TOCTOU races.
 */
export function acquireIndexLock(): boolean {
  if (!existsSync(OC_DIR)) {
    try {
      const { mkdirSync } = require('fs');
      mkdirSync(OC_DIR, { recursive: true });
    } catch {}
  }

  // 1. Check for existing lock
  if (existsSync(INDEX_LOCK_PATH)) {
    try {
      const lock: IndexLock = JSON.parse(readFileSync(INDEX_LOCK_PATH, 'utf-8'));
      const isStale = Date.now() - lock.timestamp > LOCK_STALE_THRESHOLD_MS;
      const isSameHost = lock.hostname === hostname();
      const isProcessDead = isSameHost && !isProcessAlive(lock.pid);
      
      if (!isStale && !isProcessDead) {
        return false; // Lock held by live process
      }
      
      // Stale lock - remove it
      unlinkSync(INDEX_LOCK_PATH);
    } catch {
      // Corrupted lock file - remove it
      try { unlinkSync(INDEX_LOCK_PATH); } catch {}
    }
  }

  // 2. Attempt atomic lock acquisition
  const lockInfo: IndexLock = {
    pid: process.pid,
    hostname: hostname(),
    timestamp: Date.now(),
  };

  try {
    writeFileSync(INDEX_LOCK_PATH, JSON.stringify(lockInfo), { flag: 'wx' });
    startHeartbeat();
    return true;
  } catch {
    return false; // Another process won the race
  }
}

/**
 * Release the write lock.
 */
export function releaseIndexLock(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  
  try {
    if (existsSync(INDEX_LOCK_PATH)) {
      const lock: IndexLock = JSON.parse(readFileSync(INDEX_LOCK_PATH, 'utf-8'));
      if (lock.pid === process.pid) {
        unlinkSync(INDEX_LOCK_PATH);
      }
    }
  } catch {}
}

// Cleanup on exit
process.on('exit', releaseIndexLock);
process.on('SIGINT', () => { releaseIndexLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseIndexLock(); process.exit(0); });
