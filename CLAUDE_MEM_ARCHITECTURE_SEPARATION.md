# Claude Mem Architecture Separation Analysis

## Executive Summary

**Yes, separating the OpenCode memory plugin into its own repo makes excellent architectural sense.** Here's the comprehensive analysis and recommended approach.

---

## Current Architecture Understanding

### Three Distinct Components Currently in Content-Tracker:

```
/content-tracker/
├── .claude/plugins/claude-mem/          # THIRD-PARTY: Original Claude Mem plugin
│   ├── package.json (v9.0.12)
│   ├── src/ (official Claude Mem source)
│   └── Maintained by: thedotmack (Alex Newman)
│   └── License: AGPL-3.0
│
├── packages/memory-plugin/              # OPENCODE BRIDGE: Our OpenCode integration
│   ├── package.json (@opencode/memory-plugin)
│   ├── src/index.ts (OpenCode hooks implementation)
│   └── Our custom code (11,000+ lines)
│
└── CLAUDE_MEM_PARITY_PLAN.md            # DOCUMENTATION: Our planning docs
```

### Clarification of Components:

| Component | Type | Maintained By | Purpose |
|-----------|------|---------------|---------|
| **claude-mem** (in .claude/plugins/) | Third-party plugin | thedotmack | Official Claude Mem for Claude Code |
| **@opencode/memory-plugin** | OpenCode bridge | Us | Connects OpenCode to claude-mem service |
| **Global hook interfaces** | Shared types/docs | Us | TypeScript definitions and templates |

---

## Recommended New Architecture

### Proposed Repo Structure:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPO 1: claude-mem-source                    │
│              (Fork of thedotmack/claude-mem)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Upstream sync from original repo                             │
│  • Our custom patches/extensions                                │
│  • Worker service (port 37777)                                  │
│  • SQLite + Chroma database                                     │
│  • MCP server implementation                                    │
│  • Web UI (localhost:37777)                                     │
│                                                                 │
│  Maintained as: Fork with upstream sync                        │
│  Install: .claude/plugins/claude-mem/                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API (port 37777)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPO 2: opencode-memory-bridge                     │
│         (Currently: content-tracker/packages/memory-plugin)    │
├─────────────────────────────────────────────────────────────────┤
│  • OpenCode plugin implementation                               │
│  • Hook handlers (session.created, tool.execute.after, etc.)   │
│  • ZEN-native extraction                                        │
│  • Durable outbox pattern                                       │
│  • Smart install utility                                        │
│  • User messaging                                               │
│  • Integration tests (19 tests)                                 │
│  • Performance benchmarks                                       │
│                                                                 │
│  Package: @opencode/memory-plugin                              │
│  Install: npm install @opencode/memory-plugin                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Plugin API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPO 3: opencode-global-config (EXISTING)         │
├─────────────────────────────────────────────────────────────────┤
│  • Hook interface definitions (universal/hooks/)               │
│  • Documentation (docs/architecture/hooks.md)                  │
│  • Templates (templates/hooks/)                                │
│  • Memory-bridge agent (universal/prompts/agents/)             │
│  • Shared types and utilities                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Goes in Each Repo

### Repo 1: `claude-mem-source` (NEW FORK)

**Purpose:** Maintain the original Claude Mem plugin with our customizations

**Contents:**
```
claude-mem-source/
├── src/
│   ├── hooks/           # Original Claude Mem hooks
│   ├── services/        # Worker service, SQLite, Chroma
│   └── ui/              # Web viewer
├── plugin/              # Compiled plugin
├── docs/                # Upstream docs + our additions
├── package.json         # v9.0.12
└── README.md            # Fork notice + sync instructions
```

**Maintenance Strategy:**
- Fork from `thedotmack/claude-mem`
- Regular sync from upstream (monthly or on new releases)
- Apply our patches in a separate branch
- Keep modifications minimal and documented

