# Search Orchestration Layer (Task 3.3)

## Overview

The Search Orchestration Layer provides a unified API for hybrid search execution with feature flags for gradual rollout of advanced capabilities:

- **Pure Semantic Search**: Backward compatible, existing behavior unchanged
- **Hybrid Scoring**: Importance-weighted semantic results (default: enabled)
- **Query Expansion**: 1-hop relationship neighbor augmentation (default: opt-in)

All options are optional with sensible defaults. Feature flags enable controlled rollout without breaking existing code.

## API Reference

### Main Function: `executeHybridSearch()`

Executes hybrid search with optional feature flags.

```typescript
export async function executeHybridSearch(
  semanticResults: SemanticSearchResult[],
  options: HybridSearchExecutionOptions,
  db?: Database
): Promise<HybridSearchResult[]>
```

**Parameters:**
- `semanticResults`: Results from ChromaSync semantic search
- `options`: Execution options with feature flags (see below)
- `db`: Optional SQLite database connection for relationship expansion

**Returns:** Hybrid search results ranked by combined score

**Throws:** `SearchExecutionError` if validation fails

### HybridSearchExecutionOptions

Complete option interface for controlling search behavior:

```typescript
interface HybridSearchExecutionOptions {
  query: string;                           // (required) Search query
  limit: number;                           // (required) Max results
  minRelevance?: number;                   // Min semantic score (0-1, default: 0.3)
  minImportance?: number;                  // Min importance score (0-100, default: 0)
  useHybridScoring?: boolean;              // Enable importance weighting (default: true)
  expandByRelationships?: boolean;         // Enable relationship expansion (default: false)
  maxNeighborsPerResult?: number;          // Max neighbors per result (default: 3)
  maxExpansionResults?: number;            // Safety limit on expansion (default: 100)
  relationshipTypes?: string[];            // Filter by relationship types (optional)
  minRelationshipConfidence?: number;      // Min relationship confidence (default: 0.5)
  boostRecent?: boolean;                   // Apply recency weighting (future enhancement)
}
```

## Usage Patterns

### Pattern 1: Pure Semantic Search (Backward Compatible)

```typescript
import { executeHybridSearch } from '@opencode/memory-plugin';

const results = await executeHybridSearch(semanticResults, {
  query: 'authentication bug',
  limit: 10,
  useHybridScoring: false
});
```

**When to use:** Legacy code, pure semantic matching without importance filtering

**Result count:** Up to `limit` results

---

### Pattern 2: Hybrid Scoring (Importance Weighting)

```typescript
const results = await executeHybridSearch(semanticResults, {
  query: 'authentication bug',
  limit: 10,
  useHybridScoring: true    // (default)
});
```

**When to use:** Default pattern - combines semantic relevance (70%) with importance (30%)

**Features:**
- Importance-weighted ranking
- Filters based on minimum importance threshold
- Prevents low-quality spam from ranking too high

**Scoring formula:**
```
Combined Score = 0.7 × semanticScore + 0.3 × (importanceScore / 100)
```

---

### Pattern 3: Hybrid with Importance Filtering

```typescript
const results = await executeHybridSearch(semanticResults, {
  query: 'critical bug',
  limit: 10,
  useHybridScoring: true,
  minImportance: 70        // Only critical/high importance
});
```

**When to use:** Need only the most important observations (e.g., critical issues)

**Filtering:**
- Excludes observations below importance threshold
- Combines with semantic relevance threshold

---

### Pattern 4: Full Intelligence (Hybrid + Expansion)

```typescript
import { fullIntelligenceSearch } from '@opencode/memory-plugin';

const results = await fullIntelligenceSearch(
  semanticResults,
  'authentication',
  10,
  database,
  { maxNeighborsPerResult: 3 }
);
```

**When to use:** Discovery mode - find direct matches + related observations

**Features:**
- Hybrid scoring (importance weighting)
- 1-hop relationship expansion
- Automatic deduplication
- Result re-ranking

**Expansion algorithm:**
1. Take top K/2 direct results
2. Find up to 3 relationship neighbors per result
3. Score neighbors: `0.3 × confidence × (importance / 100)`
4. Deduplicate by observation ID
5. Re-rank all results by score
6. Return top `limit` results

