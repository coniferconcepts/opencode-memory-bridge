# Project Plan: Claude Mem Architecture Separation

## Executive Summary

**Project Objective:** Separate the mixed Claude Mem components in content-tracker into three distinct, maintainable repositories with clear responsibilities and independent release cycles.

**Current State:** All components mixed in content-tracker repo
**Target State:** 3 separate repos with clean boundaries
**Timeline:** 4-6 weeks
**Team Size:** 1-2 developers
**Risk Level:** Low to Medium

---

## Background & Context

### Current Architecture Problem

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

### Why Separation is Needed

| Issue | Current State | After Separation |
|-------|---------------|------------------|
| **Upstream Sync** | Manual comparison of mixed files | Clean fork with `git fetch upstream` |
| **Reusability** | Bridge trapped in one project | Any project: `npm install @opencode/memory-plugin` |
| **Testing** | Hard to test components independently | Each repo has independent CI/CD |
| **Versioning** | All components version-locked | Independent semantic versioning |
| **Contributions** | Mixed concerns confuse contributors | Clear contribution paths per repo |
| **Release Cycle** | Monolithic releases | Targeted releases per component |

---

## Project Scope

### In Scope

✅ **Repository 1: claude-mem-source**
- Fork of thedotmack/claude-mem
- Setup upstream tracking
- Document sync process
- Apply current customizations as patches

✅ **Repository 2: opencode-memory-bridge**
- Extract from packages/memory-plugin/
- Setup as standalone git repository
- Configure for git submodule distribution (not npm)
- Maintain all tests and benchmarks
- Tag versions for release tracking

✅ **Repository 3: opencode-global-config (Update)**
- Already exists with hook interfaces
- Add references to new repos
- Update documentation with installation instructions

✅ **Repository 4: content-tracker (Migration)**
- Remove packages/memory-plugin/
- Add opencode-memory-bridge as git submodule (replaces npm dependency)
- Add claude-mem-source as git submodule
- Update documentation and imports
- Configure git submodule workflow
- Update CI/CD to handle submodules

### Out of Scope

❌ Forking to a new organization (keep under coniferconcepts)
❌ Rewriting core Claude Mem functionality
❌ Changing the HTTP API between bridge and service
❌ Adding new features (this is a refactoring project)
❌ Migrating data or databases

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPO 1: claude-mem-source                    │
│              https://github.com/coniferconcepts/                │
│                        claude-mem-source                        │
├─────────────────────────────────────────────────────────────────┤
│  ORIGIN: Fork of thedotmack/claude-mem                          │
│  PURPOSE: Core memory service (worker, SQLite, Chroma)         │
│  VERSION: 9.0.12 → tracks upstream                              │
│  LICENSE: AGPL-3.0 (inherited)                                  │
│  MAINTENANCE: Sync monthly from upstream                        │
├─────────────────────────────────────────────────────────────────┤
│  INSTALLATION:                                                  │
│  • Git submodule in projects using it                           │
│  • Or manual clone to ~/.claude/plugins/                        │
│  • Runs on port 37777                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API (port 37777)
                              │ Protocol: REST + SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPO 2: opencode-memory-bridge                     │
│              https://github.com/coniferconcepts/                │
│                    opencode-memory-bridge                       │
├─────────────────────────────────────────────────────────────────┤
│  ORIGIN: Extracted from content-tracker/packages/memory-plugin/│
│  PURPOSE: OpenCode plugin bridge to claude-mem service         │
│  PACKAGE: @opencode/memory-plugin (git-based, not npm)         │
│  VERSION: Independent semantic versioning via git tags         │
│  LICENSE: MIT (our code)                                        │
│  MAINTENANCE: Feature development, bug fixes, releases         │
├─────────────────────────────────────────────────────────────────┤
│  INSTALLATION:                                                  │
│  • Git submodule (recommended):                                │
│    git submodule add github.com/coniferconcepts/...            │
│  • Or: github: reference in package.json                       │
│  • Or: file: reference for local development                   │
├─────────────────────────────────────────────────────────────────┤
│  DEPENDENCIES:                                                  │
│  • Runtime: claude-mem-source (running on port 37777)          │
│  • Dev: @opencode-ai/plugin, @types/node, vitest, etc.         │
│  • Uses types from opencode-global-config                      │
│  • Distribution: Git submodules (NOT npm registry)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Implements
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPO 3: opencode-global-config (EXISTING)         │
│              https://github.com/coniferconcepts/                │
│                    opencode-global-config                       │
├─────────────────────────────────────────────────────────────────┤
│  PURPOSE: Hook interfaces, documentation, templates            │
│  ROLE: Single source of truth for hook types                   │
│  USAGE: Imported by bridge and any custom hook implementations │
└─────────────────────────────────────────────────────────────────┘
```

---

## Distribution Strategy: Git Submodules (Not npm)

### Decision Rationale

**Why Git Submodules Instead of npm:**

After evaluating all distribution options (documented in PRIVATE_DISTRIBUTION_OPTIONS.md), we selected **git submodules** as the primary distribution method for the following reasons:

1. **Privacy**: No need to publish to public npm registry
2. **Control**: Full control over versioning via git tags/commits
3. **Simplicity**: Works with existing git workflows
4. **Cost**: Free, no npm organization fees
5. **Flexibility**: Easy to modify and test locally
6. **Team Familiarity**: Team already uses git extensively

### Installation Methods

**Method 1: Git Submodules (Primary)**
```bash
git submodule add \
  https://github.com/coniferconcepts/opencode-memory-bridge.git \
  packages/memory-plugin

git submodule init
git submodule update
```

**package.json:**
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin"
  }
}
```

