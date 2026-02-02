# @mem-facilitator Error Scenarios and Recovery

## Overview

This document provides comprehensive error scenario documentation for @mem-facilitator, including all error scenarios, generic error messages, recovery strategies, and troubleshooting checklists.

## Error Scenarios

### 1. Invalid Input

**Description**: The request does not match the expected schema or contains invalid data.

**Causes**:
- Missing required fields (query, observations)
- Invalid data types (e.g., observations is not an array)
- Invalid filter values (e.g., time_range is not a valid value)
- Invalid output_format value
- Invalid detail_level value
- Invalid relevance_threshold value (outside 0-100 range)

**Response**:
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input: Please check request format"
  }
}
```

**Recovery Strategy**:
1. Validate request schema before calling @mem-facilitator
2. Ensure all required fields are present
3. Verify data types match expected types
4. Check filter values are valid
5. Review [MEM_FACILITATOR_INTEGRATION.md](./MEM_FACILITATOR_INTEGRATION.md) for schema reference

**Example**:
```typescript
// ❌ WRONG: Missing required field
const request = {
  query: 'queue retry logic',
  // Missing: observations, filters, output_format, etc.
};

// ✅ CORRECT: Complete request
const request = {
  input_type: 'observation_review',
  query: 'queue retry logic',
  filters: {
    types: ['decision'],
    time_range: '7d',
    limit: 50,
  },
  output_format: 'summary_with_ids',
  relevance_threshold: 60,
  detail_level: 'standard',
  observations: [], // Required
};
```

### 2. No Matching Observations

**Description**: No observations match the query criteria.

**Causes**:
- Query is too specific
- Time range filter excludes all observations
- Type filter excludes all observations
- No observations exist in the database
- Observations exist but don't match query

**Response**:
```json
{
  "status": "empty",
  "summary": {
    "key_findings": [],
    "patterns_detected": [],
    "context_relevance": "low",
    "freshness": "unknown"
  },
  "observations": {
    "total_found": 0,
    "total_reviewed": 0,
    "matching_count": 0,
    "relevance_threshold": 60
  },
  "claude_mem_ids": {
    "high_relevance": [],
    "medium_relevance": [],
    "low_relevance": []
  },
  "recommendations": [
    "Try broadening search criteria",
    "Check time range filter",
    "Verify observation types",
    "Consider lowering relevance threshold"
  ],
  "warnings": [
    "No matching observations found"
  ],
  "follow_up": {
    "suggested_queries": [
      "queue retry logic",
      "retry patterns",
      "error handling"
    ],
    "recommended_detail_level": "standard",
    "haiku_follow_up_recommended": false
  },
  "token_usage": {
    "input": 500,
    "output": 300,
    "total": 800,
    "budget_remaining": 7200
  },
  "estimated_cost_usd": 0.0004,
  "confidence": 0
}
```

**Recovery Strategy**:
1. Broaden search criteria (e.g., remove type filter)
2. Expand time range (e.g., from '7d' to '30d')
3. Lower relevance threshold (e.g., from 60 to 40)
4. Try alternative query terms
5. Verify observations exist in database

**Example**:
```typescript
// ❌ WRONG: Too specific
const request = {
  query: 'exponential backoff with jitter for queue retry logic',
  filters: {
    types: ['decision'],
    time_range: '1d',
    limit: 10,
  },
};

// ✅ CORRECT: Broader search
const request = {
  query: 'queue retry logic',
  filters: {
    types: ['decision', 'problem-solution'],
    time_range: '7d',
    limit: 50,
  },
  relevance_threshold: 40, // Lower threshold
};
```

### 3. Token Budget Exceeded

**Description**: The total token count exceeds the 8000 token budget.

**Causes**:
- Too many observations in request
- Observations are too long
- Detail level is too high
- Output format includes too much detail

**Response**:
```json
{
  "status": "partial",
  "summary": {
    "key_findings": [
      "Exponential backoff implemented with max 3 retries",
      "Permanent failures logged and alerted"
    ],
    "patterns_detected": [
      "Exponential backoff with jitter"
    ],
    "context_relevance": "high",
    "freshness": "current"
  },
  "observations": {
    "total_found": 100,
    "total_reviewed": 40,
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
    "Reduce observation limit",
    "Lower detail level",
    "Use 'ids_only' output format"
  ],
  "warnings": [
    "[truncated] Results truncated due to token budget limit"
  ],
  "follow_up": {
    "suggested_queries": [],
    "recommended_detail_level": "brief",
    "haiku_follow_up_recommended": true
  },
  "token_usage": {
    "input": 7500,
    "output": 1450,
    "total": 8950,
    "budget_remaining": 50
  },
  "estimated_cost_usd": 0.0045,
  "confidence": 85,
  "truncation_reason": "token_budget"
}
```

**Recovery Strategy**:
1. Reduce observation limit (e.g., from 100 to 50)
2. Lower detail level (e.g., from 'comprehensive' to 'standard')
3. Use 'ids_only' output format
4. Filter by type to reduce observation count
5. Use time range filter to exclude old observations

**Example**:
```typescript
// ❌ WRONG: Too many observations
const request = {
  filters: {
    limit: 150, // Max allowed
  },
  detail_level: 'comprehensive',
  output_format: 'summary_with_ids',
};

