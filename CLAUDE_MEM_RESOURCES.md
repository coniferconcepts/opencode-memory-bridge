# Claude Mem Documentation Resources

## Official Claude Mem Documentation

This document provides quick access to all essential Claude Mem documentation resources for development, implementation, and maintenance.

---

## Primary Documentation Sources

### 1. Documentation Index (llms.txt)
**URL:** `https://docs.claude-mem.ai/llms.txt`

**Description:**  
Complete index of all documentation pages available for Claude Mem. This is the best starting point for navigating the documentation.

**Contents:**
- Architecture documents (evolution, database, hooks, worker service)
- Configuration and development guides
- Usage guides and workflows
- Integration guides (Cursor, VS Code)
- Troubleshooting and best practices

**Use Cases:**
- Find specific documentation topics
- Understand documentation structure
- Navigate to relevant guides

---

### 2. Complete Documentation (llms-full.txt)
**URL:** `https://docs.claude-mem.ai/llms-full.txt`

**Description:**  
Comprehensive documentation content (~350KB) containing all guides, architecture documents, and implementation details in a single file.

**Contents:**
- Architecture Evolution (v1-v5+)
- Database Architecture (SQLite, FTS5, Chroma)
- Hook Lifecycle documentation
- Worker Service implementation
- Platform Integration Guide
- Configuration and troubleshooting

**Use Cases:**
- Offline reference
- Full-text search across all docs
- Complete implementation details
- Offline development work

---

### 3. Hooks Architecture
**URL:** `https://docs.claude-mem.ai/hooks-architecture`

**Description:**  
Complete technical guide to the 5-stage memory agent lifecycle for platform implementers.

**Key Sections:**
- Pre-Hook: Smart Install (dependency management)
- Hook 1: SessionStart - Context Injection
- Hook 2: SessionStart - User Message
- Hook 3: UserPromptSubmit (New Session Hook)
- Hook 4: PostToolUse (Save Observation Hook)
- Hook 5: Stop (Summary Generation)
- Hook 6: SessionEnd (Cleanup Hook)

**Use Cases:**
- Implementing hooks in other platforms
- Understanding hook timing and execution
- Hook debugging and troubleshooting
- Performance optimization

---

### 4. Platform Integration Guide
**URL:** `https://docs.claude-mem.ai/platform-integration`

**Description:**  
Complete reference for integrating claude-mem worker service into VSCode extensions, IDE plugins, and CLI tools.

**Key Topics:**
- HTTP API endpoints
- MCP (Model Context Protocol) integration
- Two-process architecture
- VS Code Extension API integration points
- Async processing pipeline
- Error handling and retry logic

**Use Cases:**
- Building bridges for other platforms
- Understanding worker communication
- Integration pattern reference
- Cross-platform implementation

---

## Architecture Documentation

### Architecture Evolution
**URL:** `https://docs.claude-mem.ai/architecture-evolution`

**Description:**  
How claude-mem evolved from v3 to v5+, including key architectural decisions and lessons learned.

**Key Insights:**
- Progressive disclosure philosophy
- Session state management lessons
- Graceful vs aggressive cleanup patterns
- AI as the compressor (semantic understanding)
- One session, not many (streaming input mode)

**Use Cases:**
- Understanding design decisions
- Learning from past mistakes
- Architecture pattern reference
- Migration planning

---

### Database Architecture
**URL:** `https://docs.claude-mem.ai/architecture/database`

**Description:**  
SQLite schema, FTS5 search implementation, and data storage architecture.

**Key Topics:**
- Database location and configuration
- Core tables (sdk_sessions, observations, session_summaries, user_prompts)
- FTS5 virtual tables for full-text search
- Automatic synchronization triggers
- Security (SQL injection prevention)
- Performance considerations

**Use Cases:**
- Database schema reference
- Query optimization
- Migration planning
- Custom search implementations

---

### Worker Service
**URL:** `https://docs.claude-mem.ai/architecture/worker-service`

**Description:**  
HTTP API and Bun process management for the background worker.

**Key Topics:**
- Express server architecture
- HTTP endpoints
- Bun process management
- Real-time updates via SSE
- Health checks and monitoring

**Use Cases:**
- Worker service implementation
- API endpoint reference
- Process management patterns
- Health monitoring setup

---

## Development & Configuration

### Development Guide
**URL:** `https://docs.claude-mem.ai/development`

**Description:**  
Build from source, run tests, and contribute to Claude-Mem.