**Why Separate?**
- Clear separation from upstream
- Easier to track upstream changes
- Can contribute back to original project
- Version management independent of OpenCode

---

### Repo 2: `opencode-memory-bridge` (EXTRACT FROM CONTENT-TRACKER)

**Purpose:** The OpenCode-specific bridge plugin

**Contents (from current packages/memory-plugin/):**
```
opencode-memory-bridge/
├── src/
│   ├── index.ts                    # Main plugin with all hooks
│   ├── constants.ts                # Configuration constants
│   ├── manifest.ts                 # Context injection
│   ├── outbox.ts                   # Durable outbox
│   ├── summarization.ts            # Session summaries
│   ├── ingestor.ts                 # Data ingestion
│   ├── zen-native.ts               # ZEN extraction
│   ├── utils/
│   │   ├── smart-install.ts       # Dependency management
│   │   └── user-messaging.ts      # User notifications
│   └── __tests__/
│       ├── hook-lifecycle.test.ts # 19 integration tests
│       └── benchmarks/
│           └── hook-performance.ts
├── package.json                    # @opencode/memory-plugin
├── tsconfig.json
├── README.md                       # Updated documentation
├── CHANGELOG.md                    # Version history
└── MIGRATION_GUIDE.md             # Upgrade instructions
```

**Maintenance Strategy:**
- Independent release cycle from claude-mem-source
- Semantic versioning for the bridge
- Published to npm as @opencode/memory-plugin
- CI/CD for testing and publishing

**Why Separate?**
- **Reusability:** Any OpenCode project can install it via npm
- **Clear API:** Well-defined interface between bridge and service
- **Testing:** Can test bridge independently of claude-mem updates
- **Versioning:** Bridge can evolve independently
- **Contributions:** Easier for community to contribute

---

### Repo 3: `opencode-global-config` (ALREADY EXISTS)

**Purpose:** Global configurations, types, and documentation

**Contents (already created):**
```
opencode-global-config/
├── universal/hooks/
│   ├── interface.ts       # TypeScript hook definitions
│   └── index.ts          # Exports
├── templates/hooks/
│   ├── session-lifecycle.ts
│   ├── tool-observation.ts
│   └── context-injection.ts
├── docs/
│   ├── architecture/hooks.md
│   └── guides/writing-hooks.md
└── universal/prompts/agents/memory-bridge.txt
```

**Role:**
- Provides TypeScript types for all hook implementations
- Documents hook patterns and best practices
- Provides templates for custom hook development
- Contains the memory-bridge agent definition

**Why Keep Separate?**
- Language-agnostic (just types and docs)
- Can be imported by any project
- Provides authoritative definitions
- Not tied to any specific implementation

---

## Benefits of This Separation

### 1. **Clear Responsibility Boundaries**

| Repo | Responsibility | Updates When |
|------|----------------|--------------|
| claude-mem-source | Core memory service | Upstream releases updates |
| opencode-memory-bridge | OpenCode integration | We add features/fix bugs |
| opencode-global-config | Shared types/docs | Hook interface changes |

### 2. **Independent Release Cycles**

```
claude-mem-source:    v9.0.12 → v9.1.0 (upstream update)
opencode-memory-bridge: v3.1.0 → v3.2.0 (new feature)
opencode-global-config:  v1.0 → v1.1 (new hook type)
```

### 3. **Easier Maintenance**

- **Upstream Sync:** Simply `git fetch upstream` in claude-mem-source
- **Bridge Updates:** Work on opencode-memory-bridge without touching core
- **Type Updates:** Change interfaces in global-config, update bridge

### 4. **Better Testing**

- Test bridge against different claude-mem versions
- Mock claude-mem service for bridge testing
- CI/CD per repository

### 5. **Community Contribution**

- Bridge repo can accept PRs from OpenCode users
- Clear contribution guidelines per repo
- Issues tracked separately

---

## Implementation Plan

### Phase 1: Create `claude-mem-source` Repo

