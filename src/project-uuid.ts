/**
 * Project UUID Generator
 * 
 * Responsibility:
 * - Generate non-reversible project UUIDs from absolute paths.
 * - Use a salted hash to prevent rainbow table attacks.
 * - Maintain determinism within a single installation.
 * 
 * @module src/integrations/claude-mem/project-uuid
 * @see docs/MULTI_PROJECT_MEMORY_PLAN_FINAL.md
 */

import { createHmac, randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'fs';
import { join, normalize } from 'path';
import { homedir } from 'os';

const OC_DIR = join(homedir(), '.oc');
const SALT_PATH = join(OC_DIR, 'salt');

/**
 * Get or create the installation-specific salt.
 * Salt is 32 bytes of cryptographically secure random data.
 */
function getOrCreateSalt(): Buffer {
  if (!existsSync(OC_DIR)) {
    mkdirSync(OC_DIR, { recursive: true });
  }

  if (existsSync(SALT_PATH)) {
    const salt = readFileSync(SALT_PATH);
    if (salt.length === 32) return salt;
    // Regenerate if corrupted
  }

  const salt = randomBytes(32);
  writeFileSync(SALT_PATH, salt, { mode: 0o600 }); // Owner read/write only
  return salt;
}

/**
 * Generate a non-reversible project UUID from an absolute path.
 * 
 * Formula: HMAC-SHA256(salt, canonical_path)
 * 
 * This prevents rainbow table attacks while maintaining determinism
 * within a single installation.
 */
export function generateProjectUUID(absolutePath: string): string {
  const salt = getOrCreateSalt();
  
  // SEC-002: Canonicalize path to ensure consistency across symlinks/case
  let canonicalPath = absolutePath;
  try {
    canonicalPath = realpathSync(normalize(absolutePath));
  } catch {
    canonicalPath = normalize(absolutePath);
  }
  
  // Use HMAC-SHA256 for better robustness than simple concatenation
  const hmac = createHmac('sha256', salt);
  hmac.update(canonicalPath);
  return hmac.digest('hex').substring(0, 32); // 128-bit UUID
}

/**
 * Validate that a string looks like a valid project UUID.
 */
export function isValidProjectUUID(uuid: string): boolean {
  return /^[a-f0-9]{32}$/.test(uuid);
}
