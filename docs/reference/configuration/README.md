# Configuration Reference

Complete reference for all OpenCode Base-Layer configuration options.

## Overview

The base-layer uses a hierarchical configuration system:

1. **Base Configuration** - `config/opencode.json` (universal settings)
2. **Routing Configuration** - `config/routing.json` (agent routing rules)
3. **Agent Metadata** - `config/agent-metadata.json` (agent definitions)
4. **Project Configuration** - `.opencode/project.json` (project-specific)

## Configuration Files

### Main Configuration (`config/opencode.json`)

The primary configuration file defining all agents.

**Structure:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": [
    {
      "name": "agent-name",
      "model": "opencode/glm-4.7",
      "prompt": "{file:~/.opencode/universal/prompts/agents/agent-name.txt}",
      "description": "Agent description"
    }
  ],
  "defaultAgent": "default-agent-name"
}
```

**Fields:**
- `name` - Unique agent identifier (used with @)
- `model` - AI model to use (e.g., opencode/glm-4.7, gpt-5-nano)
- `prompt` - Path to prompt file or inline prompt
- `description` - Human-readable description
- `defaultAgent` - Agent used when no specific agent is mentioned

**Built vs Source:**
- **Source** (`config/opencode.json`): ~9.4KB, uses `{file:...}` references
- **Built** (`~/.config/opencode/opencode.json`): ~406KB, all references resolved

### Routing Configuration (`config/routing.json`)

Configures the intelligent routing system.

**Structure:**
```json
{
  "extends": "~/.opencode/config/routing.json",
  "routing": {
    "enabled": true,
    "defaultRouter": "router",
    "strategies": {
      "keyword": { "weight": 0.4 },
      "semantic": { "weight": 0.3 },
      "context": { "weight": 0.3 }
    }
  }
}
```

**Options:**
- `enabled` - Enable/disable routing (default: true)
- `defaultRouter` - Default routing agent
- `strategies` - Routing strategy weights
- `cache` - Cache configuration for routing decisions

### Agent Metadata (`config/agent-metadata.json`)

Extended metadata for agent routing and capabilities.

**Structure:**
```json
{
  "agents": {
    "agent-name": {
      "category": "specialists",
      "triggers": ["keyword1", "keyword2"],
      "model": "opencode/glm-4.7",
      "prerequisites": ["other-agent"],
      "guardrails": ["guardrail-name"],
      "confidence": 0.9
    }
  }
}
```

**Fields:**
- `category` - Agent classification (orchestrators, specialists, utilities, etc.)
- `triggers` - Keywords that trigger this agent
- `model` - Override model for this agent
- `prerequisites` - Other agents this one depends on
- `guardrails` - Guardrails that apply to this agent
- `confidence` - Base confidence score for routing

### Project Configuration (`.opencode/project.json`)

Project-specific overrides and extensions.

**Structure:**
```json
{
  "extends": "~/.opencode/config/opencode.json",
  "agents": [
    {
      "name": "project-specific-agent",
      "model": "opencode/glm-4.7",
      "prompt": "{file:.opencode/agents/custom-agent.txt}"
    }
  ],
  "overrides": {
    "base-agent": {
      "prompt": "{file:.opencode/overrides/base-agent-override.txt}"
    }
  }
}
```

## Configuration Hierarchy

Configurations are merged in this order (later overrides earlier):

1. OpenCode defaults
2. Base-layer config (`~/.config/opencode/opencode.json`)
3. Project config (`.opencode/project.json`)
4. User preferences (`~/.config/opencode/user.json`)

## Environment Variables

Configuration can be influenced by environment:

- `OPENCODE_CONFIG_PATH` - Override config file location
- `OPENCODE_MODEL_DEFAULT` - Default model to use
- `OPENCODE_ROUTING_ENABLED` - Enable/disable routing (true/false)
- `OPENCODE_DEBUG` - Enable debug logging (true/false)

## Common Configurations

### Disabling Routing

```json
{
  "routing": {
    "enabled": false
  }
}
```

### Custom Default Agent

```json
{
  "defaultAgent": "my-custom-agent"
}
```

### Adding Project Agents

```json
{
  "agents": [
    {
      "name": "custom-agent",
      "model": "opencode/glm-4.7",
      "prompt": "Custom prompt here"
    }
  ]
}
```

## Validation

Configuration is automatically validated:

**JSON Schema:**
- Validates against `https://opencode.ai/config.json`
- Checks required fields
- Validates model names
- Ensures unique agent names

**Build-Time Checks:**
- Resolves all `{file:...}` references
- Validates referenced files exist
- Checks for circular references
- Ensures valid UTF-8 encoding

**Runtime Checks:**
- Validates agent name references
- Checks model availability
- Validates prompt format

## Troubleshooting

### "Config file is not valid JSON"

**Cause**: Using source config without building

**Fix**:
```bash
cd ~/.opencode
node scripts/build-config.js
```

### "Missing file" error

**Cause**: File reference points to non-existent file

**Fix**: Check the path in the error message, ensure file exists

### "Duplicate agent name"

**Cause**: Two agents with same name defined

**Fix**: Rename one of the agents

### "Invalid model"

**Cause**: Unknown model specified

**Fix**: Use valid model name (check OpenCode documentation)

## Advanced Configuration

### Custom Routing Rules

```json
{
  "routing": {
    "rules": [
      {
        "pattern": "security|auth|login",
        "agents": ["security-expert", "gpt5-security"],
        "priority": 10
      }
    ]
  }
}
```

### Agent Groups

```json
{
  "groups": {
    "frontend": ["tamagui-expert", "legend-state-expert"],
    "backend": ["trpc-expert", "drizzle-expert"]
  }
}
```

### Conditional Configuration

```json
{
  "conditional": {
    "if": "env.NODE_ENV === 'production'",
    "then": {
      "guardrails": ["all-production-checks"]
    }
  }
}
```

## Migration Guide

### From v0.x to v1.0

1. Backup existing config
2. Update to new structure
3. Run build script
4. Verify agents load

See [CHANGELOG](../../CHANGELOG.md) for breaking changes.

## Reference

- [Agent Registry](../agent-registry.md) - All available agents
- [Agent Hierarchy](../agent-hierarchy.md) - Agent organization
- [Intelligent Routing](../intelligent-routing.md) - Routing system details
