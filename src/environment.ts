/**
 * OpenCode Environment Detection for claude-mem Integration
 *
 * ## Rationale: Zero Interference Principle
 * 
 * OpenCode operates as a "Co-Owner" of the shared claude-mem installation,
 * but MUST NOT disrupt the user's existing Claude Code workflow.
 * 
 * **Why environment detection?**
 * - Prevents OpenCode hooks from firing in Claude Code sessions
 * - Enables source-based filtering in the shared database
 * - Allows gradual migration from Claude Code to OpenCode
 * 
 * **Detection hierarchy:**
 * 1. `OPENCODE_ACTIVE=true` - Explicit flag (highest confidence)
 * 2. `OPENCODE_API_KEY` present - Implicit (OpenCode configured)
 * 3. Process parent contains "opencode" - Fallback detection
 * 4. Default: Assume Claude Code (safety-first)
 *
 * @module src/integrations/claude-mem/environment
 * @see plans/2026-01-10-claude-mem-local-native-strategy.md (Appendix E)
 */

/**
 * Environment source identifiers.
 */
export type EnvironmentSource = 'opencode' | 'claude-code' | 'unknown';

/**
 * OpenCode environment detection result.
 */
export interface EnvironmentDetectionResult {
  /** Whether we're running in an OpenCode environment */
  isOpenCode: boolean;
  /** The detected environment source */
  source: EnvironmentSource;
  /** Detection method used */
  detectionMethod: 'explicit' | 'api-key' | 'process' | 'claude-session' | 'default';
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Detects if we're running in an OpenCode environment.
 *
 * Detection hierarchy (first match wins):
 * 1. OPENCODE_ACTIVE env var (explicit) - confidence: 1.0
 * 2. OPENCODE_API_KEY env var (implicit) - confidence: 0.9
 * 3. Process parent check (opencode binary) - confidence: 0.7
 * 4. Default: false (assume Claude Code) - confidence: 0.5
 *
 * @returns true if running in OpenCode environment
 *
 * @example
 * ```typescript
 * if (isOpenCodeEnvironment()) {
 *   // OpenCode-specific behavior
 *   await captureOpenCodeObservation(...);
 * }
 * // Claude Code: no-op, zero interference
 * ```
 */
export function isOpenCodeEnvironment(): boolean {
  return detectEnvironment().isOpenCode;
}

/**
 * Returns the current environment identifier.
 *
 * @returns 'opencode' | 'claude-code' | 'unknown'
 */
export function getEnvironmentSource(): EnvironmentSource {
  return detectEnvironment().source;
}

/**
 * Full environment detection with confidence and method details.
 *
 * @returns Complete detection result
 */
export function detectEnvironment(): EnvironmentDetectionResult {
  // 1. Explicit flag (highest priority, highest confidence)
  if (process.env.OPENCODE_ACTIVE === 'true') {
    return {
      isOpenCode: true,
      source: 'opencode',
      detectionMethod: 'explicit',
      confidence: 1.0,
    };
  }

  // 2. Implicit: OpenCode API key present
  if (process.env.OPENCODE_API_KEY) {
    return {
      isOpenCode: true,
      source: 'opencode',
      detectionMethod: 'api-key',
      confidence: 0.9,
    };
  }

  // 3. Process parent detection (fallback, lower confidence)
  const parentProcess = process.env._ || '';
  if (parentProcess.includes('opencode')) {
    return {
      isOpenCode: true,
      source: 'opencode',
      detectionMethod: 'process',
      confidence: 0.7,
    };
  }

  // 4. Check for Claude Code indicators
  if (process.env.CLAUDE_CODE_SESSION || process.env.CLAUDE_SESSION_ID) {
    return {
      isOpenCode: false,
      source: 'claude-code',
      detectionMethod: 'claude-session',
      confidence: 0.9,
    };
  }

  // 5. Default: Not OpenCode (assume Claude Code for safety)
  return {
    isOpenCode: false,
    source: 'unknown',
    detectionMethod: 'default',
    confidence: 0.5,
  };
}

/**
 * Generates an OpenCode-namespaced session ID.
 *
 * Format: `opencode-{agentName}-{timestamp}`
 *
 * @param agentName - The name of the OpenCode agent
 * @returns Namespaced session ID
 *
 * @example
 * ```typescript
 * const sessionId = generateOpenCodeSessionId('solo-orchestrator');
 * // "opencode-solo-orchestrator-1736582400000"
 * ```
 */
export function generateOpenCodeSessionId(agentName: string): string {
  const sanitizedAgent = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `opencode-${sanitizedAgent}-${Date.now()}`;
}

/**
 * Prefixes an observation type with the OpenCode namespace.
 *
 * @param type - The base observation type
 * @returns Namespaced type (e.g., "oc:agent-invocation")
 *
 * @example
 * ```typescript
 * const type = prefixOpenCodeType('agent-invocation');
 * // "oc:agent-invocation"
 * ```
 */
export function prefixOpenCodeType(type: string): string {
  if (type.startsWith('oc:')) {
    return type; // Already prefixed
  }
  return `oc:${type}`;
}

/**
 * Checks if an observation type is OpenCode-namespaced.
 *
 * @param type - The observation type to check
 * @returns true if the type has the "oc:" prefix
 */
export function isOpenCodeType(type: string): boolean {
  return type.startsWith('oc:');
}

/**
 * OpenCode observation types (for type safety).
 */
export const OPENCODE_OBSERVATION_TYPES = {
  /** Agent was invoked */
  AGENT_INVOCATION: 'oc:agent-invocation',
  /** Plan step completed */
  PLAN_EXECUTION: 'oc:plan-execution',
  /** Review finding recorded */
  REVIEW_FINDING: 'oc:review-finding',
  /** Model routing decision */
  MODEL_SWITCH: 'oc:model-switch',
  /** Token/cost tracking */
  COST_EVENT: 'oc:cost-event',
  /** Error encountered */
  ERROR: 'oc:error',
  /** Session summary */
  SESSION_SUMMARY: 'oc:session-summary',
} as const;

/**
 * OpenCode observation type
 */
export type OpenCodeObservationType =
  (typeof OPENCODE_OBSERVATION_TYPES)[keyof typeof OPENCODE_OBSERVATION_TYPES];