1. **Fork the original:**
   ```bash
   git clone https://github.com/thedotmack/claude-mem.git claude-mem-source
   cd claude-mem-source
   git remote add upstream https://github.com/thedotmack/claude-mem.git
   ```

2. **Apply current customizations:**
   - Compare with current `.claude/plugins/claude-mem/`
   - Create `patches/` directory for our changes
   - Document each patch in `PATCHES.md`

3. **Update documentation:**
   - Add FORK.md explaining relationship to upstream
   - Add SYNC.md with sync instructions
   - Update README with installation for content-tracker

### Phase 2: Extract `opencode-memory-bridge` Repo

1. **Create new repo:**
   ```bash
   mkdir opencode-memory-bridge
   cd opencode-memory-bridge
   git init
   ```

2. **Extract from content-tracker:**
   ```bash
   # Copy all memory-plugin files
   cp -r /content-tracker/packages/memory-plugin/* .
   
   # Update package.json
   # Change name if needed: @opencode/memory-plugin
   # Update repository URL
   ```

3. **Update dependencies:**
   - Add `claude-mem-source` as git submodule or peer dependency
   - Update imports to reference new locations
   - Ensure all tests pass

4. **Setup CI/CD:**
   - GitHub Actions for testing
   - Automated npm publishing
   - Version tagging

### Phase 3: Update Content-Tracker

1. **Remove packages/memory-plugin/:**
   ```bash
   cd /content-tracker
   rm -rf packages/memory-plugin
   ```

2. **Add as dependency:**
   ```json
   // content-tracker/package.json
   {
     "dependencies": {
       "@opencode/memory-plugin": "^3.1.0"
     }
   }
   ```

3. **Update .claude/plugins/:**
   - Replace with git submodule from claude-mem-source
   - Or use npm install if published

4. **Update documentation:**
   - Reference new repos in README
   - Update installation instructions

### Phase 4: Update Global Config

1. **Already done!** The global-config has the hook interfaces
2. **Add references:**
   - Link to opencode-memory-bridge in docs
   - Add installation instructions

---

## What About the Hooks?

**Question:** Where do the hooks live?

**Answer:** The hooks are implemented in `opencode-memory-bridge`, but the **hook interface definitions** (TypeScript types) are in `opencode-global-config`.

### Hook Distribution:

```typescript
// In opencode-global-config/universal/hooks/interface.ts
export interface SessionHookInput {
  sessionId: string;
  project: string;
  directory: string;
}

// In opencode-memory-bridge/src/index.ts
"session.created": async (input: SessionHookInput, output: any) => {
  // Implementation uses the interface from global-config
  // This is the actual hook handler
}
```

### Why This Split?

- **Global Config:** Authoritative type definitions (single source of truth)
- **Memory Bridge:** Actual hook implementations (can be swapped out)
- **Future:** Could create alternative bridges (vscode-bridge, cursor-bridge) using same types

---

## What About the OpenCode Plugin?

**The OpenCode plugin IS the bridge!** 

The `@opencode/memory-plugin` (in packages/memory-plugin/) IS the OpenCode plugin. When we separate it into its own repo (`opencode-memory-bridge`), it becomes:

1. **An npm package:** `@opencode/memory-plugin`
2. **Installed as:** `npm install @opencode/memory-plugin`
3. **Used by:** Any OpenCode project via `.opencode/plugins/`
4. **Depends on:** claude-mem service (from claude-mem-source)

### Installation Flow:

```bash
# For any OpenCode project:
npm install @opencode/memory-plugin

# This gives you:
# - All the hooks (session.stop, user messaging, etc.)
# - Integration with claude-mem service
# - TypeScript types from global-config
```

---

## Migration Strategy for Content-Tracker

### Current State:
```
content-tracker/
├── .claude/plugins/claude-mem/     # 3rd party (fork it)
├── packages/memory-plugin/         # Move to new repo
└── docs about claude-mem          # Keep references
```