**Method 2: GitHub Reference (Alternative)**
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "github:coniferconcepts/opencode-memory-bridge#v3.2.0"
  }
}
```

**Method 3: Local Path (Development)**
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:../opencode-memory-bridge"
  }
}
```

### Version Management

Instead of npm semver, we use:

- **Git Tags**: `v3.2.0`, `v3.2.1`, etc.
- **Commit SHAs**: Pin to specific commits for reproducibility
- **Branches**: `main` for stable, `develop` for integration

### When to Use npm Instead

This project intentionally avoids npm publishing, but you could add it later if:
- You want to share with external community
- You need npm's ecosystem features (semver resolution, etc.)
- You're comfortable with public or paid private npm

See PRIVATE_DISTRIBUTION_OPTIONS.md for detailed npm alternatives if needed.

---

## Detailed Phase Plan

### Phase 1: Preparation & Setup (Week 1)

**Duration:** 5 working days
**Deliverables:** 3 new GitHub repositories created and configured

#### Task 1.1: Create GitHub Repositories

**Assignee:** Lead Developer
**Effort:** 4 hours
**Dependencies:** None

**Steps:**
1. ✅ Create `coniferconcepts/claude-mem-source`
   - Initialize with README
   - Add LICENSE (AGPL-3.0, inherited from upstream)
   - Setup branch protection (main requires PR)
   - Enable GitHub Actions

2. ✅ Create `coniferconcepts/opencode-memory-bridge`
   - Initialize with README
   - Add LICENSE (MIT for our code)
   - Setup branch protection
   - Enable GitHub Actions
   - Configure git tag-based versioning

3. ✅ Update `coniferconcepts/opencode-global-config`
   - Add references to new repos in README
   - Ensure CI/CD is functional

**Deliverables:**
- [ ] Two new GitHub repos created and configured
- [ ] Repository settings documented
- [ ] Team access permissions set

#### Task 1.2: Document Architecture Decision

**Assignee:** Lead Developer
**Effort:** 4 hours
**Dependencies:** Task 1.1

**Steps:**
1. Write Architecture Decision Record (ADR)
   - Document why separation is needed
   - Document chosen architecture
   - Document alternatives considered
   - Document risks and mitigations

2. Create project README templates for each repo
   - Clear purpose statement
   - Installation instructions
   - Link to related repos

3. Document dependency relationships
   - Create architecture diagram
   - Document API contracts
   - Document versioning strategy

**Deliverables:**
- [ ] ADR-001: Repository Separation (in opencode-global-config)
- [ ] README.md for claude-mem-source
- [ ] README.md for opencode-memory-bridge
- [ ] Architecture diagram (PNG/SVG)

#### Task 1.3: Setup Development Environments

**Assignee:** Developer
**Effort:** 6 hours
**Dependencies:** Task 1.1

**Steps:**
1. Clone all three repos locally
2. Setup branch naming conventions
   - `main`: Production-ready
   - `develop`: Integration branch
   - `feature/*`: Feature branches
   - `hotfix/*`: Emergency fixes

3. Configure git hooks for code quality
   - Pre-commit linting
   - Commit message validation

4. Test CI/CD pipelines
   - Push test commits
   - Verify GitHub Actions trigger

**Deliverables:**
- [ ] Local dev environments setup
- [ ] Branch strategy documented
- [ ] CI/CD tested and working

**Checkpoint 1:** End of Week 1
- ✅ Repositories created
- ✅ Documentation drafted
- ✅ Dev environments ready

---

### Phase 2: Extract & Setup claude-mem-source (Week 2)

**Duration:** 5 working days
**Deliverables:** Working fork with upstream sync capability

#### Task 2.1: Fork Original Claude Mem

**Assignee:** Lead Developer
**Effort:** 4 hours
**Dependencies:** Phase 1 complete

**Steps:**
1. Fork thedotmack/claude-mem to coniferconcepts/claude-mem-source
   ```bash
   git clone https://github.com/thedotmack/claude-mem.git
   cd claude-mem
   git remote rename origin upstream
   git remote add origin https://github.com/coniferconcepts/claude-mem-source.git
   git push -u origin main
   ```

2. Verify fork integrity
   - Compare file structure
   - Verify all files present
   - Check git history preserved

3. Add sync documentation
   ```bash
   cat > SYNC.md << 'EOF'
   # Upstream Sync Process
   
   ## Monthly Sync
   1. Fetch upstream changes: `git fetch upstream`
   2. Review changes: `git log upstream/main --oneline -20`
   3. Create sync branch: `git checkout -b sync/upstream-$(date +%Y%m%d)`
   4. Merge upstream: `git merge upstream/main`
   5. Resolve any conflicts
   6. Test locally
   7. Create PR to main
   
   ## Emergency Sync
   - For critical upstream fixes
   - Same process, expedited review
   EOF
   ```

**Deliverables:**
- [ ] Fork created and pushed
- [ ] Upstream remote configured
- [ ] SYNC.md documentation
- [ ] Fork integrity verified

#### Task 2.2: Apply Current Customizations

**Assignee:** Developer
**Effort:** 8 hours
**Dependencies:** Task 2.1

**Steps:**
1. Compare current `.claude/plugins/claude-mem/` with fork
   ```bash
   diff -r /content-tracker/.claude/plugins/claude-mem/ \
            ./claude-mem-source/
   ```

2. Identify all modifications
   - Configuration changes
   - Custom patches
   - Added features
   - Bug fixes

3. Create patches directory
   ```
   patches/
   ├── 001-config-location.patch
   ├── 002-custom-worker-port.patch
   └── README.md
   ```

4. Apply each patch as separate commit
   ```bash
   git checkout -b apply-patches
   git am < patches/001-*.patch
   git am < patches/002-*.patch
   git push origin apply-patches
   ```

