/**
 * Cost estimation helper for GLM 4.7.
 *
 * Guardrails:
 * - #38: Track token usage and costs
 * - #41: Always estimate costs
 *
 * @module src/utils/cost-estimator
 */

export const GLM_4_7_PRICING = {
  input: 0.30, // $0.30 per 1M tokens
  output: 0.60, // $0.60 per 1M tokens
} as const;

const TOKEN_UNIT = 1_000_000;

/**
 * Estimate cost given input/output token counts.
 */
export function estimateCost(inputTokens: number, outputTokens: number): {
  inputCost: number;
  outputCost: number;
  totalCost: number;
} {
  const safeInput = Math.max(0, inputTokens);
  const safeOutput = Math.max(0, outputTokens);

  const inputCost = (safeInput / TOKEN_UNIT) * GLM_4_7_PRICING.input;
  const outputCost = (safeOutput / TOKEN_UNIT) * GLM_4_7_PRICING.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}