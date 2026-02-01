#!/bin/bash
#
# OpenCode Global Configuration - Project Initialization Script
# This script initializes a new project with global OpenCode configuration
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global config location
GLOBAL_CONFIG_DIR="$HOME/.opencode"
GLOBAL_CONFIG_FILE="$HOME/.config/opencode/opencode.json"

# Functions
print_header() {
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    if [ ! -d "$GLOBAL_CONFIG_DIR" ]; then
        print_error "Global OpenCode config not found at $GLOBAL_CONFIG_DIR"
        echo "Please clone and set up the global config first:"
        echo "  git clone <repo-url> ~/.opencode"
        exit 1
    fi
    
    if [ ! -f "$GLOBAL_CONFIG_FILE" ]; then
        print_warning "Global opencode.json not found at $GLOBAL_CONFIG_FILE"
        print_info "Will create from template"
    fi
    
    print_success "Prerequisites check complete"
}

select_stack() {
    print_header "Select Project Stack"
    
    echo "Available stacks:"
    echo "  1) Cloudflare Worker (TypeScript + Workers + D1 + R2 + Queues)"
    echo "  2) Tanstack Start (Full-stack web app with Tanstack)"
    echo "  3) Expo Native (React Native mobile app)"
    echo "  4) Minimal (Base configuration only)"
    echo ""
    
    read -p "Enter your choice (1-4): " stack_choice
    
    case $stack_choice in
        1) STACK="cloudflare-worker" ;;
        2) STACK="tanstack-start" ;;
        3) STACK="expo-native" ;;
        4) STACK="minimal" ;;
        *) 
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    print_success "Selected stack: $STACK"
}

init_project() {
    print_header "Initializing Project"
    
    PROJECT_DIR=$(pwd)
    PROJECT_NAME=$(basename "$PROJECT_DIR")
    
    print_info "Project: $PROJECT_NAME"
    print_info "Location: $PROJECT_DIR"
    print_info "Stack: $STACK"
    
    # Check if already initialized
    if [ -f "$PROJECT_DIR/opencode.json" ]; then
        print_warning "opencode.json already exists"
        read -p "Overwrite? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "Skipping initialization"
            exit 0
        fi
    fi
    
    # Create .opencode directory
    mkdir -p "$PROJECT_DIR/.opencode"
    
    # Create project-specific opencode.json
    create_opencode_config
    
    # Create AGENTS.md
    create_agents_md
    
    # Create .gitignore additions
    update_gitignore
    
    # Copy stack-specific templates if applicable
    if [ "$STACK" != "minimal" ] && [ -d "$GLOBAL_CONFIG_DIR/stacks/$STACK" ]; then
        copy_stack_templates
    fi
    
    print_success "Project initialized successfully!"
}

create_opencode_config() {
    print_info "Creating opencode.json..."
    
    cat > "$PROJECT_DIR/opencode.json" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "extends": "~/.config/opencode/opencode.json",
  "model": "opencode/glm-4.7",
  "agent": {
    "project-context": {
      "model": "opencode/glm-4.7",
      "prompt": "You are working on a PROJECT_NAME project. 

## Project Context
- **Stack**: STACK_NAME
- **Created**: $(date +%Y-%m-%d)

## Guidelines
- Follow all guardrails defined in AGENTS.md
- Use the appropriate stack-specific agents
- Maintain documentation in docs/
- Run npm run check before committing",
      "description": "Project context agent with stack-specific knowledge",
      "mode": "subagent"
    }
  }
}
EOF
    
    # Replace placeholders
    sed -i.bak "s/PROJECT_NAME/$PROJECT_NAME/g" "$PROJECT_DIR/opencode.json"
    sed -i.bak "s/STACK_NAME/$STACK/g" "$PROJECT_DIR/opencode.json"
    rm -f "$PROJECT_DIR/opencode.json.bak"
    
    print_success "Created opencode.json"
}

create_agents_md() {
    print_info "Creating AGENTS.md..."
    
    if [ -f "$GLOBAL_CONFIG_DIR/universal/AGENTS.md" ]; then
        cp "$GLOBAL_CONFIG_DIR/universal/AGENTS.md" "$PROJECT_DIR/AGENTS.md"
        
        # Add project-specific section
        cat >> "$PROJECT_DIR/AGENTS.md" << EOF

---

## Project-Specific Information

### Stack
**$STACK**

### Project Structure
\`\`\`
src/          - Source code
tests/        - Test files
docs/         - Documentation
\`\`\`

### Quick Commands
\`\`\`bash
npm run check        # Run validation
npm run test         # Run tests
npm run build        # Build project
\`\`\`

### Stack-Specific Agents
**ADD YOUR STACK-SPECIFIC AGENTS HERE**

---

**Initialized**: $(date +%Y-%m-%d)
**Template**: Global OpenCode Configuration
EOF
        
        print_success "Created AGENTS.md"
    else
        print_warning "Global AGENTS.md template not found"
    fi
}

update_gitignore() {
    print_info "Updating .gitignore..."
    
    if [ ! -f "$PROJECT_DIR/.gitignore" ]; then
        touch "$PROJECT_DIR/.gitignore"
    fi
    
    # Add OpenCode-specific entries if not present
    if ! grep -q "\.opencode/backup" "$PROJECT_DIR/.gitignore"; then
        cat >> "$PROJECT_DIR/.gitignore" << 'EOF'

# OpenCode
.opencode/backup*
.opencode-backups/
.opencode/*.log
*.opencode.tmp

# Environment
.env
.env.local
.env.*.local
.dev.vars

# Secrets
*.secret
*.key
EOF
        print_success "Updated .gitignore"
    else
        print_info ".gitignore already contains OpenCode entries"
    fi
}

copy_stack_templates() {
    print_info "Copying $STACK stack templates..."
    
    STACK_DIR="$GLOBAL_CONFIG_DIR/stacks/$STACK"
    
    # Copy README if exists
    if [ -f "$STACK_DIR/README.md" ]; then
        cp "$STACK_DIR/README.md" "$PROJECT_DIR/STACK_README.md"
        print_success "Copied stack README"
    fi
    
    # Copy any stack-specific prompts
    if [ -d "$STACK_DIR/prompts" ]; then
        mkdir -p "$PROJECT_DIR/.opencode/prompts"
        cp -r "$STACK_DIR/prompts/"* "$PROJECT_DIR/.opencode/prompts/" 2>/dev/null || true
        print_success "Copied stack prompts"
    fi
    
    print_success "Stack templates copied"
}

print_summary() {
    print_header "Initialization Complete"
    
    echo ""
    echo "Your project is now configured with OpenCode!"
    echo ""
    echo -e "${GREEN}Created files:${NC}"
    echo "  - opencode.json (project configuration)"
    echo "  - AGENTS.md (agent guidelines)"
    echo "  - .opencode/ (OpenCode directory)"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "  1. Review and customize AGENTS.md for your project"
    echo "  2. Add project-specific agents to opencode.json"
    echo "  3. Run 'npm install' if this is a Node.js project"
    echo "  4. Start coding with your AI agents!"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "  - Global config: ~/.opencode/"
    echo "  - Project config: ./opencode.json"
    echo "  - Agent guidelines: ./AGENTS.md"
    echo ""
}

# Main execution
main() {
    print_header "OpenCode Project Initialization"
    
    check_prerequisites
    select_stack
    init_project
    print_summary
}

# Run main
main
