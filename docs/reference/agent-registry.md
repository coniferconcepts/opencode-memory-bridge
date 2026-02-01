# Agent Registry

Complete catalog of all AI agents available in the OpenCode Base-Layer.

## Quick Reference

| Category | Count | Agents |
|----------|-------|--------|
| **Orchestrators** | 3 | @planner, @code-reviewer, @solo-orchestrator |
| **Router** | 1 | @router |
| **Specialists** | 10 | @legend-state-expert, @valibot-expert, @tamagui-expert, @cloudflare-expert, @context7-super-expert, @security-expert, @gpt5-security, @deep-reviewer, @test-reviewer, @fast-validator |
| **Utilities** | 13 | @tool-utility, @flash-lite, @glm-flash, @glm-executor, @kimi-premium, @codexmax-implementation, @dependency-guardian, @doc-guardian, @terminal-error-reviewer, @frontend-designer, @memory-bridge, @guardrail-validator, @always-works-validator |
| **Total** | **27** | |

## Orchestrators

High-level coordination agents.

### @planner
- **Purpose**: Task decomposition and multi-expert coordination
- **Model**: opencode/glm-4.7
- **Triggers**: "plan", "break down", "coordinate"
- **Usage**: `@planner help me implement user authentication`

### @code-reviewer
- **Purpose**: Multi-phase code review pipeline
- **Model**: opencode/glm-4.7
- **Triggers**: "review", "check code", "audit"
- **Usage**: `@code-reviewer review my pull request`

### @solo-orchestrator
- **Purpose**: Solo developer workflow with self-review
- **Model**: opencode/glm-4.7
- **Triggers**: "implement", "build", "create"
- **Usage**: `@solo-orchestrator implement the dashboard feature`

## Router

### @router
- **Purpose**: Auto-selects optimal agents based on request
- **Model**: gpt-5-nano
- **Triggers**: Any request (acts as default)
- **Benefits**: 60-80% context reduction, <100ms routing decisions
- **Usage**: `@router create a form with validation`

## Technology Specialists

### @legend-state-expert
- **Domain**: Legend State v3 state management
- **Capabilities**: syncedCrud, persistence, sync patterns
- **Usage**: `@legend-state-expert set up syncedCrud for workouts`

### @valibot-expert
- **Domain**: Valibot schema validation
- **Capabilities**: Schema creation, type inference, validation
- **Usage**: `@valibot-expert create schema for user registration`

### @tamagui-expert
- **Domain**: Tamagui UI framework
- **Capabilities**: Components, tokens, cross-platform design
- **Usage**: `@tamagui-expert create a card component`

### @cloudflare-expert
- **Domain**: Cloudflare Workers, D1, R2, KV
- **Capabilities**: Edge computing, serverless patterns
- **Usage**: `@cloudflare-expert create a worker with D1 integration`

### @context7-super-expert
- **Domain**: Deep documentation retrieval
- **Capabilities**: Context7 MCP integration, authoritative knowledge
- **Usage**: `@context7-super-expert look up React best practices`

## Quality & Review Agents

### @deep-reviewer
- **Purpose**: Deep architectural analysis
- **Usage**: `@deep-reviewer analyze the data flow architecture`

### @test-reviewer
- **Purpose**: Test coverage and quality analysis
- **Usage**: `@test-reviewer review the test suite`

### @fast-validator
- **Purpose**: Fast pattern matching and validation
- **Usage**: `@fast-validator check for common issues`

### @guardrail-validator
- **Purpose**: Guardrail compliance checking
- **Usage**: `@guardrail-validator run all checks`

### @always-works-validator
- **Purpose**: Production-readiness validation
- **Usage**: `@always-works-validator verify production readiness`

## Utility Agents

### @tool-utility
- **Purpose**: Mechanical file operations
- **Capabilities**: Read, write, edit, search, bash commands
- **Usage**: `@tool-utility find all TODO comments`

### @flash-lite
- **Purpose**: Read-only reconnaissance
- **Model**: gemini-3-flash (fast, cheap)
- **Usage**: `@flash-lite analyze the codebase structure`

### @glm-flash
- **Purpose**: Fast GLM via OpenRouter
- **Model**: glm-4.7-free
- **Usage**: `@glm-flash quick question about the code`

### @glm-executor
- **Purpose**: Mechanical code execution
- **Model**: glm-4.7-free
- **Usage**: `@glm-executor implement the utility function`

### @kimi-premium
- **Purpose**: Premium reasoning tasks
- **Model**: kimi-k2.5
- **Usage**: `@kimi-premium solve this complex algorithm`

### @codexmax-implementation
- **Purpose**: Precise TypeScript implementation
- **Model**: gpt-5.2-codex
- **Usage**: `@codexmax-implementation implement the type-safe API`

### @dependency-guardian
- **Purpose**: Dependency evaluation and risk assessment
- **Usage**: `@dependency-guardian evaluate adding lodash`

### @doc-guardian
- **Purpose**: Documentation maintenance
- **Usage**: `@doc-guardian update the README`

### @terminal-error-reviewer
- **Purpose**: Terminal error diagnosis
- **Usage**: `@terminal-error-reviewer diagnose this error`

### @frontend-designer
- **Purpose**: UI/UX design
- **Usage**: `@frontend-designer design a login screen`

### @memory-bridge
- **Purpose**: Context continuity across sessions
- **Usage**: `@memory-bridge remember we decided to use Stripe`

## Security Agents

### @security-expert
- **Purpose**: Security patterns and anti-patterns
- **Usage**: `@security-expert audit the authentication flow`

### @gpt5-security
- **Purpose**: Security audits with GPT-5
- **Model**: gpt-5.2
- **Usage**: `@gpt5-security perform security audit`

## Configuration

Agents are defined in:
- `config/opencode.json` - Main configuration
- `universal/prompts/agents/*.txt` - Agent prompt definitions
- `config/agent-metadata.json` - Routing metadata

## Future Agents (Proposed)

See [Architecture Proposal](../architecture/PROPOSAL.md) for planned expansions:
- @drizzle-expert - Database ORM specialist
- @auth-expert - Authentication patterns
- @performance-expert - Optimization specialist
- @ecommerce-expert - E-commerce domain expert

## Usage Examples

### Common Workflows

**Feature Development:**
```
@planner plan the user profile feature
@solo-orchestrator implement the plan
@code-reviewer review the implementation
@test-reviewer create comprehensive tests
```

**Debugging:**
```
@terminal-error-reviewer diagnose the error
@security-expert check for security implications
@deep-reviewer analyze the root cause
```

**Code Quality:**
```
@guardrail-validator run all quality checks
@fast-validator check for anti-patterns
@always-works-validator verify production readiness
```

## Contributing

To add a new agent:
1. Create prompt file in `universal/prompts/agents/`
2. Add to `config/opencode.json`
3. Update `config/agent-metadata.json` for routing
4. Rebuild: `node scripts/build-config.js`
5. Update this registry
