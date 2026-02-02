/**
 * Smart dependency installation with version caching.
 *
 * Responsibility:
 * - Check if dependencies need installation
 * - Cache installation state based on package.json hash
 * - Perform conditional npm install only when necessary
 * - Handle Windows-specific build tool errors gracefully
 *
 * Inspired by: Claude Mem SessionStart smart-install pre-hook
 */

import { homedir } from 'os'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { logger } from '../logger.js'

/**
 * Installation state reasons
 */
export type InstallReason = 'first-run' | 'version-changed' | 'missing-packages' | 'none'

/**
 * Result of dependency check
 */
export interface DependencyCheckResult {
  /** Whether installation is needed */
  needsInstall: boolean
  /** Reason for installation decision */
  reason: InstallReason
  /** Current version hash (for caching) */
  versionMarker?: string
}

/**
 * Path to the version cache directory
 */
const CACHE_DIR = join(homedir(), '.claude-mem')

/**
 * Path to the version marker file
 */
const VERSION_MARKER_PATH = join(CACHE_DIR, '.install-version')

/**
 * Path to claude-mem package.json (for dependency hashing)
 */
const CLAUDE_MEM_PACKAGE_JSON_PATH = join(homedir(), '.claude-mem', 'package.json')

/**
 * Calculate hash of package.json dependencies.
 *
 * **Why hash?** Allows quick comparison without storing full package.json.
 * Any change to dependencies invalidates the cache.
 *
 * @param packageJsonPath - Path to package.json
 * @returns SHA-256 hash of dependencies section, or null if file not found
 */
function calculatePackageHash(packageJsonPath: string): string | null {
  try {
    if (!existsSync(packageJsonPath)) {
      return null
    }

    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)

    // Hash the dependencies and devDependencies sections
    const deps = {
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
    }

    const hash = createHash('sha256')
      .update(JSON.stringify(deps))
      .digest('hex')
      .slice(0, 16) // First 16 chars sufficient for cache key

    return hash
  } catch (e) {
    logger.debug('smart-install', 'Failed to calculate package hash', { error: String(e) })
    return null
  }
}

/**
 * Read the cached version marker.
 *
 * @returns Cached hash or null if not found
 */
function readCachedVersion(): string | null {
  try {
    if (!existsSync(VERSION_MARKER_PATH)) {
      return null
    }
    return readFileSync(VERSION_MARKER_PATH, 'utf-8').trim()
  } catch (e) {
    logger.debug('smart-install', 'Failed to read cached version', { error: String(e) })
    return null
  }
}

/**
 * Write the version marker to cache.
 *
 * @param version - Version hash to cache
 */
function writeCachedVersion(version: string): void {
  try {
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }

    // Write version marker with restricted permissions (owner read/write only)
    writeFileSync(VERSION_MARKER_PATH, version, { mode: 0o600 })
  } catch (e) {
    logger.debug('smart-install', 'Failed to write cached version', { error: String(e) })
  }
}

/**
 * Check if node_modules exists and has content.
 *
 * @returns true if node_modules appears valid
 */
function hasNodeModules(): boolean {
  const nodeModulesPath = join(homedir(), '.claude-mem', 'node_modules')
  try {
    if (!existsSync(nodeModulesPath)) {
      return false
    }
    // Quick check: does node_modules have subdirectories?
    const { readdirSync } = require('fs')
    const entries = readdirSync(nodeModulesPath)
    return entries.length > 0
  } catch (e) {
    return false
  }
}

/**
 * Check if dependencies need installation.
 *
 * **Logic:**
 * 1. Check if ~/.claude-mem exists (first run)
 * 2. Check if node_modules exists
 * 3. Compare package.json hash with cached version
 *
 * **Performance:** < 10ms when cached (file system checks only)
 *
 * @returns DependencyCheckResult with installation decision
 */