5. Document each patch
   - Why it was needed
   - What it changes
   - Whether it should be upstreamed

**Deliverables:**
- [ ] All customizations identified
- [ ] Patches directory with documented patches
- [ ] Patches applied to fork
- [ ] PATCHES.md with full documentation

#### Task 2.3: Setup CI/CD for Fork

**Assignee:** Developer
**Effort:** 6 hours
**Dependencies:** Task 2.2

**Steps:**
1. Create GitHub Actions workflow
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v1
         - run: bun install
         - run: bun test
   ```

2. Add upstream sync workflow (monthly)
   ```yaml
   # .github/workflows/sync-upstream.yml
   name: Sync Upstream
   on:
     schedule:
       - cron: '0 0 1 * *'  # Monthly
     workflow_dispatch:
   ```

3. Test CI/CD with sample push

**Deliverables:**
- [ ] CI workflow running
- [ ] Test suite passing
- [ ] Upstream sync workflow configured
- [ ] Build artifacts working

#### Task 2.4: Create Installation Guide

**Assignee:** Technical Writer
**Effort:** 4 hours
**Dependencies:** Task 2.3

**Steps:**
1. Write installation guide for different use cases:
   - As git submodule in OpenCode projects
   - As manual installation for Claude Code
   - As development setup

2. Document configuration options
   - Environment variables
   - Config file locations
   - Port settings

3. Document upgrade process
   - From upstream versions
   - With custom patches
   - Rollback procedures

**Deliverables:**
- [ ] INSTALL.md with full instructions
- [ ] Configuration reference
- [ ] Troubleshooting guide

**Checkpoint 2:** End of Week 2
- ✅ Fork created with upstream sync
- ✅ Custom patches applied
- ✅ CI/CD functional
- ✅ Installation documented

---

### Phase 3: Extract opencode-memory-bridge (Weeks 3-4)

**Duration:** 10 working days
**Deliverables:** Standalone npm package with full CI/CD

#### Task 3.1: Extract Code from Content-Tracker

**Assignee:** Lead Developer
**Effort:** 8 hours
**Dependencies:** Phase 2 complete

**Steps:**
1. Create clean extraction
   ```bash
   mkdir opencode-memory-bridge
   cd opencode-memory-bridge
   git init
   
   # Copy all relevant files
   cp -r /content-tracker/packages/memory-plugin/src .
   cp /content-tracker/packages/memory-plugin/package.json .
   cp /content-tracker/packages/memory-plugin/tsconfig.json .
   cp /content-tracker/packages/memory-plugin/README.md .
   cp /content-tracker/packages/memory-plugin/CHANGELOG.md .
   cp /content-tracker/packages/memory-plugin/MIGRATION_GUIDE.md .
   
   # Create new package.json
   cat > package.json << 'EOF'
   {
     "name": "@opencode/memory-plugin",
     "version": "3.2.0",
     "description": "OpenCode memory bridge plugin for Claude Mem",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "repository": {
       "type": "git",
       "url": "https://github.com/coniferconcepts/opencode-memory-bridge.git"
     },
     "dependencies": {
       "@opencode-ai/plugin": "^1.0.0"
     },
     "peerDependencies": {
       "claude-mem-source": ">=9.0.12"
     },
     "devDependencies": {
       "vitest": "^1.0.0",
       "typescript": "^5.0.0"
     }
   }
   EOF
   ```

2. Verify extraction completeness
   - Check all source files present
   - Check tests included
   - Check benchmarks included
   - Check documentation included

3. Initial commit
   ```bash
   git add .
   git commit -m "Initial extraction from content-tracker"
   git branch -M main
   git remote add origin https://github.com/coniferconcepts/opencode-memory-bridge.git
   git push -u origin main
   ```

**Deliverables:**
- [ ] All code extracted to new repo
- [ ] Initial commit pushed
- [ ] Extraction verified complete

#### Task 3.2: Update Imports and Dependencies

**Assignee:** Developer
**Effort:** 12 hours
**Dependencies:** Task 3.1

**Steps:**
1. Update package.json
   - Add proper npm package name: `@opencode/memory-plugin`
   - Set version to 3.2.0 (continue from current)
   - Add peer dependency on claude-mem-source
   - Add dependency on opencode-global-config types

2. Update all imports
   ```typescript
   // Before (in content-tracker)
   import { HookInterface } from '../../../universal/hooks/interface'
   
   // After (standalone)
   import { HookInterface } from '@coniferconcepts/opencode-global-config/universal/hooks'
   ```

3. Add TypeScript path mapping
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "@coniferconcepts/opencode-global-config/*": [
           "../opencode-global-config/*"
         ]
       }
     }
   }
   ```

4. Update references to claude-mem
   - Change hardcoded paths to use environment variables
   - Add configuration for service URL
   - Document the API contract

**Deliverables:**
- [ ] All imports updated
- [ ] package.json configured
- [ ] TypeScript compilation passing
- [ ] No broken references

#### Task 3.3: Setup Git Submodule Distribution (NOT npm)

**Assignee:** Developer
**Effort:** 4 hours
**Dependencies:** Task 3.2

**Rationale:** Using git submodules instead of npm publishing for private distribution. See PRIVATE_DISTRIBUTION_OPTIONS.md for alternatives comparison.

**Steps:**
1. Configure package.json for git-based installation
   ```json
   {
     "name": "@opencode/memory-plugin",
     "version": "3.2.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "repository": {
       "type": "git",
       "url": "https://github.com/coniferconcepts/opencode-memory-bridge.git"
     },
     "scripts": {
       "build": "tsc",
       "test": "vitest",
       "benchmark": "bun run src/__tests__/benchmarks/hook-performance.ts"
     }
   }
   ```

