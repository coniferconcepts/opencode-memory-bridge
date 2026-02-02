# Memory Plugin Troubleshooting Guide

## @mem-facilitator Troubleshooting

### 1. @mem-facilitator Returns Empty Results

**Symptoms**: `@mem-facilitator.process()` returns `status: "empty"`

**Causes & Solutions**:

1. **Query too specific**
   ```typescript
   // Broaden search criteria
   const request = {
     query: 'queue retry logic', // More general
     filters: {
       types: ['decision', 'problem-solution'], // More types
       time_range: '30d', // Wider time range
     },
   };
   ```

2. **Time range filter excludes all observations**
   ```typescript
   // Expand time range
   const request = {
     filters: { time_range: '30d' }, // Was '1d'
   };
   ```

3. **Type filter excludes all observations**
   ```typescript
   // Include more types
   const request = {
     filters: { types: ['decision', 'problem-solution', 'note'] },
   };
   ```

4. **Relevance threshold too high**
   ```typescript
   // Lower relevance threshold
   const request = {
     relevance_threshold: 40, // Was 70
   };
   ```

5. **No observations exist in database**
   ```bash
   # Check if observations exist
   sqlite3 ~/.claude-mem/claude-mem.db "SELECT COUNT(*) FROM observations"

   # If 0, observations need to be created first
   ```

### 2. @mem-facilitator Returns Partial Results

**Symptoms**: `@mem-facilitator.process()` returns `status: "partial"` with `truncation_reason: "token_budget"`

**Causes & Solutions**:

1. **Too many observations**
   ```typescript
   // Reduce observation limit
   const request = {
     filters: { limit: 50 }, // Was 100
   };
   ```

2. **Detail level too high**
   ```typescript
   // Lower detail level
   const request = {
     detail_level: 'standard', // Was 'comprehensive'
   };
   ```

3. **Output format too verbose**
   ```typescript
   // Use less verbose format
   const request = {
     output_format: 'summary', // Was 'summary_with_ids'
   };
   ```

4. **Filter by type to reduce count**
   ```typescript
   // Filter by relevant types
   const request = {
     filters: {
       types: ['decision'], // Only decisions
     },
   };
   ```

### 3. @mem-facilitator Returns Error

**Symptoms**: `@mem-facilitator.process()` returns `status: "error"`

**Causes & Solutions**:

1. **Invalid input schema**
   ```typescript
   // Validate request before calling
   import { parse } from 'valibot';
   try {
     const validated = parse(MemFacilitatorRequestSchema, request);
   } catch (error) {
     console.error('Invalid input:', error.message);
   }
   ```

2. **Missing required fields**
   ```typescript
   // Ensure all required fields are present
   const request = {
     input_type: 'observation_review', // Required
     query: 'queue retry logic', // Required
     output_format: 'summary_with_ids', // Required
     detail_level: 'standard', // Required
     observations: [], // Required
   };
   ```

3. **Invalid filter values**
   ```typescript
   // Verify filter values are valid
   const validTimeRanges = ['1d', '7d', '30d', 'all'];
   const validTypes = ['decision', 'problem-solution', 'note', 'warning'];
   const validOutputFormats = ['summary', 'summary_with_ids', 'ids_only'];
   const validDetailLevels = ['brief', 'standard', 'comprehensive'];
   ```

4. **Service unavailable**
   ```typescript
   // Implement retry logic with exponential backoff
   async function callWithRetry(request, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await memFacilitator.process(request);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
       }
     }
   }
   ```

### 4. @mem-facilitator Returns Stale Observations

**Symptoms**: `@mem-facilitator.process()` returns `freshness: "stale"`

**Causes & Solutions**:

1. **Time range includes old observations**
   ```typescript
   // Filter to recent observations
   const request = {
     filters: { time_range: '7d' }, // Was '30d'
   };
   ```

2. **No recent observations match query**
   ```typescript
   // Try alternative query terms
   const request = {
     query: 'recent queue retry logic', // More specific
   };
   ```

3. **Observations haven't been updated**
   ```bash
   # Check observation timestamps
   sqlite3 ~/.claude-mem/claude-mem.db "
   SELECT id, timestamp FROM observations
   ORDER BY timestamp DESC LIMIT 10"
   ```

### 5. @mem-facilitator Returns Conflicting Observations

**Symptoms**: `@mem-facilitator.process()` returns warnings about conflicting observations

**Causes & Solutions**:

1. **Decisions changed over time**
   ```typescript
   // Prioritize recent observations
   const recentIds = response.claude_mem_ids.high_relevance
     .sort((a, b) => b.timestamp - a.timestamp)
     .slice(0, 3)
     .map(obs => obs.id);
   ```

2. **Different sessions made different decisions**
   ```typescript
   // Use Haiku to retrieve detailed context
   const detailed = await haiku.retrieveDetailedContext(recentIds);
   // Use detailed context to resolve conflicts
   ```

