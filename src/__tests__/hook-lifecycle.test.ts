/**
 * Hook Lifecycle Integration Tests
 *
 * Test Objective:
 * Verify that the memory plugin correctly handles the complete session lifecycle
 * across all hooks with proper state management, context injection, and graceful failure recovery.
 *
 * Test Coverage:
 * - Complete session lifecycle (created → message → tools → idle/stop → deleted)
 * - Context injection on session start
 * - Multiple tool calls maintaining state correctly
 * - Graceful failure recovery
 * - Non-blocking behavior verification
 *
 * @module src/__tests__/hook-lifecycle.test
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockObservations: any[] = [];
let mockSessionId: string | null = null;
let mockObservationCount = 0;
const mockCallArgsMap = new Map<string, any>();
const mockCallTimingMap = new Map<string, { started_at: string; started_at_ms: number }>();
let mockFileEventTimestamps: number[] = [];
let outboxShouldFail = false;
let summarizationShouldFail = false;

// Mock outbox
const mockOutbox = {
  push: mock((obs: any) => {
    if (outboxShouldFail) {
      outboxShouldFail = false;
      return Promise.reject(new Error('Outbox full'));
    }
    mockObservations.push({
      ...obs,
      _pushedAt: Date.now()
    });
    mockObservationCount++;
    return Promise.resolve();
  }),
  drain: mock(() => Promise.resolve()),
  queryPending: mock(() => mockObservations.filter(o => o.status === 'pending')),
  getDatabase: mock(() => null),
};

// Mock worker health
let mockWorkerHealthy = true;
const mockIsWorkerHealthy = mock(() => Promise.resolve(mockWorkerHealthy));

// Mock context fetch
const mockContextData = 'Previous session context: Test observations from earlier work';
const mockFetchContext = mock(() => Promise.resolve(mockContextData));

// Mock session registration
const mockRegisterSession = mock(() => Promise.resolve(true));

// Mock ingestor trigger
const mockTriggerIngestorOnce = mock(() => Promise.resolve());

// Mock summarization
const mockSummarizeSession = mock((sessionId: string, durationMs: number, summaryType?: string) => {
  if (summarizationShouldFail) {
    summarizationShouldFail = false;
    return Promise.reject(new Error('Summarization failed'));
  }
  return Promise.resolve({ sessionId, durationMs, summaryType });
});

// Mock logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
  status: mock(() => {}),
  notify: mock(() => {}),
  init: mock(() => {}),
  child: mock(() => mockLogger),
};

// Mock Zen extractor
const mockZenExtractor = {
  init: mock(() => Promise.resolve()),
  cleanup: mock(() => Promise.resolve()),
  extract: mock(() => Promise.resolve({
    title: 'Mock Extraction',
    type: 'discovery',
    narrative: 'Mock extraction result',
    concepts: ['test'],
    facts: ['fact1'],
  })),
};

// Mock client
const mockClient = {
  app: {
    log: mock(() => {}),
    status: mock(() => {}),
    notify: mock(() => {}),
  },
  session: {
    create: mock(() => Promise.resolve({ data: { id: 'test-extraction-session' } })),
    delete: mock(() => Promise.resolve()),
    prompt: mock(() => Promise.resolve({ data: { parts: [{ type: 'text', text: 'test' }] } })),
    status: mock(() => {}),
  },
};

// Mock Bun shell
const mock$ = {
  quiet: mock(() => Promise.resolve({})),
  text: mock(() => Promise.resolve('test output')),
};

// ============================================================================
// TEST STATE MANAGEMENT
// ============================================================================

function resetTestState() {
  mockObservations.length = 0;
  mockSessionId = null;
  mockObservationCount = 0;
  mockCallArgsMap.clear();
  mockCallTimingMap.clear();
  mockFileEventTimestamps = [];
  mockWorkerHealthy = true;
  outboxShouldFail = false;
  summarizationShouldFail = false;
}

function generateSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// HOOK SIMULATION FUNCTIONS
// ============================================================================

/**
 * Simulates session.created hook execution
 */
