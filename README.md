# OpenCode Global Configuration

A comprehensive, production-ready global configuration for OpenCode with intelligent routing, 24 specialized agents, and best practices from real-world projects.

## 🎯 Overview

This repository provides:
- **24 Intelligent Agents** - Specialized agents for different domains and tasks
- **Technology Stack** - Legend State, Valibot, Tamagui, tRPC, Hono, Bun, Biome
- **Smart Routing** - Agent metadata for intelligent delegation
- **Stack Templates** - Pre-configured for TanStack Start, Expo Native, Cloudflare Workers
- **Best Practices** - Guardrails, standards, and workflows from production experience

## 📊 Current Status

**Last Updated:** 2026-02-01  
**Configuration Status:** ✅ Operational  
**Total Agents:** 24 (3 Primary + 21 Subagents)  
**Config Size:** 9.4KB source → 406KB built  
**Context7 MCP:** ✅ Enabled  
**Build System:** ✅ Recursive file reference resolution  

**Recent Improvements:**
- ✅ All 24 agents verified and operational
- ✅ 58 backup files cleaned up
- ✅ Configuration optimized and documented
- ✅ Build script resolves nested file references
- ✅ Full improvement report available in [IMPROVEMENT_REPORT.md](./IMPROVEMENT_REPORT.md)

## 📁 Repository Structure

```
opencode-global-config/                 ← GitHub repo (this directory)
├── README.md                          ← This file
├── LICENSE
├── config/                            ← Configuration files
│   ├── opencode.json                 ← Global config TEMPLATE
│   ├── agent-metadata.json           ← Intelligent routing metadata
│   └── routing.json                  ← Router configuration
├── docs/                              ← Documentation
│   ├── AGENT_HIERARCHY.md           ← Three-tier agent system
│   ├── INTELLIGENT_ROUTING.md       ← Auto-delegation system
│   └── SETUP_GUIDE.md               ← Detailed setup instructions
├── scripts/                           ← Utility scripts
│   ├── router.js                    ← Dynamic agent filtering
│   ├── analytics.js                 ← Routing analytics
│   └── init-project.sh              ← Project initialization
├── stacks/                            ← Stack-specific templates
│   ├── cloudflare-worker/
│   ├── expo-native/
│   └── tanstack-start/
├── templates/                         ← Project templates
└── universal/                         ← Shared agent prompts
    ├── prompts/
    │   ├── base-orchestrator.txt    ← Orchestrator foundation
    │   ├── base-subagent.txt        ← Subagent foundation
    │   └── agents/                  ← All 25 agent prompts
    │       ├── code-reviewer.txt
    │       ├── legend-state-expert.txt
    │       ├── valibot-expert.txt
    │       ├── tamagui-expert.txt
    │       ├── router.txt           ← NEW: Intelligent router
    │       └── ... (19 more)
    └── AGENTS.md                    ← Universal template
```

## 🚀 Installation

### Prerequisites

- Git installed
- OpenCode installed (`npm install -g opencode` or equivalent)
- Home directory access

### Step 1: Clone the Repository

**Option A: Standard Location (Recommended)**
```bash
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/.opencode
```

**Option B: Development Location with Symlink**
```bash
# Clone to your CODE directory
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/CODE/opencode-global-config

# Create symlink for OpenCode to find it
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### Step 2: Install Global Configuration

```bash
# Create OpenCode config directory
mkdir -p ~/.config/opencode

# Copy the global configuration
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json

# Verify the installation
ls -la ~/.config/opencode/
ls -la ~/.opencode/universal/prompts/agents/
```

### Step 3: Verify Agent Count

You should have 24 agents configured:
```bash
# Count agents in global config
grep -c '"model":' ~/.config/opencode/opencode.json

