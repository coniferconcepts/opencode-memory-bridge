# New Session Prompt: Execute Claude Mem Architecture Separation

## Session Context

You are starting a new implementation session to execute the **Claude Mem Architecture Separation Project**. This is a 6-week project to separate mixed concerns in the content-tracker repository into three distinct, maintainable repositories using git submodules for distribution.

## 📋 Project Overview

**Objective:** Separate Claude Mem components from content-tracker into 3 repos:
1. **claude-mem-source** - Fork of upstream with our patches
2. **opencode-memory-bridge** - OpenCode plugin (git submodule distribution)
3. **opencode-global-config** - Hook interfaces (already exists, needs updates)

**Distribution Method:** Git submodules (NOT npm publishing)
**Timeline:** 6 weeks (30 working days)
**Current Phase:** Week 1 - Preparation & Setup

## 📁 Reference Documentation

All documentation is in `/Users/benjaminerb/CODE/opencode-global-config/`:

1. **CLAUDE_MEM_SEPARATION_PROJECT_PLAN.md** - Complete 6-week project plan
2. **CLAUDE_MEM_ARCHITECTURE_SEPARATION.md** - Architecture analysis
3. **PRIVATE_DISTRIBUTION_OPTIONS.md** - Why we chose git submodules
4. **GIT_SUBMODULE_INTEGRATION_SUMMARY.md** - Quick reference for changes

## 🎯 Current Task: Phase 1 - Preparation & Setup

### Immediate Tasks (Week 1):

#### Task 1.1: Create GitHub Repositories
- [ ] Create `coniferconcepts/claude-mem-source`
  - Fork from `thedotmack/claude-mem` (v9.0.12)
  - Setup upstream tracking
  - Add LICENSE (AGPL-3.0)
  - Enable branch protection
  
- [ ] Create `coniferconcepts/opencode-memory-bridge`
  - Initialize empty repo
  - Add LICENSE (MIT)
  - Enable branch protection
  - Setup CI/CD basics

- [ ] Update `coniferconcepts/opencode-global-config`
  - Already exists
  - Verify CI/CD functional

#### Task 1.2: Document Architecture
- [ ] Write Architecture Decision Record (ADR-001)
- [ ] Create README templates for new repos
- [ ] Document dependency relationships
- [ ] Create architecture diagram

#### Task 1.3: Setup Development Environment
- [ ] Clone all three repos locally
- [ ] Setup branch naming conventions
- [ ] Configure git hooks
- [ ] Test CI/CD pipelines

## 🚀 Your Mission (Start Here)

### Step 1: Read the Project Plan (5 minutes)
```bash
cat /Users/benjaminerb/CODE/opencode-global-config/CLAUDE_MEM_SEPARATION_PROJECT_PLAN.md
```
Focus on:
- Executive Summary (first 2 pages)
- Target Architecture diagram
- Phase 1: Preparation & Setup section
- Task 1.1, 1.2, 1.3 details

### Step 2: Verify Current State
```bash
# Check content-tracker current state
cd /Users/benjaminerb/CODE/content-tracker
git status
git log --oneline -5

# Check if repos already exist
curl -s https://api.github.com/repos/coniferconcepts/claude-mem-source | grep "Not Found" && echo "Repo doesn't exist - need to create"
curl -s https://api.github.com/repos/coniferconcepts/opencode-memory-bridge | grep "Not Found" && echo "Repo doesn't exist - need to create"
```

### Step 3: Start with Task 1.1

**Option A: If repos don't exist:**
```bash
# 1. Fork claude-mem to claude-mem-source
git clone https://github.com/thedotmack/claude-mem.git /tmp/claude-mem-fork
cd /tmp/claude-mem-fork
git remote rename origin upstream
git remote add origin https://github.com/coniferconcepts/claude-mem-source.git
# ... create repo on GitHub first, then push

# 2. Create opencode-memory-bridge
mkdir /tmp/opencode-memory-bridge
cd /tmp/opencode-memory-bridge
git init
# ... add README, LICENSE, push to GitHub
```

