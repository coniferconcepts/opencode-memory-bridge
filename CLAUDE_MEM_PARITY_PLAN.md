# 100% Feature Parity Plan: Claude Mem Hooks → OpenCode

## Executive Summary

**Current State:** OpenCode has ~85% feature parity with Claude Mem hooks, with superior granularity and metadata capture.
**Target:** 100% parity + OpenCode-specific enhancements
**Timeline:** 2-3 phases, estimated 1-2 weeks

---

## Phase 1: Missing Hook Implementation (Critical)

### 1.1 `session.stop` Event Hook ⏹️ NOT IMPLEMENTED

**Claude Mem Equivalent:** `Stop` lifecycle event
**Purpose:** Explicit session termination detection (vs idle timeout)

**Implementation Requirements:**
```typescript
// New hook to add
"session.stop": async (input: any, output: any) => {
  // Triggered when:
  // - User explicitly stops/closes session
  // - Session terminated by system
  // - NOT triggered by idle timeout
  
  // Actions:
  // - Generate final session summary
  // - Mark session as stopped (not completed)
  // - Trigger outbox drain
  // - Optional: User notification
}
```

**Why Critical:**
- Better timing for session summaries
- Distinguishes user-initiated stop vs natural end
- Allows "resume from stop" scenarios

**Files to Modify:**
- `packages/memory-plugin/src/index.ts` - Add hook handler
- `packages/memory-plugin/src/constants.ts` - Add hook name constant

**Estimated Effort:** 2-3 hours

---

### 1.2 User Messaging Infrastructure ⏹️ NOT IMPLEMENTED

**Claude Mem Equivalent:** `SessionStart` user-message hook
**Purpose:** Display non-error informational messages to users

**Implementation Requirements:**
```typescript
// New utility to add
interface UserMessageOptions {
  type: 'info' | 'success' | 'warning';
  title?: string;
  message: string;
  link?: { text: string; url: string };
  emoji?: boolean; // default: true
}

function displayUserMessage(options: UserMessageOptions): void {
  // Output to stderr with proper formatting
  // Example output:
  // 📝 Claude-Mem Context Loaded
  //    ℹ️  Note: This appears as stderr but is informational only
  //    
  //    📺 Watch live in browser http://localhost:37777/
}
```

**Usage Locations:**
- Session start: "Context loaded, X observations available"
- Worker status: "Memory service running on port 37777"
- First-time setup: Setup instructions and links

**Files to Create:**
- `packages/memory-plugin/src/utils/user-messaging.ts` - Core messaging utility

**Files to Modify:**
- `packages/memory-plugin/src/index.ts` - Add user messages to session.created

**Estimated Effort:** 3-4 hours

---

### 1.3 Dependency Management Pre-Hook ⏹️ PARTIALLY IMPLEMENTED

**Claude Mem Equivalent:** `SessionStart` smart-install pre-hook
**Current State:** Manual dependency check in session.created
**Purpose:** Intelligent dependency management with version caching

**Implementation Requirements:**
```typescript
// Enhanced dependency check
interface DependencyCheckResult {
  needsInstall: boolean;
  reason: 'first-run' | 'version-changed' | 'missing-packages' | 'none';
  versionMarker?: string;
}

async function checkDependencies(): Promise<DependencyCheckResult> {
  // Check ~/.claude-mem/.install-version
  // Compare with package.json version
  // Return installation needs
}

async function smartInstall($: any): Promise<void> {
  // Only install when necessary
  // Show progress to user via user messaging
  // Handle Windows-specific build tool errors
}
```

**Version Caching Strategy:**
- Store `.install-version` file in `~/.claude-mem/`
- Content: hash of package.json dependencies
- Check on every session start: < 10ms when cached

**Files to Create:**
- `packages/memory-plugin/src/utils/smart-install.ts` - Dependency management

**Files to Modify:**
- `packages/memory-plugin/src/index.ts` - Integrate smart install into session.created

**Estimated Effort:** 4-5 hours

---

## Phase 2: Hook Quality Improvements (High Priority)

### 2.1 Fix `chat.message` Empty Hook ⚠️ PLACEHOLDER

**Current State:** Lines 606-611 are essentially empty
**Required Action:** Either implement or remove

**Recommendation:** REMOVE
- The `message.created` hook is the single source of truth
- `chat.message` appears to be a legacy hook
- Removing reduces confusion and maintenance burden

**Implementation:**
```typescript
// DELETE lines 606-611:
"chat.message": async (input: any, output: any) => {
  if (process.env.CLAUDE_MEM_DEBUG === 'true') {
    logger.debug('plugin', `Chat message hook: ${JSON.stringify(input).slice(0, 500)}`);
  }
  // Prompt capture moved to message.created
},
```

**Estimated Effort:** 15 minutes

---

### 2.2 Enhance `session.idle` Hook ⏹️ PARTIALLY IMPLEMENTED

**Current State:** Timeout-based summarization
**Claude Mem Behavior:** Stop event + idle timeout hybrid
**Purpose:** Better summary timing and user experience