// ✅ CORRECT: Reduce observation count
const request = {
  filters: {
    limit: 50, // Reasonable limit
  },
  detail_level: 'standard',
  output_format: 'summary_with_ids',
};
```

### 4. Stale Observations

**Description**: All matching observations are stale (≥7 days old).

**Causes**:
- No recent observations match query
- Time range filter includes old observations only
- Observations haven't been updated recently

**Response**:
```json
{
  "status": "success",
  "summary": {
    "key_findings": [
      "Exponential backoff implemented with max 3 retries",
      "Decision made during Phase 2 queue implementation"
    ],
    "patterns_detected": [
      "Exponential backoff with jitter"
    ],
    "context_relevance": "medium",
    "freshness": "stale"
  },
  "observations": {
    "total_found": 20,
    "total_reviewed": 20,
    "matching_count": 15,
    "relevance_threshold": 60
  },
  "claude_mem_ids": {
    "high_relevance": [
      {
        "id": 1234,
        "ref": "obs_1234",
        "type": "decision",
        "relevanceScore": 85,
        "excerpt": "Decided to use exponential backoff...",
        "relevanceReason": "Addresses retry logic decision",
        "timestamp": 1737216000000
      }
    ],
    "medium_relevance": [],
    "low_relevance": []
  },
  "recommendations": [
    "Consider refreshing context",
    "Check for recent updates",
    "Verify if observations are still relevant"
  ],
  "warnings": [
    "Observations are stale (≥7 days old)"
  ],
  "follow_up": {
    "suggested_queries": [
      "recent queue retry logic updates",
      "current retry patterns"
    ],
    "recommended_detail_level": "standard",
    "haiku_follow_up_recommended": false
  },
  "token_usage": {
    "input": 3500,
    "output": 800,
    "total": 4300,
    "budget_remaining": 3700
  },
  "estimated_cost_usd": 0.0021,
  "confidence": 72
}
```

**Recovery Strategy**:
1. Check if observations are still relevant
2. Look for recent updates
3. Consider refreshing context
4. Verify if decision has changed
5. Use time range filter to exclude old observations

**Example**:
```typescript
// ❌ WRONG: Includes stale observations
const request = {
  filters: {
    time_range: '30d', // Includes old observations
  },
};

