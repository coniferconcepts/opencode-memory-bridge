# GitHub Repository Setup - Complete Guide

This document explains how the GitHub repository structure works and how to set it up properly.

## 🎯 The Core Concept

Your GitHub repository (`opencode-global-config`) contains the **source of truth** for all OpenCode configurations. Users clone it to `~/.opencode`, then copy the config to `~/.config/opencode/` where OpenCode reads it.

## 📁 Directory Structure Explained

### What Goes on GitHub

```
opencode-global-config/          ← GitHub repo root
├── README.md                    ← Main documentation
├── LICENSE                      ← MIT license
├── config/                      ← Configuration files
│   ├── opencode.json           ← Template (25 agents)
│   ├── agent-metadata.json     ← Routing metadata
│   └── routing.json            ← Router config
├── docs/                        ← Documentation
│   ├── AGENT_HIERARCHY.md
│   ├── INTELLIGENT_ROUTING.md
│   ├── SETUP_GUIDE.md
│   └── ARCHITECTURE.md
├── scripts/                     ← Utility scripts
│   ├── setup.sh                ← Installation script
│   ├── verify.sh               ← Verification script
│   ├── router.js               ← Dynamic filtering
│   ├── analytics.js            ← Routing analytics
│   └── init-project.sh         ← Project init
├── stacks/                      ← Stack templates
│   ├── cloudflare-worker/
│   ├── expo-native/
│   └── tanstack-start/
├── templates/                   ← Project templates
└── universal/                   ← Shared agent prompts
    ├── AGENTS.md               ← Universal template
    └── prompts/
        ├── agent-registry.txt  ← NEW: Agent directory
        ├── base-orchestrator.txt
        ├── base-subagent.txt
        └── agents/             ← All 25 agent prompts
            ├── code-reviewer.txt
            ├── planner.txt
            ├── solo-orchestrator.txt
            ├── router.txt      ← NEW: GPT-5 Nano router
            ├── legend-state-expert.txt
            ├── valibot-expert.txt
            ├── tamagui-expert.txt
            ├── context7-super-expert.txt
            └── ... (17 more)
```

### Where Files Live After Installation

**Method A: Standard Installation**
```
~/.opencode/                     ← Git repo cloned here
├── (all repo files)
└── ...

~/.config/opencode/
└── opencode.json               ← Copied from ~/.opencode/config/
```

**Method B: Development Installation**
```
~/CODE/opencode-global-config/   ← Git repo cloned here
├── (all repo files)
└── ...

~/.opencode → ~/CODE/opencode-global-config  ← Symlink

~/.config/opencode/
└── opencode.json               ← Copied from repo
```

## 🔧 Path Resolution Explained

### Why `~/.opencode` Paths?

All agent prompts use paths like:
```json
{
  "legend-state-expert": {
    "prompt": "{file:~/.opencode/universal/prompts/agents/legend-state-expert.txt}"
  }
}
```

**How it works:**
1. User clones repo to `~/.opencode` (or creates symlink)
2. OpenCode expands `~/.opencode` to `/Users/you/.opencode`
3. Prompts are loaded from the repository
4. Works identically whether using Method A or B

### The Active Config

The file at `~/.config/opencode/opencode.json` is the **active** configuration:
- OpenCode reads this at startup
- It references prompts in `~/.opencode/`
- It's a COPY of `~/.opencode/config/opencode.json`
- Lightweight (just JSON, no prompts)

## 🚀 Installation Process

### For Users (Method A)

```bash
# 1. Clone to standard location
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/.opencode

# 2. Copy active config
mkdir -p ~/.config/opencode
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json

# 3. Verify
bash ~/.opencode/scripts/verify.sh
```

### For Contributors (Method B)

```bash
# 1. Clone to CODE directory
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/CODE/opencode-global-config

# 2. Create symlink
ln -s ~/CODE/opencode-global-config ~/.opencode

# 3. Copy active config
mkdir -p ~/.config/opencode
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json

# 4. Verify
bash ~/.opencode/scripts/verify.sh
```

## 📦 What Gets Installed

### Global Configuration (`~/.config/opencode/`)
- `opencode.json` - 25 agents with all configurations
- Referenced by all OpenCode instances
- Single file, easy to backup