**Contents:**
- Development setup
- Build process
- Testing procedures
- Contribution guidelines

---

### Configuration
**URL:** `https://docs.claude-mem.ai/configuration`

**Description:**  
Environment variables and settings for Claude-Mem.

**Contents:**
- Environment variables
- Configuration files
- Settings reference
- Feature flags

---

### Context Engineering
**URL:** `https://docs.claude-mem.ai/context-engineering`

**Description:**  
Best practices for curating optimal token sets for AI agents.

**Key Concepts:**
- Token budget management
- Progressive disclosure
- Relevance scoring
- Context optimization

---

### Troubleshooting
**URL:** `https://docs.claude-mem.ai/troubleshooting`

**Description:**  
Common issues and solutions for Claude-Mem.

**Topics:**
- Database issues
- Worker service problems
- Hook failures
- Performance issues
- Installation problems

---

## Integration Guides

### Cursor Integration
**URL:** `https://docs.claude-mem.ai/cursor/`

**Description:**  
Persistent AI memory for Cursor IDE with free tier options.

**Variants:**
- Gemini Setup (free tier)
- OpenRouter Setup (100+ models)

---

### Claude Desktop MCP
**URL:** `https://docs.claude-mem.ai/usage/claude-desktop`

**Description:**  
Use claude-mem memory search in Claude Desktop with MCP tools.

---

## Usage Guides

### Getting Started
**URL:** `https://docs.claude-mem.ai/usage/getting-started`

**Description:**  
Learn how Claude-Mem works automatically in the background.

---

### Memory Search
**URL:** `https://docs.claude-mem.ai/usage/search-tools`

**Description:**  
Search your project history with MCP tools.

---

### Private Tags
**URL:** `https://docs.claude-mem.ai/usage/private-tags`

**Description:**  
Control what gets stored in memory with privacy tags.

---

### Memory Export/Import
**URL:** `https://docs.claude-mem.ai/usage/export-import`

**Description:**  
Share knowledge across claude-mem installations with duplicate prevention.

---

### Manual Recovery
**URL:** `https://docs.claude-mem.ai/usage/manual-recovery`

**Description:**  
Recover stuck observations after worker crashes or restarts.

---

## Advanced Topics

### Endless Mode (Beta)
**URL:** `https://docs.claude-mem.ai/endless-mode`

**Description:**  
Experimental biomimetic memory architecture for extended sessions.

---

### Beta Features
**URL:** `https://docs.claude-mem.ai/beta-features`

**Description:**  
Try experimental features before they're released.

---

## Quick Reference

### Essential URLs for Development

| Purpose | URL | Priority |
|---------|-----|----------|
| Documentation Index | `https://docs.claude-mem.ai/llms.txt` | High |
| Complete Documentation | `https://docs.claude-mem.ai/llms-full.txt` | High |
| Hooks Architecture | `https://docs.claude-mem.ai/hooks-architecture` | Critical |
| Platform Integration | `https://docs.claude-mem.ai/platform-integration` | Critical |
| Database Architecture | `https://docs.claude-mem.ai/architecture/database` | High |
| Worker Service | `https://docs.claude-mem.ai/architecture/worker-service` | Medium |
| Troubleshooting | `https://docs.claude-mem.ai/troubleshooting` | Medium |

### Repository References

- **Original Upstream:** `https://github.com/thedotmack/claude-mem`
- **Documentation Site:** `https://docs.claude-mem.ai/`
- **License:** AGPL-3.0
- **Current Version:** v9.0.12 (as of 2026-02-01)

---

## Usage Guidelines

### For Developers

1. **Start Here:** Read `llms.txt` to understand documentation structure
2. **Deep Dive:** Use `llms-full.txt` for complete implementation details
3. **Hook Implementation:** Reference `hooks-architecture` for hook patterns
4. **Integration:** Use `platform-integration` for bridge development
5. **Troubleshooting:** Check `troubleshooting` when issues arise

### For Users

1. **Getting Started:** Start with `usage/getting-started`
2. **Configuration:** Review `configuration` for settings
3. **Search:** Learn `usage/search-tools` for memory retrieval
4. **Privacy:** Understand `usage/private-tags` for sensitive data

---

## Document Information

**Created:** 2026-02-01  
**Purpose:** Centralized resource reference for Claude Mem development  
**Maintainer:** Development Team  
**Update Frequency:** As needed when new resources become available

---

*All URLs and documentation references are based on the official Claude Mem documentation at docs.claude-mem.ai.*