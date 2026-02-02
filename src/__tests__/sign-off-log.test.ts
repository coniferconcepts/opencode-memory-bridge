import { describe, it, expect } from 'bun:test';
import { logSignOff } from '../utils/sign-off-log';

describe('sign-off log', () => {
  it('logs without throwing', () => {
    const entry = {
      timestamp: Date.now(),
      agent: 'mem-facilitator',
      jurisdiction: 'US' as const,
      model: 'opencode/glm-4.7',
      operation: 'observation_review',
      tokenUsage: { input: 100, output: 200, total: 300 },
      cost: 0.0003,
    };

    expect(() => logSignOff(entry)).not.toThrow();
  });
});