---

### Pattern 5: Convenience Functions

#### simpleSearch()
Pure semantic search without hybrid scoring:

```typescript
import { simpleSearch } from '@opencode/memory-plugin';

const results = await simpleSearch(semanticResults, 'test query', 10);
```

#### hybridSearchWithScoring()
Hybrid scoring with optional parameters:

```typescript
import { hybridSearchWithScoring } from '@opencode/memory-plugin';

const results = await hybridSearchWithScoring(
  semanticResults,
  'test query',
  10,
  { minImportance: 50 }
);
```

#### fullIntelligenceSearch()
Complete search with scoring and expansion:

```typescript
import { fullIntelligenceSearch } from '@opencode/memory-plugin';

const results = await fullIntelligenceSearch(
  semanticResults,
  'test query',
  10,
  database,
  { maxNeighborsPerResult: 3 }
);
```

## Feature Flags

All feature flags default to safe, sensible values controlled by `HYBRID_SEARCH_CONFIG`:

```typescript
export const HYBRID_SEARCH_CONFIG = {
  defaultUseHybridScoring: true,           // Hybrid scoring enabled by default
  defaultExpandByRelationships: false,     // Expansion is opt-in (careful with perf)
  defaultMaxNeighborsPerResult: 3,         // Limits expansion explosion
  maxExpansionResults: 100,                // Safety limit
  defaultMinRelationshipConfidence: 0.5,   // Minimum confidence for expansion
  defaultMinImportance: 0,                 // No importance filtering by default
  defaultMinRelevance: 0.3,                // Standard semantic threshold
};
```

### Why These Defaults?

1. **Hybrid Scoring Enabled**: Safe and always beneficial
   - Importance filtering prevents spam
   - Never degrades user experience
   - Gradual rollout with data-driven tuning

2. **Relationship Expansion Opt-In**: Conservative for performance
   - Prevents unexpected latency spikes
   - Optional per-query control
   - Can be enabled globally via config changes

## Error Handling

### SearchExecutionError

Thrown when search execution fails with validation errors:

```typescript
import { SearchExecutionError } from '@opencode/memory-plugin';

try {
  await executeHybridSearch(semanticResults, options);
} catch (error) {
  if (error instanceof SearchExecutionError) {
    console.error('Search failed:', error.message);
    console.error('Context:', error.context);
    console.error('Cause:', error.cause);
  }
}
```

### Graceful Fallback

If features fail, the system falls back gracefully:

1. **Hybrid scoring fails** → Returns raw semantic results
2. **Expansion fails** → Returns non-expanded results
3. **Database unavailable** → Continues without expansion
4. **Invalid parameters** → Throws `SearchExecutionError`

## Performance Characteristics

### Execution Time

Measured on typical result sets (10-100 results):

- **Pure semantic**: <1ms (just limit slicing)
- **Hybrid scoring**: 1-5ms (weighted scoring)
- **Hybrid + expansion**: 10-100ms (depends on relationships)

### Memory Usage

- Minimal: Results are not copied (in-place re-ranking)
- Expansion: +O(n) for neighbor deduplication Map
- No internal buffers or caches

### Database Impact

- **Hybrid scoring**: No database access
- **Expansion**: One query per top-K result
- **Typically**: 2-5 queries for 10 results

## Backward Compatibility

### Pure Semantic Search

Existing code continues to work unchanged:

```typescript
// This still works exactly as before
const results = await executeHybridSearch(semanticResults, {
  query: 'test',
  limit: 10,
  useHybridScoring: false
});
```

### Default Behavior

When options are not specified, defaults apply:

```typescript
// This enables hybrid scoring by default
const results = await executeHybridSearch(semanticResults, {
  query: 'test',
  limit: 10
  // useHybridScoring: true (default)
  // expandByRelationships: false (default)
});
```

## Configuration

### Global Defaults

Modify `HYBRID_SEARCH_CONFIG` in `constants.ts`:

