# Development Environment Setup

This document describes the development environment setup for the Claude Mem Architecture Separation project.

## Repository Locations

All repositories are located in `/Users/benjaminerb/CODE/`:

```
/CODE/
├── claude-mem-source/        # Fork of thedotmack/claude-mem
├── opencode-memory-bridge/   # OpenCode integration (extracted)
└── opencode-global-config/   # Hook interfaces (existing)
```

## Git Configuration

### Global Settings (Recommended for Solo Dev)

```bash
# Set your identity
git config --global user.name "Benjamin Erb"
git config --global user.email "benjamin@coniferconcepts.com"

# Solo dev friendly settings
git config --global push.default current
git config --global init.defaultBranch main
git config --global pull.rebase true
```

### Solo Development Workflow

For solo development, we use a simplified workflow:

1. **Work directly on main** for small changes
2. **Use feature branches** for larger changes, then self-merge
3. **No PR requirements** (already configured)

### Common Git Aliases

Add these to your `~/.gitconfig`:

```ini
[alias]
    # Solo dev shortcuts
    st = status
    co = checkout
    br = branch
    ci = commit
    cp = cherry-pick
    
    # Quick sync
    sync = "!git fetch upstream && git merge upstream/main"
    
    # Safe push
    pushf = push --force-with-lease
    
    # Branch cleanup
    prune-local = "!git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -d"
    
    # Upstream sync for claude-mem-source
    sync-upstream = "!git fetch upstream && git checkout main && git merge upstream/main"
```

## Repository-Specific Setup

### 1. claude-mem-source

```bash
cd /Users/benjaminerb/CODE/claude-mem-source

# Verify upstream is configured
git remote -v
# Should show:
# origin  https://github.com/coniferconcepts/claude-mem-source.git
# upstream https://github.com/thedotmack/claude-mem.git

# Install dependencies (if applicable)
npm install  # or bun install

# Build
npm run build
```

**Upstream Sync Commands:**
```bash
# Fetch and merge upstream changes
git sync-upstream

# Push to our fork
git push

# Sync tags
git push --tags
```

### 2. opencode-memory-bridge

```bash
cd /Users/benjaminerb/CODE/opencode-memory-bridge

# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

### 3. opencode-global-config

```bash
cd /Users/benjaminerb/CODE/opencode-global-config

# Already configured and working
```

## Branch Naming Conventions

Even in solo development, consistent naming helps:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `docs/` | Documentation updates | `docs/readme-update` |
| `feat/` | New features | `feat/hook-integration` |
| `fix/` | Bug fixes | `fix/memory-leak` |
| `chore/` | Maintenance | `chore/update-deps` |
| `refactor/` | Code restructuring | `refactor/extract-utils` |
| `sync/` | Upstream sync | `sync/upstream-v9.0.13` |

## Workflow Cheat Sheet

### Starting Work

```bash
# 1. Check current state
git status

# 2. Pull latest changes
git pull

# 3. Create feature branch (if needed)
git checkout -b feat/my-feature
```

### Making Changes

```bash
# 1. Make edits
# ... edit files ...

# 2. Stage changes
git add -A

# 3. Commit
git commit -m "feat: add new feature"

# 4. Push
git push
```

### For Solo Dev (Direct to Main)

```bash
# Just commit and push
git add -A
git commit -m "feat: add new feature"
git push
```

### Syncing Upstream (claude-mem-source only)

```bash
cd /Users/benjaminerb/CODE/claude-mem-source

# Sync with upstream
git sync-upstream

# Resolve any conflicts if needed
# ... resolve conflicts ...
git add -A
git commit -m "chore: sync with upstream vX.X.X"

# Push
git push
```

## Testing Changes

### Local Testing

```bash
# In each repo
cd /Users/benjaminerb/CODE/claude-mem-source
npm test

cd /Users/benjaminerb/CODE/opencode-memory-bridge
npm test
```

### Integration Testing

When ready to test the full integration:

```bash
cd /Users/benjaminerb/CODE/content-tracker

# Update submodules
git submodule update --remote

# Run integration tests
npm test
```

## CI/CD

All repositories have GitHub Actions configured (basic templates). They run on:
- Push to `main` or `develop`
- Pull requests to `main`

To view status:
```bash
gh run list --repo coniferconcepts/claude-mem-source
gh run list --repo coniferconcepts/opencode-memory-bridge
gh run list --repo coniferconcepts/opencode-global-config
```

## Troubleshooting

### Submodule Issues

```bash
# If submodule is empty
git submodule update --init --recursive

# If submodule is out of sync
cd <submodule-path>
git fetch
git checkout main
git pull
cd ../..
git add <submodule-path>
git commit -m "chore: update submodule"
```

### Merge Conflicts

```bash
# During upstream sync
git merge upstream/main

# See conflicts
git status

# Resolve manually, then:
git add -A
git commit -m "chore: resolve upstream merge conflicts"
```

### Force Push (Use Carefully)

```bash
# Only if you're sure and working solo
git push --force-with-lease
```

## Scripts

### Quick Sync All Repos

Create a script at `/Users/benjaminerb/CODE/sync-all.sh`:

```bash
#!/bin/bash
set -e

echo "Syncing all repositories..."

cd /Users/benjaminerb/CODE/claude-mem-source
echo "📦 claude-mem-source"
git pull
git sync-upstream || true

cd /Users/benjaminerb/CODE/opencode-memory-bridge
echo "📦 opencode-memory-bridge"
git pull

cd /Users/benjaminerb/CODE/opencode-global-config
echo "📦 opencode-global-config"
git pull

echo "✅ All repos synced"
```

Make it executable:
```bash
chmod +x /Users/benjaminerb/CODE/sync-all.sh
```

Run it:
```bash
/Users/benjaminerb/CODE/sync-all.sh
```

---

**Last Updated**: 2026-02-02
**Setup Status**: Complete
