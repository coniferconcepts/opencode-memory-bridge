# Agent Knowledge Hierarchy Documentation

## Overview

This document describes the three-tier agent knowledge hierarchy that optimizes context efficiency while ensuring proper delegation and coordination.

## The Three-Tier System

### Tier 1: Orchestrators (Full Knowledge)
**Agents**: @planner, @code-reviewer, @solo-orchestrator

**Knowledge Level**: 
- Have access to the complete **Agent Registry** (all 24 agents)
- Know which specialist to call for which task
- Can coordinate cross-domain work
- Understand delegation patterns and handoff protocols

**Responsibilities**:
- Select the right specialists for each task
- Coordinate multiple specialists for cross-domain work
- Handle "blocked" responses from specialists
- Synthesize results from multiple domains
- Make final decisions and recommendations

**Context Size**: ~400 lines (includes full registry)

### Tier 2: Specialists (Deep Domain Knowledge)
**Agents**: @legend-state-expert, @valibot-expert, @tamagui-expert, @cloudflare-expert, etc.

**Knowledge Level**:
- **DEEP** knowledge in their specific domain (100-150 lines)
- **LIMITED** knowledge of other agents
- **NO** access to the full Agent Registry
- Know to escalate cross-domain issues

**Responsibilities**:
- Stay strictly within their domain
- Provide deep expertise in their specialty
- Return structured responses with status
- Escalate when work touches other domains
- Never invoke other agents directly

**Context Size**: ~150 lines (domain only, no registry)

**Escalation Protocol**:
When encountering work outside their domain:
1. Analyze what they CAN do in their domain
2. Identify the domain gap (e.g., "database schema", "UI components")
3. Return `status: "blocked"` with structured response
4. Specify the domain_gap field
5. Let orchestrator coordinate the handoff

### Tier 3: Utilities (Minimal Context)
**Agents**: @tool-utility, @flash-lite, @glm-executor, etc.

**Knowledge Level**:
- **MINIMAL** context - just tools and communication
- **NO** domain knowledge
- **NO** access to registry
- **NO** delegation capability

**Responsibilities**:
- Execute tasks literally
- Return raw results (no interpretation)
- Never make decisions or recommendations
- Fail fast on errors

**Context Size**: ~50 lines (tools only)

## Key Design Principles

### 1. Context Efficiency
- **Orchestrators carry the map** - They know who to call
- **Specialists carry the depth** - They know their domain deeply
- **Utilities carry nothing** - They just execute

This prevents every agent from having bloated context about all other agents.

### 2. Clear Boundaries
- Specialists have explicit domain scope definitions
- Domain limitations are documented in each specialist
- Cross-domain detection is built into specialist prompts

### 3. Structured Communication
All subagents use standardized response schema:
```json
{
  "status": "complete" | "partial" | "blocked",
  "findings": [...],
  "missing_info": [...],
  "confidence": 0-100,
  "domain_scope": "what was analyzed",
  "domain_limitations": "what was NOT analyzed"
}
```

### 4. No Direct Delegation
- Specialists NEVER invoke other agents
- If they need help outside their domain, they escalate to orchestrator
- Orchestrators handle all coordination

## How It Works in Practice

### Scenario 1: Single Domain Task
**User**: "Set up syncedCrud for workouts"

**Flow**:
1. Orchestrator (@solo-orchestrator) receives request
2. Checks Agent Registry: "State management → @legend-state-expert"
3. Delegates to @legend-state-expert
4. Specialist works within their domain (Legend State)
5. Returns `status: "complete"` with implementation
6. Orchestrator presents result to user

**Context Efficiency**: Only @legend-state-expert loads Legend State knowledge (~150 lines)

### Scenario 2: Cross-Domain Task
**User**: "Create a complete workout feature with validation and UI"

**Flow**:
1. Orchestrator (@planner) receives request
2. Checks Agent Registry for all relevant specialists:
   - Validation → @valibot-expert
   - State management → @legend-state-expert
   - UI → @tamagui-expert
3. Plans sequence: Validation schema first (prerequisite for state)
4. Delegates in phases:
   - Phase 1: @valibot-expert creates schema
   - Phase 2: @legend-state-expert sets up state (using schema)
   - Phase 3: @tamagui-expert creates UI (in parallel with Phase 2)
5. Collects all responses
6. Synthesizes and presents unified result

**Context Efficiency**: Each specialist only loads their domain (~150 lines each), not the full stack

### Scenario 3: Blocked Specialist
**User**: "Set up syncedCrud for workouts"

**Problem**: @legend-state-expert discovers they need database field names

**Flow**:
1. Orchestrator delegates to @legend-state-expert
2. Specialist analyzes: "I need to know the database schema field names for fieldId mapping"
3. Specialist returns:
   ```json
   {
     "status": "blocked",
     "findings": [...],
     "missing_info": [{
       "severity": "BLOCKING",
       "domain_gap": "database schema",
       "question": "What are the exact field names?"
     }]
   }
   ```