# Count agent prompt files
ls ~/.opencode/universal/prompts/agents/*.txt | wc -l
```

Expected output: `24`

### Step 4: Build the Configuration

**⚠️ IMPORTANT:** OpenCode supports `{file:path}` syntax, but only resolves one level. Our prompts use **nested references** (e.g., `tool-utility.txt` references `base-subagent.txt`). 

**You MUST use the build script:**

```bash
# Build the configuration (resolves all nested references)
cd ~/CODE/opencode-global-config
node scripts/build-config.js

# Verify it worked
ls -lh ~/.config/opencode/opencode.json
# Should show ~406KB (not 9.4KB)
```

### Step 5: Test the Router

```bash
cd ~/.opencode
node scripts/router.js "Create validation schema for user signup"
```

## 📂 Directory Reference

### Active Configuration (Runtime)
```
~/.config/opencode/
└── opencode.json              ← Active global config (BUILT from source)
```

### Repository Files (Source)
```
~/.opencode/                   ← Repo clone location
├── config/opencode.json       ← Source template with {file:...} references
├── universal/prompts/         ← Agent prompts (referenced by source config)
└── scripts/build-config.js    ← Build script ⭐
```

### Project Files (Per Project)
```
~/CODE/my-project/
├── opencode.json              ← Project-specific extensions
└── AGENTS.md                  ← Project guidelines (from template)
```

## 🔧 Path Resolution

All agent prompts use `~/.opencode` paths:
```json
{
  "prompt": "{file:~/.opencode/universal/prompts/agents/router.txt}"
}
```

This works because:
1. You cloned the repo to `~/.opencode` (or created a symlink)
2. OpenCode expands `~/.opencode` to the full path
3. The prompts are loaded from the repository

## 🔧 Build System (IMPORTANT)

### Why We Need a Build Script

**The Problem:**
OpenCode supports `{file:path}` syntax, but only resolves **one level deep**. Our prompt files contain **nested references**:

```
# agents/tool-utility.txt contains:
{file:base-subagent.txt}\n\n# TOOL UTILITY AGENT...
```

When OpenCode reads this, it doesn't recursively resolve `{file:base-subagent.txt}` → **Parse error**.

**The Solution:**
Use a build script that recursively resolves ALL references before OpenCode sees the config.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SOURCE (Maintainable)                                      │
│  config/opencode.json              9.4 KB                   │
│  universal/prompts/agents/*.txt    Individual prompts       │
└──────────────────────┬──────────────────────────────────────┘
                       │ Build Script
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  BUILT (Runtime)                                            │
│  ~/.config/opencode/opencode.json  406 KB                   │
│  All references resolved, valid JSON                        │
└─────────────────────────────────────────────────────────────┘
```

### Daily Workflow

**To update an agent:**
```bash
# 1. Edit the source prompt
vim ~/.opencode/universal/prompts/agents/tool-utility.txt

# 2. Rebuild the config
cd ~/CODE/opencode-global-config && node scripts/build-config.js

# 3. Test
opencode
@tool-utility test
```

**One-liner for quick updates:**
```bash
cd ~/CODE/opencode-global-config && node scripts/build-config.js && opencode
```

### Build Script Features

- ✅ Recursively resolves nested `{file:...}` references
- ✅ Properly escapes content for JSON (handles `\n`, quotes, etc.)
- ✅ Validates output is valid JSON before writing
- ✅ Creates automatic backups
- ✅ Shows statistics (files resolved, size, etc.)

### Troubleshooting Build Issues

**"Config file is not valid JSON" error:**
→ You forgot to run the build script. Run: `node scripts/build-config.js`

**"Missing file" error during build:**
→ A file reference points to non-existent file. Check error message for path.

**Agent not working after build:**
→ Check the agent's prompt file for syntax errors, then rebuild.

## 🤖 Available Agents

### Primary Orchestrators
| Agent | Purpose | Model |
|-------|---------|-------|
| @planner | Task decomposition & planning | glm-4.7 |
| @code-reviewer | Multi-phase review pipeline | glm-4.7 |
| @solo-orchestrator | Solo dev coordination | glm-4.7 |

### NEW: Intelligent Router
| Agent | Purpose | Model |
|-------|---------|-------|
| @router | Auto-selects optimal agents | gpt-5-nano |

### Technology Specialists
| Agent | Domain |
|-------|--------|
| @legend-state-expert | Legend State v3 |
| @valibot-expert | Schema validation |
| @tamagui-expert | UI components |
| @cloudflare-expert | Workers, D1, R2 |
| @context7-super-expert | Documentation lookup |
| ... (20 total specialists) |

## 🎮 Usage

### Basic Usage

```bash
# Navigate to your project
cd ~/CODE/my-project

# Use orchestrators for complex tasks
@planner help me implement user authentication

# Use specialists for domain-specific tasks
@valibot-expert create validation schema
@legend-state-expert set up syncedCrud for workouts
@tamagui-expert design a workout card component
```

### With Intelligent Routing

```bash
# Enable routing in your project
# (Add to opencode.json: "extends": "~/.opencode/config/routing.json")

# Router auto-selects agents
# "Create validation schema" → @valibot-expert
# "Build workout feature" → @legend-state-expert + @valibot-expert + @tamagui-expert
```

### Initialize New Project

```bash
cd ~/CODE/my-new-project
~/.opencode/scripts/init-project.sh
```

## 📊 Intelligent Routing

The system includes auto-delegation with:
- **60-80% context reduction**
- **<100ms routing decisions**
- **90%+ routing accuracy**
- **70%+ cache hit rate**

See `docs/INTELLIGENT_ROUTING.md` for details.

## 🔄 Updating

```bash
cd ~/.opencode
git pull origin main

# Rebuild config (IMPORTANT: don't just copy!)
cd ~/CODE/opencode-global-config && node scripts/build-config.js
```

## 🆘 Troubleshooting

### Agents Not Found
```bash
# Verify symlink (if using development setup)
ls -la ~/.opencode

# Should show: ~/.opencode -> /Users/you/CODE/opencode-global-config

# If broken, recreate:
rm ~/.opencode
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### Config Not Loading / JSON Parse Error
```bash
# Check if you built the config
ls -lh ~/.config/opencode/opencode.json

# If it's ~9KB, you need to build it:
cd ~/CODE/opencode-global-config && node scripts/build-config.js

# Should be ~406KB after building
# Verify it's valid JSON:
cat ~/.config/opencode/opencode.json | python3 -m json.tool > /dev/null && echo "✅ Valid JSON"
```

### Wrong Agent Count
```bash
# Count agents
grep -o '"model":' ~/.config/opencode/opencode.json | wc -l

# Should be 25
# If not, re-copy from repo
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json
```

## 📝 Development Workflow

### For Contributors

1. **Edit in repo**: `~/CODE/opencode-global-config/`
2. **Build & test**: `node scripts/build-config.js && opencode`
3. **Commit & push**: `git add . && git commit && git push`
4. **Update active config**: `node scripts/build-config.js` (not just copy!)

### For Users

1. **Clone**: `git clone ... ~/.opencode`
2. **Copy config**: `cp ~/.opencode/config/opencode.json ~/.config/opencode/`
3. **Use**: Agents available in all projects
4. **Update**: `cd ~/.opencode && git pull`

## 📚 Documentation

- `docs/AGENT_HIERARCHY.md` - Three-tier agent system
- `docs/INTELLIGENT_ROUTING.md` - Auto-delegation system
- `docs/SETUP_GUIDE.md` - Detailed setup instructions
- `ROUTING_INTEGRATION_SUMMARY.md` - Routing implementation details
- `SESSION_SUMMARY.md` - Configuration overview

## 🎯 Next Steps

1. **Install**: Follow installation steps above
2. **Test**: Run `node scripts/router.js "test request"`
3. **Use**: Start using agents in your projects
4. **Configure**: Add project-specific agents as needed

## 📄 License

MIT License - See LICENSE file

---

**Total Agents**: 25 (3 orchestrators + 1 router + 20+ specialists)
**Technology Stack**: Legend State, Valibot, Tamagui, tRPC, Hono, Bun, Biome
**Context Reduction**: 60-80% with intelligent routing