3. **Observations from different contexts conflict**
   ```typescript
   // Check observation metadata for context
   const observations = response.claude_mem_ids.high_relevance.filter(
     obs => obs.metadata?.context === 'current'
   );
   ```

### 6. @mem-facilitator Exceeds Rate Limit

**Symptoms**: `@mem-facilitator.process()` throws rate limit error

**Causes & Solutions**:

1. **Too many requests in short time**
   ```typescript
   // Implement rate limiting
   const rateLimiter = new RateLimiter({ max: 10, window: 60000 });
   try {
     await rateLimiter.acquire();
     const response = await memFacilitator.process(request);
   } catch (error) {
     console.error('Rate limit exceeded');
   }
   ```

2. **Batch requests**
   ```typescript
   // Process requests in batches
   const batchSize = 5;
   for (let i = 0; i < requests.length; i += batchSize) {
     const batch = requests.slice(i, i + batchSize);
     await Promise.all(batch.map(req => memFacilitator.process(req)));
     await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds
   }
   ```

### 7. @mem-facilitator Cost Too High

**Symptoms**: `estimated_cost_usd` is higher than expected

**Causes & Solutions**:

1. **Too many observations**
   ```typescript
   // Reduce observation limit
   const request = {
     filters: { limit: 50 }, // Was 100
   };
   ```

2. **Detail level too high**
   ```typescript
   // Lower detail level
   const request = {
     detail_level: 'brief', // Was 'comprehensive'
   };
   ```

3. **Output format too verbose**
   ```typescript
   // Use less verbose format
   const request = {
     output_format: 'ids_only', // Was 'summary_with_ids'
   };
   ```

4. **Monitor token usage**
   ```typescript
   const response = await memFacilitator.process(request);
   console.log('Token usage:', response.token_usage);
   console.log('Estimated cost:', response.estimated_cost_usd);
   ```

### 8. @mem-facilitator Returns Low Confidence

**Symptoms**: `confidence` score is low (<60)

**Causes & Solutions**:

1. **Query too vague**
   ```typescript
   // Make query more specific
   const request = {
     query: 'queue retry logic exponential backoff', // More specific
   };
   ```

2. **Few matching observations**
   ```typescript
   // Broaden search criteria
   const request = {
     filters: {
       types: ['decision', 'problem-solution', 'note'], // More types
       time_range: '30d', // Wider time range
     },
   };
   ```

3. **Observations not relevant**
   ```typescript
   // Lower relevance threshold
   const request = {
     relevance_threshold: 40, // Was 60
   };
   ```

### 9. @mem-facilitator Deontic Filtering Not Working

**Symptoms**: Summaries still contain imperative language

**Causes & Solutions**:

1. **Deontic filtering not applied**
   ```typescript
   // Verify deontic filtering is applied
   const imperativeWords = ['ALWAYS', 'NEVER', 'MUST', 'SHALL', 'REQUIRED', 'MANDATORY', 'DO NOT', 'SHOULD'];
   function applyDeonticFiltering(text) {
     let filtered = text;
     for (const word of imperativeWords) {
       const regex = new RegExp(`\\b${word}\\b`, 'gi');
       filtered = filtered.replace(regex, '');
     }
     return filtered;
   }
   ```

2. **Imperative words not in list**
   ```typescript
   // Add missing imperative words
   const imperativeWords = [
     'ALWAYS', 'NEVER', 'MUST', 'SHALL', 'REQUIRED', 'MANDATORY', 'DO NOT', 'SHOULD',
     'ENSURE', 'VERIFY', 'CONFIRM', // Add more as needed
   ];
   ```

### 10. @mem-facilitator Sensitive Data Scrubbing Not Working

**Symptoms**: Output contains sensitive data

**Causes & Solutions**:

1. **Scrubbing not applied**
   ```typescript
   // Verify scrubbing is applied
   const tokenPattern = /sk-[a-zA-Z0-9]{32}/;
   const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
   function scrubSensitiveData(text) {
     let scrubbed = text;
     scrubbed = scrubbed.replace(tokenPattern, '[REDACTED]');
     scrubbed = scrubbed.replace(emailPattern, '[REDACTED]');
     return scrubbed;
   }
   ```

2. **Pattern not matching**
   ```typescript
   // Test pattern matching
   const input = 'API key: sk-1234567890abcdef';
   const output = scrubSensitiveData(input);
   console.log(output); // Should be 'API key: [REDACTED]'
   ```

