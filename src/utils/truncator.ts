/**
 * Truncator for @mem-facilitator.
 *
 * Truncates long observations to fit within token budget.
 *
 * @module src/utils/truncator
 */

import type { Observation } from '../algorithms/relevance-scorer';

/**
 * Truncation result.
 */
export interface TruncationResult {
  /** Truncated observations */
  truncated: Observation[];
  /** Status */
  status: 'complete' | 'partial' | 'error';
  /** Truncation reason */
  truncation_reason?: 'token_budget' | 'observation_limit' | 'time_budget';
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Truncate observation content to fit within max tokens.
 *
 * @param content - Content to truncate
 * @param maxTokens - Maximum tokens (default: 200)
 * @returns Truncated content
 */
export function truncateContent(
  content: string,
  maxTokens: number = 200,
): string {
  const maxChars = maxTokens * 4; // Rough: 4 chars per token

  if (content.length <= maxChars) {
    return content;
  }

  // Truncate and add ellipsis
  return content.substring(0, maxChars - 3) + '...';
}

/**
 * Truncate observations to fit within max tokens.
 *
 * @param observations - Observations to truncate
 * @param maxTokens - Maximum tokens
 * @returns Truncation result
 */
export function truncateObservations(
  observations: Observation[],
  maxTokens: number,
): TruncationResult {
  let totalTokens = 0;
  const truncated: Observation[] = [];

  for (const obs of observations) {
    const obsTokens = Math.ceil(obs.content.length / 4);

    // Check if adding this observation would exceed budget
    if (totalTokens + obsTokens > maxTokens) {
      return {
        truncated,
        status: 'partial',
        truncation_reason: 'token_budget',
        totalTokens,
      };
    }

    // Truncate content if needed (max 200 tokens per observation)
    const truncatedContent = obsTokens > 200
      ? truncateContent(obs.content, 200)
      : obs.content;

    totalTokens += obsTokens;
    truncated.push({
      ...obs,
      content: truncatedContent,
    });
  }

  return {
    truncated,
    status: 'complete',
    totalTokens,
  };
}

/**
 * Chunk observations into batches.
 *
 * @param observations - Observations to chunk
 * @param maxTokensPerChunk - Maximum tokens per chunk
 * @returns Array of observation chunks
 */
export function chunkObservations(
  observations: Observation[],
  maxTokensPerChunk: number = 6000,
): Observation[][] {
  const chunks: Observation[][] = [];
  let currentChunk: Observation[] = [];
  let currentTokens = 0;

  for (const obs of observations) {
    const obsTokens = Math.ceil(obs.content.length / 4);

    // Start new chunk if adding would exceed budget
    if (currentTokens + obsTokens > maxTokensPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }

    currentChunk.push(obs);
    currentTokens += obsTokens;
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Estimate observation token count.
 *
 * @param obs - Observation
 * @returns Estimated token count
 */
export function estimateObservationTokens(obs: Observation): number {
  return Math.ceil(obs.content.length / 4);
}

/**
 * Get observation size statistics.
 *
 * @param observations - Observations to analyze
 * @returns Size statistics
 */
export function getObservationSizeStats(observations: Observation[]): {
  totalObservations: number;
  totalTokens: number;
  averageTokensPerObservation: number;
  minTokens: number;
  maxTokens: number;
} {
  const tokenCounts = observations.map((obs) =>
    estimateObservationTokens(obs)
  );

  const totalObservations = observations.length;
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
  const averageTokensPerObservation =
    totalObservations > 0 ? totalTokens / totalObservations : 0;
  const minTokens = tokenCounts.length > 0 ? Math.min(...tokenCounts) : 0;
  const maxTokens = tokenCounts.length > 0 ? Math.max(...tokenCounts) : 0;

  return {
    totalObservations,
    totalTokens,
    averageTokensPerObservation,
    minTokens,
    maxTokens,
  };
}