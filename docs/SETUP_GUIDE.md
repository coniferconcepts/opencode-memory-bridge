# Setup Guide

Complete guide for setting up the OpenCode Global Configuration.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding the Structure](#understanding-the-structure)
3. [Installation Methods](#installation-methods)
4. [Configuration](#configuration)
5. [Project Initialization](#project-initialization)
6. [Verification](#verification)
7. [Intelligent Routing Setup](#intelligent-routing-setup)
8. [Troubleshooting](#troubleshooting)
9. [Development Workflow](#development-workflow)

## Prerequisites

### Required

- **Git** - For cloning the repository
- **Node.js** - Version 18+ recommended
- **OpenCode** - AI coding assistant (installed separately)
- **Bash** - For running initialization scripts

### Optional but Recommended

- **npm** or **bun** - Package manager
- **GitHub account** - For forking/customizing the config

## Installation

### Step 1: Clone the Repository

Choose one of these approaches:

#### Option A: Direct to ~/.opencode (Recommended)

```bash
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/.opencode
```

#### Option B: Clone to CODE directory with symlink

```bash
cd ~/CODE
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git opencode-global-config
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### Step 2: Set Up Global Configuration

Create the OpenCode configuration directory and copy the main config:

```bash
# Create config directory
mkdir -p ~/.config/opencode

# Copy global configuration
cp ~/.opencode/config/opencode.json ~/.config/opencode/opencode.json

# Verify
ls -la ~/.config/opencode/
# Should show: opencode.json
```

### Step 3: Verify Global Config Location

The global configuration should be at:

```
~/.config/opencode/opencode.json  (Primary global config)
~/.opencode/                       (Templates, prompts, stacks)
```

## Configuration

### Understanding the Config Structure

```
~/.config/opencode/opencode.json     # Global agent and provider settings
~/.opencode/universal/               # Shared templates and prompts
~/.opencode/stacks/                  # Stack-specific configurations
~/.opencode/scripts/                 # Utility scripts
```

### Customizing Global Settings

Edit `~/.config/opencode/opencode.json` to customize:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/glm-4.7",        // Your preferred default model
  "small_model": "opencode/gpt-5-nano", // Lightweight model for simple tasks
  
  "provider": {
    "anthropic": {
      "options": {
        "timeout": 600000,            // API timeout in ms
        "setCacheKey": true           // Enable prompt caching
      }
    },
    "openai": {
      "options": {
        "baseURL": "https://us.api.openai.com/v1",
        "timeout": 600000
      }
    }
  }
}
```

### Environment Variables

Create a `.env` file in your home directory for API keys (not in version control):

```bash
# ~/.opencode/.env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

## Project Initialization

### Automatic Initialization

Use the provided script to set up new projects:

```bash
# Navigate to your new project
cd ~/CODE/my-new-project

# Run initialization script
~/.opencode/scripts/init-project.sh

# Or from CODE directory
~/CODE/opencode-global-config/scripts/init-project.sh
```

The script will:
1. Check prerequisites
2. Let you select a stack (Cloudflare Worker, Tanstack Start, Expo, or Minimal)
3. Create `opencode.json` with stack-specific settings
4. Create `AGENTS.md` from template
5. Update `.gitignore` with OpenCode entries
6. Copy stack-specific templates

### Manual Initialization

If you prefer manual setup:

#### 1. Create opencode.json

```bash
cat > opencode.json << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "extends": "~/.config/opencode/opencode.json",
  "model": "opencode/glm-4.7",
  "agent": {
    "my-custom-agent": {
      "model": "opencode/glm-4.7",
      "prompt": "Your custom prompt here",
      "description": "Description of your agent",
      "mode": "subagent"
    }
  }
}
EOF
```

#### 2. Create AGENTS.md

```bash
cp ~/.opencode/universal/AGENTS.md ./AGENTS.md
# Edit to customize for your project
```

#### 3. Update .gitignore

Add to your `.gitignore`:

```
# OpenCode
.opencode/backup*
.opencode-backups/
*.opencode.tmp
```

## Verification

### Verify Global Installation

```bash
# Check global config exists
test -f ~/.config/opencode/opencode.json && echo "✓ Global config exists"

# Check universal templates exist
test -d ~/.opencode/universal/prompts && echo "✓ Universal prompts exist"

# Check stacks exist
test -d ~/.opencode/stacks/cloudflare-worker && echo "✓ Stack templates exist"
```

### Verify Project Setup

In your project directory:

```bash
# Check opencode.json
test -f opencode.json && echo "✓ Project opencode.json exists"

# Check AGENTS.md
test -f AGENTS.md && echo "✓ AGENTS.md exists"

# Check .gitignore
grep -q "\.opencode" .gitignore && echo "✓ .gitignore updated"
```

### Test Agent Loading

Start OpenCode in your project and verify:

```bash
# OpenCode should load without errors
# You should see agents from both global and project config
```

## Project Types

### Cloudflare Worker Project

```bash
cd ~/CODE/my-worker
~/.opencode/scripts/init-project.sh
# Select option 1: Cloudflare Worker
```

**Key features:**
- D1 database migrations
- R2 storage patterns
- Queue processing
- Wrangler integration

### Tanstack Start Project

```bash
cd ~/CODE/my-webapp
~/.opencode/scripts/init-project.sh
# Select option 2: Tanstack Start
```

**Key features:**
- File-based routing
- Server-side rendering
- API routes
- Full-stack TypeScript

### Expo Native Project

```bash
cd ~/CODE/my-mobile-app
~/.opencode/scripts/init-project.sh
# Select option 3: Expo Native
```

**Key features:**
- Mobile-first components
- Platform-specific handling
- EAS build configuration
- Expo Router

### Minimal Project

```bash
cd ~/CODE/my-generic-project
~/.opencode/scripts/init-project.sh
# Select option 4: Minimal
```

**Key features:**
- Base agent configuration
- No stack-specific assumptions
- Flexible for any project type

## Updating

### Update Global Configuration

```bash
cd ~/.opencode
git pull origin main

# Update config if needed
cp config/opencode.json ~/.config/opencode/
```

### Update Individual Projects

Projects don't auto-update. To update a project:

1. Review changes in global config
2. Manually update project-specific files
3. Or re-run init script (will overwrite - backup first!)

## Advanced Configuration

### Custom Agent Prompts

Create custom prompts in your project:

```
my-project/
├── .opencode/
│   └── prompts/
│       └── my-custom-agent.txt
└── opencode.json
```

Reference in `opencode.json`:

```json
{
  "agent": {
    "my-custom-agent": {
      "prompt": "{file:./.opencode/prompts/my-custom-agent.txt}"
    }
  }
}
```

### Stack-Specific Extensions

Create stack-specific agents:

```json
{
  "extends": "~/.config/opencode/opencode.json",
  "agent": {
    "cloudflare-expert": {
      "prompt": "{file:~/.opencode/stacks/cloudflare-worker/prompts/cloudflare-expert.txt}"
    }
  }
}
```

### Multiple Projects with Shared Config

For organizations or multiple developers:

1. Fork this repository
2. Customize for your organization
3. Share the fork URL with your team
4. Everyone clones the same fork

## Best Practices

1. **Always extend global config** - Don't duplicate, use `"extends"`
2. **Add project-specific agents** - For domain-specific knowledge
3. **Keep AGENTS.md updated** - Document project-specific guidelines
4. **Version control** - Track changes to your global config fork
5. **Regular updates** - Pull updates periodically for improvements

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

## Next Steps

- Read the [main README](../README.md) for overview
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Explore stack-specific READMEs in `stacks/` directory
- Customize agents for your workflow

---

**Need Help?**

- [GitHub Issues](https://github.com/YOUR_USERNAME/opencode-global-config/issues)
- [GitHub Discussions](https://github.com/YOUR_USERNAME/opencode-global-config/discussions)