2. Create initial git tag for versioning
   ```bash
   git tag -a v3.2.0 -m "Initial extraction from content-tracker"
   git push origin v3.2.0
   ```

3. Document installation methods in README.md
   - Method 1: Git submodule (recommended)
   - Method 2: GitHub reference in package.json
   - Method 3: Local path for development

4. Create version release workflow (optional)
   ```yaml
   # .github/workflows/release.yml
   name: Create Release
   on:
     push:
       tags:
         - 'v*'
   jobs:
     release:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Create Release
           uses: actions/create-release@v1
           with:
             tag_name: ${{ github.ref }}
             release_name: Release ${{ github.ref }}
   ```

**Deliverables:**
- [ ] Package configured for git distribution
- [ ] Initial version tag created (v3.2.0)
- [ ] Installation methods documented
- [ ] Ready for submodule installation

#### Task 3.4: Setup Comprehensive CI/CD

**Assignee:** DevOps
**Effort:** 8 hours
**Dependencies:** Task 3.3

**Steps:**
1. Create CI workflow
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: oven-sh/setup-bun@v1
         
         - name: Install dependencies
           run: bun install
         
         - name: Type check
           run: bunx tsc --noEmit
         
         - name: Run tests
           run: bun test
         
         - name: Run benchmarks
           run: bun run benchmark:hooks
         
         - name: Build
           run: bun run build
   ```

2. Add test matrix (multiple Node/Bun versions)
   - Bun 1.0, 1.1
   - Node 18, 20 (for compatibility)

3. Add coverage reporting
   - Upload to Codecov
   - Fail if coverage drops

4. Add linting and formatting
   - Biome or ESLint
   - Prettier for formatting
   - Enforce in CI

**Deliverables:**
- [ ] CI workflow passing
- [ ] Test matrix configured
- [ ] Coverage reporting active
- [ ] Linting enforced

#### Task 3.5: Create Package Documentation

**Assignee:** Technical Writer
**Effort:** 8 hours
**Dependencies:** Task 3.4

**Steps:**
1. Update README.md
   - Clear installation: `npm install @opencode/memory-plugin`
   - Quick start guide
   - Configuration options
   - Link to global-config for hook types

2. Write API documentation
   - Document all exported functions
   - Document hook handlers
   - Document configuration interface

3. Create examples
   - Basic installation example
   - Custom configuration example
   - Integration with other plugins

4. Update CHANGELOG.md
   - Document v3.2.0 as first standalone release
   - List all changes from extraction
   - Migration notes from content-tracker

**Deliverables:**
- [ ] README.md complete
- [ ] API documentation
- [ ] Usage examples
- [ ] CHANGELOG.md updated

**Checkpoint 3:** End of Week 4
- ✅ Bridge extracted to standalone repo
- ✅ Git distribution configured (submodules, not npm)
- ✅ CI/CD comprehensive
- ✅ Documentation complete
- ✅ Package ready for git submodule installation

---

### Phase 4: Migrate Content-Tracker (Week 5)

**Duration:** 5 working days
**Deliverables:** Content-tracker using new package structure

#### Task 4.1: Remove Old Code

**Assignee:** Developer
**Effort:** 4 hours
**Dependencies:** Phase 3 complete

**Steps:**
1. Backup current state
   ```bash
   cd /content-tracker
   git checkout -b migration/remove-memory-plugin
   ```

2. Remove packages/memory-plugin/
   ```bash
   rm -rf packages/memory-plugin
   ```

3. Update root package.json
   ```json
   {
     "dependencies": {
       "@opencode/memory-plugin": "^3.2.0"
     }
   }
   ```

4. Remove .claude/plugins/claude-mem/
   ```bash
   rm -rf .claude/plugins/claude-mem
   ```

5. Commit removal
   ```bash
   git add .
   git commit -m "refactor: remove memory-plugin (moving to separate repo)"
   ```

**Deliverables:**
- [ ] Old code removed
- [ ] Committed to branch
- [ ] Backup created

#### Task 4.2: Add Git Submodules

**Assignee:** Developer
**Effort:** 4 hours
**Dependencies:** Task 4.1

**Steps:**
1. Add claude-mem-source as submodule
   ```bash
   git submodule add \
     https://github.com/coniferconcepts/claude-mem-source.git \
     .claude/plugins/claude-mem
   ```

2. Add opencode-global-config as submodule (if not already)
   ```bash
   git submodule add \
     https://github.com/coniferconcepts/opencode-global-config.git \
     .opencode/global-config
   ```

3. Configure .gitmodules
   ```ini
   [submodule ".claude/plugins/claude-mem"]
     path = .claude/plugins/claude-mem
     url = https://github.com/coniferconcepts/claude-mem-source.git
     branch = main
   
   [submodule ".opencode/global-config"]
     path = .opencode/global-config
     url = https://github.com/coniferconcepts/opencode-global-config.git
     branch = main
   ```

4. Initialize and update submodules
   ```bash
   git submodule init
   git submodule update
   ```

**Deliverables:**
- [ ] Submodules added
- [ ] .gitmodules configured
- [ ] Submodules initialized

#### Task 4.3: Install npm Package

**Assignee:** Developer
**Effort:** 2 hours
**Dependencies:** Task 4.2

**Steps:**
1. Install the package
   ```bash
   bun install @opencode/memory-plugin@3.2.0
   ```

2. Verify installation
   ```bash
   ls node_modules/@opencode/memory-plugin
   # Should see: dist/, src/, package.json, etc.
   ```

3. Update any scripts that reference old paths
   - Check package.json scripts
   - Check any build scripts
   - Check documentation references

**Deliverables:**
- [ ] Package installed
- [ ] node_modules verified
- [ ] Scripts updated

#### Task 4.4: Update Imports and Configuration

**Assignee:** Developer
**Effort:** 6 hours
**Dependencies:** Task 4.3

**Steps:**
1. Find all imports from old packages/memory-plugin/
   ```bash
   grep -r "packages/memory-plugin" --include="*.ts" --include="*.js" .
   ```

2. Update to new package imports
   ```typescript
   // Before
   import { ClaudeMemBridge } from '../packages/memory-plugin/src/index'
   
   // After
   import { ClaudeMemBridge } from '@opencode/memory-plugin'
   ```

3. Update configuration references
   - .oc/memory-config.json paths
   - Environment variable references
   - Documentation links

4. Update any hardcoded paths
   - Worker service path
   - Database path
   - Log file paths

**Deliverables:**
- [ ] All imports updated
- [ ] TypeScript compilation passing
- [ ] No broken references

#### Task 4.5: Test Full Integration

**Assignee:** QA/Developer
**Effort:** 8 hours
**Dependencies:** Task 4.4

**Steps:**
1. Run full test suite
   ```bash
   bun test
   ```

2. Test memory plugin specifically
   ```bash
   bun test --grep "memory"
   ```

3. Manual integration testing
   - Start a new OpenCode session
   - Verify hooks fire correctly
   - Verify observations captured
   - Verify context injection works

4. Test edge cases
   - Session stop detection
   - User messaging display
   - Smart install caching
   - Error handling

5. Performance benchmarks
   ```bash
   bun run benchmark:hooks
   ```

**Deliverables:**
- [ ] All tests passing
- [ ] Manual testing successful
- [ ] Performance verified
- [ ] No regressions

#### Task 4.6: Update Documentation

**Assignee:** Technical Writer
**Effort:** 4 hours
**Dependencies:** Task 4.5

**Steps:**
1. Update content-tracker README.md
   - Reference new npm package
   - Reference new submodules
   - Update installation instructions

2. Update CLAUDE.md
   - Document new architecture
   - Update references

3. Create migration notes
   - What changed
   - Why it changed
   - How to update existing code

4. Update any other documentation
   - docs/ folder
   - AGENTS.md
   - Any other markdown files

**Deliverables:**
- [ ] README.md updated
- [ ] CLAUDE.md updated
- [ ] Migration notes created
- [ ] All references updated

**Checkpoint 4:** End of Week 5
- ✅ Old code removed
- ✅ Submodules added
- ✅ npm package installed
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Content-tracker migrated

---

### Phase 5: Final Integration & Launch (Week 6)

**Duration:** 5 working days
**Deliverables:** Production-ready system

#### Task 5.1: Cross-Repository Testing

**Assignee:** QA Team
**Effort:** 12 hours
**Dependencies:** Phase 4 complete

**Steps:**
1. Test full stack integration
   - claude-mem-source running
   - opencode-memory-bridge installed
   - content-tracker using both
   - opencode-global-config providing types

2. Test in clean environment
   - Fresh clone of all repos
   - Follow installation docs exactly
   - Verify everything works

3. Test submodule updates
   - Update claude-mem-source
   - Verify content-tracker gets changes
   - Test rollback procedure

4. Test npm package updates
   - Publish test version
   - Update in content-tracker
   - Verify smooth upgrade

**Deliverables:**
- [ ] Full stack tested
- [ ] Clean environment tested
- [ ] Update procedures verified
- [ ] No integration issues

#### Task 5.2: Performance Validation

**Assignee:** Performance Engineer
**Effort:** 6 hours
**Dependencies:** Task 5.1

**Steps:**
1. Run comprehensive benchmarks
   - Before/after comparison
   - All hook execution times
   - Memory usage
   - Database performance

2. Compare with targets
   | Hook | Target | Must Meet |
   |------|--------|-----------|
   | session.created | <100ms | ✅ |
   | tool.execute.after | <20ms | ✅ |
   | message.created | <25ms | ✅ |
   | session.idle | <50ms | ✅ |

3. Document any regressions
   - Identify issues
   - Create tickets
   - Prioritize fixes

4. Create performance report
   - Baseline metrics
   - Improvements achieved
   - Monitoring recommendations

**Deliverables:**
- [ ] Benchmarks run
- [ ] Performance report
- [ ] No critical regressions
- [ ] Monitoring in place

#### Task 5.3: Security Audit

**Assignee:** Security Lead
**Effort:** 8 hours
**Dependencies:** Task 5.2

**Steps:**
1. Review all new code
   - Check for secrets/credentials
   - Check for injection vulnerabilities
   - Check for path traversal
   - Check for unsafe dependencies

2. Audit dependencies
   ```bash
   npm audit
   ```

3. Review access controls
   - Repository permissions
   - npm package access
   - Submodule access

4. Document security considerations
   - API authentication
   - Data privacy
   - Network security

**Deliverables:**
- [ ] Security audit report
- [ ] No critical vulnerabilities
- [ ] Dependencies updated
- [ ] Security documented

#### Task 5.4: Documentation Final Review

**Assignee:** Technical Writer
**Effort:** 8 hours
**Dependencies:** Task 5.3

**Steps:**
1. Review all documentation
   - README.md in each repo
   - Architecture Decision Records
   - Installation guides
   - API documentation

2. Verify cross-references
   - Links between repos work
   - Version references accurate
   - Examples are correct

3. Check for completeness
   - All features documented
   - All APIs documented
   - All edge cases covered

4. Get peer review
   - Have team member review docs
   - Incorporate feedback
   - Final polish

**Deliverables:**
- [ ] All docs reviewed
- [ ] Cross-references verified
- [ ] Peer review completed
- [ ] Docs published

#### Task 5.5: Create Release Announcements

**Assignee:** Product/Comms
**Effort:** 4 hours
**Dependencies:** Task 5.4

**Steps:**
1. Write release notes
   - What changed
   - Why it matters
   - How to upgrade
   - Breaking changes (none)

2. Create GitHub releases
   - claude-mem-source v9.0.12-fork-1
   - opencode-memory-bridge v3.2.0
   - Tag content-tracker migration commit

3. Announce to stakeholders
   - Team announcement
   - User documentation update
   - Support team briefing

4. Update project roadmaps
   - Mark separation complete
   - Update future plans

**Deliverables:**
- [ ] Release notes published
- [ ] GitHub releases created
- [ ] Stakeholders notified
- [ ] Roadmaps updated

**Final Checkpoint:** End of Week 6
- ✅ All testing complete
- ✅ Performance validated
- ✅ Security audited
- ✅ Documentation finalized
- ✅ Releases published
- ✅ System production-ready

---

## Project Timeline

```
Week 1: ████████░░░░░░░░░░░░ Phase 1: Preparation & Setup
Week 2: ░░████████░░░░░░░░░░ Phase 2: claude-mem-source Fork
Week 3: ░░░░████████░░░░░░░░ Phase 3: Bridge Extraction (Part 1)
Week 4: ░░░░░░████████░░░░░░ Phase 3: Bridge Extraction (Part 2)
Week 5: ░░░░░░░░████████░░░░ Phase 4: Content-Tracker Migration
Week 6: ░░░░░░░░░░████████░░ Phase 5: Integration & Launch