export async function checkDependencies(): Promise<DependencyCheckResult> {
  // Check if claude-mem is installed
  if (!existsSync(CLAUDE_MEM_PACKAGE_JSON_PATH)) {
    return {
      needsInstall: false,
      reason: 'none',
      versionMarker: undefined
    }
  }

  // Calculate current version hash
  const currentHash = calculatePackageHash(CLAUDE_MEM_PACKAGE_JSON_PATH)
  if (!currentHash) {
    return {
      needsInstall: true,
      reason: 'missing-packages',
      versionMarker: undefined
    }
  }

  // Check cached version
  const cachedHash = readCachedVersion()

  // First run: no cache file
  if (cachedHash === null) {
    // Check if node_modules exists (might be from manual install)
    if (!hasNodeModules()) {
      return {
        needsInstall: true,
        reason: 'first-run',
        versionMarker: currentHash
      }
    }
    // Node modules exists, cache the current version
    writeCachedVersion(currentHash)
    return {
      needsInstall: false,
      reason: 'none',
      versionMarker: currentHash
    }
  }

  // Version changed
  if (cachedHash !== currentHash) {
    return {
      needsInstall: true,
      reason: 'version-changed',
      versionMarker: currentHash
    }
  }

  // Cache hit - no install needed
  return {
    needsInstall: false,
    reason: 'none',
    versionMarker: currentHash
  }
}

/**
 * Detect if running on Windows.
 */
function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Detect if error is Windows build tools related.
 */
function isWindowsBuildToolsError(error: string): boolean {
  const windowsBuildPatterns = [
    'gyp err',
    'msbuild',
    'visual studio',
    'windows-build-tools',
    'python2',
    'node-gyp',
  ]
  const lowerError = error.toLowerCase()
  return windowsBuildPatterns.some(pattern => lowerError.includes(pattern))
}

/**
 * Perform smart installation of dependencies.
 *
 * **Features:**
 * - Runs npm install in ~/.claude-mem directory
 * - Handles Windows-specific build tool errors
 * - Updates version cache on success
 * - Non-blocking with timeout protection
 *
 * @param $ - OpenCode shell instance
 * @throws Error if installation fails catastrophically
 */
export async function smartInstall($: any): Promise<void> {
  const claudeMemDir = join(homedir(), '.claude-mem')

  logger.info('smart-install', 'Installing claude-mem dependencies...')

  try {
    // Check if directory exists
    if (!existsSync(claudeMemDir)) {
      logger.warn('smart-install', 'claude-mem directory not found, skipping install')
      return
    }

    // Run npm install with timeout
    const installPromise = $`cd "${claudeMemDir}" && npm install`.quiet()

    // Add timeout protection (5 minutes)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Installation timeout')), 5 * 60 * 1000)
    })

    await Promise.race([installPromise, timeoutPromise])

    // Update version cache on success
    const currentHash = calculatePackageHash(CLAUDE_MEM_PACKAGE_JSON_PATH)
    if (currentHash) {
      writeCachedVersion(currentHash)
    }

    logger.info('smart-install', 'Dependencies installed successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Handle Windows-specific build tool errors
    if (isWindows() && isWindowsBuildToolsError(errorMessage)) {
      logger.warn('smart-install', 'Windows build tools required', {
        message: 'Some dependencies may need native compilation. Consider installing windows-build-tools.',
        error: errorMessage.slice(0, 200)
      })
      // Don't throw - installation might still be partially successful
      return
    }

    // Log but don't throw - allow session to continue
    logger.error('smart-install', 'Installation failed', { error: errorMessage.slice(0, 200) })

    // Don't block the session - memory features will gracefully degrade
    logger.info('smart-install', 'Continuing without full dependency installation')
  }
}

/**
 * Force a fresh installation (invalidate cache and reinstall).
 *
 * @param $ - OpenCode shell instance
 */
export async function forceReinstall($: any): Promise<void> {
  try {
    // Clear version cache
    if (existsSync(VERSION_MARKER_PATH)) {
      const { unlinkSync } = require('fs')
      unlinkSync(VERSION_MARKER_PATH)
    }

    // Force reinstall
    await smartInstall($)
  } catch (e) {
    logger.error('smart-install', 'Force reinstall failed', { error: String(e) })
    throw e
  }
}