```typescript
export const HYBRID_SEARCH_CONFIG = {
  defaultUseHybridScoring: true,        // Change to false to disable globally
  defaultExpandByRelationships: true,   // Change to true to enable globally
  defaultMaxNeighborsPerResult: 5,      // Adjust expansion width
  // ... other options
};
```

### Per-Query Override

Use `HybridSearchExecutionOptions` to override per query:

```typescript
const results = await executeHybridSearch(semanticResults, {
  query: 'test',
  limit: 10,
  useHybridScoring: false,              // Override global default
  expandByRelationships: true,          // Override global default
});
```

## Testing

### Test Coverage

28 comprehensive tests covering:

1. **Pure semantic search** (backward compatibility)
2. **Hybrid scoring enabled**
3. **Query expansion enabled**
4. **Hybrid + expansion together**
5. **Feature flags control behavior**
6. **Error handling and graceful fallback**
7. **Convenience functions**
8. **Edge cases and boundary conditions**
9. **Result format and metadata**
10. **Parameter combinations**

### Running Tests

```bash
cd packages/memory-plugin
bun test src/__tests__/search-orchestration.test.ts
```

### Test Results

```
28 pass
0 fail
69 expect() calls
Ran 28 tests across 1 file. [80.00ms]
```

## Integration Points

### Importing

```typescript
import {
  executeHybridSearch,
  simpleSearch,
  hybridSearchWithScoring,
  fullIntelligenceSearch,
  SearchExecutionError,
  HYBRID_SEARCH_CONFIG,
  type HybridSearchExecutionOptions,
  type HybridSearchResult,
} from '@opencode/memory-plugin';
```

### Using with ChromaSync

```typescript
import { createClaudeMemClient } from '@opencode/memory-plugin';

const client = createClaudeMemClient();

// 1. Get semantic results from ChromaSync
const semanticResults = await client.search({
  query: 'authentication',
  project: 'content-tracker',
  limit: 20
});

// 2. Apply hybrid search orchestration
const hybridResults = await executeHybridSearch(semanticResults, {
  query: 'authentication',
  limit: 10,
  useHybridScoring: true
});
```

### Using with Database

```typescript
import { Database } from 'bun:sqlite';
import { executeHybridSearch } from '@opencode/memory-plugin';

const db = new Database('.claude-mem/claude-mem.db');

// Execute full intelligence search
const results = await executeHybridSearch(semanticResults, {
  query: 'authentication',
  limit: 10,
  useHybridScoring: true,
  expandByRelationships: true,
  maxNeighborsPerResult: 3
}, db);
```

## Future Enhancements

1. **Recency Weighting** (`boostRecent` flag)
   - Apply time-decay to observation importance
   - Boost recently-modified observations

2. **Custom Scoring Functions**
   - Allow pluggable importance calculators
   - Support different weighting schemes per domain

3. **Expansion Limits**
   - Configure max expansion depth (currently 1-hop)
   - Support n-hop transitive expansion

4. **Caching**
   - Cache expansion results for frequent queries
   - TTL-based invalidation

## Examples

### Example 1: Find Critical Issues

```typescript
const results = await executeHybridSearch(semanticResults, {
  query: 'security vulnerability',
  limit: 5,
  useHybridScoring: true,
  minImportance: 80,         // Only critical
  minRelevance: 0.6          // High semantic match
});
```

### Example 2: Discovery Search

```typescript
const results = await fullIntelligenceSearch(
  semanticResults,
  'database migration',
  15,
  database,
  {
    maxNeighborsPerResult: 5,
    minRelationshipConfidence: 0.4
  }
);
```

### Example 3: Backward Compatible

```typescript
// Existing code continues to work
const results = await executeHybridSearch(semanticResults, {
  query: 'bug',
  limit: 10,
  useHybridScoring: false
});
```

## References

- **Hybrid Search Module**: `src/hybrid-search.ts`
- **Query/Relationship API**: `src/queries.ts`
- **Constants & Config**: `src/constants.ts`
- **Tests**: `src/__tests__/search-orchestration.test.ts`
- **Related ADR**: docs/ADR-036-NATIVE-OPENCODE-MEMORY-SYSTEM.md