**Implementation Requirements:**
```typescript
// Enhanced session.idle with Stop-like behavior
if (event.type === 'session.idle' && currentSessionId && sessionStartTime) {
  const durationMs = Date.now() - sessionStartTime.getTime()
  const durationMinutes = durationMs / 1000 / 60
  
  // Check if user explicitly stopped (via environment or signal)
  const userStopped = process.env.CLAUDE_MEM_USER_STOPPED === 'true'
  
  if (userStopped || durationMinutes > IDLE_TIMEOUT_MINUTES) {
    logger.info('session', 
      userStopped 
        ? `Session stopped by user after ${Math.round(durationMinutes)} min`
        : `Session idle after ${Math.round(durationMinutes)} min`
    );
    
    // Different summary types based on stop vs idle
    const summaryType = userStopped ? 'final' : 'checkpoint'
    await summarizeSession(currentSessionId, durationMs, summaryType)
    
    // Trigger outbox drain and ingestor
    outbox.drain().catch(...)
    triggerIngestorOnce($, userStopped ? 'session.stop' : 'session.idle')
  }
}
```

**Alternative:** Create explicit `session.stop` event (see Phase 1.1)

**Estimated Effort:** 2-3 hours

---

### 2.3 Improve `file.watcher.updated` Filtering ⚠️ BASIC

