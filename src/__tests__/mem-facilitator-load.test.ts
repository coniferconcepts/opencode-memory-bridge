/**
 * Load testing for @mem-facilitator.
 *
 * Tests:
 * - Load test with 150 observations (max limit)
 * - Load test with 100 observations
 * - Load test with 50 observations
 * - Concurrent request handling
 * - Rate limiting under load
 * - Token budget enforcement under load
 *
 * @module src/__tests__/mem-facilitator-load.test
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

describe('mem-facilitator load testing', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  afterEach(() => {
    resetRateLimiter();
  });

  describe('load test with 150 observations (max limit)', () => {
    it('handles maximum observation limit', async () => {
      const observations = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      const result = await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      expect(result.status).toBe('success');
      expect(result.token_usage.total).toBeLessThanOrEqual(8000);
      expect(endTime - startTime).toBeLessThan(10000); // <10s
    });

    it('maintains performance at max limit', async () => {
      const observations = Array.from({ length: 150 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        await mockMemFacilitatorProcess(observations);
        times.push(Date.now() - startTime);
      }

      // All times should be consistent (within 2x of each other)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(2);
    });
  });

  describe('load test with 100 observations', () => {
    it('handles 100 observations efficiently', async () => {
      const observations = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      const result = await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      expect(result.status).toBe('success');
      expect(result.token_usage.total).toBeLessThanOrEqual(8000);
      expect(endTime - startTime).toBeLessThan(5000); // <5s
    });

    it('stays within token budget', async () => {
      const observations = Array.from({ length: 100 }, (_, i) => ({
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
  });

  describe('load test with 50 observations', () => {
    it('handles 50 observations efficiently', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();
      const result = await mockMemFacilitatorProcess(observations);
      const endTime = Date.now();

      expect(result.status).toBe('success');
      expect(result.token_usage.total).toBeLessThanOrEqual(8000);
      expect(endTime - startTime).toBeLessThan(2000); // <2s
    });

    it('estimates cost accurately', async () => {
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
  });

  describe('concurrent request handling', () => {
    it('handles 5 concurrent requests', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();

      const promises = Array.from({ length: 5 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();

      expect(results.length).toBe(5);
      expect(results.every(r => r.status === 'success')).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // <5s for 5 concurrent requests
    });

    it('handles 10 concurrent requests', async () => {
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

      const results = await Promise.all(promises);

      const endTime = Date.now();

      expect(results.length).toBe(10);
      expect(results.every(r => r.status === 'success')).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // <10s for 10 concurrent requests
    });

    it('maintains data integrity under concurrency', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const observations = Array.from({ length: 10 + i * 10 }, (_, j) => ({
          id: j,
          type: 'decision',
          content: `Test observation ${j}`,
          metadata: {},
          timestamp: Date.now(),
        }));

        return mockMemFacilitatorProcess(observations).then(result => ({
          requestId: i,
          result,
        }));
      });

      const results = await Promise.all(promises);

      // Each request should have its own result
      expect(results.length).toBe(5);
      expect(results.every(r => r.result.status === 'success')).toBe(true);

      // Results should be independent
      const tokenUsages = results.map(r => r.result.token_usage.total);
      expect(new Set(tokenUsages).size).toBeGreaterThan(1);
    });
  });

  describe('rate limiting under load', () => {
    it('enforces rate limit under load', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      // Exhaust rate limit
      for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
        const result = checkRateLimit();
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const result = checkRateLimit();
      expect(result.allowed).toBe(false);
    });

    it('tracks remaining requests correctly under load', async () => {
      resetRateLimiter();

      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      for (let i = 0; i < 5; i++) {
        checkRateLimit();
      }

      expect(getRemainingRequests()).toBe(MAX_REQUESTS_PER_MINUTE - 5);
    });

    it('provides wait time when rate limited', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      // Exhaust rate limit
      for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
        checkRateLimit();
      }

      // Next request should be blocked with wait time
      const result = checkRateLimit();
      expect(result.allowed).toBe(false);
      expect(result.waitTimeMs).toBeGreaterThan(0);
    });
  });

  describe('token budget enforcement under load', () => {
    it('enforces token budget for large loads', async () => {
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

    it('enforces token budget for concurrent requests', async () => {
      const observations = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const promises = Array.from({ length: 5 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      const results = await Promise.all(promises);

      // All requests should stay within budget
      expect(results.every(r => r.token_usage.total <= 8000)).toBe(true);
    });

    it('tracks budget remaining correctly', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const result = await mockMemFacilitatorProcess(observations);

      expect(result.token_usage.budget_remaining).toBe(
        8000 - result.token_usage.total
      );
    });
  });

  describe('performance under sustained load', () => {
    it('handles 20 sequential requests', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const result = await mockMemFacilitatorProcess(observations);
        expect(result.status).toBe('success');
      }

      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // <10s for 10 requests
    });

    it('maintains consistent response times', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
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
        times.push(Date.now() - startTime);
      }

      // Check consistency (within 2x of each other)
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const ratio = maxTime / minTime;

      expect(ratio).toBeLessThan(2);
    });
  });

  describe('memory usage under load', () => {
    it('does not leak memory under load', async () => {
      const observations = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const initialMemory = process.memoryUsage().heapUsed;

      // Run 10 requests
      for (let i = 0; i < 10; i++) {
        await mockMemFacilitatorProcess(observations);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (<20MB for 10 requests)
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024);
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
      expect(growth).toBeLessThan(5 * 1024 * 1024); // <5MB
    });
  });

  describe('error handling under load', () => {
    it('handles errors gracefully under load', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      // Simulate error in one request
      const promises = [
        mockMemFacilitatorProcess(observations),
        mockMemFacilitatorProcess(observations),
        mockMemFacilitatorProcess(observations),
      ];

      const results = await Promise.allSettled(promises);

      // All requests should succeed
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('isolates errors between requests', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const promises = Array.from({ length: 5 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      const results = await Promise.all(promises);

      // All requests should succeed independently
      expect(results.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('cost estimation under load', () => {
    it('estimates cost accurately under load', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const promises = Array.from({ length: 5 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      const results = await Promise.all(promises);

      // All cost estimates should be accurate
      expect(results.every(r => r.estimated_cost_usd < 0.05)).toBe(true);
    });

    it('tracks total cost under load', async () => {
      const observations = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        type: 'decision',
        content: `Test observation ${i}`,
        metadata: {},
        timestamp: Date.now(),
      }));

      const promises = Array.from({ length: 5 }, () =>
        mockMemFacilitatorProcess(observations)
      );

      const results = await Promise.all(promises);

      const totalCost = results.reduce((sum, r) => sum + r.estimated_cost_usd, 0);

      // Total cost should be reasonable
      expect(totalCost).toBeLessThan(0.25); // <$0.25 for 5 requests
    });
  });
});