/**
 * Hook Performance Benchmarks
 *
 * Purpose:
 * - Measure execution time for each hook in the memory plugin
 * - Calculate p50, p95, p99 statistics
 * - Output in CI-friendly format
 * - Track performance regressions
 *
 * Benchmarks:
 * - session.created
 * - tool.execute.before
 * - tool.execute.after
 * - message.created
 * - session.idle
 *
 * @module src/__tests__/benchmarks/hook-performance
 */

interface BenchmarkResult {
  hookName: string;
  iterations: number;
  times: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

function calculatePercentile(sortedTimes: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedTimes.length) - 1;
  return sortedTimes[Math.max(0, Math.min(index, sortedTimes.length - 1))];
}

function runBenchmark(hookName: string, fn: () => void | Promise<void>, iterations: number = 100): BenchmarkResult {
  const times: number[] = [];
  
  // Warmup
  for (let i = 0; i < 10; i++) {
    fn();
  }
  
  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = fn();
    if (result instanceof Promise) {
      throw new Error('Use runAsyncBenchmark for async functions');
    }
    const end = performance.now();
    times.push(end - start);
  }
  
  const sorted = [...times].sort((a, b) => a - b);
  
  return {
    hookName,
    iterations,
    times,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

async function runAsyncBenchmark(hookName: string, fn: () => Promise<void>, iterations: number = 50): Promise<BenchmarkResult> {
  const times: number[] = [];
  
  // Warmup
  for (let i = 0; i < 5; i++) {
    await fn();
  }
  
  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const sorted = [...times].sort((a, b) => a - b);
  
  return {
    hookName,
    iterations,
    times,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

function formatBenchmarkOutput(result: BenchmarkResult): string {
  return `[PERFORMANCE] ${result.hookName}: ${result.avg.toFixed(2)}ms avg (p50: ${result.p50.toFixed(2)}ms, p95: ${result.p95.toFixed(2)}ms, p99: ${result.p99.toFixed(2)}ms, min: ${result.min.toFixed(2)}ms, max: ${result.max.toFixed(2)}ms) [${result.iterations} iterations]`;
}

function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('HOOK PERFORMANCE BENCHMARKS');
  console.log('='.repeat(80));
  
  for (const result of results) {
    console.log(formatBenchmarkOutput(result));
  }
  
  console.log('='.repeat(80));
  console.log('\nSummary:');
  
  const targets: Record<string, number> = {
    'session.created': 100,
    'tool.execute.before': 5,
    'tool.execute.after': 20,
    'message.created': 25,
    'session.idle': 50,
  };
  
  let allPassed = true;
  for (const result of results) {
    const target = targets[result.hookName];
    if (target) {
      const status = result.p95 <= target ? '✅ PASS' : '❌ FAIL';
      if (result.p95 > target) allPassed = false;
      console.log(`  ${result.hookName}: ${result.p95.toFixed(2)}ms p95 vs ${target}ms target ${status}`);
    }
  }
  
  console.log(`\nOverall: ${allPassed ? '✅ ALL BENCHMARKS PASSED' : '❌ SOME BENCHMARKS FAILED'}`);
  console.log('='.repeat(80) + '\n');
  
  return allPassed;
}

// Mock infrastructure
let mockSessionId: string | null = null;
const mockCallArgsMap = new Map<string, any>();
const mockCallTimingMap = new Map<string, { started_at: string; started_at_ms: number }>();
const mockObservations: any[] = [];

const mockOutbox = {
  push: (obs: any) => {
    mockObservations.push(obs);
  },
  drain: async () => {},
};

const mockLogger = {
  info: () => {},
  debug: () => {},
  error: () => {},
};

// Hook implementations
function sessionCreatedHook(project: string, directory: string) {
  mockSessionId = `bench-session-${Date.now()}`;
  
  mockOutbox.push({
    session_id: mockSessionId,
    source: 'opencode',
    project,
    cwd: directory,
    tool: 'session_start',
    title: 'Session Started',
    type: 'discovery',
    narrative: `Benchmark session started`,
    concepts: ['session-start'],
    facts: ['benchmark'],
    content: 'Session created',
    timestamp: new Date().toISOString(),
  });
  
  return mockSessionId;
}

function toolExecuteBeforeHook(tool: string, callID: string, args: any) {
  const now = new Date();
  mockCallArgsMap.set(callID, args);
  mockCallTimingMap.set(callID, {
    started_at: now.toISOString(),
    started_at_ms: now.getTime(),
  });
}

function toolExecuteAfterHook(tool: string, callID: string, output: string, sessionId: string) {
  const args = mockCallArgsMap.get(callID) || {};
  mockCallArgsMap.delete(callID);
  
  const timing = mockCallTimingMap.get(callID);
  mockCallTimingMap.delete(callID);
  
  const ended_at = new Date().toISOString();
  const execution_time_ms = timing ? Date.now() - timing.started_at_ms : undefined;
  
  mockOutbox.push({
    session_id: sessionId,
    source: 'opencode',
    project: 'benchmark',
    cwd: '/benchmark',
    tool,
    title: `${tool}: execution`,
    type: 'execution',
    narrative: `Executed ${tool}`,
    concepts: ['tool-execution'],
    facts: [],
    content: output,
    timestamp: new Date().toISOString(),
    oc_metadata: {
      execution_time_ms,
      success: true,
      started_at: timing?.started_at,
      ended_at,
    },
  });
}

function messageCreatedHook(content: string, sessionId: string) {
  mockOutbox.push({
    session_id: sessionId,
    source: 'opencode',
    project: 'benchmark',
    cwd: '/benchmark',
    tool: 'user_prompt',
    title: `Prompt: ${content.slice(0, 50)}...`,
    type: 'discovery',
    narrative: `User prompt: ${content}`,
    concepts: ['user-interaction'],
    facts: [content],
    content,
    timestamp: new Date().toISOString(),
  });
}

async function sessionIdleHook(
  sessionId: string,
  sessionStartTime: Date,
  observationCount: number,
  userStopped: boolean = false
) {
  const durationMs = Date.now() - sessionStartTime.getTime();
  const durationMinutes = durationMs / 1000 / 60;
  const IDLE_TIMEOUT_MINUTES = 15;
  
  if (userStopped || (durationMinutes > IDLE_TIMEOUT_MINUTES && observationCount > 0)) {
    const summaryType = userStopped ? 'final' : 'checkpoint';
    
    mockLogger.info(`Session ${userStopped ? 'stopped' : 'idle'}`);
    
    await mockOutbox.drain();
    
    const summaryObs = {
      session_id: sessionId,
      type: 'summary',
      title: `${summaryType} summary`,
      narrative: 'Benchmark summary',
      text: 'Summary',
      concepts: ['summary'],
      facts: [],
      project: 'benchmark',
      cwd: '/benchmark',
      oc_metadata: { summary_type: summaryType },
    };
    
    mockOutbox.push(summaryObs);
    
    return { processed: true, summaryType };
  }
  
  return { processed: false };
}

// Main benchmark runner
async function runStandaloneBenchmarks() {
  console.log('\n' + '='.repeat(80));
  console.log('STANDALONE HOOK PERFORMANCE BENCHMARKS');
  console.log('='.repeat(80));
  console.log(`Runtime: ${typeof Bun !== 'undefined' ? 'Bun ' + Bun.version : 'Node ' + process.version}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(80) + '\n');
  
  const results: BenchmarkResult[] = [];
  
  // Reset state
  mockObservations.length = 0;
  mockCallArgsMap.clear();
  mockCallTimingMap.clear();
  
  // session.created
  console.log('Benchmarking session.created...');
  let c1 = 0;
  results.push(runBenchmark('session.created', () => {
    sessionCreatedHook('benchmark-project', '/benchmark/project');
  }, 100));
  
  // tool.execute.before
  console.log('Benchmarking tool.execute.before...');
  let c2 = 0;
  results.push(runBenchmark('tool.execute.before', () => {
    toolExecuteBeforeHook('read', `bench-${c2++}`, { file_path: '/test/file.ts' });
  }, 100));
  
  // tool.execute.after
  console.log('Benchmarking tool.execute.after...');
  for (let i = 0; i < 100; i++) {
    const now = new Date();
    mockCallTimingMap.set(`standalone-${i}`, {
      started_at: now.toISOString(),
      started_at_ms: now.getTime(),
    });
    mockCallArgsMap.set(`standalone-${i}`, { file_path: '/test/file.ts' });
  }
  let c3 = 0;
  results.push(runBenchmark('tool.execute.after', () => {
    toolExecuteAfterHook('read', `standalone-${c3++}`, 'content', 'standalone-session');
  }, 100));
  
  // message.created
  console.log('Benchmarking message.created...');
  let c4 = 0;
  results.push(runBenchmark('message.created', () => {
    messageCreatedHook(`Message ${c4++}`, 'standalone-session');
  }, 100));
  
  // session.idle
  console.log('Benchmarking session.idle...');
  const sessionStartTime = new Date(Date.now() - 16 * 60 * 1000);
  results.push(await runAsyncBenchmark('session.idle', async () => {
    await sessionIdleHook('standalone-session', sessionStartTime, 10, false);
  }, 50));
  
  // Print results
  const allPassed = printResults(results);
  
  // Output JSON report
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      runtime: typeof Bun !== 'undefined' ? 'bun' : 'node',
      version: typeof Bun !== 'undefined' ? Bun.version : process.version,
      platform: process.platform,
      arch: process.arch,
    },
    results: results.map(r => ({
      hook: r.hookName,
      p50: Math.round(r.p50 * 100) / 100,
      p95: Math.round(r.p95 * 100) / 100,
      p99: Math.round(r.p99 * 100) / 100,
      avg: Math.round(r.avg * 100) / 100,
      min: Math.round(r.min * 100) / 100,
      max: Math.round(r.max * 100) / 100,
    })),
    targets: {
      'session.created': 100,
      'tool.execute.before': 5,
      'tool.execute.after': 20,
      'message.created': 25,
      'session.idle': 50,
    },
  };
  
  console.log('\n[JSON_REPORT]');
  console.log(JSON.stringify(report, null, 2));
  
  process.exit(allPassed ? 0 : 1);
}

// Run standalone if executed directly
if (import.meta.main) {
  runStandaloneBenchmarks();
}

export { runBenchmark, runAsyncBenchmark, calculatePercentile, formatBenchmarkOutput };
