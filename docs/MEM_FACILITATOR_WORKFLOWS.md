# @mem-facilitator Workflow Documentation

## Overview

This document provides comprehensive workflow documentation for @mem-facilitator, a specialized agent for reviewing Claude Mem observations, generating summaries with key findings, and extracting Claude Mem IDs for follow-up retrieval by Haiku.

## Orchestrator Round-Trip Integration Pattern

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR LAYER                          │
│                  (Planner, Solo-Orchestrator)                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 1. Request observation review
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @memory-bridge                                │
│              (Raw observation retrieval)                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 2. Return observations
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @mem-facilitator                              │
│              (Observation review & summarization)                │
│              - Relevance scoring                                 │
│              - Deontic filtering                                  │
│              - Sensitive data scrubbing                          │
│              - Summary generation                                │
│              - ID extraction                                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 3. Return summary + IDs
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                                  │
│              (Uses IDs for Haiku follow-up)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Workflow

#### Step 1: Orchestrator Initiates Request

```typescript
// Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'queue retry logic decisions',
  filters: {
    types: ['decision', 'problem-solution'],
    time_range: '7d',
    project: 'content-tracker',
    limit: 50,
  },
  output_format: 'summary_with_ids',
  relevance_threshold: 60,
  detail_level: 'standard',
  parent_context: {
    agent_id: 'planner',
    goals: ['understand retry patterns', 'identify edge cases'],
    constraints: ['max 50 observations', 'stay within 8000 tokens'],
  },
};
```

#### Step 2: Orchestrator Calls @memory-bridge

```typescript
// Orchestrator retrieves observations via @memory-bridge
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// observations is an array like:
// [
//   { id: 1234, type: 'decision', content: '...', timestamp: 1737820800000, metadata: {...} },
//   { id: 1235, type: 'problem-solution', content: '...', timestamp: 1737820900000, metadata: {...} },
//   ...
// ]
```

#### Step 3: Orchestrator Calls @mem-facilitator

```typescript
// Orchestrator passes observations to @mem-facilitator
const memFacilitatorRequest = {
  ...request,
  observations: observations, // Add retrieved observations
};

const response = await memFacilitator.process(memFacilitatorRequest);
```

#### Step 4: @mem-facilitator Processes Observations

```typescript
// @mem-facilitator internal workflow
async function process(request) {
  // 1. Validate input schema (Guardrail #18)
  validateInput(request);

  // 2. Apply filters (type, time_range, project)
  const filtered = applyFilters(request.observations, request.filters);

  // 3. Enforce token budget (8000 tokens max)
  const { observations: budgeted, truncated } = enforceTokenBudget(filtered, 8000);

  // 4. Score relevance (0-100) - deterministic algorithm
  const scored = scoreRelevance(budgeted, request.query, request.parent_context);

  // 5. Apply deontic filtering (deterministic)
  const filteredDeontic = applyDeonticFiltering(scored);

  // 6. Apply sensitive data scrubbing (deterministic)
  const scrubbed = applySensitiveDataScrubbing(filteredDeontic);

  // 7. Generate structured summary
  const summary = generateSummary(scrubbed, request.detail_level);

  // 8. Extract Claude Mem IDs
  const ids = extractClaudeMemIds(scrubbed, request.relevance_threshold);

  // 9. Return to orchestrator
  return {
    status: truncated ? 'partial' : 'success',
    summary,
    claude_mem_ids: ids,
    token_usage: calculateTokenUsage(request, response),
    estimated_cost_usd: calculateCost(request, response),
    confidence: calculateConfidence(scored),
    truncation_reason: truncated ? 'token_budget' : null,
  };
}
```

#### Step 5: Orchestrator Uses Results

```typescript
// Orchestrator receives response
if (response.status === 'success' || response.status === 'partial') {
  // Use summary for context
  console.log('Key findings:', response.summary.key_findings);
  console.log('Patterns:', response.summary.patterns_detected);

  // Use IDs for Haiku follow-up (optional)
  if (response.follow_up.haiku_follow_up_recommended) {
    const highRelevanceIds = response.claude_mem_ids.high_relevance.map(obs => obs.id);
    const detailedContext = await haiku.retrieveDetailedContext(highRelevanceIds);
    // Use detailed context for decision-making
  }
}
```

