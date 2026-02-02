# opencode-memory-bridge

> **OpenCode memory plugin that integrates with claude-mem via git submodules**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/coniferconcepts/opencode-memory-bridge/ci.yml?branch=main)](https://github.com/coniferconcepts/opencode-memory-bridge/actions)

The OpenCode Memory Bridge provides seamless integration between [OpenCode](https://github.com/supermaven/opencode) and the [claude-mem](https://github.com/coniferconcepts/claude-mem-source) memory service, enabling persistent, context-aware conversations with AI agents.

## Overview

This package implements OpenCode hooks to:
- Extract ZEN-native conversation data
- Store and retrieve memories via the claude-mem service
- Provide context-aware suggestions to AI agents
- Manage project-specific memory contexts

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              OpenCode Editor                        │
│  ┌──────────────────────────────────────────────┐  │
│  │         opencode-memory-bridge               │  │
│  │  ┌─────────────┐      ┌──────────────────┐   │  │
│  │  │   Hooks     │──────▶│ Memory Service   │   │  │
│  │  │             │      │ (claude-mem)     │   │  │
│  │  └─────────────┘      └──────────────────┘   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Features

- **Automatic Memory Extraction**: Captures conversation context automatically
- **Semantic Search**: Find relevant memories using vector similarity
- **Project Awareness**: Organize memories by project/workspace
- **ZEN-Native**: Built for ZEN (Zettelkasten Enhanced Notes) workflows
- **OpenCode Hooks**: Implements `onStart`, `onMessage`, and `onExit` hooks

## Installation

### As a Git Submodule (Recommended)

```bash
cd your-opencode-project
git submodule add https://github.com/coniferconcepts/opencode-memory-bridge.git packages/memory-plugin
git submodule update --init --recursive
```

Then add to your `package.json`:
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin"
  }
}
```

### Using GitHub Reference

```bash
npm install github:coniferconcepts/opencode-memory-bridge#v1.0.0
```

### Local Development

```bash
git clone https://github.com/coniferconcepts/opencode-memory-bridge.git
cd opencode-memory-bridge
npm install
npm link
cd your-project
npm link @opencode/memory-plugin
```

## Dependencies

This package requires:
- **[claude-mem-source](https://github.com/coniferconcepts/claude-mem-source)**: Memory service (usually as git submodule)
- **OpenCode**: The editor this plugin extends
- **Node.js**: v18 or higher

## Configuration

Add to your OpenCode configuration:

```json
{
  "plugins": [
    {
      "name": "@opencode/memory-plugin",
      "config": {
        "memoryServiceUrl": "http://localhost:37777",
        "autoExtract": true,
        "projectContext": true
      }
    }
  ]
}
```

## Usage

### Basic Usage

```typescript
import { MemoryBridge } from '@opencode/memory-plugin';

const bridge = new MemoryBridge({
  serviceUrl: 'http://localhost:37777'
});

// Store a memory
await bridge.store({
  content: 'Important conversation context',
  project: 'my-project',
  tags: ['architecture', 'decision']
});

// Retrieve relevant memories
const memories = await bridge.search({
  query: 'architecture decisions',
  project: 'my-project',
  limit: 5
});
```

### Hook Integration

```typescript
import { onStart, onMessage, onExit } from '@opencode/memory-plugin/hooks';

export default {
  onStart: async (context) => {
    await onStart(context);
  },
  
  onMessage: async (message, context) => {
    // Memory is automatically extracted and stored
    return await onMessage(message, context);
  },
  
  onExit: async (context) => {
    await onExit(context);
  }
};
```

## Development

### Setup

```bash
npm install
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
```

### Building

```bash
npm run build
npm run lint
```

## Versioning

We use [semantic versioning](https://semver.org/) with git tags:

- `v1.0.0` - Major releases
- `v1.1.0` - Feature additions
- `v1.1.1` - Bug fixes

To use a specific version via git submodule:
```bash
cd packages/memory-plugin
git checkout v1.0.0
cd ../..
git add packages/memory-plugin
git commit -m "Pin memory-bridge to v1.0.0"
```

## API Reference

### MemoryBridge

Main class for interacting with the memory service.

#### Methods

- `store(memory: Memory)`: Store a new memory
- `search(query: SearchQuery)`: Search for relevant memories
- `get(id: string)`: Retrieve a specific memory
- `delete(id: string)`: Delete a memory
- `list(options?: ListOptions)`: List memories with filtering

### Hooks

- `onStart(context: Context)`: Called when OpenCode starts
- `onMessage(message: Message, context: Context)`: Called on each message
- `onExit(context: Context)`: Called when OpenCode exits

## Troubleshooting

### Memory Service Not Found

Ensure claude-mem is running:
```bash
curl http://localhost:37777/health
```

### Submodule Not Initialized

```bash
git submodule update --init --recursive
```

### Build Errors

Make sure you have the correct Node.js version:
```bash
node --version  # Should be v18+
```

## License

**MIT** - See [LICENSE](./LICENSE) for full terms.

## Related Repositories

- [claude-mem-source](https://github.com/coniferconcepts/claude-mem-source) - Core memory service
- [opencode-global-config](https://github.com/coniferconcepts/opencode-global-config) - Hook interfaces and configuration
- [OpenCode](https://github.com/supermaven/opencode) - The editor this plugin extends

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation as needed
- Ensure CI passes before submitting PR

## Support

- **Issues**: https://github.com/coniferconcepts/opencode-memory-bridge/issues
- **Upstream Memory Service**: https://github.com/coniferconcepts/claude-mem-source/issues
- **Hook Interfaces**: https://github.com/coniferconcepts/opencode-global-config/issues

## Acknowledgments

- Built for [OpenCode](https://github.com/supermaven/opencode)
- Integrates with [claude-mem](https://github.com/thedotmack/claude-mem) by Alex Newman
- Maintained by [Conifer Concepts](https://github.com/coniferconcepts)
