#!/bin/bash
# OpenCode Global Configuration Setup Script
# Usage: bash scripts/setup.sh

set -e

echo "OpenCode Global Configuration Setup"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v git &> /dev/null; then
    echo -e "${RED}✗ Git is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git installed${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠ Node.js is not installed (optional but recommended)${NC}"
fi

# Determine installation method
echo ""
echo "Choose installation method:"
echo "1. Standard (~/.opencode directly) - Recommended for users"
echo "2. Development (~/CODE/ with symlink) - Recommended for contributors"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    # Standard installation
    REPO_DIR="$HOME/.opencode"
    
    if [ -d "$REPO_DIR" ]; then
        echo -e "${YELLOW}⚠ $REPO_DIR already exists${NC}"
        read -p "Overwrite? (y/N): " overwrite
        if [ "$overwrite" = "y" ]; then
            rm -rf "$REPO_DIR"
        else
            echo "Setup cancelled"
            exit 1
        fi
    fi
    
    echo "Cloning to $REPO_DIR..."
    # Note: Update this URL to your actual repo
    git clone https://github.com/coniferconcepts/opencode-global-config.git "$REPO_DIR"
    
elif [ "$choice" = "2" ]; then
    # Development installation
    CODE_DIR="$HOME/CODE/opencode-global-config"
    SYMLINK="$HOME/.opencode"
    
    if [ -d "$CODE_DIR" ]; then
        echo -e "${YELLOW}⚠ $CODE_DIR already exists${NC}"
        read -p "Overwrite? (y/N): " overwrite
        if [ "$overwrite" = "y" ]; then
            rm -rf "$CODE_DIR"
        else
            echo "Setup cancelled"
            exit 1
        fi
    fi
    
    # Remove old symlink if exists
    if [ -L "$SYMLINK" ]; then
        rm "$SYMLINK"
    fi
    
    echo "Cloning to $CODE_DIR..."
    git clone https://github.com/YOUR_USERNAME/opencode-global-config.git "$CODE_DIR"
    
    echo "Creating symlink..."
    ln -s "$CODE_DIR" "$SYMLINK"
    echo -e "${GREEN}✓ Created symlink: $SYMLINK -> $CODE_DIR${NC}"
    
else
    echo -e "${RED}Invalid choice${NC}"
    exit 1
fi

# Create config directory
CONFIG_DIR="$HOME/.config/opencode"
mkdir -p "$CONFIG_DIR"

# Copy global config
echo ""
echo "Installing global configuration..."
cp "$REPO_DIR/config/opencode.json" "$CONFIG_DIR/opencode.json"
echo -e "${GREEN}✓ Copied config to $CONFIG_DIR/opencode.json${NC}"

# Verify installation
echo ""
echo "Verifying installation..."

# Check agent count
AGENT_COUNT=$(grep -c '"model":' "$CONFIG_DIR/opencode.json" 2>/dev/null || echo "0")
if [ "$AGENT_COUNT" -eq 25 ]; then
    echo -e "${GREEN}✓ All 25 agents configured${NC}"
else
    echo -e "${YELLOW}⚠ Agent count: $AGENT_COUNT (expected 25)${NC}"
fi

# Check prompt files
PROMPT_COUNT=$(ls "$REPO_DIR/universal/prompts/agents/"*.txt 2>/dev/null | wc -l)
if [ "$PROMPT_COUNT" -eq 25 ]; then
    echo -e "${GREEN}✓ All 25 prompt files present${NC}"
else
    echo -e "${YELLOW}⚠ Prompt files: $PROMPT_COUNT (expected 25)${NC}"
fi

# Test router script
if [ -f "$REPO_DIR/scripts/router.js" ]; then
    echo -e "${GREEN}✓ Router script found${NC}"
else
    echo -e "${RED}✗ Router script missing${NC}"
fi

# Create cache directory
mkdir -p "$REPO_DIR/.cache"

echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update the GitHub URL in this script to your actual repo"
echo "2. Test the router: node $REPO_DIR/scripts/router.js 'test query'"
echo "3. Start using agents in your projects!"
echo ""
echo "Directory structure:"
echo "  Active config: ~/.config/opencode/opencode.json"
echo "  Repository:    $REPO_DIR"
echo ""
echo "To verify: bash $REPO_DIR/scripts/verify.sh"
