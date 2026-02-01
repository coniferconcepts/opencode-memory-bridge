# Installation Guide

Complete installation instructions for the OpenCode Base-Layer.

## Prerequisites

### Required
- **Git** - Version 2.30+
- **Node.js** - Version 18+ recommended
- **OpenCode** - AI coding assistant
- **Bash** - For running scripts

### Optional
- **npm** or **bun** - Package manager
- **GitHub account** - For contributing or forking

## Installation Methods

### Method 1: Direct Install (Recommended)

Clone directly to `~/.opencode`:

```bash
git clone https://github.com/coniferconcepts/opencode-global-config.git ~/.opencode
```

### Method 2: Development Install

Clone to your CODE directory with symlink:

```bash
# Clone to CODE directory
git clone https://github.com/coniferconcepts/opencode-global-config.git ~/CODE/opencode-global-config

# Create symlink
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### Method 3: Fork & Customize

Fork the repository to customize for your organization:

```bash
# Fork on GitHub first, then:
git clone https://github.com/YOUR_ORG/opencode-global-config.git ~/.opencode
```

## Post-Installation Setup

### 1. Create Config Directory

```bash
mkdir -p ~/.config/opencode
```

### 2. Install Dependencies

```bash
cd ~/.opencode
npm install
# or
bun install
```

### 3. Build Configuration

**IMPORTANT**: You must build the configuration to resolve nested file references:

```bash
cd ~/CODE/opencode-global-config  # or ~/.opencode if direct install
node scripts/build-config.js
```

### 4. Verify Installation

```bash
# Check config size (should be ~406KB, not 9.4KB)
ls -lh ~/.config/opencode/opencode.json

# Validate JSON
python3 -c "import json; json.load(open('~/.config/opencode/opencode.json'))" && echo "Valid JSON"

# Count agents (should be 27)
grep -c '"model":' ~/.config/opencode/opencode.json
```

## Directory Structure After Install

```
~/.opencode/                          # Repository location
├── config/
│   └── opencode.json                 # Source config (9.4KB)
├── universal/
│   ├── prompts/
│   │   ├── agents/                   # 27 agent prompts
│   │   ├── modules/                  # Shared modules
│   │   └── roles/                    # Agent roles
│   └── AGENTS.md                     # Universal template
├── scripts/
│   ├── build-config.js               # Build system
│   ├── init-project.sh               # Project initialization
│   └── ...
├── stacks/
│   ├── tanstack-start/
│   ├── expo-native/
│   └── cloudflare-worker/
└── docs/                             # Documentation

~/.config/opencode/
└── opencode.json                     # Built config (~406KB)
```

## Troubleshooting

### "Config file is not valid JSON"

You forgot to build the configuration:

```bash
cd ~/.opencode
node scripts/build-config.js
```

### "No such file or directory: ~/.opencode"

The symlink or clone failed:

```bash
# Check if exists
ls -la ~/.opencode

# If broken, recreate:
rm ~/.opencode
ln -s ~/CODE/opencode-global-config ~/.opencode
```

### Permission Denied on Scripts

Make scripts executable:

```bash
chmod +x ~/.opencode/scripts/*.sh
chmod +x ~/.opencode/*.sh
```

## Next Steps

- [Quick Start Guide](quickstart.md) - Get up and running in 15 minutes
- [Setup Guide](setup-guide.md) - Complete setup walkthrough
- [Architecture Overview](../architecture/README.md) - Understand the system

## Updating

To update to the latest version:

```bash
cd ~/.opencode
git pull origin main

# Rebuild configuration
node scripts/build-config.js
```

## Uninstalling

To completely remove:

```bash
# Remove repository
rm -rf ~/.opencode

# Remove config
rm -rf ~/.config/opencode

# Remove symlink if using development install
rm ~/.opencode  # if it was a symlink
```