Total Duration: 6 weeks (30 working days)
Buffer: Week 6 has 2 days buffer for issues
```

---

## Resource Requirements

### Personnel

| Role | Effort | Responsibility |
|------|--------|----------------|
| **Lead Developer** | 80 hours | Architecture, complex tasks, code review |
| **Developer** | 120 hours | Implementation, testing, documentation |
| **DevOps Engineer** | 40 hours | CI/CD setup, git workflows, automation |
| **Technical Writer** | 40 hours | Documentation, guides, examples |
| **QA Engineer** | 32 hours | Testing, validation, bug reporting |
| **Security Lead** | 16 hours | Security audit, vulnerability assessment |

**Total: 328 hours (~8.5 person-weeks)**

### Tools & Infrastructure

- GitHub repositories (already available)
- Git submodules workflow
- CI/CD minutes (GitHub Actions)
- Test environments
- Documentation hosting (GitHub Pages optional)

### Budget Estimate

| Item | Cost | Notes |
|------|------|-------|
| Personnel | $15,000-25,000 | Contract rates for 6 weeks |
| Infrastructure | $50-100 | CI/CD, storage (no npm costs) |
| Tools | $0 | Using existing/free tools |
| **Total** | **~$15,100-25,200** | |

---

## Risk Assessment

### High Risk (Must Mitigate)

#### Risk 1: Data Loss During Migration
**Impact:** High | **Probability:** Low | **Risk Score:** 6/25

**Description:** Accidental deletion of important code or data during extraction.

**Mitigation:**
- ✅ Full git history backup before any changes
- ✅ Incremental migrations with verification at each step
- ✅ Read-only operations during extraction
- ✅ Rollback plan documented and tested

**Owner:** Lead Developer
**Review Date:** Weekly during migration

---

### Medium Risk (Should Monitor)

#### Risk 2: npm Package Publishing Issues
**Impact:** Medium | **Probability:** Medium | **Risk Score:** 9/25

**Description:** Problems with npm authentication, naming conflicts, or publishing failures.

**Mitigation:**
- ✅ Verify npm package name availability early
- ✅ Setup publishing with dry-run testing
- ✅ Use scoped package (@opencode/memory-plugin) to avoid conflicts
- ✅ Have manual publishing backup procedure

**Owner:** DevOps Engineer
**Review Date:** Week 3

---

#### Risk 3: Upstream Sync Breaks Custom Patches
**Impact:** Medium | **Probability:** Medium | **Risk Score:** 9/25

**Description:** New upstream version conflicts with our patches.

**Mitigation:**
- ✅ Document all patches with detailed rationale
- ✅ Create patch test suite
- ✅ Review upstream changes before merging
- ✅ Maintain patch branch separate from main

**Owner:** Lead Developer
**Review Date:** Before each upstream sync

---

#### Risk 4: Integration Testing Reveals Regressions
**Impact:** Medium | **Probability:** Medium | **Risk Score:** 9/25

**Description:** After separation, functionality doesn't work as expected.

**Mitigation:**
- ✅ Comprehensive test suite (1,189 tests)
- ✅ Manual integration testing checklist
- ✅ Performance benchmarks to catch regressions
- ✅ Staged rollout (dev → staging → prod)

**Owner:** QA Engineer
**Review Date:** End of Phase 4

---

### Low Risk (Acceptable)

#### Risk 5: Submodule Complexity Confuses Users
**Impact:** Low | **Probability:** Medium | **Risk Score:** 4/25

**Description:** Team members struggle with git submodules.

**Mitigation:**
- ✅ Document submodule workflow clearly
- ✅ Provide helper scripts
- ✅ Training session for team
- ✅ Consider alternatives if problematic

**Owner:** Technical Writer
**Review Date:** Week 5

---

#### Risk 6: Performance Degradation
**Impact:** Low | **Probability:** Low | **Risk Score:** 2/25

**Description:** Separated architecture performs worse than monolithic.

**Mitigation:**
- ✅ Performance benchmarks defined upfront
- ✅ No network calls added (still local HTTP)
- ✅ Same database and storage
- ✅ Monitoring in place

**Owner:** Performance Engineer
**Review Date:** Continuous

---

## Success Criteria

### Must Have (Critical Success Factors)

✅ **Criterion 1:** All 3 repositories created and functional
- claude-mem-source fork with upstream sync
- opencode-memory-bridge with npm publishing
- opencode-global-config updated with references

✅ **Criterion 2:** Content-tracker migrated successfully
- Old code removed cleanly
- New submodules working
- Git submodule installation functional
- All tests passing

✅ **Criterion 3:** No functionality regression
- All 1,189 tests passing
- Performance at or above targets
- Manual testing successful
- No critical bugs

✅ **Criterion 4:** Documentation complete
- Each repo has comprehensive README
- Installation guides tested
- API documentation accurate
- Architecture diagrams published

### Should Have (Important Success Factors)

🎯 **Criterion 5:** Git submodule installation tested and documented
- Submodule can be added to fresh project
- Installation documentation clear and tested
- Works with bun install / npm install
- Version pinning with git tags functional

🎯 **Criterion 6:** Upstream sync workflow functional
- Can sync from thedotmack/claude-mem
- Patches apply cleanly
- Automated monthly sync works

🎯 **Criterion 7:** CI/CD comprehensive
- All repos have CI pipelines
- Automated testing on PR
- Automated npm publishing on release
- Code coverage reporting

### Nice to Have (Bonus Success Factors)

⭐ **Criterion 8:** Community adoption
- Other projects using @opencode/memory-plugin
- Contributions from community
- Issues and discussions active

⭐ **Criterion 9:** Performance improvements
- Faster than monolithic version
- Reduced memory usage
- Better scalability

⭐ **Criterion 10:** Additional tooling
- Helper scripts for common tasks
- IDE integrations
- Monitoring dashboards

---

## Communication Plan

### Stakeholder Communication

| Stakeholder | Communication | Frequency | Method |
|-------------|---------------|-----------|--------|
| **Development Team** | Progress updates | Weekly | Standup + Slack |
| **Project Manager** | Status reports | Weekly | Email + Dashboard |
| **QA Team** | Test plans & results | Per phase | TestRail + Slack |
| **Security Team** | Audit schedule | Week 5 | Meeting + Report |
| **End Users** | Migration guide | Week 6 | Documentation |
| **Community** | Release notes | Week 6 | GitHub + Blog |

### Key Messages

**Week 1-2:** "Setting up foundation - creating repos and forking upstream"
**Week 3-4:** "Building the bridge - extracting and packaging the plugin"
**Week 5:** "Migration in progress - content-tracker being updated"
**Week 6:** "Launch complete - new architecture live and documented"

### Escalation Path

1. **Team Lead** - Day-to-day issues, task coordination
2. **Project Manager** - Scope changes, timeline issues
3. **Engineering Manager** - Resource allocation, technical decisions
4. **CTO** - Architecture changes, strategic decisions

---

## Quality Assurance

### Testing Strategy

#### Unit Tests
- All repos: 80%+ code coverage
- Critical paths: 100% coverage
- Run on every PR

#### Integration Tests
- End-to-end scenarios
- Cross-repo integration
- Run before releases

#### Performance Tests
- Hook execution times
- Memory usage
- Database queries
- Run weekly + on releases

#### Security Tests
- Dependency scanning
- Secret detection
- Vulnerability assessment
- Run on every PR

### Code Review Requirements

- All PRs require 1 approval
- Critical changes require 2 approvals
- Security changes require security lead approval
- Documentation changes require tech writer review

### Definition of Done

For each task:
- [ ] Code implemented
- [ ] Tests passing (unit + integration)
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] No security vulnerabilities
- [ ] Performance benchmarks meet targets
- [ ] Merged to main branch

---

## Post-Launch Support

### Week 7-8: Hypercare

- Daily monitoring of all systems
- Immediate response to issues
- Daily standup to review status
- Quick patches if needed

### Week 9-12: Stabilization

- Weekly monitoring
- Address any lingering issues
- Gather feedback from users
- Plan improvements

### Ongoing: Maintenance

- Monthly upstream sync (claude-mem-source)
- Quarterly releases (opencode-memory-bridge)
- Continuous documentation updates
- Community support

---

## Appendix A: Repository Structure Details

### Repo 1: claude-mem-source

```
claude-mem-source/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Test on push/PR
│       └── sync-upstream.yml   # Monthly upstream sync
├── src/
│   ├── hooks/                  # Original Claude Mem hooks
│   ├── services/               # Worker, SQLite, Chroma
│   └── ui/                     # Web viewer
├── plugin/                     # Compiled plugin
├── patches/                    # Our custom patches
│   ├── 001-*.patch
│   └── README.md
├── docs/                       # Documentation
├── tests/                      # Test suite
├── FORK.md                     # Fork explanation
├── SYNC.md                     # Upstream sync guide
├── PATCHES.md                  # Patch documentation
├── package.json                # v9.0.12
└── README.md
```

### Repo 2: opencode-memory-bridge

```
opencode-memory-bridge/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Full test suite
│       └── publish.yml         # npm publishing
├── src/
│   ├── index.ts                # Main plugin entry
│   ├── constants.ts            # Configuration
│   ├── manifest.ts             # Context injection
│   ├── outbox.ts               # Durable outbox
│   ├── summarization.ts        # Session summaries
│   ├── ingestor.ts             # Data ingestion
│   ├── zen-native.ts           # ZEN extraction
│   ├── utils/
│   │   ├── smart-install.ts    # Dependency mgmt
│   │   └── user-messaging.ts   # User notifications
│   └── __tests__/
│       ├── hook-lifecycle.test.ts
│       └── benchmarks/
│           └── hook-performance.ts
├── dist/                       # Compiled output
├── docs/
│   ├── API.md
│   └── EXAMPLES.md
├── package.json                # @opencode/memory-plugin v3.2.0
├── tsconfig.json
├── README.md
├── CHANGELOG.md
└── MIGRATION_GUIDE.md
```

### Repo 3: opencode-global-config (Updated)

```
opencode-global-config/
├── universal/
│   ├── hooks/
│   │   ├── interface.ts        # TypeScript definitions
│   │   └── index.ts
│   └── prompts/
│       └── agents/
│           └── memory-bridge.txt
├── templates/
│   └── hooks/
│       ├── session-lifecycle.ts
│       ├── tool-observation.ts
│       └── context-injection.ts
├── docs/
│   ├── architecture/
│   │   ├── hooks.md
│   │   └── claude-mem-integration.md  # NEW
│   └── guides/
│       └── writing-hooks.md
└── README.md                   # Updated with links
```

---

## Appendix B: Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-02-01 | Separate into 3 repos | Clear boundaries, independent releases | High |
| 2026-02-01 | Fork vs reimplement | Preserve upstream compatibility | High |
| 2026-02-01 | Git submodules for bridge | Reusability, versioning, private | High |
| 2026-02-01 | Git submodules | Track external dependencies | Medium |
| 2026-02-01 | Keep types in global-config | Single source of truth | Medium |

---

## Appendix C: Glossary

- **Claude Mem**: Original memory plugin by thedotmack
- **OpenCode**: The AI coding platform/IDE
- **Bridge**: Our OpenCode-specific integration code
- **Upstream**: Original thedotmack/claude-mem repository
- **Fork**: Our copy of claude-mem with tracking
- **Submodule**: Git mechanism for including other repos
- **Hook**: Lifecycle event handler (session.created, etc.)
- **Outbox**: Durable queue for observations
- **ZEN**: OpenCode's internal LLM dispatcher

---

## Appendix D: External Resources & References

### Official Claude Mem Documentation

**Essential Documentation Sources:**

1. **Claude Mem Documentation Index** (`llms.txt`)
   - URL: `https://docs.claude-mem.ai/llms.txt`
   - Description: Complete documentation index listing all available pages
   - Use: Starting point for understanding documentation structure
   - Update Frequency: Reflects current documentation state