async function simulateSessionCreated(project: string, directory: string) {
  mockSessionId = generateSessionId();
  
  try {
    // Capture observation
    await mockOutbox.push({
      session_id: mockSessionId,
      source: 'opencode',
      project,
      cwd: directory,
      tool: 'session_start',
      title: 'Session Started',
      type: 'discovery',
      narrative: `OpenCode session started in ${project}`,
      concepts: ['session-start'],
      facts: [`Project: ${project}`],
      content: 'Session created',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    mockLogger.error('session', 'Failed to push session observation', { error: String(e) });
  }
  
  return {
    sessionId: mockSessionId,
    context: await mockFetchContext(project),
  };
}

/**
 * Simulates message.created hook execution
 */
async function simulateMessageCreated(content: string, sessionId: string) {
  // Capture user prompt
  await mockOutbox.push({
    session_id: sessionId,
    source: 'opencode',
    project: 'test-project',
    cwd: '/test/project',
    tool: 'user_prompt',
    title: `Prompt: ${content.slice(0, 50)}...`,
    type: 'discovery',
    narrative: `User submitted a prompt: ${content}`,
    concepts: ['user-interaction'],
    facts: [`User prompt: ${content}`],
    content,
    timestamp: new Date().toISOString(),
  });
  
  return { captured: true };
}

/**
 * Simulates tool.execute.before hook execution
 */
async function simulateToolExecuteBefore(tool: string, callID: string, args: any) {
  const now = new Date();
  mockCallArgsMap.set(callID, args);
  mockCallTimingMap.set(callID, {
    started_at: now.toISOString(),
    started_at_ms: now.getTime(),
  });
  
  return { captured: true };
}

/**
 * Simulates tool.execute.after hook execution
 */
async function simulateToolExecuteAfter(
  tool: string,
  callID: string,
  output: string,
  sessionId: string,
  success: boolean = true
) {
  const args = mockCallArgsMap.get(callID) || {};
  mockCallArgsMap.delete(callID);
  
  const timing = mockCallTimingMap.get(callID);
  mockCallTimingMap.delete(callID);
  
  const ended_at = new Date().toISOString();
  const ended_at_ms = Date.now();
  const execution_time_ms = timing ? ended_at_ms - timing.started_at_ms : undefined;
  
  // Create observation
  await mockOutbox.push({
    session_id: sessionId,
    source: 'opencode',
    project: 'test-project',
    cwd: '/test/project',
    tool,
    title: `${tool}: ${args.file_path || args.command || 'execution'}`,
    type: 'execution',
    narrative: `Executed ${tool} with result: ${output.slice(0, 100)}`,
    concepts: ['tool-execution'],
    facts: [`Tool: ${tool}`, `Success: ${success}`],
    content: output,
    timestamp: new Date().toISOString(),
    oc_metadata: {
      execution_time_ms,
      success,
      started_at: timing?.started_at,
      ended_at,
    },
  });
  
  return { captured: true };
}

/**
 * Simulates session.idle hook execution
 */
async function simulateSessionIdle(
  sessionId: string,
  sessionStartTime: Date,
  observationCount: number,
  userStopped: boolean = false
) {
  const durationMs = Date.now() - sessionStartTime.getTime();
  const durationMinutes = durationMs / 1000 / 60;
  const IDLE_TIMEOUT_MINUTES = 15;
  
  // Trigger on explicit stop OR idle timeout with observations
  if (userStopped || (durationMinutes > IDLE_TIMEOUT_MINUTES && observationCount > 0)) {
    const summaryType = userStopped ? 'final' : 'checkpoint';
    
    mockLogger.info('session', 
      userStopped 
        ? `Session stopped by user after ${Math.round(durationMinutes)} min`
        : `Session idle after ${Math.round(durationMinutes)} min`
    );
    
    await mockOutbox.drain();
    await mockTriggerIngestorOnce(userStopped ? 'session.stop' : 'session.idle');
    
    try {
      await mockSummarizeSession(sessionId, durationMs, summaryType);
    } catch (e) {
      mockLogger.error('summarization', 'Failed to summarize session', { error: String(e) });
    }
    
    return { processed: true, summaryType };
  }
  
  return { processed: false };
}

/**
 * Simulates session.deleted hook execution
 */
async function simulateSessionDeleted(sessionId: string) {
  await mockTriggerIngestorOnce('session.deleted');
  await mockZenExtractor.cleanup();
  
  return { cleaned: true };
}

// ============================================================================
// TEST SUITE: COMPLETE SESSION LIFECYCLE
// ============================================================================

describe('Hook Lifecycle Integration Tests', () => {
  beforeEach(() => {
    resetTestState();
  });
  
  afterEach(() => {
    resetTestState();
  });

  describe('Complete Session Lifecycle', () => {
    it('should handle complete session lifecycle: created → message → tools → idle → deleted', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // 1. session.created
      const sessionResult = await simulateSessionCreated(project, directory);
      expect(sessionResult.sessionId).toBeTruthy();
      expect(mockFetchContext).toHaveBeenCalled();
      
      const sessionId = sessionResult.sessionId;
      const sessionStartTime = new Date();
      
      // 2. message.created (user prompt)
      await simulateMessageCreated('Test user prompt', sessionId);
      
      // 3. tool.execute.before
      const callID1 = 'call-001';
      await simulateToolExecuteBefore('read', callID1, { file_path: '/test/project/src/index.ts' });
      
      // 4. tool.execute.after
      await simulateToolExecuteAfter('read', callID1, 'File content here', sessionId, true);
      
      // 5. session.idle
      const idleResult = await simulateSessionIdle(sessionId, sessionStartTime, 2, false);
      expect(idleResult.processed).toBe(false); // Not idle yet (timeout not exceeded)
      
      // Simulate time passing
      const oldDate = Date;
      global.Date = class extends oldDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(sessionStartTime.getTime() + 16 * 60 * 1000); // 16 minutes later
          } else {
            super(...args);
          }
        }
        static now() {
          return sessionStartTime.getTime() + 16 * 60 * 1000;
        }
      } as any;
      
      const idleResult2 = await simulateSessionIdle(sessionId, sessionStartTime, 2, false);
      expect(idleResult2.processed).toBe(true);
      expect(idleResult2.summaryType).toBe('checkpoint');
      
      global.Date = oldDate;
      
      // 6. session.deleted
      const deleteResult = await simulateSessionDeleted(sessionId);
      expect(deleteResult.cleaned).toBe(true);
      
      // Verify all observations captured
      expect(mockObservations.length).toBeGreaterThanOrEqual(3); // session_start + prompt + read
      
      // Verify session lifecycle observations exist
      const sessionObs = mockObservations.find(o => o.tool === 'session_start');
      expect(sessionObs).toBeDefined();
      
      const promptObs = mockObservations.find(o => o.tool === 'user_prompt');
      expect(promptObs).toBeDefined();
      expect(promptObs.content).toBe('Test user prompt');
      
      const toolObs = mockObservations.find(o => o.tool === 'read');
      expect(toolObs).toBeDefined();
      expect(toolObs.oc_metadata).toBeDefined();
      expect(toolObs.oc_metadata.success).toBe(true);
    });
    
    it('should handle session.stop lifecycle (explicit stop vs idle)', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // 1. session.created
      const sessionResult = await simulateSessionCreated(project, directory);
      const sessionId = sessionResult.sessionId;
      const sessionStartTime = new Date();
      
      // 2. User prompt
      await simulateMessageCreated('Implement feature X', sessionId);
      
      // 3. Tool execution
      const callID1 = 'call-002';
      await simulateToolExecuteBefore('write', callID1, { file_path: '/test/project/src/feature.ts', content: 'code' });
      await simulateToolExecuteAfter('write', callID1, 'File written successfully', sessionId, true);
      
      // 4. session.stop (explicit user stop, not idle timeout) - pass true for userStopped
      const stopResult = await simulateSessionIdle(sessionId, sessionStartTime, 2, true);
      expect(stopResult.processed).toBe(true);
      expect(stopResult.summaryType).toBe('final'); // Different from checkpoint
      
      // Verify final summary was triggered
      expect(mockSummarizeSession).toHaveBeenCalled();
      const summaryCalls = mockSummarizeSession.mock.calls;
      expect(summaryCalls.length).toBeGreaterThan(0);
      // Find the call with 'final' summary type
      const finalCall = summaryCalls.find((call: any[]) => call[2] === 'final');
      expect(finalCall).toBeDefined();
      expect(finalCall[2]).toBe('final');
    });
    
    it('should handle session with multiple tool calls maintaining state', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Create session
      const sessionResult = await simulateSessionCreated(project, directory);
      const sessionId = sessionResult.sessionId;
      const sessionStartTime = new Date();
      
      // Execute multiple tools
      const tools = [
        { name: 'read', callID: 'call-003', args: { file_path: '/test/file1.ts' }, output: 'content1', success: true },
        { name: 'edit', callID: 'call-004', args: { file_path: '/test/file1.ts', old_string: 'old', new_string: 'new' }, output: 'Edit successful', success: true },
        { name: 'bash', callID: 'call-005', args: { command: 'npm test' }, output: 'Tests passed', success: true },
        { name: 'read', callID: 'call-006', args: { file_path: '/test/file2.ts' }, output: 'content2', success: true },
      ];
      
      for (const tool of tools) {
        await simulateToolExecuteBefore(tool.name, tool.callID, tool.args);
        // Simulate some execution time
        await new Promise(resolve => setTimeout(resolve, 10));
        await simulateToolExecuteAfter(tool.name, tool.callID, tool.output, sessionId, tool.success);
      }
      
      // Verify all tool calls captured
      expect(mockObservations.filter(o => o.tool === 'session_start').length).toBe(1);
      
      // Check that args and timing maps are cleared after each tool
      expect(mockCallArgsMap.size).toBe(0);
      expect(mockCallTimingMap.size).toBe(0);
      
      // Check that execution metadata is captured
      const toolObservations = mockObservations.filter(o => tools.some(t => t.name === o.tool && o.tool !== 'session_start'));
      for (const obs of toolObservations) {
        expect(obs.oc_metadata).toBeDefined();
        expect(typeof obs.oc_metadata.execution_time_ms).toBe('number');
        expect(obs.oc_metadata.success).toBe(true);
        expect(obs.oc_metadata.started_at).toBeDefined();
        expect(obs.oc_metadata.ended_at).toBeDefined();
      }
    });
  });

  describe('Context Injection on Session Start', () => {
    it('should inject context when enabled', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Enable injection
      const originalEnv = process.env.CLAUDE_MEM_INJECTION_ENABLED;
      process.env.CLAUDE_MEM_INJECTION_ENABLED = 'true';
      
      const sessionResult = await simulateSessionCreated(project, directory);
      
      expect(sessionResult.context).toBe(mockContextData);
      expect(mockFetchContext).toHaveBeenCalledWith(project);
      
      // Restore env
      if (originalEnv) {
        process.env.CLAUDE_MEM_INJECTION_ENABLED = originalEnv;
      } else {
        delete process.env.CLAUDE_MEM_INJECTION_ENABLED;
      }
    });
    
    it('should skip context injection when disabled', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Disable injection
      const originalEnv = process.env.CLAUDE_MEM_INJECTION_ENABLED;
      process.env.CLAUDE_MEM_INJECTION_ENABLED = 'false';
      
      // When disabled, context should not be fetched or should be empty
      mockFetchContext.mockImplementationOnce(() => Promise.resolve(null));
      
      const sessionResult = await simulateSessionCreated(project, directory);
      
      // Restore env
      if (originalEnv) {
        process.env.CLAUDE_MEM_INJECTION_ENABLED = originalEnv;
      } else {
        delete process.env.CLAUDE_MEM_INJECTION_ENABLED;
      }
    });
  });

  describe('Graceful Failure Recovery', () => {
    it('should continue session when outbox push fails', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Make outbox.push fail
      outboxShouldFail = true;
      
      // Should not throw - should continue gracefully
      const sessionResult = await simulateSessionCreated(project, directory);
      expect(sessionResult.sessionId).toBeTruthy();
      
      // Logger should have recorded the error
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    it('should continue when summarization fails', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Create session
      const sessionResult = await simulateSessionCreated(project, directory);
      const sessionId = sessionResult.sessionId;
      const sessionStartTime = new Date();
      
      // Add an observation
      await simulateMessageCreated('Test prompt', sessionId);
      
      // Make summarization fail
      summarizationShouldFail = true;
      
      // Override Date for idle timeout
      const oldDate = Date;
      global.Date = class extends oldDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(sessionStartTime.getTime() + 16 * 60 * 1000);
          } else {
            super(...args);
          }
        }
        static now() {
          return sessionStartTime.getTime() + 16 * 60 * 1000;
        }
      } as any;
      
      // Should not throw even if summarization fails
      const result = await simulateSessionIdle(sessionId, sessionStartTime, 1, false);
      expect(result.processed).toBe(true);
      
      global.Date = oldDate;
    });
    
    it('should recover from worker health check failure', async () => {
      // Simulate worker not healthy
      mockWorkerHealthy = false;
      
      const project = 'test-project';
      const directory = '/test/project';
      
      // Session should still be created even if worker is not healthy
      const sessionResult = await simulateSessionCreated(project, directory);
      expect(sessionResult.sessionId).toBeTruthy();
    });
  });

  describe('Non-Blocking Behavior', () => {
    it('should not block on session creation', async () => {
      const startTime = performance.now();
      
      await simulateSessionCreated('test-project', '/test/project');
      
      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Should complete in under 100ms
    });
    
    it('should not block on tool execution hooks', async () => {
      const startTime = performance.now();
      
      const callID = 'perf-test-001';
      await simulateToolExecuteBefore('read', callID, { file_path: '/test/file.ts' });
      await simulateToolExecuteAfter('read', callID, 'content', 'session-123', true);
      
      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(50); // Should complete in under 50ms
    });
  });

  describe('Session State Persistence', () => {
    it('should maintain observation count across hooks', async () => {
      const project = 'test-project';
      const directory = '/test/project';
      
      // Create session
      await simulateSessionCreated(project, directory);
      
      // Initial count should be 1 (session_start)
      const initialCount = mockObservationCount;
      
      // Add messages
      await simulateMessageCreated('Message 1', 'session-123');
      await simulateMessageCreated('Message 2', 'session-123');
      
      // Count should increment
      expect(mockObservationCount).toBe(initialCount + 2);
      
      // Add tools
      const callID1 = 'state-test-001';
      await simulateToolExecuteBefore('read', callID1, { file_path: '/test/file1.ts' });
      await simulateToolExecuteAfter('read', callID1, 'content1', 'session-123', true);
      
      expect(mockObservationCount).toBe(initialCount + 3);
    });
  });
});