### Repository (`~/.opencode/`)
- All 25 agent prompt files
- Documentation and guides
- Utility scripts (router, analytics, init)
- Stack templates
- Routing metadata
- ~800+ lines total

### Per Project
- `opencode.json` - Project extensions (optional)
- `AGENTS.md` - Project guidelines (from template)

## 🎮 Usage After Installation

### Basic Commands

```bash
# Use orchestrators
@planner help me implement authentication

# Use specialists
@valibot-expert create validation schema
@legend-state-expert set up syncedCrud

# Use router (auto-delegation)
# (Enable in project config: "extends": "~/.opencode/config/routing.json")
"Create validation schema" → auto-routes to @valibot-expert
```

### Initialize Projects

```bash
cd ~/CODE/my-new-project
~/.opencode/scripts/init-project.sh
```

### Update System

```bash
cd ~/.opencode
git pull origin main
cp config/opencode.json ~/.config/opencode/
```

## 🔍 Verification

Run the verification script:
```bash
bash ~/.opencode/scripts/verify.sh
```

Expected output:
```
✓ Active config exists: ~/.config/opencode/opencode.json
✓ Repository exists: ~/.opencode
✓ Agent count correct: 25
✓ Prompt files correct: 25
✓ agent-metadata.json exists
✓ routing.json exists
✓ router.js exists
✓ init-project.sh exists
✓ README.md exists

✅ All checks passed! Installation is complete.
```

## 🐛 Common Issues

### "Agents not found"
**Cause**: `~/.opencode` doesn't exist or is broken
**Fix**: 
```bash
# Re-clone or fix symlink
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/.opencode
# OR
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### "Wrong agent count"
**Cause**: Active config not copied from repo
**Fix**:
```bash
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json
```

### "Broken symlink" (Method B)
**Cause**: Moved or deleted the CODE directory
**Fix**:
```bash
rm ~/.opencode
ln -s ~/CODE/opencode-global-config ~/.opencode
```

## 📊 File Count Summary

| Location | Files | Purpose |
|----------|-------|---------|
| `config/` | 3 | Configurations |
| `docs/` | 5+ | Documentation |
| `scripts/` | 5 | Utilities |
| `stacks/` | 3 dirs | Templates |
| `universal/prompts/agents/` | 25 | Agent prompts |
| **Total** | **40+** | Complete system |

## 🎯 Key Takeaways

1. **GitHub repo** = Source of truth (all files)
2. **`~/.opencode`** = Where repo lives after clone
3. **`~/.config/opencode/opencode.json`** = Active config (copy)
4. **Paths use `~/.opencode`** = Works with both methods
5. **25 agents total** = 3 orchestrators + 1 router + 21 specialists

## 📝 OC_SETUP_PROMPT.txt

Use this file in OpenCode when working on the repo:
```
@solo-orchestrator Help me set up this OpenCode global configuration repository. 
Follow the instructions in OC_SETUP_PROMPT.txt to ensure all files are properly 
configured, paths are correct, and documentation is complete.
```

## ✅ Checklist for GitHub Push

Before pushing to GitHub:

- [ ] All 25 agent prompts in `universal/prompts/agents/`
- [ ] `config/opencode.json` has 25 agents
- [ ] `config/agent-metadata.json` has routing metadata
- [ ] `config/routing.json` has router config
- [ ] `scripts/setup.sh` is executable
- [ ] `scripts/verify.sh` is executable
- [ ] README.md has clear installation instructions
- [ ] All paths use `~/.opencode` consistently
- [ ] Documentation is complete in `docs/`
- [ ] LICENSE file present
- [ ] `.gitignore` configured

## 🚀 Next Steps

1. **Create GitHub repo** (if not already done)
2. **Push all files** to main branch
3. **Update README** with your GitHub username
4. **Test installation** using setup.sh
5. **Share with others** - they can now clone and use!

---

**Total Configuration Size**: ~2500 lines across all files
**Agent Count**: 25 (3 orchestrators + 1 router + 21 specialists)
**Intelligent Routing**: Yes (60-80% context reduction)
**Ready for Production**: ✅
