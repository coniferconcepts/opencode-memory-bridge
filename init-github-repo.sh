#!/bin/bash
#
# GitHub Repository Initialization Script
# Usage: ./init-github-repo.sh
#

set -e

echo "🚀 GitHub Repository Initialization"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if already a git repo
if [ -d .git ]; then
    echo -e "${YELLOW}⚠️  This is already a git repository${NC}"
    echo "   Current status:"
    git status --short
    echo ""
    read -p "Continue anyway? (y/N): " continue_anyway
    if [ "$continue_anyway" != "y" ]; then
        echo "Cancelled"
        exit 0
    fi
else
    echo "📦 Initializing git repository..."
    git init
    echo -e "${GREEN}✅ Git repository initialized${NC}"
fi

echo ""

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Backups
*.backup
*.bak
*~

# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp

# Logs
*.log

# Node modules (if any)
node_modules/

# Cache
.cache/
EOF
    echo -e "${GREEN}✅ .gitignore created${NC}"
else
    echo -e "${GREEN}✅ .gitignore already exists${NC}"
fi

echo ""

# Add all files
echo "📁 Adding files to git..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    # Commit
    echo "💾 Creating initial commit..."
    git commit -m "Initial commit: OpenCode global configuration with 25 agents

- Complete agent system with 3 orchestrators + 21 specialists  
- Build system for nested file reference resolution
- Intelligent routing with 60-80% context reduction
- Full documentation and setup guides
- Ready for production use"
    echo -e "${GREEN}✅ Initial commit created${NC}"
fi

echo ""
echo "🌐 Next Steps for GitHub:"
echo "========================"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create repository named: opencode-global-config"
echo "3. Make it public (or private)"
echo "4. Do NOT initialize with README"
echo "5. Copy the repository URL"
echo ""
echo "Then run these commands:"
echo ""
echo "   git remote add origin https://github.com/YOUR_USERNAME/opencode-global-config.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo -e "${YELLOW}Replace YOUR_USERNAME with your actual GitHub username${NC}"
echo ""

# Check if remote already exists
if git remote | grep -q origin; then
    echo -e "${GREEN}✅ Remote 'origin' already configured${NC}"
    git remote -v
    echo ""
    read -p "Push to GitHub now? (y/N): " push_now
    if [ "$push_now" = "y" ]; then
        echo "🚀 Pushing to GitHub..."
        git push -u origin main
        echo -e "${GREEN}✅ Successfully pushed to GitHub!${NC}"
    fi
fi

echo ""
echo "📊 Repository Status:"
echo "===================="
git status

echo ""
echo -e "${GREEN}🎉 Repository initialization complete!${NC}"
echo ""
echo "Next: Create the repository on GitHub and push your code."
echo ""
