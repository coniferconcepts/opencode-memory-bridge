# Using Agents

Guide to effectively using AI agents in your projects.

## What Are Agents?

Agents are specialized AI assistants with specific knowledge and capabilities. Each agent is optimized for particular tasks, technologies, or workflows.

## Basic Usage

Invoke an agent with `@` followed by the agent name:

```
@agent-name your request here
```

Examples:
```
@tool-utility find all TODO comments
@valibot-expert create a user schema
@security-expert audit the login flow
```

## Agent Categories

### Orchestrators
High-level coordination for complex tasks.

**@planner**
- Use for: Breaking down complex features
- Example: `@planner help me implement user authentication`

**@code-reviewer**
- Use for: Comprehensive code review
- Example: `@code-reviewer review the payment processing code`

**@solo-orchestrator**
- Use for: Solo development with self-review
- Example: `@solo-orchestrator build the dashboard feature`

### Specialists
Domain experts for specific technologies.

**Technology Examples:**
```
@legend-state-expert set up syncedCrud for workouts
@valibot-expert create validation for user registration
@tamagui-expert design a profile card component
@cloudflare-expert create a worker with D1 database
```

### Utilities
Operational and support agents.

**Common Tasks:**
```
@tool-utility rename all .js files to .ts
@flash-lite analyze the codebase structure
@memory-bridge remember we use Stripe for payments
@terminal-error-reviewer diagnose this build error
```

## Best Practices

### 1. Choose the Right Agent

Match the agent to the task:
- Technical implementation → @solo-orchestrator or specialist
- Code review → @code-reviewer or @deep-reviewer
- Planning → @planner
- Quick questions → @flash-lite or @glm-flash
- Security → @security-expert

### 2. Be Specific

Good: `@valibot-expert create a schema for user registration with email validation`

Vague: `@valibot-expert help with validation`

### 3. Provide Context

Include relevant information:
```
@tamagui-expert create a login form. We're using:
- Tamagui v1.76
- Legend State for form state
- Valibot for validation
```

### 4. Chain Agents

Use multiple agents for complex workflows:
```
@planner plan the user profile feature
@solo-orchestrator implement the plan
@code-reviewer review the implementation
@test-reviewer create tests
```

### 5. Use the Router

When unsure, let the router decide:
```
@router create a form with validation and state management
```

## Common Workflows

### Feature Development

```
@planner plan the shopping cart feature
↓
@solo-orchestrator implement step 1: data models
↓
@valibot-expert create schemas
@legend-state-expert set up state
↓
@solo-orchestrator implement UI components
↓
@tamagui-expert review component design
↓
@code-reviewer full review
↓
@test-reviewer comprehensive tests
↓
@guardrail-validator run all checks
```

### Debugging

```
@terminal-error-reviewer what's causing this error?
↓
@security-expert is this a security issue?
↓
@deep-reviewer analyze the root cause
↓
@solo-orchestrator implement the fix
↓
@test-reviewer verify the fix works
```

### Refactoring

```
@deep-reviewer analyze the current implementation
↓
@planner plan the refactoring approach
↓
@solo-orchestrator execute the refactoring
↓
@code-reviewer verify nothing broke
↓
@always-works-validator production readiness check
```

## Agent Combinations

Some agents work particularly well together:

**Frontend Development:**
- @tamagui-expert + @legend-state-expert + @valibot-expert

**Backend Development:**
- @trpc-expert + @drizzle-expert + @valibot-expert

**Full-Stack Feature:**
- @planner + @solo-orchestrator + multiple specialists

**Security Audit:**
- @security-expert + @gpt5-security + @code-reviewer

**Performance Optimization:**
- @flash-lite + @deep-reviewer + @solo-orchestrator

## Tips and Tricks

### Agent Memory

Use @memory-bridge to maintain context:
```
@memory-bridge remember we're using Cloudflare D1 for the database
```

Later:
```
@solo-orchestrator create a new API endpoint (use D1)
```

### Quick Questions

For simple questions, use fast agents:
```
@flash-lite what's in the utils folder?
@glm-flash explain this TypeScript error
```

### Delegation

Let orchestrators handle coordination:
```
@planner implement user authentication with:
- Login/registration forms
- JWT token handling
- Password reset
- Email verification
```

The planner will delegate to appropriate agents automatically.

## Troubleshooting

### Agent Not Responding

Check:
1. Is the agent name correct? (check @ + exact name)
2. Is the configuration built? (`node scripts/build-config.js`)
3. Are there errors in the prompt file?

### Wrong Agent Selected

- Be more specific in your request
- Use the specific agent directly instead of @router
- Check agent triggers in metadata

### Agent Doesn't Know Something

- Use @context7-super-expert for documentation lookup
- Provide more context in your request
- Use @memory-bridge to establish context

## Advanced Usage

### Custom Agents

Create project-specific agents:
1. Create prompt file in `.opencode/agents/`
2. Add to project configuration
3. Use with @custom-agent-name

### Agent Overrides

Override base agent behavior:
```json
{
  "overrides": {
    "tool-utility": {
      "prompt": "{file:.opencode/overrides/tool-utility.txt}"
    }
  }
}
```

## Further Reading

- [Agent Registry](../../reference/agent-registry.md) - Complete agent catalog
- [Agent Hierarchy](../../reference/agent-hierarchy.md) - How agents are organized
- [Intelligent Routing](../../reference/intelligent-routing.md) - How routing works
