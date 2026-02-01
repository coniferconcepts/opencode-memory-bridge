#!/bin/bash
# Verification script for OpenCode Global Config
# Usage: bash scripts/verify.sh

echo "OpenCode Global Configuration Verification"
echo "=========================================="
echo ""

ERRORS=0

# Check 1: Active config exists
if [ -f "$HOME/.config/opencode/opencode.json" ]; then
    echo "✓ Active config exists: ~/.config/opencode/opencode.json"
else
    echo "✗ Missing: ~/.config/opencode/opencode.json"
    ((ERRORS++))
fi

# Check 2: Repository exists
if [ -d "$HOME/.opencode" ]; then
    echo "✓ Repository exists: ~/.opencode"
    
    # Check if it's a symlink (Method B)
    if [ -L "$HOME/.opencode" ]; then
        echo "  (Symlink to: $(readlink $HOME/.opencode))"
    fi
else
    echo "✗ Missing: ~/.opencode directory"
    ((ERRORS++))
fi

# Check 3: Agent count
AGENTS=$(grep -c '"model":' "$HOME/.config/opencode/opencode.json" 2>/dev/null || echo "0")
if [ "$AGENTS" -eq 25 ]; then
    echo "✓ Agent count correct: $AGENTS"
else
    echo "✗ Agent count incorrect: $AGENTS (expected 25)"
    ((ERRORS++))
fi

# Check 4: Prompt files
PROMPTS=$(ls "$HOME/.opencode/universal/prompts/agents/"*.txt 2>/dev/null | wc -l)
if [ "$PROMPTS" -eq 25 ]; then
    echo "✓ Prompt files correct: $PROMPTS"
else
    echo "✗ Prompt files incorrect: $PROMPTS (expected 25)"
    ((ERRORS++))
fi

# Check 5: Critical files exist
FILES=(
    "$HOME/.opencode/config/agent-metadata.json"
    "$HOME/.opencode/config/routing.json"
    "$HOME/.opencode/scripts/router.js"
    "$HOME/.opencode/scripts/init-project.sh"
    "$HOME/.opencode/README.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $(basename $file) exists"
    else
        echo "✗ Missing: $(basename $file)"
        ((ERRORS++))
    fi
done

# Check 6: Test router (if node available)
if command -v node &> /dev/null; then
    echo ""
    echo "Testing router..."
    if node "$HOME/.opencode/scripts/router.js" "test" > /dev/null 2>&1; then
        echo "✓ Router script works"
    else
        echo "⚠ Router test failed (may need dependencies)"
    fi
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Installation is complete."
    exit 0
else
    echo "❌ $ERRORS issue(s) found. Please review above."
    exit 1
fi
