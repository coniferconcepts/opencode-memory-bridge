/**
 * Cross-process lock file management for claude-mem worker.
 * 
 * ## Rationale: Startup Race Prevention
 * 
 * Both OpenCode and Claude Code can start the claude-mem worker.
 * Without coordination, simultaneous startup attempts cause:
 * - "Address already in use" errors
 * - Orphaned processes
 * - Inconsistent state
 * 
 * This module implements a simple lock file protocol:
 * 1. Check if lock exists and is held by a live process
 * 2. If not, acquire lock before starting worker
 * 3. Release lock on process exit
 * 
 * @module src/integrations/claude-mem/lockfile
 */

import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOCK_DIR = join(homedir(), '.claude-mem');
const LOCK_FILE = join(LOCK_DIR, 'worker.lock');
const LOCK_TIMEOUT_MS = 30000; // 30 seconds

interface LockInfo {
  pid: number;
  timestamp: number;
  source: 'opencode' | 'claude-code' | 'unknown';
}

/**
 * Ensure the lock directory exists.
 */
function ensureLockDir(): void {
  if (!existsSync(LOCK_DIR)) {
    mkdirSync(LOCK_DIR, { recursive: true });
  }
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

/**
 * Read the current lock file.
 */
function readLock(): LockInfo | null {
  try {
    if (!existsSync(LOCK_FILE)) return null;
    const content = readFileSync(LOCK_FILE, 'utf-8');
    return JSON.parse(content) as LockInfo;
  } catch {
    return null;
  }
}

/**
 * Check if the lock is currently held by a live process.
 */
export function isLockHeld(): boolean {
  const lock = readLock();
  if (!lock) return false;
  
  // Check if lock is stale (process died without cleanup)
  if (!isProcessAlive(lock.pid)) {
    // Clean up stale lock
    try { unlinkSync(LOCK_FILE); } catch {}
    return false;
  }
  
  // Check if lock is expired (safety timeout)
  if (Date.now() - lock.timestamp > LOCK_TIMEOUT_MS) {
    try { unlinkSync(LOCK_FILE); } catch {}
    return false;
  }
  
  return true;
}

/**
 * Acquire the worker startup lock.
 * 
 * @param source - The source acquiring the lock
 * @returns true if lock acquired, false if already held
 */
export function acquireLock(source: 'opencode' | 'claude-code' = 'opencode'): boolean {
  ensureLockDir();

  // 1. Check for existing lock and handle staleness
  const lock = readLock();
  if (lock) {
    const isStale = !isProcessAlive(lock.pid) || (Date.now() - lock.timestamp > LOCK_TIMEOUT_MS);
    if (!isStale) {
      return false; // Lock is held by a live process
    }
    
    // Lock is stale, try to remove it
    try {
      unlinkSync(LOCK_FILE);
    } catch (err) {
      // If we can't delete it, someone else might have or it's a permission issue
      // We'll still try the atomic write below
    }
  }
  
  const lockInfo: LockInfo = {
    pid: process.pid,
    timestamp: Date.now(),
    source,
  };
  
  try {
    // 2. Atomic write with 'wx' flag to prevent TOCTOU
    writeFileSync(LOCK_FILE, JSON.stringify(lockInfo), { flag: 'wx' });
    return true;
  } catch (err) {
    // Another process acquired the lock between our check and write
    return false;
  }
}

/**
 * Release the worker startup lock.
 * 
 * Only releases if we hold the lock (same PID).
 */
export function releaseLock(): void {
  const lock = readLock();
  if (lock && lock.pid === process.pid) {
    try { unlinkSync(LOCK_FILE); } catch {}
  }
}

/**
 * Get information about the current lock holder.
 */
export function getLockHolder(): LockInfo | null {
  const lock = readLock();
  if (!lock) return null;
  if (!isProcessAlive(lock.pid)) return null;
  return lock;
}

// Cleanup on process exit
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