## Common Use Cases

### Use Case 1: Session Context Retrieval

**Scenario**: Orchestrator needs to understand recent decisions about queue retry logic.

```typescript
// Step 1: Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'queue retry logic decisions',
  filters: {
    types: ['decision', 'problem-solution'],
    time_range: '7d',
    project: 'content-tracker',
    limit: 50,
  },
  output_format: 'summary_with_ids',
  relevance_threshold: 60,
  detail_level: 'standard',
  parent_context: {
    agent_id: 'planner',
    goals: ['understand retry patterns', 'identify edge cases'],
  },
};

// Step 2: Retrieve observations via @memory-bridge
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Call @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations,
});

// Step 4: Use results
console.log('Key findings:', response.summary.key_findings);
// Output:
// [
//   'Exponential backoff implemented with max 3 retries',
//   'Permanent failures logged and alerted',
//   'Queue messages are immutable once sent',
// ]

console.log('Patterns detected:', response.summary.patterns_detected);
// Output:
// [
//   'Exponential backoff with jitter',
//   'Fail-fast on permanent errors',
// ]

// Step 5: Optional Haiku follow-up
if (response.follow_up.haiku_follow_up_recommended) {
  const ids = response.claude_mem_ids.high_relevance.map(obs => obs.id);
  const detailed = await haiku.retrieveDetailedContext(ids);
  // Use detailed context for implementation
}
```

### Use Case 2: Historical Decision Lookup

**Scenario**: Orchestrator needs to find a specific architecture decision about queue immutability.

```typescript
// Step 1: Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'architecture decision queue immutability',
  filters: {
    types: ['decision'],
    time_range: '30d',
    limit: 20,
  },
  output_format: 'summary', // No IDs needed
  relevance_threshold: 70,
  detail_level: 'brief',
};

// Step 2: Retrieve observations
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Call @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations,
});

// Step 4: Use results
console.log('Key findings:', response.summary.key_findings);
// Output:
// [
//   'Queue messages must be immutable (Guardrail #15)',
//   'Decision made during Phase 2 queue implementation',
// ]

console.log('Context relevance:', response.summary.context_relevance);
// Output: 'high'

console.log('Freshness:', response.summary.freshness);
// Output: 'recent'
```

### Use Case 3: Pattern Analysis Across Sessions

**Scenario**: Orchestrator needs to identify patterns in error handling across multiple sessions.

```typescript
// Step 1: Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'error handling patterns',
  filters: {
    types: ['problem-solution', 'decision'],
    time_range: '30d',
    limit: 100,
  },
  output_format: 'summary_with_ids',
  relevance_threshold: 50,
  detail_level: 'comprehensive',
  parent_context: {
    agent_id: 'planner',
    goals: ['identify common error patterns', 'find best practices'],
  },
};

// Step 2: Retrieve observations
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Call @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations,
});

// Step 4: Use results
console.log('Patterns detected:', response.summary.patterns_detected);
// Output:
// [
//   'Consistent use of exponential backoff',
//   'Fail-fast on permanent errors',
//   'Comprehensive error logging with context',
//   'Graceful degradation patterns',
//   'Circuit breaker usage for external services',
// ]

console.log('Recommendations:', response.recommendations);
// Output:
// [
//   'Consider standardizing error response format',
//   'Review error classification consistency',
//   'Document error handling patterns in CLAUDE.md',
// ]
```

### Use Case 4: Preparing Context for Haiku Follow-up

**Scenario**: Orchestrator needs to prepare a list of high-relevance observations for Haiku to retrieve detailed context.