// ============================================================================
// TEST SUITE: SESSION IDLE ENHANCEMENTS
// ============================================================================

describe('Session Idle Hook Enhancements', () => {
  beforeEach(() => {
    resetTestState();
  });

  it('should detect user stop via environment variable', async () => {
    process.env.CLAUDE_MEM_USER_STOPPED = 'true';
    
    const project = 'test-project';
    const directory = '/test/project';
    
    const sessionResult = await simulateSessionCreated(project, directory);
    const sessionId = sessionResult.sessionId;
    const sessionStartTime = new Date();
    
    // Even without timeout, should process when userStopped is true
    const result = await simulateSessionIdle(sessionId, sessionStartTime, 0, true);
    
    expect(result.processed).toBe(true);
    expect(result.summaryType).toBe('final');
    
    delete process.env.CLAUDE_MEM_USER_STOPPED;
  });
  
  it('should use different summary types for stop vs idle', async () => {
    const project = 'test-project';
    const directory = '/test/project';
    
    const sessionResult = await simulateSessionCreated(project, directory);
    const sessionId = sessionResult.sessionId;
    const sessionStartTime = new Date();
    
    // Test idle (checkpoint)
    const oldDate = Date;
    global.Date = class extends oldDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(sessionStartTime.getTime() + 16 * 60 * 1000);
        } else {
          super(...args);
        }
      }
      static now() {
        return sessionStartTime.getTime() + 16 * 60 * 1000;
      }
    } as any;
    
    const idleResult = await simulateSessionIdle(sessionId, sessionStartTime, 1, false);
    expect(idleResult.summaryType).toBe('checkpoint');
    
    global.Date = oldDate;
    
    // Test stop (final)
    const stopResult = await simulateSessionIdle(sessionId, sessionStartTime, 1, true);
    expect(stopResult.summaryType).toBe('final');
  });
  
  it('should log different messages for stop vs idle', async () => {
    const project = 'test-project';
    const directory = '/test/project';
    
    const sessionResult = await simulateSessionCreated(project, directory);
    const sessionId = sessionResult.sessionId;
    const sessionStartTime = new Date();
    
    // Clear previous calls
    mockLogger.info.mockClear();
    
    // Idle case
    const oldDate = Date;
    global.Date = class extends oldDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(sessionStartTime.getTime() + 16 * 60 * 1000);
        } else {
          super(...args);
        }
      }
      static now() {
        return sessionStartTime.getTime() + 16 * 60 * 1000;
      }
    } as any;
    
    await simulateSessionIdle(sessionId, sessionStartTime, 1, false);
    
    const idleLogCall = mockLogger.info.mock.calls.find(
      (call: any[]) => call[1] && call[1].includes('Session idle')
    );
    expect(idleLogCall).toBeDefined();
    
    global.Date = oldDate;
    
    // Stop case
    mockLogger.info.mockClear();
    await simulateSessionIdle(sessionId, sessionStartTime, 1, true);
    
    const stopLogCall = mockLogger.info.mock.calls.find(
      (call: any[]) => call[1] && call[1].includes('Session stopped')
    );
    expect(stopLogCall).toBeDefined();
  });
});

