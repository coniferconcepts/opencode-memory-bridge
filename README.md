# @opencode/memory-plugin

Multi-project memory cataloging plugin for OpenCode.

> ⚠️ **CRITICAL: Bun Runtime Required** ⚠️
> 
> This plugin **ONLY works with Bun runtime** and will fail under Node.js.
> 
> **Why?** The plugin uses `bun:sqlite`, a Bun built-in module that doesn't exist in Node.js.
> 
> **Quick Fix:**
> ```bash
> # ❌ DON'T: npm run claude-mem:restart  (uses Node.js - will fail)
> # ✅ DO:    bun run scripts/memory-bridge.ts restart  (uses Bun - works!)
> ```
> 
> Install Bun: `curl -fsSL https://bun.sh/install | bash`

## Overview

This plugin automatically captures observations from tool executions and stores them in a structured memory database. It provides:

- **Automatic Extraction**: Transforms raw tool outputs into strategic knowledge artifacts using ZEN models.
- **Context Injection**: Injects relevant historical context into new sessions to help agents remember past decisions.
- **Durable Outbox**: Ensures observations are captured even if the worker service is temporarily unavailable.
- **ZEN-Native Integration**: Leverages OpenCode's internal LLM dispatcher for "zero-key" AI extraction.

## Architecture

The plugin implements a **Hybrid Extraction Strategy**:

1.  **ZEN-Native (Internal Session)**: Creates a dedicated background session in OpenCode to perform LLM completions using the host's authentication.
2.  **CLI Delegation**: Falls back to `opencode run` for non-interactive extraction if the SDK session is unavailable.
3.  **Direct API**: Falls back to direct calls to `https://opencode.ai/zen/v1/` if `OPENCODE_API_KEY` is provided.
4.  **Simple Fallback**: Uses basic non-AI extraction to ensure no data is lost.

## Configuration

The plugin can be configured via `.oc/memory-config.json` in the project root:

```json
{
  "enabled": true,
  "verbosity": "normal",
  "projectAllowlist": ["*"],
  "agentAllowlist": ["orchestrator", "planner"]
}
```

## Development

### Build

```bash
cd packages/memory-plugin
npm run build
```

### Test

```bash
cd packages/memory-plugin
npm test
```

## Phase 3: Advanced Memory Features

### Importance Scoring (Task 3.2)

Observations are automatically scored 0-100 with four tiers:

| Tier | Score Range | Description |
|------|-------------|-------------|
| Critical | 90-100 | Decision-critical, high-ROI |
| High | 70-89 | Important features, bug fixes |
| Medium | 40-69 | Standard development work |
| Low | 0-39 | Discovery, routine changes |

Scoring factors:
- Type: decision (30), bugfix (25), feature (20), refactor (15), change (12), discovery (10)
- Content quality: narrative length, facts, concepts (30 points)
- Recency: exponential decay over 30 days (20 points)
- ROI: discovery tokens spent (10 points)
- References: backward references (10 points)

### Relationship Tracking (Task 3.1)

Automatic relationship detection between observations using 5 heuristics:

**Relationship Types**:
- `follows` - Chronological sequence
- `references` - Content references
- `modifies` - Changes prior work
- `extends` - Builds upon
- `depends_on` - Requires understanding
- `conflicts_with` - Contradicts

**Detection Heuristics**:
1. Concept overlap (shared concepts)
2. File matching (same files referenced)
3. Tool sequence (sequential operations)
4. Temporal proximity (within 5 minutes)
5. Session proximity (same session)

**Graph Queries**:
- `getRelatedObservations(db, id, options)` - Get 1-hop neighbors
- `getRelationshipGraph(db, rootId, maxDepth)` - BFS graph traversal
- `findPathBetween(db, startId, endId)` - Shortest path

### Hybrid Search (Task 3.3)

Enhanced search combining semantic similarity with importance weighting.

**Search Modes**:

```typescript
// Pure semantic (backward compatible)
const results = await simpleSearch(semanticResults, 'query', 10);

// Hybrid scoring (default - importance weighting)
const results = await hybridSearchWithScoring(
  semanticResults,
  'query',
  10,
  { minImportance: 50 }
);

// Full intelligence (hybrid + relationship expansion)
const results = await fullIntelligenceSearch(
  semanticResults,
  'query',
  10,
  db,
  { expandByRelationships: true }
);
```

**Scoring Formula**:
```
Combined Score = 0.7 × semanticScore + 0.3 × (importanceScore / 100)
```

### Configuration

```typescript
// constants.ts
HYBRID_SEARCH_CONFIG = {
  defaultUseHybridScoring: true,
  defaultExpandByRelationships: false,
  defaultMaxNeighborsPerResult: 3,
  maxExpansionResults: 100,
  defaultMinRelationshipConfidence: 0.5,
  defaultMinImportance: 0,
  defaultMinRelevance: 0.3,
}
```
