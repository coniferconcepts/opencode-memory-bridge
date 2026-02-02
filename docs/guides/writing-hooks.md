# Writing Custom Hooks

## Overview

This guide walks you through creating, registering, and testing custom hooks for the OpenCode system. Whether you're building a plugin or adding project-specific functionality, hooks provide a powerful way to extend OpenCode's behavior.

---

## Prerequisites

Before writing hooks, ensure you have:

- Basic knowledge of TypeScript
- Understanding of the [Hook Architecture](../architecture/hooks.md)
- OpenCode project initialized with hook support

---

## Quick Start

### Your First Hook

Here's a minimal example of a custom session hook:

```typescript
// hooks/my-custom-hook.ts
import type { 
  OpenCodeHook, 
  SessionHookInput, 
  SessionHookOutput 
} from '~/universal/hooks'

export const mySessionHook: OpenCodeHook<SessionHookInput, SessionHookOutput> = {
  name: 'session.created',
  priority: 100,
  description: 'My first custom hook',
  
  handler: async (input, output) => {
    console.log(`Session ${input.sessionId} started in ${input.project}`)
    
    // Your custom logic here
    await doSomethingCool(input)
  }
}

async function doSomethingCool(input: SessionHookInput): Promise<void> {
  // Implementation
}
```

---

## Creating a Custom Hook

### Step 1: Choose the Right Hook Type

Select a hook that matches your use case:

| Use Case | Recommended Hook |
|----------|------------------|
| Initialize resources | `session.created` |
| Inject context | `context.inject` |
| Track tool usage | `tool.execute.after` |
| Monitor messages | `message.created` |
| Cleanup on exit | `session.deleted` |
| Track file changes | `file.watcher.updated` |

### Step 2: Define Your Hook

```typescript
// hooks/tool-tracker.ts
import type { 
  OpenCodeHook, 
  ToolHookInput, 
  ToolHookOutput 
} from '~/universal/hooks'

export interface ToolTrackerConfig {
  /** Tools to track */
  trackTools: string[]
  
  /** Whether to log timing */
  logTiming: boolean
  
  /** Callback when tracked tool executes */
  onToolExecuted?: (tool: string, durationMs: number) => void
}

export function createToolTrackerHook(
  config: ToolTrackerConfig
): OpenCodeHook<ToolHookInput, ToolHookOutput> {
  return {
    name: 'tool.execute.after',
    priority: 50,
    description: 'Tracks tool execution metrics',
    
    handler: async (input, output) => {
      // Only track specified tools
      if (!config.trackTools.includes(input.tool)) {
        return
      }
      
      // Log the execution
      if (config.logTiming) {
        console.log(`[Tool] ${input.tool} took ${output.durationMs}ms`)
      }
      
      // Call optional callback
      config.onToolExecuted?.(input.tool, output.durationMs)
      
      // Store in your analytics system
      await recordToolUsage(input, output)
    }
  }
}

async function recordToolUsage(
  input: ToolHookInput, 
  output: ToolHookOutput
): Promise<void> {
  // Non-blocking storage
  analytics.track({
    event: 'tool_executed',
    properties: {
      tool: input.tool,
      durationMs: output.durationMs,
      success: output.success,
      sessionId: input.sessionId
    }
  }).catch(err => {
    console.error('Failed to record analytics:', err)
  })
}
```

### Step 3: Add Type Safety

Use TypeScript generics for full type safety:

```typescript
import type { 
  OpenCodeHook,
  HookName,
  HookInput,
  HookOutput 
} from '~/universal/hooks'

// Generic hook factory
type TypedHook<T extends HookName> = OpenCodeHook<
  HookInput<T>, 
  HookOutput<T>
>

// Create a typed hook for any hook name
function createHook<T extends HookName>(
  name: T,
  handler: (input: HookInput<T>, output: HookOutput<T>) => Promise<void>
): TypedHook<T> {
  return {
    name,
    priority: 100,
    handler
  }
}

// Usage with full type inference
const sessionHook = createHook('session.created', async (input, output) => {
  // input is fully typed as SessionHookInput
  console.log(input.sessionId, input.project)
  // output is fully typed as SessionHookOutput
  console.log(output.success)
})
```

### Step 4: Implement Error Handling

Always handle errors gracefully:

```typescript
{
  name: 'tool.execute.after',
  handler: async (input, output) => {
    try {
      await processToolOutput(input, output)
    } catch (error) {
      // Log but don't throw - hooks must not break execution
      console.error(`Hook error for ${input.tool}:`, error)
      
      // Optionally report to monitoring
      reportHookError('tool.execute.after', error)
    }
  }
}
```

---

## Hook Registration

### Method 1: Plugin Registration (Recommended)