```typescript
// Step 1: Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'database schema changes',
  filters: {
    types: ['decision', 'problem-solution'],
    time_range: '14d',
    limit: 75,
  },
  output_format: 'ids_only', // Only need IDs
  relevance_threshold: 65,
  detail_level: 'brief',
};

// Step 2: Retrieve observations
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Call @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations,
});

// Step 4: Extract high-relevance IDs
const highRelevanceIds = response.claude_mem_ids.high_relevance.map(obs => obs.id);
console.log('High relevance IDs:', highRelevanceIds);
// Output: [1234, 1235, 1236, 1237, 1238]

// Step 5: Haiku retrieves detailed context
const detailedContext = await haiku.retrieveDetailedContext(highRelevanceIds);
// Use detailed context for implementation
```

## Best Practices

### 1. Always Use Orchestrator Round-Trip Pattern

```typescript
// ❌ WRONG: Direct call to @mem-facilitator
const response = await memFacilitator.process({ query: '...' });

// ✅ CORRECT: Orchestrator mediates all calls
const observations = await memoryBridge.retrieveObservations({ query: '...' });
const response = await memFacilitator.process({ query: '...', observations });
```

### 2. Set Appropriate Token Budget

```typescript
// ✅ CORRECT: Enforce 8000 token budget
const response = await memFacilitator.process({
  ...request,
  observations,
  token_budget: 8000, // Enforce budget
});

// Check if truncated
if (response.truncation_reason === 'token_budget') {
  console.warn('Results truncated due to token budget');
}
```

### 3. Use Appropriate Detail Levels

```typescript
// For quick reconnaissance
const briefRequest = {
  detail_level: 'brief', // 3-5 bullets, 1-2 sentences, no patterns, 5 IDs
};

// For standard analysis
const standardRequest = {
  detail_level: 'standard', // 5-8 bullets, 1 paragraph, 2-3 patterns, 10 IDs
};

// For comprehensive analysis
const comprehensiveRequest = {
  detail_level: 'comprehensive', // 8-12 bullets, 2-3 paragraphs, 5+ patterns, 20 IDs
};
```

### 4. Monitor Token Usage and Cost

```typescript
const response = await memFacilitator.process(request);

console.log('Token usage:', response.token_usage);
// Output: { input: 7200, output: 1450, total: 8650, budget_remaining: 350 }

console.log('Estimated cost:', response.estimated_cost_usd);
// Output: 0.0043

// Warn if approaching budget
if (response.token_usage.budget_remaining < 1000) {
  console.warn('Approaching token budget limit');
}
```

### 5. Handle Partial Results Gracefully

```typescript
const response = await memFacilitator.process(request);

switch (response.status) {
  case 'success':
    // All observations processed
    break;
  case 'partial':
    // Some observations truncated
    console.warn('Partial results:', response.truncation_reason);
    break;
  case 'empty':
    // No matching observations
    console.warn('No matching observations found');
    break;
  case 'error':
    // Error occurred
    console.error('Error processing observations');
    break;
}
```

### 6. Use Relevance Thresholds Effectively

```typescript
// High threshold for precise queries
const preciseRequest = {
  relevance_threshold: 80, // Only highly relevant observations
};

// Medium threshold for general queries
const generalRequest = {
  relevance_threshold: 60, // Moderately relevant observations
};

// Low threshold for broad searches
const broadRequest = {
  relevance_threshold: 40, // Broadly relevant observations
};
```

### 7. Leverage Follow-Up Recommendations

```typescript
const response = await memFacilitator.process(request);

// Check if follow-up is recommended
if (response.follow_up.haiku_follow_up_recommended) {
  // Use suggested queries
  for (const query of response.follow_up.suggested_queries) {
    console.log('Suggested query:', query);
  }

  // Use recommended detail level
  const recommendedLevel = response.follow_up.recommended_detail_level;
  console.log('Recommended detail level:', recommendedLevel);
}
```

### 8. Apply Deontic Filtering Consistently

```typescript
// @mem-facilitator automatically applies deontic filtering
// All summaries will have imperative language removed

// Example observation content:
// "ALWAYS use exponential backoff for retries. NEVER skip validation."

// After deontic filtering:
// "Exponential backoff used for retries. Validation not skipped."

// This ensures memory is treated as historical context, not binding policy
```

