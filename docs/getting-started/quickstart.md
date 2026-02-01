# Quick Start Guide

Get up and running with the OpenCode Base-Layer in 15 minutes.

## Prerequisites

Ensure you have:
- Git installed
- Node.js 18+ installed
- OpenCode installed (`npm install -g opencode`)

## 5-Minute Setup

### 1. Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/coniferconcepts/opencode-global-config.git ~/.opencode

# Create config directory
mkdir -p ~/.config/opencode

# Install dependencies
cd ~/.opencode && npm install
```

### 2. Build (1 minute)

```bash
# Build the configuration (resolves nested file references)
node scripts/build-config.js
```

### 3. Verify (1 minute)

```bash
# Check it worked
ls -lh ~/.config/opencode/opencode.json
# Should show ~406KB

# Count agents
grep -c '"model":' ~/.config/opencode/opencode.json
# Should show 27
```

### 4. Test (1 minute)

```bash
# Start OpenCode
opencode

# Test an agent
@tool-utility echo "Hello from base-layer!"
```

## Your First Project (10 minutes)

### 1. Initialize Project (3 minutes)

```bash
# Navigate to where you want your project
cd ~/CODE

# Initialize with the base-layer
~/.opencode/scripts/init-project.sh

# Enter project name: my-first-app
# Select template: 1) TanStack Start
```

### 2. Explore (3 minutes)

```bash
cd my-first-app
ls -la

# You should see:
# - src/ - Source code
# - .opencode/ - Project-specific OpenCode config
# - docs/ - Project documentation
# - tests/ - Test files
```

### 3. Build a Feature (4 minutes)

In OpenCode:

```
@planner help me create a simple todo list feature
```

The planner will:
1. Decompose the feature into tasks
2. Delegate to appropriate agents
3. Generate the code
4. Run tests
5. Commit the changes

## Common Commands

### Quick Build

```bash
# Build and verify config
cd ~/CODE/opencode-global-config && ./quick-build.sh
```

### Initialize New Project

```bash
~/.opencode/scripts/init-project.sh
```

### Use Agents

```bash
opencode
```

Then:
```
@planner plan my next feature
@code-reviewer review my last commit
@valibot-expert create validation schema for users
```

## Next Steps

- [Complete Setup Guide](setup-guide.md) - Deep dive into configuration
- [Architecture Overview](../architecture/README.md) - Understand the system
- [Agent Registry](../reference/agent-registry.md) - See all available agents

## Help

Stuck? Try these:

```bash
# Verify your installation
bash ~/.opencode/scripts/verify.sh

# Check what's configured
@tool-utility show me the project structure

# Get help
@planner I'm stuck, can you help me understand the project?
```