For plugins and reusable components:

```typescript
// plugins/my-plugin/index.ts
import type { Plugin } from '~/universal/plugins'
import { mySessionHook } from './hooks/session-hook'
import { myToolHook } from './hooks/tool-hook'

export const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  hooks: [
    mySessionHook,
    myToolHook
  ],
  
  async initialize(): Promise<void> {
    console.log('My plugin initialized')
  }
}

// Register in your config
// opencode.json
{
  "plugins": ["my-plugin"]
}
```

### Method 2: Direct Registration

For project-specific hooks:

```typescript
// hooks/register.ts
import { hookRegistry } from '~/universal/hooks/registry'
import { myCustomHook } from './my-custom-hook'

// Register at runtime
hookRegistry.register(myCustomHook)

// Or register with options
hookRegistry.register(myCustomHook, {
  enabled: true,
  timeoutMs: 5000
})
```

### Method 3: Configuration-Based

Via `.opencode/hook-config.json`:

```json
{
  "hooks": {
    "my-custom-hook": {
      "enabled": true,
      "module": "./hooks/my-custom-hook",
      "priority": 50,
      "options": {
        "customOption": "value"
      }
    }
  }
}
```

### Registration Order

The order of hook execution is determined by:

1. **Priority** (primary): Lower numbers execute first
2. **Registration time** (secondary): Earlier registrations within same priority

```typescript
// This hook runs first (priority: 1)
hookRegistry.register({
  name: 'session.created',
  priority: 1,
  handler: async () => { /* ... */ }
})

// This hook runs second (priority: 50)
hookRegistry.register({
  name: 'session.created',
  priority: 50,
  handler: async () => { /* ... */ }
})

// This hook runs third (priority: 100, default)
hookRegistry.register({
  name: 'session.created',
  priority: 100,
  handler: async () => { /* ... */ }
})
```

---

## Testing Hooks

### Unit Testing

Test your hook in isolation:

```typescript
// hooks/__tests__/my-hook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mySessionHook } from '../my-hook'
import type { SessionHookInput, SessionHookOutput } from '~/universal/hooks'

describe('mySessionHook', () => {
  it('should log session start', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const input: SessionHookInput = {
      sessionId: 'test-session',
      project: 'test-project',
      directory: '/test/dir',
      timestamp: new Date()
    }
    
    const output: SessionHookOutput = {
      success: true
    }
    
    // Act
    await mySessionHook.handler(input, output)
    
    // Assert
    expect(consoleSpy).toHaveBeenCalledWith(
      'Session test-session started in test-project'
    )
    
    consoleSpy.mockRestore()
  })
  
  it('should handle errors gracefully', async () => {
    // Arrange
    const errorHook = {
      ...mySessionHook,
      handler: async () => {
        throw new Error('Test error')
      }
    }
    
    const input = {
      sessionId: 'test',
      project: 'test',
      directory: '/test',
      timestamp: new Date()
    }
    
    const output = { success: true }
    
    // Act & Assert - should not throw
    await expect(errorHook.handler(input, output)).rejects.toThrow()
  })
})
```

### Integration Testing

Test hooks in a real OpenCode context:

```typescript
// tests/hooks/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { hookRegistry } from '~/universal/hooks/registry'
import { createTestSession } from '~/testing/helpers'

describe('Hook Integration', () => {
  let session: TestSession
  
  beforeAll(async () => {
    session = await createTestSession({
      hooks: [myCustomHook]
    })
  })
  
  afterAll(async () => {
    await session.cleanup()
  })
  
  it('should trigger hook on session creation', async () => {
    // Track hook calls
    const hookCalls: string[] = []
    
    hookRegistry.register({
      name: 'session.created',
      handler: async (input) => {
        hookCalls.push(input.sessionId)
      }
    })
    
    // Create new session
    const newSession = await session.createChild()
    
    // Assert hook was called
    expect(hookCalls).toContain(newSession.id)
  })
})
```

### Mocking Hooks

For testing other code that depends on hooks:

```typescript
// Mock the hook registry
vi.mock('~/universal/hooks/registry', () => ({
  hookRegistry: {
    register: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true }),
    getHooks: vi.fn().mockReturnValue([])
  }
}))

// Or use MSW to intercept hook calls
import { server } from '~/testing/mocks/server'

beforeAll(() => {
  server.listen()
})

afterAll(() => {
  server.close()
})
```

---

## Performance Considerations

### 1. Keep Hooks Fast

**Target durations by hook type:**

| Hook Type | Target | Maximum |
|-----------|--------|---------|
| Blocking | <5ms | 100ms |
| Non-blocking | <50ms | 5s |
| Cleanup | <100ms | 30s |