3. **Pattern not bounded (Guardrail #7)**
   ```typescript
   // ✅ CORRECT: Bounded regex
   const tokenPattern = /sk-[a-zA-Z0-9]{32}/;

   // ❌ WRONG: Unbounded regex
   const tokenPattern = /sk-.*/;
   ```

---

## Common Issues

### 1. Hybrid Search Returns No Results

**Symptoms**: `executeHybridSearch()` returns empty array

**Causes & Solutions**:

1. **Importance threshold too high**
   ```typescript
   // Lower the threshold
   const results = await executeHybridSearch(semanticResults, {
     query: 'test',
     limit: 10,
     minImportance: 0  // Was 70, lowered to 0
   });
   ```

2. **Relevance threshold too high**
   ```typescript
   // Lower semantic threshold
   const results = await executeHybridSearch(semanticResults, {
     query: 'test',
     limit: 10,
     minRelevance: 0.1  // Was 0.3, lowered to 0.1
   });
   ```

3. **No importance scores populated**
   ```bash
   # Check if scores exist
   sqlite3 ~/.claude-mem/claude-mem.db "
   SELECT COUNT(*) FROM observations
   WHERE json_extract(oc_metadata, '\$.importance_score') IS NOT NULL"

   # If 0, run population script
   bun run scripts/populate-importance-scores.ts
   ```

### 2. Relationship Expansion Fails

**Symptoms**: `expandAndRankByRelationships()` logs warnings

**Error**: `db.prepare is not a function`

**Cause**: Database connection not properly passed

**Solution**:
```typescript
// Ensure db is a valid bun:sqlite Database instance
import Database from 'bun:sqlite';
const db = new Database(join(homedir(), '.claude-mem', 'claude-mem.db'));

// Pass to expansion
const expanded = await expandAndRankByRelationships(results, db, options);
```

### 3. Slow Query Performance

**Symptoms**: Queries taking >100ms

**Diagnosis**:
```bash
# Check if indices exist
sqlite3 ~/.claude-mem/claude-mem.db ".indices observation_relationships"

# Should show:
# idx_relationships_source
# idx_relationships_target
# idx_relationships_bidirectional
# idx_relationships_high_confidence
```

**Solution**: Recreate indices
```bash
sqlite3 ~/.claude-mem/claude-mem.db "
CREATE INDEX IF NOT EXISTS idx_relationships_source ON observation_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON observation_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_relationships_bidirectional ON observation_relationships(source_id, target_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_high_confidence ON observation_relationships(confidence DESC) WHERE confidence >= 0.7;
"
```

### 4. Database Corruption

**Symptoms**: PRAGMA integrity_check fails

**Solution**:
```bash
# Backup corrupted database
cp ~/.claude-mem/claude-mem.db ~/.claude-mem/claude-mem.db.corrupted

# Attempt recovery
sqlite3 ~/.claude-mem/claude-mem.db ".recover" | sqlite3 ~/.claude-mem/claude-mem-recovered.db

# Verify recovery
sqlite3 ~/.claude-mem/claude-mem-recovered.db "PRAGMA integrity_check"

# If OK, replace
mv ~/.claude-mem/claude-mem-recovered.db ~/.claude-mem/claude-mem.db
```

### 5. Tests Failing

**Symptoms**: bun test shows failures

**Common causes**:

1. **TypeScript errors**
   ```bash
   npx tsc --noEmit
   # Fix any type errors shown
   ```

2. **Missing dependencies**
   ```bash
   bun install
   ```

3. **Database schema mismatch**
   ```bash
   # Check observation_relationships exists
   sqlite3 ~/.claude-mem/claude-mem.db ".schema observation_relationships"
   ```

### 6. Importance Scores All Zero

**Symptoms**: All observations have importance_score = 0

**Cause**: Population script ran with empty metadata

**Solution**:
```bash
# Check metadata exists
sqlite3 ~/.claude-mem/claude-mem.db "
SELECT COUNT(*) FROM observations WHERE metadata IS NOT NULL AND metadata != ''"

# Re-run population with verbose mode
CLAUDE_MEM_DEBUG=1 bun run scripts/populate-importance-scores.ts
```

## Debugging Tools

### Enable Debug Logging

```bash
export CLAUDE_MEM_DEBUG=1
```

### Query Execution Plans

```bash
sqlite3 ~/.claude-mem/claude-mem.db "EXPLAIN QUERY PLAN
SELECT * FROM observation_relationships WHERE source_id = 1"
```

### Database Statistics

```bash
sqlite3 ~/.claude-mem/claude-mem.db "
SELECT
  name,
  SUM(pgsize) as size_bytes,
  printf('%.2f MB', SUM(pgsize) / 1024.0 / 1024.0) as size_mb
FROM dbstat
GROUP BY name
ORDER BY size_bytes DESC
LIMIT 10"
```

## Performance Tuning

### Optimize for Read-Heavy Workloads

```bash
sqlite3 ~/.claude-mem/claude-mem.db "
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA mmap_size = 268435456; -- 256MB mmap
"
```

### Vacuum Database

```bash
sqlite3 ~/.claude-mem/claude-mem.db "VACUUM"
```

## Getting Help

1. Check test output: `bun test 2>&1 | grep -A5 "FAIL"`
2. Review logs: `~/.claude-mem/logs/`
3. Verify database integrity: `PRAGMA integrity_check`
4. Check this guide for common issues

## Reporting Issues

Include:
- Bun version: `bun --version`
- Database stats: Run statistics query above
- Error message: Full stack trace
- Steps to reproduce
