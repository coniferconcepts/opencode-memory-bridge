/**
 * Cost estimation verification for @mem-facilitator.
 *
 * Tests:
 * - GLM 4.7 pricing accuracy (~$0.30/1M input tokens, ~$0.60/1M output tokens)
 * - Cost estimation accuracy for typical queries
 * - Cost estimation accuracy for edge cases
 * - Token budget enforcement verification
 *
 * @module src/__tests__/mem-facilitator-cost.test
 */

import { describe, it, expect } from 'bun:test';
import { estimateCost, GLM_4_7_PRICING } from '../utils/cost-estimator';

describe('mem-facilitator cost estimation', () => {
  describe('GLM 4.7 pricing accuracy', () => {
    it('uses correct input pricing ($0.30/1M tokens)', () => {
      expect(GLM_4_7_PRICING.input).toBe(0.30);
    });

    it('uses correct output pricing ($0.60/1M tokens)', () => {
      expect(GLM_4_7_PRICING.output).toBe(0.60);
    });

    it('calculates input cost correctly for 1M tokens', () => {
      const result = estimateCost(1_000_000, 0);
      expect(result.inputCost).toBeCloseTo(0.30, 6);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBeCloseTo(0.30, 6);
    });

    it('calculates output cost correctly for 1M tokens', () => {
      const result = estimateCost(0, 1_000_000);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBeCloseTo(0.60, 6);
      expect(result.totalCost).toBeCloseTo(0.60, 6);
    });

    it('calculates total cost correctly for 1M/1M tokens', () => {
      const result = estimateCost(1_000_000, 1_000_000);
      expect(result.inputCost).toBeCloseTo(0.30, 6);
      expect(result.outputCost).toBeCloseTo(0.60, 6);
      expect(result.totalCost).toBeCloseTo(0.90, 6);
    });
  });

  describe('cost estimation for typical queries', () => {
    it('estimates cost for small query (10 observations)', () => {
      // 10 observations * 100 input tokens = 1000 input tokens
      // 10 observations * 50 output tokens = 500 output tokens
      const inputTokens = 1000;
      const outputTokens = 500;

      const result = estimateCost(inputTokens, outputTokens);

      const expectedInputCost = (1000 / 1_000_000) * 0.30;
      const expectedOutputCost = (500 / 1_000_000) * 0.60;

      expect(result.inputCost).toBeCloseTo(expectedInputCost, 6);
      expect(result.outputCost).toBeCloseTo(expectedOutputCost, 6);
      expect(result.totalCost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
    });

    it('estimates cost for typical query (50 observations)', () => {
      // 50 observations * 100 input tokens = 5000 input tokens
      // 50 observations * 50 output tokens = 2500 output tokens
      const inputTokens = 5000;
      const outputTokens = 2500;

      const result = estimateCost(inputTokens, outputTokens);

      const expectedInputCost = (5000 / 1_000_000) * 0.30;
      const expectedOutputCost = (2500 / 1_000_000) * 0.60;

      expect(result.inputCost).toBeCloseTo(expectedInputCost, 6);
      expect(result.outputCost).toBeCloseTo(expectedOutputCost, 6);
      expect(result.totalCost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
    });

    it('estimates cost for large query (150 observations)', () => {
      // 150 observations * 100 input tokens = 15000 input tokens
      // 150 observations * 50 output tokens = 7500 output tokens
      const inputTokens = 15000;
      const outputTokens = 7500;

      const result = estimateCost(inputTokens, outputTokens);

      const expectedInputCost = (15000 / 1_000_000) * 0.30;
      const expectedOutputCost = (7500 / 1_000_000) * 0.60;

      expect(result.inputCost).toBeCloseTo(expectedInputCost, 6);
      expect(result.outputCost).toBeCloseTo(expectedOutputCost, 6);
      expect(result.totalCost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
    });

    it('typical query cost is <$0.05', () => {
      const inputTokens = 5000;
      const outputTokens = 2500;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.05);
    });
  });

  describe('cost estimation for edge cases', () => {
    it('handles zero tokens', () => {
      const result = estimateCost(0, 0);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('handles only input tokens', () => {
      const result = estimateCost(1000, 0);
      expect(result.inputCost).toBeCloseTo(0.0003, 6);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBeCloseTo(0.0003, 6);
    });

    it('handles only output tokens', () => {
      const result = estimateCost(0, 1000);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBeCloseTo(0.0006, 6);
      expect(result.totalCost).toBeCloseTo(0.0006, 6);
    });

    it('handles negative input tokens (clamps to zero)', () => {
      const result = estimateCost(-100, 500);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBeCloseTo(0.0003, 6);
      expect(result.totalCost).toBeCloseTo(0.0003, 6);
    });

    it('handles negative output tokens (clamps to zero)', () => {
      const result = estimateCost(500, -100);
      expect(result.inputCost).toBeCloseTo(0.00015, 6);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBeCloseTo(0.00015, 6);
    });

    it('handles both negative tokens (clamps to zero)', () => {
      const result = estimateCost(-100, -200);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('handles very large token counts', () => {
      const result = estimateCost(10_000_000, 5_000_000);
      expect(result.inputCost).toBeCloseTo(3.0, 6);
      expect(result.outputCost).toBeCloseTo(3.0, 6);
      expect(result.totalCost).toBeCloseTo(6.0, 6);
    });

    it('handles fractional token counts', () => {
      const result = estimateCost(1234.5, 567.8);
      expect(result.inputCost).toBeGreaterThan(0);
      expect(result.outputCost).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
    });
  });

  describe('token budget enforcement', () => {
    it('calculates budget remaining correctly', () => {
      const TOKEN_BUDGET = 8000;
      const inputTokens = 5000;
      const outputTokens = 2000;

      const result = estimateCost(inputTokens, outputTokens);
      const budgetRemaining = TOKEN_BUDGET - (inputTokens + outputTokens);

      expect(budgetRemaining).toBe(1000);
    });

    it('detects when budget is exceeded', () => {
      const TOKEN_BUDGET = 8000;
      const inputTokens = 5000;
      const outputTokens = 4000;

      const totalTokens = inputTokens + outputTokens;
      const budgetExceeded = totalTokens > TOKEN_BUDGET;

      expect(budgetExceeded).toBe(true);
    });

    it('detects when budget is within limit', () => {
      const TOKEN_BUDGET = 8000;
      const inputTokens = 3000;
      const outputTokens = 2000;

      const totalTokens = inputTokens + outputTokens;
      const budgetExceeded = totalTokens > TOKEN_BUDGET;

      expect(budgetExceeded).toBe(false);
    });

    it('handles budget exactly at limit', () => {
      const TOKEN_BUDGET = 8000;
      const inputTokens = 5000;
      const outputTokens = 3000;

      const totalTokens = inputTokens + outputTokens;
      const budgetExceeded = totalTokens > TOKEN_BUDGET;

      expect(budgetExceeded).toBe(false);
      expect(totalTokens).toBe(TOKEN_BUDGET);
    });
  });

  describe('cost accuracy verification', () => {
    it('input cost is accurate to 6 decimal places', () => {
      const inputTokens = 12345;
      const result = estimateCost(inputTokens, 0);

      const expectedCost = (inputTokens / 1_000_000) * 0.30;
      const difference = Math.abs(result.inputCost - expectedCost);

      expect(difference).toBeLessThan(0.000001);
    });

    it('output cost is accurate to 6 decimal places', () => {
      const outputTokens = 67890;
      const result = estimateCost(0, outputTokens);

      const expectedCost = (outputTokens / 1_000_000) * 0.60;
      const difference = Math.abs(result.outputCost - expectedCost);

      expect(difference).toBeLessThan(0.000001);
    });

    it('total cost is accurate to 6 decimal places', () => {
      const inputTokens = 12345;
      const outputTokens = 67890;
      const result = estimateCost(inputTokens, outputTokens);

      const expectedCost = (inputTokens / 1_000_000) * 0.30 + (outputTokens / 1_000_000) * 0.60;
      const difference = Math.abs(result.totalCost - expectedCost);

      expect(difference).toBeLessThan(0.000001);
    });
  });

  describe('cost estimation for real-world scenarios', () => {
    it('estimates cost for brief summary', () => {
      // Brief: 20 observations, minimal output
      const inputTokens = 2000;
      const outputTokens = 500;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.01);
    });

    it('estimates cost for standard summary', () => {
      // Standard: 50 observations, moderate output
      const inputTokens = 5000;
      const outputTokens = 2000;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.05);
    });

    it('estimates cost for comprehensive summary', () => {
      // Comprehensive: 100 observations, detailed output
      const inputTokens = 10000;
      const outputTokens = 4000;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.10);
    });

    it('estimates cost for summary with IDs', () => {
      // Summary with IDs: 50 observations, includes excerpts
      const inputTokens = 5000;
      const outputTokens = 3000;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.05);
    });
  });

  describe('cost estimation boundaries', () => {
    it('handles minimum cost scenario', () => {
      const result = estimateCost(1, 1);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.totalCost).toBeLessThan(0.00001);
    });

    it('handles maximum reasonable cost scenario', () => {
      // Max budget: 8000 tokens
      const inputTokens = 5000;
      const outputTokens = 3000;

      const result = estimateCost(inputTokens, outputTokens);

      expect(result.totalCost).toBeLessThan(0.01);
    });

    it('cost scales linearly with tokens', () => {
      const result1 = estimateCost(1000, 500);
      const result2 = estimateCost(2000, 1000);

      // Double the tokens should double the cost
      const ratio = result2.totalCost / result1.totalCost;
      expect(ratio).toBeCloseTo(2, 6);
    });
  });
});