2. **Claude Mem Full Documentation** (`llms-full.txt`)
   - URL: `https://docs.claude-mem.ai/llms-full.txt`
   - Description: Complete documentation content (~350KB) including:
     - Architecture evolution (v1-v5+)
     - Database architecture (SQLite, FTS5, Chroma)
     - Hook lifecycle documentation
     - Worker service implementation
     - Platform integration guide
     - Configuration and troubleshooting
   - Use: Primary reference for all implementation details
   - Update Frequency: Updated with each release

3. **Hooks Architecture Deep Dive**
   - URL: `https://docs.claude-mem.ai/hooks-architecture`
   - Description: Complete 5-stage memory agent lifecycle
   - Use: Essential for implementing hooks correctly
   - Key Sections:
     - Pre-hook: Smart Install
     - Hook 1: SessionStart - Context Injection
     - Hook 2: SessionStart - User Message
     - Hook 3: UserPromptSubmit
     - Hook 4: PostToolUse
     - Hook 5: Stop (Summary Generation)
     - Hook 6: SessionEnd (Cleanup)

4. **Platform Integration Guide**
   - URL: `https://docs.claude-mem.ai/platform-integration`
   - Description: Complete reference for integrating claude-mem worker service
   - Use: Critical for bridge development and worker communication
   - Key Topics:
     - HTTP API endpoints
     - MCP tool integration
     - VS Code extension patterns
     - Error handling strategies

### Key Documentation Topics

From the official documentation, these sections are most relevant to this project:

- **Architecture Evolution**: How claude-mem evolved from v3 to v5+ (design patterns)
- **Database Architecture**: SQLite schema, FTS5 search, Chroma vectors (storage layer)
- **Hook Lifecycle**: 5-stage memory agent lifecycle (implementation reference)
- **Worker Service**: HTTP API and Bun process management (service layer)
- **Configuration**: Environment variables and settings (deployment)
- **Troubleshooting**: Common issues and solutions (support)

### Repository References

- **Original Upstream**: `https://github.com/thedotmack/claude-mem`
- **Documentation Site**: `https://docs.claude-mem.ai/`
- **Current Version**: v9.0.12 (as of project start)
- **License**: AGPL-3.0

### Related Documentation

- **OpenCode Plugin API**: Reference for hook implementation patterns
- **Bun Documentation**: For worker service and SQLite usage
- **TypeScript Handbook**: For type definitions in global-config

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-01 | AI Assistant | Initial comprehensive plan |
| 1.1 | 2026-02-01 | AI Assistant | Added external documentation resources |

**Status:** Draft - Ready for review
**Next Review:** Week 1 checkpoint
**Owner:** Lead Developer
**Distribution:** Development team, Project stakeholders

**Documentation Sources Referenced:**
- docs.claude-mem.ai/llms.txt (documentation index)
- docs.claude-mem.ai/llms-full.txt (complete documentation)
- docs.claude-mem.ai/hooks-architecture (hook implementation)
- docs.claude-mem.ai/platform-integration (integration guide)

---

*This plan provides a complete roadmap for separating the Claude Mem architecture into maintainable, reusable repositories. Estimated 6 weeks, low-to-medium risk, high value outcome.*

*All references to Claude Mem architecture, hooks, and implementation patterns are based on official documentation at docs.claude-mem.ai.*