4. Orchestrator reads the response
5. Checks Agent Registry: "Database → @cloudflare-expert"
6. Delegates to @cloudflare-expert: "What are the workout table field names?"
7. Gets response from @cloudflare-expert
8. Hands off to @legend-state-expert with the field names
9. Specialist completes and returns `status: "complete"`
10. Orchestrator presents final result

**Benefits**:
- @legend-state-expert doesn't need to know about databases
- @cloudflare-expert doesn't need to know about Legend State
- Orchestrator coordinates the handoff
- Each specialist stays in their lane

## File Structure

### Core Files

**`base-orchestrator.txt`** (included by all orchestrators)
- Includes full `agent-registry.txt`
- Delegation decision tree
- Coordination protocols
- Response standards

**`base-subagent.txt`** (included by ALL subagents)
- Identity and role definition
- Bubbling protocol for escalation
- Response schema
- Cross-domain detection guide
- No registry included

**`agent-registry.txt`** (standalone reference)
- Complete agent directory (24 agents)
- Categorized by role (Orchestrators, Specialists, Utilities, etc.)
- Delegation patterns by role
- Cross-domain collaboration matrix
- Escalation protocols

### Agent-Specific Files

**Orchestrators** (include base-orchestrator.txt):
- `planner.txt` - Implementation planning
- `code-reviewer.txt` - Review pipeline coordination
- `solo-orchestrator.txt` - Solo dev coordination

**Specialists** (include base-subagent.txt + role definition):
- `legend-state-expert.txt` - Legend State v3 expertise
- `valibot-expert.txt` - Schema validation
- `tamagui-expert.txt` - UI components
- `cloudflare-expert.txt` - Workers/D1
- etc.

**Utilities** (include base-subagent.txt):
- `tool-utility.txt` - File operations
- `flash-lite.txt` - Read-only recon
- `glm-executor.txt` - Mechanical execution

## Benefits of This Structure

### 1. No Context Pollution
- Specialists don't know about unrelated technologies
- Utilities don't know about anything except tools
- Only orchestrators carry the full map

### 2. Clear Responsibilities
- Everyone knows their role and boundaries
- No confusion about who does what
- Escalation paths are clear

### 3. Efficient Parallelization
- Independent specialists can work simultaneously
- Orchestrators manage dependencies
- No waiting for unrelated context to load

### 4. Maintainability
- Adding new agents only requires updating registry
- Specialists are self-contained
- Changes to one don't affect others

### 5. Cost Efficiency
- Smaller context = faster inference
- Less token usage per agent
- More agents can be used in parallel

## When to Use Each Tier

### Use Orchestrators When:
- Task spans multiple domains
- Need to coordinate multiple specialists
- Making high-level decisions
- Planning complex implementations
- Synthesizing conflicting recommendations

### Use Specialists When:
- Task is within a single domain
- Need deep expertise
- Implementation in specific technology
- Domain-specific review

### Use Utilities When:
- Need mechanical execution
- File operations
- Data gathering
- No interpretation needed

## Migration from Old Structure

### What Changed

**Before**:
- All agents had ad-hoc agent references
- No clear hierarchy
- Specialists sometimes referenced other agents
- Context bloat from unnecessary references

**After**:
- Clear three-tier hierarchy
- Centralized Agent Registry
- Specialists escalate, never delegate
- Minimal context for each role

### Backwards Compatibility
- All existing agents still work
- New structure is additive
- Old references can be gradually migrated

## Best Practices

### For Orchestrators:
- Always check Agent Registry before delegating
- Provide clear handover context to specialists
- Handle "blocked" responses promptly
- Synthesize, don't just pass through

### For Specialists:
- Stay strictly within your domain
- Return structured responses always
- Be specific about domain gaps
- Don't try to solve cross-domain issues yourself

### For Users:
- Start with orchestrators for complex tasks
- Use specialists directly for domain-specific questions
- Let the system coordinate cross-domain work
- Trust the escalation process

## Future Improvements

### Potential Enhancements:
1. **Dynamic Registry** - Load only relevant agents for each task
2. **Specialist Caching** - Keep specialist responses for similar queries
3. **Orchestrator Specialization** - Domain-specific orchestrators
4. **Auto-Delegation** - AI-powered agent selection

### Current Limitations:
1. Orchestrators have large context (but only 3 of them)
2. No automatic retry logic for blocked specialists
3. Manual coordination for complex sequences

## Conclusion

This three-tier hierarchy optimizes the trade-off between:
- **Knowledge**: Deep domain expertise where needed
- **Coordination**: Full system visibility for orchestrators
- **Efficiency**: Minimal context for maximum parallelization

The result is a system where:
- 3 orchestrators carry the full map (~400 lines each)
- 20+ specialists carry deep domain knowledge (~150 lines each)
- Utilities carry minimal context (~50 lines each)
- Cross-domain work is coordinated, not duplicated
- Context is efficient and maintainable