// ✅ CORRECT: Filter to recent observations
const request = {
  filters: {
    time_range: '7d', // Recent observations only
  },
};
```

### 5. Conflicting Observations

**Description**: Multiple observations contain contradictory information.

**Causes**:
- Decisions changed over time
- Different sessions made different decisions
- Observations from different contexts conflict

**Response**:
```json
{
  "status": "success",
  "summary": {
    "key_findings": [
      "Exponential backoff implemented with max 3 retries (obs_1234)",
      "Linear backoff used for queue retries (obs_1235)"
    ],
    "patterns_detected": [
      "Conflicting retry strategies detected"
    ],
    "context_relevance": "medium",
    "freshness": "recent"
  },
  "observations": {
    "total_found": 20,
    "total_reviewed": 20,
    "matching_count": 18,
    "relevance_threshold": 60
  },
  "claude_mem_ids": {
    "high_relevance": [
      {
        "id": 1234,
        "ref": "obs_1234",
        "type": "decision",
        "relevanceScore": 90,
        "excerpt": "Decided to use exponential backoff...",
        "relevanceReason": "Recent decision on retry logic",
        "timestamp": 1737820800000
      },
      {
        "id": 1235,
        "ref": "obs_1235",
        "type": "decision",
        "relevanceScore": 85,
        "excerpt": "Decided to use linear backoff...",
        "relevanceReason": "Earlier decision on retry logic",
        "timestamp": 1737734400000
      }
    ],
    "medium_relevance": [],
    "low_relevance": []
  },
  "recommendations": [
    "Review conflicting observations",
    "Prioritize recent observations",
    "Verify current implementation"
  ],
  "warnings": [
    "Conflicting observations detected: obs_1234 vs obs_1235"
  ],
  "follow_up": {
    "suggested_queries": [
      "current queue retry logic implementation",
      "most recent retry decision"
    ],
    "recommended_detail_level": "comprehensive",
    "haiku_follow_up_recommended": true
  },
  "token_usage": {
    "input": 4200,
    "output": 950,
    "total": 5150,
    "budget_remaining": 2850
  },
  "estimated_cost_usd": 0.0026,
  "confidence": 65
}
```

**Recovery Strategy**:
1. Review conflicting observations
2. Prioritize recent observations
3. Verify current implementation
4. Check for decision changes
5. Use Haiku to retrieve detailed context

**Example**:
```typescript
// Detect conflicts
if (response.warnings.some(w => w.includes('conflicting'))) {
  console.warn('Conflicting observations detected');

  // Prioritize recent observations
  const recentIds = response.claude_mem_ids.high_relevance
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3)
    .map(obs => obs.id);

  // Retrieve detailed context
  const detailed = await haiku.retrieveDetailedContext(recentIds);
  // Use detailed context to resolve conflicts
}
```

### 6. Service Unavailable

**Description**: The @mem-facilitator service is temporarily unavailable.

**Causes**:
- GLM 4.7 API is down
- Network connectivity issues
- Service overload
- Maintenance window

**Response**:
```json
{
  "status": "error",
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable"
  }
}
```

**Recovery Strategy**:
1. Implement retry logic with exponential backoff
2. Check service status
3. Use fallback strategy (e.g., direct observation retrieval)
4. Alert operations team
5. Monitor service health

**Example**:
```typescript
// Implement retry logic with exponential backoff
async function callMemFacilitatorWithRetry(request, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await memFacilitator.process(request);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Generic Error Messages (Guardrail #16/#24)

All error responses must use generic error messages that do not expose internal details:

### Invalid Input
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid input: Please check request format"
  }
}
```

### Service Unavailable
```json
{
  "status": "error",
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable"
  }
}
```

### Processing Error
```json
{
  "status": "error",
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Error processing request"
  }
}
```

### Rate Limit Exceeded
```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later."
  }
}
```

**Do NOT expose**:
- Stack traces
- Internal error codes
- Database error messages
- API error details
- File paths
- Internal variable names

## Troubleshooting Checklist

### Step 1: Validate Request Schema

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

### Step 2: Check Observation Count

```typescript
// Ensure observation count is within limits
if (request.observations.length > 150) {
  console.error('Too many observations (max 150)');
  // Return error or truncate
}
```

### Step 3: Verify Token Budget

```typescript
// Calculate estimated token usage
const estimatedTokens = estimateTokenUsage(request);

if (estimatedTokens > 8000) {
  console.warn('Estimated token usage exceeds budget');
  // Truncate or reduce detail level
}
```

### Step 4: Check Filter Values

```typescript
// Verify filter values are valid
const validTimeRanges = ['1d', '7d', '30d', 'all'];
const validTypes = ['decision', 'problem-solution', 'note', 'warning'];
const validOutputFormats = ['summary', 'summary_with_ids', 'ids_only'];
const validDetailLevels = ['brief', 'standard', 'comprehensive'];

if (!validTimeRanges.includes(request.filters.time_range)) {
  console.error('Invalid time_range value');
}

