#!/bin/bash
#
# Quick build and test script for OpenCode configuration
# Usage: ./quick-build.sh
#

set -e  # Exit on error

echo "🔧 OpenCode Quick Build"
echo "======================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build
echo "📦 Building configuration..."
if node scripts/build-config.js; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""

# Check size
SIZE=$(ls -lh ~/.config/opencode/opencode.json | awk '{print $5}')
echo "📊 Built config size: $SIZE"

# Verify it's not the small source file
if [[ "$SIZE" == "9.4K" || "$SIZE" == "9.5K" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Config is 9.4KB - did you forget to build?${NC}"
    echo "   Run: node scripts/build-config.js"
    exit 1
fi

# Validate JSON
echo "🔍 Validating JSON..."
if cat ~/.config/opencode/opencode.json | python3 -m json.tool > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Valid JSON${NC}"
else
    echo -e "${RED}❌ Invalid JSON${NC}"
    exit 1
fi

# Count agents
AGENT_COUNT=$(grep -c '"model":' ~/.config/opencode/opencode.json)
echo -e "${GREEN}✅ $AGENT_COUNT agents configured${NC}"

echo ""
echo "🚀 Ready to test!"
echo "   Run: opencode"
echo "   Then: @tool-utility test"
echo ""
echo -e "${GREEN}Build complete!${NC}"