### Target State:
```
content-tracker/
├── .claude/plugins/claude-mem/     # git submodule → claude-mem-source
├── node_modules/@opencode/memory-plugin/  # npm dependency
└── docs/                           # References to external repos
```

### Steps:
1. Create `claude-mem-source` repo (fork)
2. Create `opencode-memory-bridge` repo (extract)
3. In content-tracker:
   - Remove `packages/memory-plugin/`
   - Add `npm install @opencode/memory-plugin`
   - Replace `.claude/plugins/claude-mem/` with submodule
   - Update all imports
   - Test everything works

---

## Questions Answered

### Q: Does separating make sense?
**A: YES.** Clear separation of concerns, independent versioning, easier maintenance.

### Q: Where do the hooks go?
**A:** Hook implementations in `opencode-memory-bridge`, hook types in `opencode-global-config`.

### Q: What about the OpenCode plugin?
**A:** The plugin IS the bridge. It becomes `@opencode/memory-plugin` npm package.

### Q: How do we sync with original Claude Mem?
**A:** `claude-mem-source` is a fork with documented sync process.

### Q: Can other projects use this?
**A:** Yes! Any OpenCode project can `npm install @opencode/memory-plugin`.

---

## Recommended Immediate Actions

1. **Create `claude-mem-source` fork** - Start tracking upstream
2. **Extract `opencode-memory-bridge`** - Make it installable via npm
3. **Update content-tracker** - Use the new npm package
4. **Document everything** - Clear READMEs in each repo

---

## External Resources & References

### Official Claude Mem Documentation

**Primary Documentation Sources:**

1. **Claude Mem Documentation Index** (`llms.txt`)
   - URL: `https://docs.claude-mem.ai/llms.txt`
   - Purpose: Complete documentation index with all available pages
   - Use: Reference for understanding full documentation structure

2. **Claude Mem Full Documentation** (`llms-full.txt`)
   - URL: `https://docs.claude-mem.ai/llms-full.txt`
   - Purpose: Complete documentation content including:
     - Architecture evolution (v1-v5+)
     - Database architecture (SQLite, FTS5)
     - Hook lifecycle documentation
     - Worker service details
     - Platform integration guide
   - Use: Primary reference for implementation details

3. **Hooks Architecture** (detailed guide)
   - URL: `https://docs.claude-mem.ai/hooks-architecture`
   - Purpose: Complete 5-stage memory agent lifecycle
   - Use: Reference for hook implementation patterns

4. **Platform Integration Guide**
   - URL: `https://docs.claude-mem.ai/platform-integration`
   - Purpose: Complete reference for integrating claude-mem worker service
   - Use: Essential for bridge development

### Key Documentation Sections

From the official documentation:

- **Architecture Evolution**: How claude-mem evolved from v3 to v5+
- **Database Architecture**: SQLite schema, FTS5 search, data storage
- **Hook Lifecycle**: 5-stage memory agent lifecycle for platform implementers
- **Worker Service**: HTTP API and Bun process management
- **Configuration**: Environment variables and settings
- **Troubleshooting**: Common issues and solutions

### Repository References

- **Original Upstream**: `https://github.com/thedotmack/claude-mem`
- **Documentation Site**: `https://docs.claude-mem.ai/`
- **License**: AGPL-3.0

---

## Conclusion

**This separation creates a clean, maintainable, reusable architecture:**

- **3 repos with clear responsibilities**
- **Independent release cycles**
- **Easy upstream syncing**
- **Reusable by any OpenCode project**
- **Community-friendly contribution model**

The separation makes the system more modular, testable, and maintainable while preserving all current functionality.

---

*Analysis Version: 1.0*
*Date: 2026-02-01*
*Based on: content-tracker current state + global-config hook interfaces*
*Documentation References: docs.claude-mem.ai/llms.txt, docs.claude-mem.ai/llms-full.txt*