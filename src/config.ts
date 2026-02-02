/**
 * Memory Injection Configuration & Feature Flags
 * 
 * Responsibility:
 * - Manage staged rollout of memory injection.
 * - Provide feature flags for master switch and project allowlists.
 * - Enforce agent-level allowlists for injection.
 * 
 * @module src/integrations/claude-mem/config
 * @see docs/GUARDRAIL_VALIDATOR_PLAN.md
 */

import { SUBAGENT_MEMORY_TOKEN_BUDGET } from './constants.js';

export interface MemoryInjectionConfig {
  /** Master switch for all memory injection */
  enabled: boolean;
  /** Master switch for guardrail validation */
  guardrailValidatorEnabled: boolean;
  /** Projects allowed to receive memory injection */
  projectAllowlist: string[];
  /** Agents allowed to receive memory injection */
  agentAllowlist: string[];
  /** Maximum token budget for injected context */
  maxTokenBudget: number;
  /** Behavior when injection fails */
  fallbackBehavior: 'skip' | 'warn' | 'error';
  /** Verbosity level for user-facing logs */
  verbosity: 'quiet' | 'normal' | 'verbose';
}

/**
 * Default configuration for Phase 1 Rollout.
 *
 * **Logging Default**: 'quiet' (errors only)
 * - Prevents console spam from file watcher events (.git/index.lock, etc.)
 * - Users can opt-in to verbose logging via .oc/memory-config.json
 * - CLAUDE_MEM_DEBUG=true environment variable enables debug logs
 */
const DEFAULT_CONFIG: MemoryInjectionConfig = {
  enabled: true,
  guardrailValidatorEnabled: true,
  projectAllowlist: ['content-tracker'],
  agentAllowlist: ['orchestrator', 'planner'],
  maxTokenBudget: SUBAGENT_MEMORY_TOKEN_BUDGET,
  fallbackBehavior: 'skip',
  verbosity: 'quiet',  // Default to quiet (errors only) to prevent console noise
};

/**
 * Get the current memory injection configuration.
 * Fetches from local .oc/memory-config.json if it exists.
 */
export async function getMemoryConfig(): Promise<MemoryInjectionConfig> {
  try {
    const { readFileSync, existsSync } = require('fs');
    const { join } = require('path');
    const configPath = join(process.cwd(), '.oc', 'memory-config.json');
    
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (e) {
    // Fallback to default on error
  }
  return DEFAULT_CONFIG;
}

/**
 * Check if memory injection is enabled for a specific project and agent.
 * 
 * @param project - Project identifier
 * @param agent - Agent identifier
 */
export async function isInjectionEnabled(project: string, agent: string): Promise<boolean> {
  const config = await getMemoryConfig();
  
  if (!config.enabled) return false;
  
  const projectAllowed = config.projectAllowlist.includes(project) || config.projectAllowlist.includes('*');
  const agentAllowed = config.agentAllowlist.includes(agent) || config.agentAllowlist.includes('*');
  
  return projectAllowed && agentAllowed;
}
