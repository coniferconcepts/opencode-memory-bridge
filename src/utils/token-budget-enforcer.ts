/**
 * Token budget enforcement for @mem-facilitator.
 *
 * Enforces the 8000 token budget for subagent memory operations.
 *
 * ## Token Budget
 *
 * - SUBAGENT_MEMORY_TOKEN_BUDGET: 8000 tokens
 * - System prompt: ~2000 tokens
 * - Available for observations: ~6000 tokens
 *
 * @module src/utils/token-budget-enforcer
 */

/**
 * Generic observation interface for token budget enforcement.
 * Compatible with both Observation (relevance-scorer) and MemFacilitatorObservation.
 */
export interface ObservationWithContent {
  id: number;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/** Token budget constants */
export const SUBAGENT_MEMORY_TOKEN_BUDGET = 8000;
export const SYSTEM_PROMPT_TOKENS = 2000;
export const OBSERVATION_TOKENS_BUDGET = 6000;

/**
 * Token budget enforcement result.
 */
export interface TokenBudgetEnforcement<T extends ObservationWithContent = ObservationWithContent> {
  /** Truncated observations */
  truncated: T[];
  /** Status */
  status: 'complete' | 'partial' | 'error';
  /** Truncation reason */
  truncationReason?: 'token_budget' | 'observation_limit' | 'time_budget';
  /** Total tokens used */
  totalTokens: number;
  /** Budget remaining */
  budgetRemaining: number;
}

/**
 * Estimate token count for text (rough approximation: 4 chars per token).
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Enforce token budget on observations.
 *
 * Truncates observations to stay within the 6000 token budget for observations.
 *
 * @param observations - Observations to enforce budget on
 * @param maxTokens - Maximum tokens for observations (default: 6000)
 * @returns Token budget enforcement result
 */
export function enforceTokenBudget<T extends ObservationWithContent>(
  observations: T[],
  maxTokens: number = OBSERVATION_TOKENS_BUDGET,
): TokenBudgetEnforcement<T> {
  let totalTokens = 0;
  const truncated: T[] = [];

  for (const obs of observations) {
    const obsTokens = estimateTokens(obs.content);

    // Check if adding this observation would exceed budget
    if (totalTokens + obsTokens > maxTokens) {
      return {
        truncated,
        status: 'partial',
        truncationReason: 'token_budget',
        totalTokens,
        budgetRemaining: maxTokens - totalTokens,
      };
    }

    totalTokens += obsTokens;
    truncated.push(obs);
  }

  return {
    truncated,
    status: 'complete',
    totalTokens,
    budgetRemaining: maxTokens - totalTokens,
  };
}

/**
 * Check if observations fit within token budget.
 *
 * @param observations - Observations to check
 * @param maxTokens - Maximum tokens (default: 6000)
 * @returns True if observations fit within budget
 */
export function fitsWithinBudget<T extends ObservationWithContent>(
  observations: T[],
  maxTokens: number = OBSERVATION_TOKENS_BUDGET,
): boolean {
  let totalTokens = 0;

  for (const obs of observations) {
    totalTokens += estimateTokens(obs.content);
    if (totalTokens > maxTokens) {
      return false;
    }
  }

  return true;
}

/**
 * Get token budget summary.
 *
 * @param observations - Observations to analyze
 * @returns Token budget summary
 */
export function getTokenBudgetSummary<T extends ObservationWithContent>(
  observations: T[],
): {
  totalObservations: number;
  totalTokens: number;
  averageTokensPerObservation: number;
  estimatedObservationsThatFit: number;
} {
  const totalObservations = observations.length;
  const totalTokens = observations.reduce(
    (sum, obs) => sum + estimateTokens(obs.content),
    0,
  );
  const averageTokensPerObservation =
    totalObservations > 0 ? totalTokens / totalObservations : 0;
  const estimatedObservationsThatFit =
    averageTokensPerObservation > 0
      ? Math.floor(OBSERVATION_TOKENS_BUDGET / averageTokensPerObservation)
      : 0;

  return {
    totalObservations,
    totalTokens,
    averageTokensPerObservation,
    estimatedObservationsThatFit,
  };
}