### 2. Use Non-Blocking Patterns

```typescript
// ❌ BAD: Blocking call
{
  name: 'tool.execute.after',
  handler: async (input, output) => {
    await saveToDatabase(output) // Blocks tool result!
  }
}

// ✅ GOOD: Non-blocking
{
  name: 'tool.execute.after',
  handler: async (input, output) => {
    // Fire and forget
    saveToDatabase(output).catch(err => {
      logger.error('Failed to save', err)
    })
  }
}

// ✅ GOOD: Queue for processing
{
  name: 'tool.execute.after',
  handler: async (input, output) => {
    // Add to queue for background processing
    processingQueue.add({
      type: 'tool_result',
      data: { input, output }
    })
  }
}
```

### 3. Batch Operations

```typescript
// hooks/batch-processor.ts
const pendingObservations: Observation[] = []
const BATCH_SIZE = 10
const FLUSH_INTERVAL = 5000 // 5 seconds

export const batchingHook: OpenCodeHook<ToolHookInput, ToolHookOutput> = {
  name: 'tool.execute.after',
  
  handler: async (input, output) => {
    // Add to batch
    pendingObservations.push({
      tool: input.tool,
      timestamp: input.timestamp,
      result: summarize(output.result)
    })
    
    // Flush if batch is full
    if (pendingObservations.length >= BATCH_SIZE) {
      await flushObservations()
    }
  }
}

// Periodic flush
setInterval(async () => {
  if (pendingObservations.length > 0) {
    await flushObservations()
  }
}, FLUSH_INTERVAL)

async function flushObservations(): Promise<void> {
  const batch = pendingObservations.splice(0, BATCH_SIZE)
  await saveBatchToDatabase(batch)
}
```

### 4. Use Timeouts

```typescript
{
  name: 'session.idle',
  handler: async (input, output) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)
    
    try {
      await generateSummary(input, { signal: controller.signal })
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('Summary generation timed out')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
}
```

### 5. Cache Expensive Operations

```typescript
import { LRUCache } from 'lru-cache'

const contextCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 5 // 5 minutes
})

export const cachedContextHook = {
  name: 'context.inject',
  
  handler: async (input, output) => {
    const cacheKey = `${input.session.sessionId}:context`
    
    // Check cache first
    let context = contextCache.get(cacheKey)
    
    if (!context) {
      // Expensive operation
      context = await buildContext(input)
      contextCache.set(cacheKey, context)
    }
    
    output.contextToInject = context
  }
}
```

---

## Common Patterns

### Pattern 1: Observation Capture

Capture and store observations from tool executions:

```typescript
export const observationCaptureHook = {
  name: 'tool.execute.after',
  
  handler: async (input, output) => {
    // Skip if not successful
    if (!output.success) return
    
    // Skip certain tools
    if (['Read', 'List'].includes(input.tool)) return
    
    // Create observation
    const observation = {
      id: generateId(),
      type: 'tool',
      tool: input.tool,
      timestamp: input.timestamp,
      content: summarize(output.result),
      sessionId: input.sessionId
    }
    
    // Async save
    observationStore.save(observation).catch(console.error)
  }
}
```

### Pattern 2: Context Injection

Inject relevant context at session start:

```typescript
export const memoryContextHook = {
  name: 'context.inject',
  priority: 1, // Run early
  
  handler: async (input, output) => {
    // Query memory system
    const relevantMemories = await queryMemories({
      project: input.session.project,
      limit: 50
    })
    
    // Build context manifest
    const contextLines = [
      '## Relevant Context',
      ...relevantMemories.map(m => `- ${m.content}`)
    ]
    
    output.contextToInject = contextLines.join('\n')
    output.observations = relevantMemories
    output.success = true
  }
}
```

### Pattern 3: Rate Limiting

Prevent hook flooding:

```typescript
const lastExecutions = new Map<string, number>()
const RATE_LIMIT_MS = 1000

export const rateLimitedHook = {
  name: 'file.watcher.updated',
  
  handler: async (input, output) => {
    const now = Date.now()
    const lastExecution = lastExecutions.get(input.path) || 0
    
    // Skip if rate limited
    if (now - lastExecution < RATE_LIMIT_MS) {
      return
    }
    
    lastExecutions.set(input.path, now)
    
    // Process the file change
    await processFileChange(input)
  }
}
```

### Pattern 4: Conditional Execution

Execute based on session state:

```typescript
export const conditionalHook = {
  name: 'message.created',
  
  handler: async (input, output) => {
    // Only process user messages
    if (input.role !== 'user') return
    
    // Skip if message is too short
    if (input.content.length < 10) return
    
    // Check for specific keywords
    if (input.content.includes('@context')) {
      await injectExtraContext(input)
    }
  }
}
```

