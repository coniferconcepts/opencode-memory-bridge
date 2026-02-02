import { describe, it, expect } from 'bun:test';
import { estimateCost } from '../utils/cost-estimator';

describe('estimateCost', () => {
  it('calculates cost correctly for 1M/1M tokens', () => {
    const result = estimateCost(1_000_000, 1_000_000);
    expect(result.inputCost).toBeCloseTo(0.30, 6);
    expect(result.outputCost).toBeCloseTo(0.60, 6);
    expect(result.totalCost).toBeCloseTo(0.90, 6);
  });

  it('clamps negative tokens to zero', () => {
    const result = estimateCost(-10, -20);
    expect(result.totalCost).toBe(0);
  });
});