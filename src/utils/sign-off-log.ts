/**
 * Sign-off logging for @mem-facilitator.
 *
 * Guardrails:
 * - #33-37: Jurisdiction tracking (US-only execution)
 * - #38-41: Cost + token tracking for audit trails
 *
 * @module src/utils/sign-off-log
 */

import { logger } from '../logger.js';
import { scrubData } from '../scrubber.js';

/**
 * Sign-off log entry for mem-facilitator advisory processing.
 */
export interface SignOffLogEntry {
  timestamp: number;
  agent: string;
  jurisdiction: 'US';
  model: string;
  operation: string;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
}

/**
 * Log a sign-off entry with jurisdiction + cost metadata.
 */
export function logSignOff(entry: SignOffLogEntry): void {
  const scrubbed = scrubData(entry);
  logger.info('mem-facilitator', 'Sign-off log entry', scrubbed);
}