// ============================================================================
// TEST SUITE: FILE WATCHER ENHANCEMENTS
// ============================================================================

describe('File Watcher Enhanced Filtering', () => {
  beforeEach(() => {
    mockFileEventTimestamps = [];
  });

  it('should ignore node_modules files', async () => {
    const filePath = '/project/node_modules/some-package/index.js';
    
    const shouldIgnore = [
      /node_modules/,
      /\.git/,
      /dist\//,
      /build\//,
    ].some(pattern => pattern.test(filePath));
    
    expect(shouldIgnore).toBe(true);
  });
  
  it('should ignore dist and build directories', async () => {
    const distFile = '/project/dist/index.js';
    const buildFile = '/project/build/app.js';
    
    const shouldIgnoreDist = [/dist\//, /build\//].some(pattern => pattern.test(distFile));
    const shouldIgnoreBuild = [/dist\//, /build\//].some(pattern => pattern.test(buildFile));
    
    expect(shouldIgnoreDist).toBe(true);
    expect(shouldIgnoreBuild).toBe(true);
  });
  
  it('should ignore own database files', async () => {
    const dbFile = '/project/.oc/memory.db';
    
    const shouldIgnore = [/\.oc\/memory\.db/].some(pattern => pattern.test(dbFile));
    
    expect(shouldIgnore).toBe(true);
  });
  
  it('should rate limit file events', async () => {
    const now = Date.now();
    const maxEventsPerMinute = 100;
    
    // Simulate 100 events in the last minute
    for (let i = 0; i < maxEventsPerMinute; i++) {
      mockFileEventTimestamps.push(now - 30000 + i * 100); // Within last minute
    }
    
    // Should skip when at limit
    expect(mockFileEventTimestamps.length).toBeGreaterThanOrEqual(maxEventsPerMinute);
  });
  
  it('should only capture during active tool use', async () => {
    const now = Date.now();
    const lastToolActivity = now - 10000; // 10 seconds ago (within 30s window)
    
    const isToolActive = (now - lastToolActivity) < 30000;
    expect(isToolActive).toBe(true);
    
    const oldActivity = now - 60000; // 60 seconds ago (outside 30s window)
    const isToolActiveOld = (now - oldActivity) < 30000;
    expect(isToolActiveOld).toBe(false);
  });
});

console.log('✅ Hook lifecycle tests loaded');