if (!validOutputFormats.includes(request.output_format)) {
  console.error('Invalid output_format value');
}
```

### Step 5: Verify Relevance Threshold

```typescript
// Ensure relevance threshold is within 0-100
if (request.relevance_threshold < 0 || request.relevance_threshold > 100) {
  console.error('Invalid relevance_threshold (must be 0-100)');
}
```

### Step 6: Check Service Health

```typescript
// Check if GLM 4.7 API is available
async function checkServiceHealth() {
  try {
    const response = await fetch('https://api.glm.example.com/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

const isHealthy = await checkServiceHealth();
if (!isHealthy) {
  console.error('Service unavailable');
  // Return error or use fallback
}
```

### Step 7: Monitor Rate Limits

```typescript
// Implement rate limiting
const rateLimiter = new RateLimiter({ max: 10, window: 60000 });

try {
  await rateLimiter.acquire();
  const response = await memFacilitator.process(request);
} catch (error) {
  console.error('Rate limit exceeded');
  // Return error or queue request
}
```

### Step 8: Verify Deontic Filtering

```typescript
// Ensure deontic filtering is applied
const imperativeWords = ['ALWAYS', 'NEVER', 'MUST', 'SHALL', 'REQUIRED', 'MANDATORY', 'DO NOT', 'SHOULD'];

function applyDeonticFiltering(text) {
  let filtered = text;
  for (const word of imperativeWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '');
  }
  return filtered;
}

// Test filtering
const input = 'ALWAYS use exponential backoff. NEVER skip validation.';
const output = applyDeonticFiltering(input);
console.log(output); // 'use exponential backoff. skip validation.'
```

### Step 9: Verify Sensitive Data Scrubbing

```typescript
// Ensure sensitive data is scrubbed
const tokenPattern = /sk-[a-zA-Z0-9]{32}/;
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const phonePattern = /\d{3}-\d{3}-\d{4}/;

function scrubSensitiveData(text) {
  let scrubbed = text;
  scrubbed = scrubbed.replace(tokenPattern, '[REDACTED]');
  scrubbed = scrubbed.replace(emailPattern, '[REDACTED]');
  scrubbed = scrubbed.replace(phonePattern, '[REDACTED]');
  return scrubbed;
}

// Test scrubbing
const input = 'API key: sk-1234567890abcdef1234567890abcdef, Email: user@example.com';
const output = scrubSensitiveData(input);
console.log(output); // 'API key: [REDACTED], Email: [REDACTED]'
```

### Step 10: Verify Bounded Regex (Guardrail #7)

```typescript
// Ensure all regex patterns have explicit bounds
// ✅ CORRECT: Bounded regex
const tokenPattern = /sk-[a-zA-Z0-9]{32}/; // Explicit bounds

// ❌ WRONG: Unbounded regex
const tokenPattern = /sk-.*/; // Unbounded (ReDoS risk)

// Verify all patterns are bounded
function verifyBoundedRegex(pattern) {
  const regex = new RegExp(pattern);
  const source = regex.source;

  // Check for unbounded quantifiers
  if (source.includes('*') || source.includes('+')) {
    // Check if bounded by {min,max}
    if (!source.includes('{')) {
      throw new Error('Unbounded regex detected');
    }
  }
}
```

## Recovery Strategies by Error Type

### Invalid Input
1. Validate request schema before calling @mem-facilitator
2. Ensure all required fields are present
3. Verify data types match expected types
4. Check filter values are valid
5. Review schema reference

### No Matching Observations
1. Broaden search criteria
2. Expand time range
3. Lower relevance threshold
4. Try alternative query terms
5. Verify observations exist

### Token Budget Exceeded
1. Reduce observation limit
2. Lower detail level
3. Use 'ids_only' output format
4. Filter by type
5. Use time range filter

### Stale Observations
1. Check if observations are still relevant
2. Look for recent updates
3. Consider refreshing context
4. Verify if decision has changed
5. Use time range filter

### Conflicting Observations
1. Review conflicting observations
2. Prioritize recent observations
3. Verify current implementation
4. Check for decision changes
5. Use Haiku for detailed context

### Service Unavailable
1. Implement retry logic with exponential backoff
2. Check service status
3. Use fallback strategy
4. Alert operations team
5. Monitor service health

## Summary

@mem-facilitator provides comprehensive error handling with generic error messages (Guardrail #16/#24) and recovery strategies for all error scenarios. By following the troubleshooting checklist and implementing appropriate recovery strategies, you can effectively handle errors and maintain service reliability.

For more information, see:
- [MEM_FACILITATOR_WORKFLOWS.md](./MEM_FACILITATOR_WORKFLOWS.md) - Workflow documentation
- [MEM_FACILITATOR_INTEGRATION.md](./MEM_FACILITATOR_INTEGRATION.md) - Integration guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Troubleshooting guide