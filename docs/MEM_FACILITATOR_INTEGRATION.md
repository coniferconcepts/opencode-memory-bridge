# @mem-facilitator Integration Guide

## Overview

This document provides comprehensive integration guidance for orchestrators using @mem-facilitator, including input/output schema reference, token budget enforcement, rate limiting, and security considerations.

## Architecture

### Orchestrator Round-Trip Pattern

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
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ 3. Return summary + IDs
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                                  │
│              (Uses IDs for Haiku follow-up)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Orchestrator mediates all calls**: @mem-facilitator never fetches observations directly
2. **Observations passed from orchestrator**: Orchestrator retrieves via @memory-bridge, then passes to @mem-facilitator
3. **Return to orchestrator**: @mem-facilitator always returns results to orchestrator (Guardrail #29)
4. **Structured findings**: Results are always structured JSON (Guardrail #30)
5. **Generic error messages**: All errors use generic messages (Guardrail #16/#24)

## Input Schema Reference

### Complete Request Schema

```typescript
interface MemFacilitatorRequest {
  input_type: 'observation_review';
  query: string;
  filters: {
    types?: ObservationType[];
    time_range?: '1d' | '7d' | '30d' | 'all';
    project?: string;
    limit?: number; // Default: 50, Max: 150
  };
  output_format: 'summary' | 'summary_with_ids' | 'ids_only';
  relevance_threshold?: number; // 0-100, Default: 60
  detail_level: 'brief' | 'standard' | 'comprehensive';
  parent_context?: {
    agent_id: string;
    goals?: string[];
    constraints?: string[];
  };
  observations: Observation[];
}

interface Observation {
  id: number;
  type: ObservationType;
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

type ObservationType = 'decision' | 'problem-solution' | 'note' | 'warning';
```

### Field Descriptions

| Field | Type | Required | Description | Default |
|-------|------|----------|-------------|---------|
| `input_type` | string | Yes | Must be `'observation_review'` | N/A |
| `query` | string | Yes | Search query string | N/A |
| `filters.types` | array | No | Observation types to include | All types |
| `filters.time_range` | string | No | Time range filter | `'all'` |
| `filters.project` | string | No | Project name | Current project |
| `filters.limit` | number | No | Max observations to review | 50 (max 150) |
| `output_format` | string | Yes | Output format | N/A |
| `relevance_threshold` | number | No | Relevance threshold (0-100) | 60 |
| `detail_level` | string | Yes | Detail level | N/A |
| `parent_context.agent_id` | string | No | Orchestrator agent ID | N/A |
| `parent_context.goals` | array | No | Orchestrator goals | N/A |
| `parent_context.constraints` | array | No | Orchestrator constraints | N/A |
| `observations` | array | Yes | Observations from @memory-bridge | N/A |

### Validation Rules (Guardrail #18)

1. **Required fields**: `input_type`, `query`, `output_format`, `detail_level`, `observations`
2. **Data types**: All fields must match expected types
3. **Enum values**: `output_format`, `detail_level`, `filters.time_range` must be valid enum values
4. **Range validation**: `relevance_threshold` must be 0-100, `filters.limit` must be 1-150
5. **Array validation**: `observations` must be an array of valid Observation objects

### Example Valid Request

```typescript
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
  observations: [
    {
      id: 1234,
      type: 'decision',
      content: 'Decided to use exponential backoff with max 3 retries',
      metadata: { importance_score: 85 },
      timestamp: 1737820800000,
    },
    // ... more observations
  ],
};
```

## Output Schema Reference

### Complete Response Schema

```typescript
interface MemFacilitatorResponse {
  status: 'success' | 'partial' | 'empty' | 'error';
  query?: {
    original: string;
    normalized: string;
    filters_applied: string[];
  };
  summary?: {
    key_findings: string[];
    patterns_detected: string[];
    context_relevance: 'high' | 'medium' | 'low';
    freshness: 'current' | 'recent' | 'stale';
  };
  observations?: {
    total_found: number;
    total_reviewed: number;
    matching_count: number;
    relevance_threshold: number;
  };
  claude_mem_ids?: {
    high_relevance: ObservationWithRelevance[];
    medium_relevance: ObservationWithRelevance[];
    low_relevance: ObservationWithRelevance[];
  };
  recommendations?: string[];
  warnings?: string[];
  follow_up?: {
    suggested_queries: string[];
    recommended_detail_level: string;
    haiku_follow_up_recommended: boolean;
  };
  token_usage?: {
    input: number;
    output: number;
    total: number;
    budget_remaining: number;
  };
  estimated_cost_usd?: number;
  confidence?: number;
  truncation_reason?: 'token_budget' | 'observation_limit' | 'time_budget';
  error?: {
    code: string;
    message: string;
  };
}

interface ObservationWithRelevance {
  id: number;
  ref: string;
  type: ObservationType;
  relevanceScore: number;
  excerpt?: string;
  relevanceReason?: string;
  timestamp: number;
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Response status |
| `query.original` | string | Original query string |
| `query.normalized` | string | Normalized query string |
| `query.filters_applied` | array | Filters applied to query |
| `summary.key_findings` | array | Key findings from observations |
| `summary.patterns_detected` | array | Patterns detected across observations |
| `summary.context_relevance` | string | Context relevance level |
| `summary.freshness` | string | Freshness category |
| `observations.total_found` | number | Total observations found |
| `observations.total_reviewed` | number | Total observations reviewed |
| `observations.matching_count` | number | Observations matching query |
| `observations.relevance_threshold` | number | Relevance threshold used |
| `claude_mem_ids.high_relevance` | array | High relevance observations (≥80) |
| `claude_mem_ids.medium_relevance` | array | Medium relevance observations (60-79) |
| `claude_mem_ids.low_relevance` | array | Low relevance observations (<60) |
| `recommendations` | array | Recommended next steps |
| `warnings` | array | Warnings or caveats |
| `follow_up.suggested_queries` | array | Suggested follow-up queries |
| `follow_up.recommended_detail_level` | string | Recommended detail level |
| `follow_up.haiku_follow_up_recommended` | boolean | Whether Haiku follow-up is recommended |
| `token_usage.input` | number | Input tokens used |
| `token_usage.output` | number | Output tokens used |
| `token_usage.total` | number | Total tokens used |
| `token_usage.budget_remaining` | number | Token budget remaining |
| `estimated_cost_usd` | number | Estimated cost in USD |
| `confidence` | number | Confidence score (0-100) |
| `truncation_reason` | string | Reason for truncation (if applicable) |
| `error.code` | string | Error code |
| `error.message` | string | Generic error message |

### Example Success Response

```json
{
  "status": "success",
  "query": {
    "original": "queue retry logic decisions",
    "normalized": "queue retry logic decisions",
    "filters_applied": ["types: decision,problem-solution", "time_range: 7d"]
  },
  "summary": {
    "key_findings": [
      "Exponential backoff implemented with max 3 retries",
      "Permanent failures logged and alerted",
      "Queue messages are immutable once sent"
    ],
    "patterns_detected": [
      "Exponential backoff with jitter",
      "Fail-fast on permanent errors"
    ],
    "context_relevance": "high",
    "freshness": "current"
  },
  "observations": {
    "total_found": 50,
    "total_reviewed": 50,
    "matching_count": 35,
    "relevance_threshold": 60
  },
  "claude_mem_ids": {
    "high_relevance": [
      {
        "id": 1234,
        "ref": "obs_1234",
        "type": "decision",
        "relevanceScore": 95,
        "excerpt": "Decided to use exponential backoff...",
        "relevanceReason": "Directly addresses retry logic decision",
        "timestamp": 1737820800000
      }
    ],
    "medium_relevance": [],
    "low_relevance": []
  },
  "recommendations": [
    "Consider adding circuit breaker pattern",
    "Review retry exhaustion handling"
  ],
  "warnings": [],
  "follow_up": {
    "suggested_queries": [
      "What happens when retries are exhausted?",
      "How are permanent failures handled?"
    ],
    "recommended_detail_level": "comprehensive",
    "haiku_follow_up_recommended": true
  },
  "token_usage": {
    "input": 7200,
    "output": 1450,
    "total": 8650,
    "budget_remaining": 350
  },
  "estimated_cost_usd": 0.0043,
  "confidence": 87
}
```

### Example Error Response

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input: Please check request format"
  }
}
```

## Token Budget Enforcement

### Budget Configuration

```typescript
const SUBAGENT_MEMORY_TOKEN_BUDGET = 8000; // Max tokens per request
const SYSTEM_PROMPT_TOKENS = 2000; // System prompt overhead
const AVAILABLE_FOR_OBSERVATIONS = 6000; // Available for observations
const MAX_OBSERVATIONS_PER_REQUEST = 150; // Hard limit
```

### Token Estimation

```typescript
function estimateTokenUsage(request: MemFacilitatorRequest): number {
  // System prompt
  let total = SYSTEM_PROMPT_TOKENS;

  // Request metadata
  total += estimateTokens(JSON.stringify({
    query: request.query,
    filters: request.filters,
    output_format: request.output_format,
    detail_level: request.detail_level,
    parent_context: request.parent_context,
  }));

  // Observations
  for (const obs of request.observations) {
    total += estimateTokens(JSON.stringify(obs));
  }

  // Output estimation (based on detail level)
  switch (request.detail_level) {
    case 'brief':
      total += 500;
      break;
    case 'standard':
      total += 1000;
      break;
    case 'comprehensive':
      total += 2000;
      break;
  }

  return total;
}

function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

### Token Budget Enforcement

```typescript
function enforceTokenBudget(request: MemFacilitatorRequest): {
  observations: Observation[];
  truncated: boolean;
} {
  const estimated = estimateTokenUsage(request);

  if (estimated <= SUBAGENT_MEMORY_TOKEN_BUDGET) {
    return { observations: request.observations, truncated: false };
  }

  // Truncate observations
  const availableForObservations = SUBAGENT_MEMORY_TOKEN_BUDGET - SYSTEM_PROMPT_TOKENS - 1000;
  const avgTokensPerObservation = estimated / request.observations.length;
  const maxObservations = Math.floor(availableForObservations / avgTokensPerObservation);

  const truncated = request.observations.slice(0, maxObservations);

  return { observations: truncated, truncated: true };
}
```

### Monitoring Token Usage

```typescript
const response = await memFacilitator.process(request);

console.log('Token usage:', response.token_usage);
// Output: { input: 7200, output: 1450, total: 8650, budget_remaining: 350 }

// Warn if approaching budget
if (response.token_usage.budget_remaining < 1000) {
  console.warn('Approaching token budget limit');
}

// Check if truncated
if (response.truncation_reason === 'token_budget') {
  console.warn('Results truncated due to token budget');
}
```

## Rate Limiting

### Rate Limit Configuration

```typescript
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
```

### Rate Limiter Implementation

```typescript
class RateLimiter {
  private requests: number[] = [];

  constructor(private max: number, private window: number) {}

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside window
    this.requests = this.requests.filter(time => now - time < this.window);

    // Check if limit exceeded
    if (this.requests.length >= this.max) {
      throw new Error('Rate limit exceeded');
    }

    // Add current request
    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter(MAX_REQUESTS_PER_MINUTE, RATE_LIMIT_WINDOW);
```

### Using Rate Limiter

```typescript
try {
  await rateLimiter.acquire();
  const response = await memFacilitator.process(request);
  return response;
} catch (error) {
  console.error('Rate limit exceeded');
  // Queue request or return error
  throw error;
}
```

## Security Considerations

### Deontic Filtering (Guardrail #7, #18)

**Purpose**: Memory is historical recall, NOT binding policy. CLAUDE.md guardrails always override memory observations.

**Implementation**:

```typescript
const IMPERATIVE_WORDS = [
  'ALWAYS', 'NEVER', 'MUST', 'SHALL', 'REQUIRED', 'MANDATORY', 'DO NOT', 'SHOULD'
];

function applyDeonticFiltering(text: string): string {
  let filtered = text;

  for (const word of IMPERATIVE_WORDS) {
    // Bounded regex (Guardrail #7)
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '');
  }

  return filtered;
}

// Example
const input = 'ALWAYS use exponential backoff. NEVER skip validation.';
const output = applyDeonticFiltering(input);
console.log(output); // 'use exponential backoff. skip validation.'
```

### Sensitive Data Scrubbing (Guardrail #7, #18)

**Purpose**: Redact PII/secrets before output.

**Implementation**:

```typescript
// Bounded regex patterns (Guardrail #7)
const TOKEN_PATTERN = /sk-[a-zA-Z0-9]{32}/;
const BEARER_PATTERN = /Bearer [a-zA-Z0-9]{32}/;
const JWT_PATTERN = /eyJ[a-zA-Z0-9]{32}\.eyJ[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{32}/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\d{3}-\d{3}-\d{4}/;
const SSN_PATTERN = /\d{3}-\d{2}-\d{4}/;
const ENV_VAR_PATTERN = /[A-Z_]+=[a-zA-Z0-9]{32}/;

function scrubSensitiveData(text: string): string {
  let scrubbed = text;

  scrubbed = scrubbed.replace(TOKEN_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(BEARER_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(JWT_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(EMAIL_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(PHONE_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(SSN_PATTERN, '[REDACTED]');
  scrubbed = scrubbed.replace(ENV_VAR_PATTERN, '[REDACTED]');

  return scrubbed;
}

// Example
const input = 'API key: sk-1234567890abcdef1234567890abcdef, Email: user@example.com';
const output = scrubSensitiveData(input);
console.log(output); // 'API key: [REDACTED], Email: [REDACTED]'
```

### Generic Error Messages (Guardrail #16/#24)

**Purpose**: Do not expose internal details in error messages.

**Implementation**:

```typescript
// ✅ CORRECT: Generic error message
{
  "status": "error",
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input: Please check request format"
  }
}

// ❌ WRONG: Detailed error message (may leak internal details)
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed: Missing required field 'query' in request object at path 'input_type'"
  }
}
```

### Bounded Regex Patterns (Guardrail #7)

**Purpose**: Prevent ReDoS attacks.

**Implementation**:

```typescript
// ✅ CORRECT: Bounded regex
const tokenPattern = /sk-[a-zA-Z0-9]{32}/; // Explicit bounds

// ❌ WRONG: Unbounded regex
const tokenPattern = /sk-.*/; // Unbounded (ReDoS risk)

// Verify all patterns are bounded
function verifyBoundedRegex(pattern: string): boolean {
  const regex = new RegExp(pattern);
  const source = regex.source;

  // Check for unbounded quantifiers
  if (source.includes('*') || source.includes('+')) {
    // Check if bounded by {min,max}
    if (!source.includes('{')) {
      return false;
    }
  }

  return true;
}
```

## Integration Examples

### Example 1: Basic Integration

```typescript
// Step 1: Orchestrator prepares request
const request = {
  input_type: 'observation_review',
  query: 'queue retry logic decisions',
  filters: {
    types: ['decision', 'problem-solution'],
    time_range: '7d',
    limit: 50,
  },
  output_format: 'summary_with_ids',
  relevance_threshold: 60,
  detail_level: 'standard',
};

// Step 2: Orchestrator retrieves observations via @memory-bridge
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Orchestrator calls @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations,
});

// Step 4: Orchestrator uses results
if (response.status === 'success') {
  console.log('Key findings:', response.summary.key_findings);

  // Optional Haiku follow-up
  if (response.follow_up.haiku_follow_up_recommended) {
    const ids = response.claude_mem_ids.high_relevance.map(obs => obs.id);
    const detailed = await haiku.retrieveDetailedContext(ids);
  }
}
```

### Example 2: With Token Budget Enforcement

```typescript
// Step 1: Prepare request
const request = {
  input_type: 'observation_review',
  query: 'queue retry logic',
  filters: { limit: 100 },
  output_format: 'summary_with_ids',
  detail_level: 'comprehensive',
};

// Step 2: Retrieve observations
const observations = await memoryBridge.retrieveObservations({
  query: request.query,
  filters: request.filters,
});

// Step 3: Enforce token budget
const { observations: budgeted, truncated } = enforceTokenBudget({
  ...request,
  observations,
});

// Step 4: Call @mem-facilitator
const response = await memFacilitator.process({
  ...request,
  observations: budgeted,
});

// Step 5: Check if truncated
if (truncated) {
  console.warn('Results truncated due to token budget');
}
```

### Example 3: With Rate Limiting

```typescript
// Step 1: Create rate limiter
const rateLimiter = new RateLimiter(10, 60000);

// Step 2: Acquire rate limit
try {
  await rateLimiter.acquire();

  // Step 3: Call @mem-facilitator
  const response = await memFacilitator.process(request);
  return response;
} catch (error) {
  console.error('Rate limit exceeded');
  throw error;
}
```

### Example 4: With Error Handling

```typescript
try {
  // Validate request
  const validated = parse(MemFacilitatorRequestSchema, request);

  // Retrieve observations
  const observations = await memoryBridge.retrieveObservations({
    query: validated.query,
    filters: validated.filters,
  });

  // Call @mem-facilitator
  const response = await memFacilitator.process({
    ...validated,
    observations,
  });

  // Handle response
  switch (response.status) {
    case 'success':
      console.log('Success:', response.summary);
      break;
    case 'partial':
      console.warn('Partial results:', response.truncation_reason);
      break;
    case 'empty':
      console.warn('No matching observations');
      break;
    case 'error':
      console.error('Error:', response.error.message);
      break;
  }
} catch (error) {
  console.error('Error processing request');
  // Do not expose internal details
}
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

### 2. Validate Input Schema

```typescript
// Use Valibot for schema validation
import { parse } from 'valibot';

try {
  const validated = parse(MemFacilitatorRequestSchema, request);
} catch (error) {
  console.error('Invalid input:', error.message);
  // Return generic error message
}
```

### 3. Enforce Token Budget

```typescript
// Enforce 8000 token budget
const { observations: budgeted, truncated } = enforceTokenBudget(request);

if (truncated) {
  console.warn('Results truncated due to token budget');
}
```

### 4. Use Rate Limiting

```typescript
// Implement rate limiting
const rateLimiter = new RateLimiter(10, 60000);

try {
  await rateLimiter.acquire();
  const response = await memFacilitator.process(request);
} catch (error) {
  console.error('Rate limit exceeded');
}
```

### 5. Monitor Token Usage and Cost

```typescript
const response = await memFacilitator.process(request);

console.log('Token usage:', response.token_usage);
console.log('Estimated cost:', response.estimated_cost_usd);

// Warn if approaching budget
if (response.token_usage.budget_remaining < 1000) {
  console.warn('Approaching token budget limit');
}
```

### 6. Handle Partial Results Gracefully

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

### 7. Use Generic Error Messages

```typescript
// ✅ CORRECT: Generic error message
console.error('Invalid input: Please check request format');

// ❌ WRONG: Detailed error message
console.error('Validation failed: Missing required field "query"');
```

### 8. Apply Deontic Filtering

```typescript
// @mem-facilitator automatically applies deontic filtering
// Memory is historical recall, NOT binding policy

// Example observation content:
// "ALWAYS use exponential backoff. NEVER skip validation."

// After deontic filtering:
// "use exponential backoff. skip validation."
```

### 9. Scrub Sensitive Data

```typescript
// @mem-facilitator automatically scrubs sensitive data
// All output will have PII/secrets redacted

// Example observation content:
// "API key: sk-1234567890abcdef, Email: user@example.com"

// After scrubbing:
// "API key: [REDACTED], Email: [REDACTED]"
```

### 10. Use Bounded Regex Patterns

```typescript
// ✅ CORRECT: Bounded regex
const tokenPattern = /sk-[a-zA-Z0-9]{32}/;

// ❌ WRONG: Unbounded regex
const tokenPattern = /sk-.*/;
```

## Summary

@mem-facilitator provides a powerful, cost-effective way to review Claude Mem observations, generate summaries with key findings, and extract Claude Mem IDs for follow-up retrieval by Haiku. By following the orchestrator round-trip pattern, enforcing token budget and rate limiting, and implementing security best practices, you can effectively integrate @mem-facilitator into your workflows.

For more information, see:
- [MEM_FACILITATOR_WORKFLOWS.md](./MEM_FACILITATOR_WORKFLOWS.md) - Workflow documentation
- [MEM_FACILITATOR_ERRORS.md](./MEM_FACILITATOR_ERRORS.md) - Error scenarios and recovery
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide