# Claude Mem Architecture

This document describes the architecture of the separated Claude Mem components and their relationships.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPOSITORY STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    claude-mem-source                                 │   │
│  │              https://github.com/coniferconcepts/                    │   │
│  │                        claude-mem-source                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ORIGIN: Fork of thedotmack/claude-mem                              │   │
│  │  PURPOSE: Core memory service (worker, SQLite, ChromaDB)            │   │
│  │  LICENSE: AGPL-3.0 (inherited from upstream)                        │   │
│  │  DISTRIBUTION: Git submodules                                       │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │   │
│  │  │  Memory Worker  │  │  SQLite Store    │  │  ChromaDB       │    │   │
│  │  │  (Port 37777)   │  │  (Persistence)   │  │  (Embeddings)   │    │   │
│  │  └────────┬────────┘  └──────────────────┘  └─────────────────┘    │   │
│  │           │                                                        │   │
│  │           │ HTTP API                                               │   │
│  │           ▼                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          ▲                                                  │
│                          │                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 opencode-memory-bridge                               │   │
│  │              https://github.com/coniferconcepts/                    │   │
│  │                      opencode-memory-bridge                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ORIGIN: Extracted from content-tracker                              │   │
│  │  PURPOSE: OpenCode integration (hooks, ZEN extraction)              │   │
│  │  LICENSE: MIT (custom code)                                         │   │
│  │  DISTRIBUTION: Git submodules                                       │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │   │
│  │  │  OpenCode Hooks │  │  ZEN Extractor   │  │  Memory Client  │────┘   │
│  │  │  onStart        │  │  (Zettelkasten)  │  │  (HTTP Client)  │        │
│  │  │  onMessage      │  └──────────────────┘  └─────────────────┘        │
│  │  │  onExit         │                                                    │   │
│  │  └────────┬────────┘                                                    │   │
│  │           │                                                             │   │
│  │           │ OpenCode Plugin API                                         │   │
│  │           ▼                                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          ▲                                                  │
│                          │                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                 opencode-global-config                               │   │
│  │              https://github.com/coniferconcepts/                    │   │
│  │                      opencode-global-config                         │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ORIGIN: Already separated                                          │   │
│  │  PURPOSE: Hook interfaces and global configuration                  │   │
│  │  LICENSE: MIT                                                       │   │
│  │  DISTRIBUTION: Git submodules                                       │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │   │
│  │  │  Hook Types     │  │  Agent Config    │  │  Documentation  │    │   │
│  │  │  Interfaces     │  │  Templates       │  │  & Templates    │    │   │
│  │  └─────────────────┘  └──────────────────┘  └─────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Dependency Flow

```
                          ┌────────────────────────┐
                          │    content-tracker     │
                          │   (Consumer Project)   │
                          └───────────┬────────────┘
                                      │ Uses via
                                      │ Git Submodules
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
        ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
        │opencode-global-  │ │ opencode-    │ │ claude-mem-      │
        │config            │ │ memory-      │ │ source           │
        │                  │ │ bridge       │ │                  │
        ├──────────────────┤ ├──────────────┤ ├──────────────────┤
        │Hook interfaces   │ │OpenCode hooks│ │Core memory      │
        │Reference only    │ │Depends on    │ │service          │
        │                  │ │claude-mem    │ │                  │
        └──────────────────┘ └──────┬───────┘ └──────────┬───────┘
                                    │                    │
                                    │ Uses via HTTP API  │
                                    ▼                    │
                          ┌──────────────────┐          │
                          │  Memory Service  │          │
                          │  (Port 37777)    │◀─────────┘
                          └──────────────────┘
```

## Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   OpenCode   │────▶│  Memory Bridge   │────▶│  Claude Mem      │
│   Editor     │     │  (Hooks)         │     │  Service         │
└──────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                              ┌───────────────────────────┼───────────┐
                              │                           │           │
                              ▼                           ▼           ▼
                    ┌──────────────────┐      ┌──────────────────┐  ┌──────────┐
                    │  SQLite          │      │  ChromaDB        │  │  MCP     │
                    │  (Persistent     │      │  (Vector         │  │  Server  │
                    │   Storage)       │      │   Search)        │  │          │
                    └──────────────────┘      └──────────────────┘  └──────────┘
```

## Repository Relationships

### 1. claude-mem-source
**Role**: Core Service
- **Inputs**: HTTP API requests
- **Outputs**: Memory data, search results
- **Dependencies**: None (leaf node)
- **Upstream**: thedotmack/claude-mem

### 2. opencode-memory-bridge
**Role**: Integration Layer
- **Inputs**: OpenCode hooks, user interactions
- **Outputs**: HTTP requests to claude-mem-source
- **Dependencies**: claude-mem-source (runtime)
- **Distribution**: Git submodule

### 3. opencode-global-config
**Role**: Interface Definitions
- **Inputs**: None (reference only)
- **Outputs**: Type definitions, documentation
- **Dependencies**: None (reference only)
- **Relationship**: Referenced by opencode-memory-bridge

## Git Submodule Distribution

```bash
# In content-tracker (or any consuming project)
.
├── .claude/
│   └── plugins/
│       └── claude-mem/          # Git submodule: claude-mem-source
├── packages/
│   └── memory-plugin/           # Git submodule: opencode-memory-bridge
└── opencode-global-config/      # Git submodule: opencode-global-config
```

### Installation Commands

```bash
# Add claude-mem-source
git submodule add \
  https://github.com/coniferconcepts/claude-mem-source.git \
  .claude/plugins/claude-mem

# Add opencode-memory-bridge
git submodule add \
  https://github.com/coniferconcepts/opencode-memory-bridge.git \
  packages/memory-plugin

# Add opencode-global-config (if not already present)
git submodule add \
  https://github.com/coniferconcepts/opencode-global-config.git \
  opencode-global-config

# Initialize all submodules
git submodule update --init --recursive
```

## API Contracts

### HTTP API (claude-mem-source)
- **Port**: 37777
- **Protocol**: HTTP/REST
- **Endpoints**:
  - `POST /memory/store` - Store memory
  - `GET /memory/search?q={query}` - Search memories
  - `GET /memory/{id}` - Get specific memory
  - `DELETE /memory/{id}` - Delete memory
  - `GET /health` - Health check

### OpenCode Hooks (opencode-memory-bridge)
- **onStart(context)**: Initialize memory bridge
- **onMessage(message, context)**: Process message, extract memory
- **onExit(context)**: Cleanup and final storage

## Versioning Strategy

Each repository uses independent git tag-based versioning:

| Repository | Current | Tag Format | Example |
|------------|---------|------------|---------|
| claude-mem-source | (tracks upstream) | `v{major}.{minor}.{patch}` | `v9.0.12` |
| opencode-memory-bridge | (extracted) | `v{major}.{minor}.{patch}` | `v1.0.0` |
| opencode-global-config | (existing) | `v{major}.{minor}.{patch}` | `v2.1.0` |

## CI/CD Integration

### Repository 1: claude-mem-source
- Tests core memory service
- Syncs with upstream automatically
- Validates patches don't break functionality

### Repository 2: opencode-memory-bridge
- Tests OpenCode hook integration
- Validates HTTP client functionality
- Tests against mock memory service

### Repository 3: opencode-global-config
- Validates hook type definitions
- Tests configuration templates
- Documentation linting

### Consuming Project (content-tracker)
- Integration tests with all submodules
- E2E tests with real memory service
- Submodule update validation

## Security Considerations

- **License Compatibility**: AGPL-3.0 (claude-mem) + MIT (bridge/config)
- **No Secrets**: All repos are public, no credentials stored
- **HTTP Only**: Internal service communication (localhost only)
- **Submodule Integrity**: Use commit SHAs for reproducibility

## Future Considerations

- **npm Alternative**: Could add npm publishing later if needed
- **Monorepo Tooling**: Could use tools like Rush or Nx if complexity grows
- **Docker**: Could containerize claude-mem-service for easier deployment
- **Version Pinning**: Currently manual via commit SHAs, could automate

---

**Last Updated**: 2026-02-02
**Architecture Version**: 1.0
**Document**: ADR-001-Repository-Separation