### 9. Verify Sensitive Data Scrubbing

```typescript
// @mem-facilitator automatically scrubs sensitive data
// All output will have PII/secrets redacted

// Example observation content:
// "API key: sk-1234567890abcdef, Email: user@example.com"

// After scrubbing:
// "API key: [REDACTED], Email: [REDACTED]"

// This ensures no sensitive data leaks in output
```

### 10. Use Time Range Filters Effectively

```typescript
// Recent context (last 7 days)
const recentRequest = {
  filters: { time_range: '7d' },
};

// Medium-term context (last 30 days)
const mediumRequest = {
  filters: { time_range: '30d' },
};

// Long-term context (all time)
const longTermRequest = {
  filters: { time_range: 'all' },
};
```

## Error Handling Patterns

### Pattern 1: Invalid Input

```typescript
try {
  const response = await memFacilitator.process(invalidRequest);
} catch (error) {
  // Generic error message (Guardrail #16/#24)
  console.error('Invalid input: Please check request format');
  // Do not expose internal details
}
```

### Pattern 2: No Matching Observations

```typescript
const response = await memFacilitator.process(request);

if (response.status === 'empty') {
  console.warn('No matching observations found');
  console.log('Recommendations:', response.recommendations);
  // Output: ['Try broadening search criteria', 'Check time range filter']
}
```

### Pattern 3: Token Budget Exceeded

```typescript
const response = await memFacilitator.process(request);

if (response.truncation_reason === 'token_budget') {
  console.warn('Results truncated due to token budget');
  console.log('Budget remaining:', response.token_usage.budget_remaining);
  // Consider reducing limit or detail level
}
```

### Pattern 4: Stale Observations

```typescript
const response = await memFacilitator.process(request);

if (response.summary.freshness === 'stale') {
  console.warn('Observations are stale (≥7 days old)');
  console.log('Recommendations:', response.recommendations);
  // Output: ['Consider refreshing context', 'Check for recent updates']
}
```

### Pattern 5: Service Unavailable

```typescript
try {
  const response = await memFacilitator.process(request);
} catch (error) {
  // Generic error message (Guardrail #16/#24)
  console.error('Service temporarily unavailable');
  // Do not expose internal details
  // Implement retry logic with exponential backoff
}
```

## Performance Optimization

### 1. Limit Observation Count

```typescript
// ✅ CORRECT: Set reasonable limit
const request = {
  filters: { limit: 50 }, // Max 150
};

// ❌ WRONG: No limit (may exceed token budget)
const request = {
  filters: {}, // No limit
};
```

### 2. Use Appropriate Detail Level

```typescript
// For quick reconnaissance
const briefRequest = { detail_level: 'brief' }; // ~2000 tokens

// For standard analysis
const standardRequest = { detail_level: 'standard' }; // ~4000 tokens

// For comprehensive analysis
const comprehensiveRequest = { detail_level: 'comprehensive' }; // ~8000 tokens
```

### 3. Filter by Type

```typescript
// ✅ CORRECT: Filter by relevant types
const request = {
  filters: { types: ['decision', 'problem-solution'] },
};

// ❌ WRONG: Include all types (may include irrelevant observations)
const request = {
  filters: {}, // No type filter
};
```

### 4. Use Time Range Filters

```typescript
// ✅ CORRECT: Filter by time range
const request = {
  filters: { time_range: '7d' }, // Recent observations only
};

// ❌ WRONG: No time filter (may include stale observations)
const request = {
  filters: {}, // No time filter
};
```

### 5. Cache Results

```typescript
// Cache results for repeated queries
const cacheKey = JSON.stringify(request);
const cached = cache.get(cacheKey);

if (cached) {
  return cached;
}

const response = await memFacilitator.process(request);
cache.set(cacheKey, response, { ttl: 300 }); // 5 minute TTL
return response;
```

## Cost Optimization

### 1. Use GLM 4.7 (Cost-Effective)

