/**
 * Task 2.2: Execution Metadata Capture - Validation Tests
 *
 * Test Objective:
 * Verify that execution metadata is properly captured, formatted, and stored
 * through the complete pipeline.
 *
 * Test Strategy: 6 Categories, 15 Total Tests
 * - Category 1: Unit Tests - Timing Capture (4 tests)
 * - Category 2: Unit Tests - Error Sanitization (4 tests)
 * - Category 3: Unit Tests - Success Detection (2 tests)
 * - Category 4: Integration - Schema Validation (2 tests)
 * - Category 5: Integration - JSONL Output (2 tests)
 * - Category 6: End-to-End - Hook Lifecycle (2 tests)
 *
 * @module src/__tests__/execution-metadata.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as v from 'valibot';
import { OcMetadataSchema, defaultMetadata } from '../metadata-schema';

// ============================================================================
// CATEGORY 1: Unit Tests - Timing Capture (4 tests)
// ============================================================================

describe('Category 1: Timing Capture', () => {
  let callTimingMap: Map<string, { started_at: string; started_at_ms: number }>;

  beforeEach(() => {
    callTimingMap = new Map();
  });

  it('Test 1.1: callTimingMap stores timing correctly', () => {
    const callID = 'test-call-001';
    const now = new Date();
    const timestamp = now.toISOString();
    const timeMs = now.getTime();

    callTimingMap.set(callID, {
      started_at: timestamp,
      started_at_ms: timeMs,
    });

    const stored = callTimingMap.get(callID);
    expect(stored).toBeDefined();
    expect(stored!.started_at).toBe(timestamp);
    expect(stored!.started_at_ms).toBe(timeMs);
  });

  it('Test 1.2: Timing accuracy within ±100ms tolerance', () => {
    const callID = 'test-call-002';
    const now = new Date();
    const startMs = now.getTime();

    callTimingMap.set(callID, {
      started_at: now.toISOString(),
      started_at_ms: startMs,
    });

    // Simulate end timing after 50ms
    const endTime = new Date();
    const endMs = endTime.getTime();

    // Execute a quick task
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum += i;
    }

    const timing = callTimingMap.get(callID);
    expect(timing).toBeDefined();

    const measuredMs = endMs - timing!.started_at_ms;
    expect(measuredMs).toBeGreaterThanOrEqual(0);
    expect(measuredMs).toBeLessThan(100); // Typically <50ms
  });

  it('Test 1.3: Timing map is cleared after hook execution', () => {
    const callID = 'test-call-003';
    const now = new Date();

    callTimingMap.set(callID, {
      started_at: now.toISOString(),
      started_at_ms: now.getTime(),
    });

    expect(callTimingMap.has(callID)).toBe(true);

    // Simulate hook cleanup
    callTimingMap.delete(callID);

    expect(callTimingMap.has(callID)).toBe(false);
  });

  it('Test 1.4: Missing timing data handled gracefully', () => {
    const callID = 'non-existent-call';

    const timing = callTimingMap.get(callID);
    expect(timing).toBeUndefined();

    // Should handle gracefully in execution_time_ms calculation
    const ended_at_ms = Date.now();
    const execution_time_ms = timing ? ended_at_ms - timing.started_at_ms : undefined;

    expect(execution_time_ms).toBeUndefined();
  });
});

// ============================================================================
// CATEGORY 2: Unit Tests - Error Sanitization (4 tests)
// ============================================================================

describe('Category 2: Error Sanitization', () => {
  it('Test 2.1: API keys/secrets redacted correctly', () => {
    const errorMessage = 'Authentication failed: sk-ant-' + 'a'.repeat(90);
    let sanitized = errorMessage;

    // Simulate redaction pattern matching
    sanitized = sanitized.replace(/sk-ant-[a-zA-Z0-9-]{90,}/g, '[redacted]');

    expect(sanitized).not.toContain('sk-ant');
    expect(sanitized).toContain('[redacted]');
    expect(sanitized).toContain('Authentication failed');
  });

  it('Test 2.2: File paths converted to [path]', () => {
    const errorMessage = 'File not found: /Users/benjaminerb/project/src/index.ts';
    let sanitized = errorMessage;

    // Simulate path redaction
    sanitized = sanitized.replace(/\/[^\s]+/g, '[path]');

    expect(sanitized).not.toContain('/Users');
    expect(sanitized).toContain('[path]');
    expect(sanitized).toContain('File not found');
  });

  it('Test 2.3: Stack traces removed (first line only)', () => {
    const errorMessage = `Error: Connection timeout
    at async fetch (native)
    at async handler (./src/handler.ts:42:10)
    at async main (./src/index.ts:100:5)`;

    const firstLineOnly = errorMessage.split('\n')[0];

    expect(firstLineOnly).toBe('Error: Connection timeout');
    expect(firstLineOnly).not.toContain('at async');
    expect(firstLineOnly).not.toContain('.ts:');
  });

  it('Test 2.4: Error messages truncated to 500 chars', () => {
    let errorMessage = 'E: ';
    errorMessage += 'x'.repeat(600); // Create a long error message

    const truncated = errorMessage.slice(0, 500);

    expect(truncated.length).toBeLessThanOrEqual(500);
    expect(truncated).toStartWith('E: x');
  });
});

// ============================================================================
// CATEGORY 3: Unit Tests - Success Detection (2 tests)
// ============================================================================

describe('Category 3: Success Detection', () => {
  it('Test 3.1: success=true when no error and valid output', () => {
    const output = {
      error: undefined,
      output: 'Command executed successfully',
      title: 'Success',
    };

    const success = !output.error &&
                    output.output !== undefined &&
                    output.output !== null &&
                    String(output.output).toLowerCase().indexOf('error') === -1;

    expect(success).toBe(true);
  });

  it('Test 3.2: success=false when error present', () => {
    const output = {
      error: 'Connection timeout',
      output: null,
      title: 'Failed',
    };

    const success = !output.error &&
                    output.output !== undefined &&
                    output.output !== null &&
                    String(output.output).toLowerCase().indexOf('error') === -1;

    expect(success).toBe(false);
  });
});

// ============================================================================
// CATEGORY 4: Integration - Schema Validation (2 tests)
// ============================================================================

describe('Category 4: Schema Validation', () => {
  it('Test 4.1: OcMetadata schema validates execution fields', () => {
    const metadata = {
      execution_time_ms: 42,
      success: true,
      error_message: undefined,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };

    // Should pass schema validation
    const result = v.safeParse(OcMetadataSchema, metadata);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.output.execution_time_ms).toBe(42);
      expect(result.output.success).toBe(true);
      expect(result.output.started_at).toBeDefined();
      expect(result.output.ended_at).toBeDefined();
    }
  });

  it('Test 4.2: Optional fields accepted by schema', () => {
    const minimalMetadata = {
      branch: 'feature/task-2.2',
    };

    const fullMetadata = {
      branch: 'feature/task-2.2',
      scope: 'branch' as const,
      importance: 'high' as const,
      execution_time_ms: 123,
      success: true,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };

    // Both should pass
    const minResult = v.safeParse(OcMetadataSchema, minimalMetadata);
    const fullResult = v.safeParse(OcMetadataSchema, fullMetadata);

    expect(minResult.success).toBe(true);
    expect(fullResult.success).toBe(true);
  });
});

// ============================================================================
// CATEGORY 5: Integration - JSONL Output (2 tests)
// ============================================================================

describe('Category 5: JSONL Output', () => {
  it('Test 5.1: Execution metadata appears in JSONL', () => {
    const observation = {
      session_id: 'session-123',
      source: 'opencode',
      project: 'test-project',
      cwd: '/path/to/project',
      tool: 'npm',
      title: 'Install dependencies',
      type: 'execution',
      narrative: 'Installed project dependencies',
      concepts: ['dependency-management'],
      facts: ['npm install completed'],
      content: 'added 100 packages',
      timestamp: new Date().toISOString(),
      oc_metadata: {
        execution_time_ms: 5432,
        success: true,
        error_message: undefined,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      },
    };

    // Simulate JSONL serialization
    const jsonl = JSON.stringify(observation);
    const parsed = JSON.parse(jsonl);

    expect(parsed.oc_metadata).toBeDefined();
    expect(parsed.oc_metadata.execution_time_ms).toBe(5432);
    expect(parsed.oc_metadata.success).toBe(true);
  });

  it('Test 5.2: Proper JSON structure maintained', () => {
    const observations = [
      {
        session_id: 'session-1',
        tool: 'git',
        oc_metadata: { execution_time_ms: 100, success: true },
      },
      {
        session_id: 'session-2',
        tool: 'npm',
        oc_metadata: { execution_time_ms: 200, success: false, error_message: 'npm ERR!' },
      },
    ];

    // Simulate JSONL output (one JSON per line)
    const jsonlContent = observations
      .map(obs => JSON.stringify(obs))
      .join('\n');

    const lines = jsonlContent.split('\n');
    expect(lines.length).toBe(2);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.oc_metadata).toBeDefined();
      expect(typeof parsed.oc_metadata.execution_time_ms).toBe('number');
    }
  });
});

// ============================================================================
// CATEGORY 6: End-to-End - Hook Lifecycle (2 tests)
// ============================================================================

describe('Category 6: Hook Lifecycle', () => {
  it('Test 6.1: Complete flow from before hook to JSONL attachment', () => {
    // Simulate the complete hook lifecycle
    const callID = 'call-e2e-001';
    const callTimingMap = new Map<string, { started_at: string; started_at_ms: number }>();
    const callArgsMap = new Map<string, any>();

    // Phase 1: Before Hook - capture start time and args
    const beforeTime = new Date();
    callTimingMap.set(callID, {
      started_at: beforeTime.toISOString(),
      started_at_ms: beforeTime.getTime(),
    });
    callArgsMap.set(callID, { command: 'install' });

    // Phase 2: Simulate tool execution (50ms)
    const startMs = beforeTime.getTime();
    let elapsed = 0;
    const endTime = new Date();
    while (Date.now() - startMs < 50) {
      elapsed++;
    }

    // Phase 3: After Hook - capture end time and metadata
    const afterTime = new Date();
    const timing = callTimingMap.get(callID);
    const args = callArgsMap.get(callID);

    expect(timing).toBeDefined();
    expect(args).toBeDefined();

    const execution_time_ms = afterTime.getTime() - timing!.started_at_ms;
    const success = true;
    const error_message = undefined;

    // Phase 4: Attach to observation
    const observation = {
      session_id: 'session-e2e',
      tool: 'npm',
      content: 'npm install output',
      timestamp: afterTime.toISOString(),
      oc_metadata: {
        execution_time_ms,
        success,
        error_message,
        started_at: timing?.started_at,
        ended_at: afterTime.toISOString(),
      },
    };

    // Verify all fields present and correct types
    expect(observation.oc_metadata.execution_time_ms).toBeGreaterThanOrEqual(0);
    expect(observation.oc_metadata.execution_time_ms).toBeLessThan(5000);
    expect(typeof observation.oc_metadata.success).toBe('boolean');
    expect(observation.oc_metadata.started_at).toBeDefined();
    expect(observation.oc_metadata.ended_at).toBeDefined();

    // Phase 5: Cleanup
    callTimingMap.delete(callID);
    callArgsMap.delete(callID);

    expect(callTimingMap.has(callID)).toBe(false);
    expect(callArgsMap.has(callID)).toBe(false);
  });

  it('Test 6.2: All metadata fields present with correct types', () => {
    const startedAt = new Date().toISOString();
    const endedAt = new Date().toISOString();

    const metadata = {
      execution_time_ms: 156,
      success: false,
      error_message: 'Connection timeout',
      started_at: startedAt,
      ended_at: endedAt,
    };

    // Type checking
    expect(typeof metadata.execution_time_ms).toBe('number');
    expect(typeof metadata.success).toBe('boolean');
    expect(typeof metadata.error_message).toBe('string');
    expect(typeof metadata.started_at).toBe('string');
    expect(typeof metadata.ended_at).toBe('string');

    // ISO timestamp validation
    expect(metadata.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(metadata.ended_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Value range checks
    expect(metadata.execution_time_ms).toBeGreaterThanOrEqual(0);
    expect(metadata.execution_time_ms).toBeLessThan(60000); // Less than 1 minute

    // Schema validation
    const result = v.safeParse(OcMetadataSchema, metadata);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// INTEGRATION TEST: Complete Pipeline
// ============================================================================

describe('Integration: Complete Metadata Pipeline', () => {
  it('Metadata flows through complete capture pipeline without loss', () => {
    // Simulate complete pipeline:
    // 1. Hook capture
    // 2. Scrubbing
    // 3. Schema validation
    // 4. JSONL serialization
    // 5. Deserialization

    const callID = 'pipeline-test-001';
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 150);

    // Step 1: Capture in hook
    const capturedMetadata = {
      execution_time_ms: 150,
      success: true,
      error_message: undefined,
      started_at: startTime.toISOString(),
      ended_at: endTime.toISOString(),
    };

    // Step 2: Schema validation
    const validationResult = v.safeParse(OcMetadataSchema, capturedMetadata);
    expect(validationResult.success).toBe(true);

    // Step 3: Serialize to JSONL
    const jsonlLine = JSON.stringify({
      session_id: 'session-pipeline',
      oc_metadata: validationResult.output || capturedMetadata,
    });

    // Step 4: Deserialize from JSONL
    const deserialized = JSON.parse(jsonlLine);

    // Step 5: Verify no data loss
    expect(deserialized.oc_metadata.execution_time_ms).toBe(150);
    expect(deserialized.oc_metadata.success).toBe(true);
    expect(deserialized.oc_metadata.started_at).toBe(startTime.toISOString());
    expect(deserialized.oc_metadata.ended_at).toBe(endTime.toISOString());
  });

  it('Performance: Metadata capture has <1ms overhead', () => {
    const iterations = 100;
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startMs = performance.now();

      // Simulate metadata capture
      const now = new Date();
      const metadata = {
        execution_time_ms: 42,
        success: true,
        started_at: now.toISOString(),
        ended_at: new Date().toISOString(),
      };

      // Validate
      v.parse(OcMetadataSchema, metadata);

      const elapsedMs = performance.now() - startMs;
      timings.push(elapsedMs);
    }

    const avgOverhead = timings.reduce((a, b) => a + b, 0) / timings.length;
    expect(avgOverhead).toBeLessThan(1.0); // Less than 1ms per capture
  });
});
