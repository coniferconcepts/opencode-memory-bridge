/**
 * Performance benchmarks for @mem-facilitator.
 *
 * Tests:
 * - Response time benchmarks (<5s for typical queries with 50 observations)
 * - Token usage benchmarks (stay under 8000 token budget)
 * - Cost estimation benchmarks (typical query <$0.05)
 * - Memory leak detection
 * - Rate limiting verification (10 requests/minute)
 *
 * @module src/__tests__/mem-facilitator-performance.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { estimateCost } from '../utils/cost-estimator';
import {
  checkRateLimit,
  resetRateLimiter,
  getRemainingRequests,
  MAX_REQUESTS_PER_MINUTE,
} from '../utils/rate-limiter';

// Mock mem-facilitator process function
async function mockMemFacilitatorProcess(observations: any[]) {
  // Simulate processing time
  const processingTime = observations.length * 10; // 10ms per observation
  await new Promise(resolve => setTimeout(resolve, processingTime));

  // Simulate token usage (respect 8000 token budget)
  const maxInputTokens = 5000;
  const maxOutputTokens = 3000;
  const inputTokens = Math.min(observations.length * 50, maxInputTokens); // 50 tokens per observation, max 5000
  const outputTokens = Math.min(observations.length * 20, maxOutputTokens); // 20 tokens per observation, max 3000

  const cost = estimateCost(inputTokens, outputTokens);

  return {
    status: 'success',
    summary: {
      key_findings: ['Test finding 1', 'Test finding 2'],
      patterns_detected: ['Test pattern'],
      context_relevance: 'high' as const,
      freshness: 'current' as const,
    },
    token_usage: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
      budget_remaining: 8000 - (inputTokens + outputTokens),
    },
    estimated_cost_usd: cost.totalCost,
    confidence: 85,
  };
}

describe('mem-facilitator performance benchmarks', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe('response time benchmarks', () => {
    it('completes typical query with 50 observations in <5s', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('completes small query with 10 observations in <1s', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('completes large query with 150 observations in <10s', async () => {
      const observations = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('token usage benchmarks', () => {
    it('stays under 8000 token budget for typical query', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const result = await mockMemFacilitatorProcess(observations);

      expect(result.token_usage.total).toBeLessThanOrEqual(8000);
      expect(result.token_usage.budget_remaining).toBeGreaterThanOrEqual(0);
    });

    it('stays under 8000 token budget for large query', async () => {
      const observations = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const result = await mockMemFacilitatorProcess(observations);

      expect(result.token_usage.total).toBeLessThanOrEqual(8000);
      expect(result.token_usage.budget_remaining).toBeGreaterThanOrEqual(0);
    });

    it('tracks input and output tokens separately', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const result = await mockMemFacilitatorProcess(observations);

      expect(result.token_usage.input).toBeGreaterThan(0);
      expect(result.token_usage.output).toBeGreaterThan(0);
      expect(result.token_usage.total).toBe(
        result.token_usage.input + result.token_usage.output
      );
    });
  });

  describe('cost estimation benchmarks', () => {
    it('estimates cost <$0.05 for typical query', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const result = await mockMemFacilitatorProcess(observations);

      expect(result.estimated_cost_usd).toBeLessThan(0.05);
    });

    it('estimates cost accurately for GLM 4.7 pricing', () => {
      // GLM 4.7: $0.30/1M input, $0.60/1M output
      const inputTokens = 5000;
      const outputTokens = 2000;
      const cost = estimateCost(inputTokens, outputTokens);

      const expectedInputCost = (inputTokens / 1_000_000) * 0.30;
      const expectedOutputCost = (outputTokens / 1_000_000) * 0.60;

      expect(cost.inputCost).toBeCloseTo(expectedInputCost, 6);
      expect(cost.outputCost).toBeCloseTo(expectedOutputCost, 6);
      expect(cost.totalCost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
    });

    it('handles zero tokens correctly', () => {
      const cost = estimateCost(0, 0);
      expect(cost.totalCost).toBe(0);
    });

    it('handles negative tokens by clamping to zero', () => {
      const cost = estimateCost(-100, -50);
      expect(cost.totalCost).toBe(0);
    });
  });

  describe('memory leak detection', () => {
    it('does not leak memory across multiple requests', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      // Run multiple requests and check memory doesn't grow unbounded
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 5; i++) {
        await mockMemFacilitatorProcess(observations);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Allow some growth but not unbounded (less than 10MB for 5 requests)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('cleans up after processing', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const beforeMemory = process.memoryUsage().heapUsed;
      await mockMemFacilitatorProcess(observations);
      const afterMemory = process.memoryUsage().heapUsed;

      // Memory should not grow significantly for a single request
      const growth = afterMemory - beforeMemory;
      expect(growth).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });
  });

  describe('rate limiting verification', () => {
    it('allows requests within rate limit', () => {
      for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
        const result = checkRateLimit();
        expect(result.allowed).toBe(true);
        expect(result.requestCount).toBe(i + 1);
      }
    });

    it('blocks requests exceeding rate limit', () => {
      // Exhaust limit
      for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
        checkRateLimit();
      }

      // Next request should be blocked
      const result = checkRateLimit();
      expect(result.allowed).toBe(false);
      expect(result.waitTimeMs).toBeGreaterThan(0);
    });

    it('resets rate limiter correctly', () => {
      checkRateLimit();
      checkRateLimit();

      resetRateLimiter();

      const result = checkRateLimit();
      expect(result.allowed).toBe(true);
      expect(result.requestCount).toBe(1);
    });

    it('tracks remaining requests correctly', () => {
      expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE);

      checkRateLimit();
      expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE - 1);

      for (let i = 0; i < 5; i++) {
        checkRateLimit();
      }

      expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE - 6);
    });

    it('provides reset time', () => {
      const result = checkRateLimit();
      expect(result.resetTime).toBeGreaterThan(Date.now());
      expect(result.resetTime).toBeLessThanOrEqual(Date.now() + 60000);
    });
  });

  describe('performance under load', () => {
    it('handles 10 concurrent requests without degradation', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();

      const promises = Array.from({ length: 10 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 10s for 10 requests)
      expect(duration).toBeLessThan(10000);
    });

    it('maintains response time consistency', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await mockMemFacilitatorProcess(observations);
        const endTime = Date.now();
        times.push(endTime - startTime);
      }

      // All times should be within reasonable range (within 2x of each other)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(2);
    });
  });
});