```typescript
// GLM 4.7: ~$0.30/1M input tokens, ~$0.60/1M output tokens
// Typical query: ~$0.02-$0.05

// Monitor cost
console.log('Estimated cost:', response.estimated_cost_usd);
// Output: 0.0043
```

### 2. Enforce Token Budget

```typescript
// Enforce 8000 token budget
const response = await memFacilitator.process({
  ...request,
  token_budget: 8000,
});

// Check budget remaining
if (response.token_usage.budget_remaining < 1000) {
  console.warn('Approaching token budget limit');
}
```

### 3. Use Rate Limiting

```typescript
// Rate limiting: max 10 requests/minute
const rateLimiter = new RateLimiter({ max: 10, window: 60000 });

await rateLimiter.acquire();
const response = await memFacilitator.process(request);
```

### 4. Use Appropriate Output Format

```typescript
// For quick lookups (no IDs needed)
const summaryRequest = { output_format: 'summary' }; // ~2000 tokens

// For standard analysis (with IDs)
const summaryWithIdsRequest = { output_format: 'summary_with_ids' }; // ~4000 tokens

// For ID extraction only
const idsOnlyRequest = { output_format: 'ids_only' }; // ~1000 tokens
```

## Security Considerations

### 1. Deontic Filtering (Critical)

```typescript
// @mem-facilitator automatically applies deontic filtering
// Memory is historical recall, NOT binding policy

// Example observation content:
// "ALWAYS use exponential backoff. NEVER skip validation."

// After deontic filtering:
// "Exponential backoff used. Validation not skipped."

// This ensures CLAUDE.md guardrails always override memory observations
```

### 2. Sensitive Data Scrubbing (Critical)

```typescript
// @mem-facilitator automatically scrubs sensitive data
// All output will have PII/secrets redacted

// Example observation content:
// "API key: sk-1234567890abcdef, Email: user@example.com"

// After scrubbing:
// "API key: [REDACTED], Email: [REDACTED]"

// This ensures no sensitive data leaks in output
```

### 3. Bounded Regex Patterns (Guardrail #7)

```typescript
// ✅ CORRECT: Bounded regex patterns
const tokenPattern = /sk-[a-zA-Z0-9]{32}/; // Explicit bounds

// ❌ WRONG: Unbounded regex patterns
const tokenPattern = /sk-.*/; // Unbounded (ReDoS risk)
```

### 4. Generic Error Messages (Guardrail #16/#24)

```typescript
// ✅ CORRECT: Generic error message
console.error('Invalid input: Please check request format');

// ❌ WRONG: Detailed error message (may leak internal details)
console.error('Validation failed: Missing required field "query" in request object');
```

## Monitoring and Observability

### 1. Track Token Usage

```typescript
console.log('Token usage:', response.token_usage);
// Output: { input: 7200, output: 1450, total: 8650, budget_remaining: 350 }
```

### 2. Track Cost

```typescript
console.log('Estimated cost:', response.estimated_cost_usd);
// Output: 0.0043
```

### 3. Track Confidence

```typescript
console.log('Confidence:', response.confidence);
// Output: 87
```

### 4. Track Query Performance

```typescript
const startTime = Date.now();
const response = await memFacilitator.process(request);
const duration = Date.now() - startTime;

console.log('Query duration:', duration, 'ms');
// Output: 3500
```

## Summary

@mem-facilitator provides a powerful, cost-effective way to review Claude Mem observations, generate summaries with key findings, and extract Claude Mem IDs for follow-up retrieval by Haiku. By following the orchestrator round-trip pattern, applying best practices, and monitoring token usage and cost, you can effectively integrate @mem-facilitator into your workflows.

For more information, see:
- [MEM_FACILITATOR_ERRORS.md](./MEM_FACILITATOR_ERRORS.md) - Error scenarios and recovery strategies
- [MEM_FACILITATOR_INTEGRATION.md](./MEM_FACILITATOR_INTEGRATION.md) - Integration guide for orchestrators
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide