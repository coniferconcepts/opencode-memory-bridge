# Session Continue Prompt: Claude Mem Architecture Separation - Phase 4

## 🎯 Session Objective
Continue the Claude Mem Architecture Separation project - begin **Phase 4: Migrate content-tracker to Git Submodules**.

---

## 📊 Current Project Status (End of Week 3)

### ✅ COMPLETED

**Phase 1: Preparation & Setup (Week 1)**
- ✅ Created `claude-mem-source` and `opencode-memory-bridge` repositories
- ✅ Wrote ADR-001 and architecture documentation
- ✅ Set up development environments with solo-dev workflow

**Phase 2: claude-mem-source Setup (Week 2)**
- ✅ Merged upstream v9.0.12 from thedotmack/claude-mem
- ✅ Applied 3 security patches:
  - Patch 001: Input validation (SessionStore.ts)
  - Patch 002: Process verification (ProcessManager.ts)
  - Patch 003: TOCTOU-safe port binding (PortManager.ts)
- ✅ Added 55+ test cases

**Phase 3: Extract opencode-memory-bridge (Week 3)**
- ✅ Extracted 88 TypeScript files (~52K lines) from content-tracker/packages/memory-plugin/
- ✅ Pushed to `extraction` branch on GitHub
- ✅ Created comprehensive documentation

---

## 🚀 IMMEDIATE ACTIONS (Do These First)

### 1. Merge the Extraction Branch (5 minutes)

The opencode-memory-bridge code is ready on the `extraction` branch:

**Via GitHub UI** (easiest):
```
https://github.com/coniferconcepts/opencode-memory-bridge/pull/new/extraction
```
1. Click "Create pull request"
2. Click "Merge pull request" 
3. Delete the extraction branch

### 2. Verify Repository State (2 minutes)

```bash
cd /Users/benjaminerb/CODE

# Check all three repos exist
ls -d claude-mem-source opencode-memory-bridge opencode-global-config

# Read the project status
cat opencode-global-config/PROJECT_STATUS.md

# Read next steps guide  
cat opencode-global-config/NEXT_STEPS.md
```

---

## 🎯 PHASE 4 OBJECTIVE: Migrate content-tracker to Git Submodules

### The Goal
Convert content-tracker from having code inline to using git submodules:

**BEFORE:**
```
content-tracker/
├── packages/memory-plugin/     ← 52K lines inline
└── .claude/plugins/claude-mem/ ← Code inline
```

**AFTER:**
```
content-tracker/
├── packages/memory-plugin/     ← Submodule → opencode-memory-bridge
└── .claude/plugins/claude-mem/ ← Submodule → claude-mem-source
```

---

## 📋 PHASE 4 TASK BREAKDOWN

### Task 4.1: Backup content-tracker (15 minutes)
```bash
cd /Users/benjaminerb/CODE
# Create a backup branch
cd content-tracker
git checkout -b pre-submodule-migration
git push -u origin pre-submodule-migration
git checkout main
```

### Task 4.2: Remove Old Code (10 minutes)
```bash
cd /Users/benjaminerb/CODE/content-tracker

# Remove the old inline memory-plugin
rm -rf packages/memory-plugin

# Check if there's a .claude/plugins/claude-mem to remove
ls -la .claude/plugins/ | grep claude-mem
# If exists and is not a submodule: rm -rf .claude/plugins/claude-mem
```

### Task 4.3: Add Git Submodules (15 minutes)
```bash
cd /Users/benjaminerb/CODE/content-tracker

# Add opencode-memory-bridge as submodule
git submodule add \
  https://github.com/coniferconcepts/opencode-memory-bridge.git \
  packages/memory-plugin

# Add claude-mem-source as submodule
git submodule add \
  https://github.com/coniferconcepts/claude-mem-source.git \
  .claude/plugins/claude-mem

# Initialize and update submodules
git submodule update --init --recursive

# Check status
git status
```

### Task 4.4: Update package.json (15 minutes)
Edit `/Users/benjaminerb/CODE/content-tracker/package.json`:

**Find** the old @opencode/memory-plugin dependency and **replace** with:
```json
{
  "dependencies": {
    "@opencode/memory-plugin": "file:./packages/memory-plugin",
    "other-deps": "..."
  }
}
```

### Task 4.5: Test the Migration (20 minutes)
```bash
cd /Users/benjaminerb/CODE/content-tracker

# Install dependencies
npm install

# Run tests
npm test 2>&1 | head -50

# Check for import errors
grep -r "packages/memory-plugin" src/ 2>/dev/null | head -5
```

### Task 4.6: Commit and Document (10 minutes)
```bash
cd /Users/benjaminerb/CODE/content-tracker

git add .gitmodules
# Stage the submodule references (not the actual files)
git add packages/memory-plugin .claude/plugins/claude-mem
git commit -m "refactor: Migrate to git submodules for memory components

- Remove inline packages/memory-plugin/ (52K lines)
- Add opencode-memory-bridge as git submodule
- Add claude-mem-source as git submodule
- Update package.json to use file: reference
- Part of Phase 4: Repository Architecture Separation"

git push
```

---

## 🔍 VERIFICATION CHECKLIST

After completing Phase 4, verify:

- [ ] `packages/memory-plugin` is a git submodule (not regular directory)
- [ ] `.claude/plugins/claude-mem` is a git submodule
- [ ] `.gitmodules` file exists and has both entries
- [ ] `npm install` completes without errors
- [ ] Tests pass (or show expected submodule-related changes)
- [ ] content-tracker can import from @opencode/memory-plugin
- [ ] Both submodules point to correct commits

Check submodules:
```bash
cd /Users/benjaminerb/CODE/content-tracker
cat .gitmodules
git submodule status
```

---

## 🆘 TROUBLESHOOTING

### Submodule not showing as directory
```bash
git submodule update --init --recursive --force
```

### Import errors after migration
Check if imports need to be updated from:
```typescript
// Old (inline)
import { something } from '../../../packages/memory-plugin/src/...'

// New (submodule)
import { something } from '@opencode/memory-plugin'
```

### Can't push to protected branch
Branch protection is disabled on all new repos for solo-dev workflow.

---

## 📚 REFERENCE DOCUMENTATION

**In `/Users/benjaminerb/CODE/opencode-global-config/`:**
- `PROJECT_STATUS.md` - Full project status and phases
- `NEXT_STEPS.md` - Detailed next steps guide
- `docs/ADR-001-Repository-Separation.md` - Architecture decisions
- `docs/DEVELOPMENT_ENVIRONMENT.md` - Dev setup guide

**Repositories:**
- `claude-mem-source` - Fork with security patches
- `opencode-memory-bridge` - Extracted memory plugin
- `opencode-global-config` - Config and documentation

---

## 🎯 SESSION SUCCESS CRITERIA

This session is successful when:

1. ✅ opencode-memory-bridge `extraction` branch is merged to `main`
2. ✅ content-tracker has both submodules added
3. ✅ `.gitmodules` file is committed
4. ✅ package.json updated with `file:` reference
5. ✅ content-tracker tests run (even if some fail due to path changes)
6. ✅ All changes committed and pushed

---

## 🚀 START HERE

**Step 1**: Verify current state
```bash
cd /Users/benjaminerb/CODE
cat opencode-global-config/PROJECT_STATUS.md | head -50
```

**Step 2**: Merge extraction branch (if not done)
Visit: https://github.com/coniferconcepts/opencode-memory-bridge/pull/new/extraction

**Step 3**: Begin Phase 4 migration
Follow Task 4.1-4.6 above

---

## 📝 NOTES FOR THIS SESSION

- **Estimated Time**: 90 minutes for full Phase 4
- **Risk Level**: Medium (changing how content-tracker works)
- **Backup**: Create `pre-submodule-migration` branch first
- **Testing**: Expect some test failures due to path changes
- **Git Submodules**: If unfamiliar, reference git documentation

---

**Questions?** Check the PROJECT_STATUS.md and NEXT_STEPS.md files.

**Ready?** Start with Task 4.1 (Backup) above!