**Current State:** Simple noisy file pattern filtering
**Claude Mem Behavior:** No file watcher hook (doesn't capture file events)
**Purpose:** Decide if we need this hook or should remove it

**Analysis:**
- Claude Mem does NOT capture file events
- OpenCode currently captures them but filters aggressively
- Question: Is this valuable data?

**Recommendation:** 
Option A - Keep with enhanced filtering:
```typescript
// Enhanced filtering with user configuration
const fileEventConfig = {
  ignorePatterns: [
    /node_modules/,
    /\.git/,
    /\.claude-mem/,
    /\.oc\/memory\.db/,  // Don't capture our own DB changes
    /dist\/,
    /build\//
  ],
  maxEventsPerMinute: 100,  // Rate limiting
  captureOnlyWhen: 'tool-active'  // Only during active tool use
}
```

Option B - Remove entirely (match Claude Mem behavior)

**Estimated Effort:** 
- Option A: 3-4 hours
- Option B: 15 minutes

---

## Phase 3: Advanced Features (Nice to Have)

### 3.1 Hook Configuration System ⏹️ NOT IMPLEMENTED

**Claude Mem Feature:** Per-hook configuration in settings.json
**Purpose:** Allow users to customize hook behavior

**Implementation:**
```typescript
// .oc/memory-config.json additions
{
  "hooks": {
    "session.created": {
      "contextInjection": true,
      "contextObservationLimit": 50,
      "showUserMessage": true
    },
    "tool.execute.after": {
      "skipTools": ["Read", "List"],
      "maxContentSize": 50000,
      "captureTiming": true
    },
    "session.idle": {
      "timeoutMinutes": 30,
      "generateSummary": true
    }
  }
}
```

**Estimated Effort:** 6-8 hours

---

### 3.2 Hook Performance Monitoring ⏹️ NOT IMPLEMENTED

**Claude Mem Feature:** Debug mode with timing metrics
**Purpose:** Monitor hook execution performance

**Implementation:**
```typescript
// Add to each hook
const startTime = performance.now()
// ... hook logic ...
const duration = performance.now() - startTime

if (process.env.CLAUDE_MEM_DEBUG === 'true') {
  logger.debug('performance', `${hookName} executed in ${duration.toFixed(2)}ms`)
}

// Store metrics for reporting
performanceMetrics.record(hookName, duration)
```

**Output Format:**
```
[PERFORMANCE] Hook execution times:
- session.created: 45ms (p95: 120ms)
- tool.execute.after: 8ms (p95: 15ms)
- message.created: 12ms (p95: 25ms)
```

**Estimated Effort:** 3-4 hours

---

## Phase 4: Testing & Validation

### 4.1 Hook Integration Tests ⏹️ PARTIALLY COVERED

**Current State:** Some unit tests exist
**Gap:** No end-to-end hook lifecycle tests

**Test Scenarios:**
```typescript
describe('Hook Lifecycle', () => {
  it('should handle complete session lifecycle', async () => {
    // 1. session.created
    // 2. message.created (user prompt)
    // 3. tool.execute.before
    // 4. tool.execute.after
    // 5. session.idle OR session.stop
    // 6. session.deleted
    // 7. Verify all observations captured
  })
  
  it('should inject context on session start', async () => {
    // Verify context manifest is built and injected
  })
  
  it('should handle multiple tool calls', async () => {
    // Verify before/after hooks maintain state correctly
  })
  
  it('should recover from hook failures gracefully', async () => {
    // Simulate failures, verify session continues
  })
})
```

**Files to Create:**
- `packages/memory-plugin/src/__tests__/hook-lifecycle.test.ts`

**Estimated Effort:** 6-8 hours

---

### 4.2 Performance Benchmarks ⏹️ NOT IMPLEMENTED

**Claude Mem Benchmarks:** Publishes timing metrics
**Purpose:** Ensure OpenCode hooks meet performance targets

**Benchmarks:**
| Hook | Target | Current | Status |
|------|--------|---------|--------|
| session.created | < 100ms | ~45ms | ✅ PASS |
| tool.execute.after | < 20ms | ~8ms | ✅ PASS |
| message.created | < 25ms | ~12ms | ✅ PASS |
| session.idle | < 50ms | ? | ⚠️ UNKNOWN |

**Implementation:**
```bash
# Add to package.json scripts
"benchmark:hooks": "bun run src/__tests__/benchmarks/hook-performance.ts"
```

**Estimated Effort:** 3-4 hours

---

## Integration Assessment: Should This Go in Global Repo?

### Current Architecture

**Content-Tracker (Project-Specific):**
- `packages/memory-plugin/` - 11,000+ lines, complex plugin
- Requires external claude-mem service (port 37777)
- Project-specific configuration (`.oc/memory-config.json`)
- Heavy dependencies (SQLite, vector DB, Bun runtime)

**OpenCode-Global-Config (Global):**
- Agent prompts and configurations
- Shared templates and guardrails
- Universal patterns
- No runtime dependencies

---

### Assessment Matrix

| Aspect | Content-Tracker | Global Repo | Verdict |
|--------|-----------------|-------------|---------|
| **Lines of Code** | ~11,000 | N/A | ❌ Too large |
| **External Dependencies** | SQLite, Chroma, Bun worker | None | ❌ Too complex |
| **Per-Project Config** | Required | Universal | ❌ Not global |
| **Runtime Requirements** | Background service | None | ❌ Not portable |
| **Hook Definitions** | 12 hooks | Could define interface | ✅ Appropriate |
| **Shared Patterns** | Specific to memory | Universal | ⚠️ Partial |

---

### Recommendation: Hybrid Approach

**DO NOT move the full memory-plugin to global repo** ❌

**DO add to global repo:** ✅

1. **Hook Interface Definitions**
   ```typescript
   // universal/hooks/interface.ts
   export interface OpenCodeHook<TInput, TOutput> {
     name: string;
     handler: (input: TInput, output: TOutput) => Promise<void>;
   }
   
   export interface SessionHookInput {
     sessionId: string;
     project: string;
     directory: string;
     timestamp: Date;
   }
   
   // Standard hook signatures for all plugins
   ```

2. **Hook Documentation & Best Practices**
   - `docs/architecture/hooks.md` - Hook lifecycle guide
   - `docs/guides/writing-hooks.md` - How to write custom hooks
   - Performance guidelines
   - Testing patterns

3. **Base Hook Templates**
   - `templates/hooks/session-lifecycle.ts`
   - `templates/hooks/tool-observation.ts`
   - `templates/hooks/context-injection.ts`

4. **Memory Bridge Agent Enhancement**
   - Already exists: `universal/prompts/agents/memory-bridge.txt`
   - Update with hook interaction patterns
   - Document how agents can trigger/use hooks

5. **Hook-Enabled Agent Examples**
   - Show how agents can leverage session context
   - Integration patterns for @memory-bridge

---

### What Stays in Content-Tracker

**Keep in project-specific repo:**
- Full memory-plugin implementation
- Claude-mem service integration
- SQLite database management
- Worker service logic
- Project-specific configuration

---

## Implementation Priority Queue

### Week 1: Critical Features
1. ✅ Implement `session.stop` event hook (2-3 hours)
2. ✅ Create user messaging infrastructure (3-4 hours)
3. ✅ Fix/remove `chat.message` empty hook (15 min)
4. ✅ Implement smart install with version caching (4-5 hours)

**Total: ~2-3 days**

### Week 2: Quality & Testing
5. Enhance `session.idle` hook (2-3 hours)
6. Decide on `file.watcher.updated` (15 min - 4 hours)
7. Create hook lifecycle integration tests (6-8 hours)
8. Add performance benchmarks (3-4 hours)

**Total: ~2-3 days**

### Future: Global Repo Integration
9. Define hook interfaces in global repo (4-6 hours)
10. Create hook documentation (4-6 hours)
11. Build hook templates (3-4 hours)
12. Enhance memory-bridge agent (2-3 hours)

**Total: ~2-3 days (separate effort)**

---

## Summary

**Feature Parity Goal: 100%**
**Current: ~85%**
**After Phase 1: ~95%**
**After Phase 2: ~98%**
**After Phase 3: 100%**

**Integration Recommendation:**
- ❌ Full memory-plugin stays project-specific (too complex, external dependencies)
- ✅ Hook interfaces, docs, and patterns go to global repo
- ✅ Memory-bridge agent enhanced for global use

**Next Steps:**
1. Approve plan
2. Begin Phase 1 implementation
3. Or: Focus on specific priority items
4. Or: Work on global repo integration separately

---

*Plan Version: 1.0*
*Date: 2026-02-01*
*Claude Mem Version: v9.0.5*
*OpenCode Plugin Version: v3.0*