**Option B: If repos exist:**
```bash
# Verify setup is complete
cd /Users/benjaminerb/CODE
git clone https://github.com/coniferconcepts/claude-mem-source.git
git clone https://github.com/coniferconcepts/opencode-memory-bridge.git
# Check configurations
```

### Step 4: Document Progress
After each task:
1. Update this session's progress tracker
2. Commit changes with descriptive messages
3. Push to remote
4. Move to next task

## ✅ Success Criteria for This Session

- [ ] At least 1 GitHub repo created and configured
- [ ] Project plan reviewed and understood
- [ ] Current state verified
- [ ] First task started with clear next steps
- [ ] Documentation updated with progress

## 🎯 Focus Areas

**DO:**
- Follow the project plan sequentially
- Use git submodules (not npm)
- Document all decisions
- Test each step before moving on
- Commit frequently with clear messages

**DON'T:**
- Skip ahead to later phases
- Try to use npm publishing (we're using git submodules)
- Modify upstream code unnecessarily
- Delete anything without backup
- Skip documentation

## 🆘 Troubleshooting

**If you get stuck:**
1. Check the project plan for detailed instructions
2. Refer to PRIVATE_DISTRIBUTION_OPTIONS.md for git submodule patterns
3. Look at existing code in content-tracker as reference
4. Document the issue and move to next subtask

**Common issues:**
- GitHub auth: Use SSH keys or personal access token
- Fork permissions: May need to create fresh clone vs true fork
- Submodule setup: Follow project plan Task 4.2 exactly

## 📝 Progress Tracker

Update this as you complete tasks:

```markdown
## Week 1 Progress

### Task 1.1: Create Repositories
- [ ] claude-mem-source created
- [ ] claude-mem-source pushed to GitHub
- [ ] opencode-memory-bridge created
- [ ] opencode-memory-bridge pushed to GitHub
- [ ] Repositories configured (branch protection, etc.)

### Task 1.2: Documentation
- [ ] ADR-001 written
- [ ] README templates created
- [ ] Architecture diagram created

### Task 1.3: Dev Environment
- [ ] Local clones setup
- [ ] Branch strategy configured
- [ ] CI/CD tested
```

## 🎬 Next Actions (Choose One)

**Option 1: Quick Start** (If repos don't exist)
> "Create the two new GitHub repositories (claude-mem-source and opencode-memory-bridge) following Task 1.1 in the project plan. Start with claude-mem-source by forking the upstream repo."

**Option 2: Verify & Continue** (If repos exist)
> "Verify the existing repository configurations are complete per Task 1.1, then move to Task 1.2 to create the Architecture Decision Record and documentation."

**Option 3: Deep Dive** (If unclear on approach)
> "Review the project plan Phase 1 section in detail, then help me understand the specific first steps to take for Task 1.1."

---

## 📚 Key Commands Reference

```bash
# Check GitHub repo exists
curl -s https://api.github.com/repos/coniferconcepts/REPO_NAME | jq -r '.message'

# Create repo via GitHub CLI (if installed)
gh repo create coniferconcepts/REPO_NAME --public --source=. --remote=origin --push

# Fork upstream
git clone https://github.com/thedotmack/claude-mem.git
cd claude-mem
git remote rename origin upstream
git remote add origin https://github.com/coniferconcepts/claude-mem-source.git
git push -u origin main

# Initialize new repo
mkdir REPO_NAME
cd REPO_NAME
git init
git remote add origin https://github.com/coniferconcepts/REPO_NAME.git
# ... add files ...
git push -u origin main
```

## 🎯 One-Liner Mission Statement

**"Separate the mixed Claude Mem components in content-tracker into three clean repositories using git submodules, starting with creating the GitHub repos and setting up the development environment."**

---

**Ready?** Start by reading the project plan, then tell me which option (1, 2, or 3) matches your current state, or ask me to check if the repos already exist.

**Session Start Time:** [Current Time]
**Target Completion:** Week 1 tasks (5 days)
**Context Status:** Clean - ready for implementation