---

## Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Blocking the Main Thread

```typescript
// ❌ BAD - Delays tool results
{
  name: 'tool.execute.after',
  handler: async (input, output) => {
    await heavyComputation(output.result)
    await saveToSlowDatabase(output)
  }
}
```

### ❌ Anti-Pattern 2: Ignoring Errors

```typescript
// ❌ BAD - Silent failures
{
  name: 'session.created',
  handler: async (input, output) => {
    try {
      await criticalSetup()
    } catch (err) {
      // Nothing! Silent failure
    }
  }
}
```

### ❌ Anti-Pattern 3: Memory Leaks

```typescript
// ❌ BAD - Unbounded growth
const allSessions: string[] = []

{
  name: 'session.created',
  handler: async (input, output) => {
    allSessions.push(input.sessionId) // Never cleaned up!
  }
}
```

### ❌ Anti-Pattern 4: State Mutation

```typescript
// ❌ BAD - Mutating input
{
  name: 'message.created',
  handler: async (input, output) => {
    input.content = input.content.toUpperCase() // Don't mutate!
  }
}
```

### ❌ Anti-Pattern 5: External Dependencies Without Fallback

```typescript
// ❌ BAD - No fallback if service is down
{
  name: 'context.inject',
  handler: async (input, output) => {
    // If this service is down, context injection fails
    const context = await externalService.getContext()
    output.contextToInject = context
  }
}
```

---

## Debugging Hooks

### Enable Debug Logging

```bash
# Environment variable
OPENCODE_HOOK_DEBUG=true opencode

# Or in config
{
  "debugLogging": true
}
```

### Add Debug Hooks

```typescript
export const debugHook = {
  name: 'tool.execute.after',
  priority: 999, // Run last
  
  handler: async (input, output) => {
    if (process.env.OPENCODE_HOOK_DEBUG) {
      console.log('[DEBUG]', {
        hook: 'tool.execute.after',
        tool: input.tool,
        duration: output.durationMs,
        success: output.success,
        timestamp: new Date().toISOString()
      })
    }
  }
}
```

### Performance Profiling

```typescript
export const profilingHook = {
  name: 'session.created',
  
  handler: async (input, output) => {
    const start = performance.now()
    
    // Your hook logic
    await initializeResources()
    
    const duration = performance.now() - start
    
    if (duration > 100) {
      console.warn(`Slow hook: session.created took ${duration.toFixed(2)}ms`)
    }
  }
}
```

---

## Examples

### Example 1: Git Integration Hook

```typescript
// hooks/git-integration.ts
export const gitHook = {
  name: 'file.watcher.updated',
  
  handler: async (input, output) => {
    // Track file changes for git commit suggestions
    if (!input.path.includes('.git/')) {
      changeTracker.add({
        path: input.path,
        event: input.event,
        timestamp: input.timestamp
      })
    }
  }
}
```

### Example 2: Notification Hook

```typescript
// hooks/notifications.ts
export const notificationHook = {
  name: 'session.stop',
  
  handler: async (input, output) => {
    // Send notification when long session ends
    if (input.metadata?.durationMs && input.metadata.durationMs > 60 * 60 * 1000) {
      await notifier.send({
        title: 'Session Complete',
        message: `Session lasted ${Math.round(input.metadata.durationMs / 60000)} minutes`
      })
    }
  }
}
```

### Example 3: Analytics Hook

```typescript
// hooks/analytics.ts
export const analyticsHook = {
  name: 'tool.execute.after',
  
  handler: async (input, output) => {
    // Track tool usage analytics
    const event = {
      event: 'tool_executed',
      properties: {
        tool_name: input.tool,
        duration_ms: output.durationMs,
        success: output.success,
        session_id: hashSessionId(input.sessionId),
        timestamp: input.timestamp
      }
    }
    
    // Non-blocking analytics
    analytics.track(event).catch(() => {}) // Ignore errors
  }
}
```

---

## Next Steps

- Read the [Hook Architecture](../architecture/hooks.md) for detailed lifecycle information
- Explore the [Hook Templates](../../templates/hooks/) for ready-to-use patterns
- Check the [API Reference](../reference/) for all available types
- Join the community to share your hooks

---

## Troubleshooting Guide

| Problem | Solution |
|---------|----------|
| Hook not firing | Check name matches exactly, verify enabled in config |
| Type errors | Import types from `~/universal/hooks`, check generic params |
| Performance issues | Add `priority`, use non-blocking patterns, add caching |
| Memory leaks | Clean up resources in `session.deleted`, use WeakMaps |
| Race conditions | Use async/await properly, avoid shared mutable state |
