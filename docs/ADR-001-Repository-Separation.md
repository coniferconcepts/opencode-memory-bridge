# ADR-001: Repository Separation for Claude Mem Architecture

## Status

Accepted

## Context

The content-tracker repository currently contains three distinct concerns mixed together:

1. **Original Claude Mem Plugin** (`.claude/plugins/claude-mem/`)
   - Third-party plugin by thedotmack (Alex Newman)
   - Version 9.0.12, AGPL-3.0 license
   - Worker service on port 37777
   - Should track upstream updates

2. **OpenCode Memory Bridge** (`packages/memory-plugin/`)
   - Our custom integration (11,000+ lines)
   - Implements OpenCode hooks
   - ZEN-native extraction
   - Should be reusable by any OpenCode project

3. **Global Config Integration** (already separated in `opencode-global-config`)
   - Hook interface definitions
   - Documentation and templates
   - Memory-bridge agent

This mixing creates several operational issues:
- Difficult to track upstream changes to Claude Mem
- Bridge code cannot be reused in other projects
- Testing is complex due to mixed concerns
- Versioning is monolithic and inflexible
- Contributors are confused about which code to modify

## Decision

We will separate the mixed concerns into three distinct repositories:

### Repository 1: claude-mem-source
- **Purpose**: Fork of thedotmack/claude-mem with upstream tracking
- **License**: AGPL-3.0 (inherited from upstream)
- **Distribution**: Git submodules
- **Responsibility**: Core memory service (worker, SQLite, ChromaDB)
- **Upstream**: https://github.com/thedotmack/claude-mem

### Repository 2: opencode-memory-bridge
- **Purpose**: OpenCode plugin integrating with claude-mem-source
- **License**: MIT (our custom code)
- **Distribution**: Git submodules
- **Responsibility**: OpenCode hooks, ZEN extraction, memory operations
- **Dependency**: claude-mem-source (via git submodule)

### Repository 3: opencode-global-config
- **Purpose**: Hook interfaces and global configuration
- **License**: MIT
- **Distribution**: Git submodules (already distributed this way)
- **Responsibility**: Hook definitions, agent templates, documentation
- **Dependency**: opencode-memory-bridge (reference only)

## Distribution Strategy

**Primary Method**: Git Submodules

```bash
# In consuming project
git submodule add https://github.com/coniferconcepts/claude-mem-source.git .claude/plugins/claude-mem
git submodule add https://github.com/coniferconcepts/opencode-memory-bridge.git packages/memory-plugin
```

**Alternative Methods**:
- GitHub tarball references in package.json
- Local file paths for development

**Rationale for Git Submodules over npm**:
1. **Privacy**: No need for public npm registry or paid private npm
2. **Control**: Full control over versioning via git tags and commits
3. **Simplicity**: Works with existing git workflows
4. **Cost**: Free, no npm organization fees
5. **Flexibility**: Easy to modify and test locally

## Consequences

### Positive
- Clean upstream tracking with `git fetch upstream`
- Bridge can be reused in any OpenCode project via git submodule
- Independent testing and CI/CD for each component
- Independent semantic versioning via git tags
- Clear contribution paths per repository
- Targeted releases per component

### Negative
- More complex initial setup (git submodules)
- Team needs to learn git submodule workflows
- No npm ecosystem features (semver resolution, automatic updates)
- Slightly more complex CI/CD with submodules

### Mitigations
- Document git submodule workflow thoroughly
- Provide helper scripts for common operations
- Use git tags for versioning instead of npm semver
- Configure CI/CD to handle submodules properly

## Alternatives Considered

### Alternative 1: npm Private Registry
- **Pros**: Familiar workflow, semver, ecosystem integration
- **Cons**: Costs $7/user/month, requires publishing process
- **Decision**: Rejected due to cost and unnecessary complexity

### Alternative 2: npm GitHub References
- **Pros**: No cost, uses npm install
- **Cons**: Still couples to npm, less control than submodules
- **Decision**: Rejected in favor of direct git submodules

### Alternative 3: Monorepo (Keep Current)
- **Pros**: No migration needed, simple setup
- **Cons**: Doesn't solve upstream tracking, reusability, or separation of concerns
- **Decision**: Rejected - doesn't address core problems

## Implementation Timeline

**Phase 1** (Week 1): Create repositories and documentation
**Phase 2** (Week 2): Extract opencode-memory-bridge from content-tracker
**Phase 3** (Week 3): Setup claude-mem-source with patches
**Phase 4** (Week 4): Migrate content-tracker to use submodules
**Phase 5** (Week 5): Update CI/CD and testing
**Phase 6** (Week 6): Documentation and cleanup

## References

- [CLAUDE_MEM_SEPARATION_PROJECT_PLAN.md](./CLAUDE_MEM_SEPARATION_PROJECT_PLAN.md)
- [PRIVATE_DISTRIBUTION_OPTIONS.md](./PRIVATE_DISTRIBUTION_OPTIONS.md)
- [GIT_SUBMODULE_INTEGRATION_SUMMARY.md](./GIT_SUBMODULE_INTEGRATION_SUMMARY.md)
- Original upstream: https://github.com/thedotmack/claude-mem

## Decision Date

2026-02-02

## Decision Makers

Conifer Concepts Development Team

---

**Template**: Adapted from [ADR Template by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
