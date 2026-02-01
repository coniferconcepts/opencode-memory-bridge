# Contributing to OpenCode Base-Layer

Thank you for your interest in contributing! This guide will help you get started.

## Ways to Contribute

### 1. Report Issues
- **Bugs**: Use the [bug report template](../.github/ISSUE_TEMPLATE/bug_report.md)
- **Features**: Use the [feature request template](../.github/ISSUE_TEMPLATE/feature_request.md)
- **Documentation**: Submit documentation improvements via PR

### 2. Add Agents
- Create specialized agents for new domains
- Improve existing agent prompts
- Share agent performance feedback

### 3. Create Patterns
- Add reusable code patterns to `universal/patterns/`
- Document patterns with examples
- Include instantiation templates

### 4. Enhance Guardrails
- Add new safety checks
- Improve existing guardrails
- Share common mistake patterns

### 5. Build Stacks
- Create new stack templates
- Improve existing templates
- Add stack-specific agents

### 6. Documentation
- Improve existing docs
- Add guides and tutorials
- Translate documentation

## Development Setup

### 1. Fork and Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git
cd opencode-global-config
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Build Configuration

```bash
node scripts/build-config.js
```

### 4. Verify

```bash
./quick-build.sh
```

## Making Changes

### Adding a New Agent

1. **Create prompt file**:
```bash
touch universal/prompts/agents/my-agent.txt
```

2. **Write the prompt** following the template:
```
{file:base-subagent.txt}

# MY AGENT

## Role
Brief description of the agent's purpose

## Capabilities
- What the agent can do
- Specific knowledge areas

## Guardrails
- Constraints the agent must follow
- Safety considerations

## Workflow
1. Step one
2. Step two
3. Step three
```

3. **Add to configuration**:
Edit `config/opencode.json`:
```json
{
  "name": "my-agent",
  "model": "opencode/glm-4.7",
  "prompt": "{file:~/.opencode/universal/prompts/agents/my-agent.txt}",
  "description": "What this agent does"
}
```

4. **Add routing metadata** (optional):
Edit `config/agent-metadata.json`:
```json
{
  "my-agent": {
    "category": "specialists",
    "triggers": ["trigger1", "trigger2"],
    "model": "opencode/glm-4.7"
  }
}
```

5. **Rebuild**:
```bash
node scripts/build-config.js
```

6. **Test**:
```bash
opencode
@my-agent test
```

### Adding a Pattern

1. **Create pattern directory**:
```bash
mkdir -p universal/patterns/category/pattern-name
```

2. **Create pattern.yaml**:
```yaml
name: Pattern Name
version: 1.0.0
description: What this pattern does

files:
  - name: Component.tsx
    template: Component.tsx.template
    required: true

dependencies:
  - package-name

instantiation:
  command: "@tool-utility instantiate-pattern pattern-name --target src/"
```

3. **Add templates**

4. **Test the pattern**

### Documentation Changes

1. Edit relevant files in `docs/`
2. Follow the existing structure
3. Update `docs/README.md` index if adding new sections
4. Submit PR with clear description

## Code Style

### General Guidelines

- **Be consistent**: Match existing code style
- **Be clear**: Write self-documenting code
- **Be tested**: Test your changes thoroughly
- **Be documented**: Update docs with your changes

### File Organization

```
universal/prompts/agents/
├── agent-name.txt           # Use kebab-case
├── another-agent.txt
└── ...

universal/patterns/
├── category/
│   └── pattern-name/        # Use kebab-case
│       ├── pattern.yaml
│       └── *.template
```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(agents): add drizzle-expert agent

fix(guardrails): correct field mapping detection
docs(readme): update installation instructions
```

## Submitting Changes

### Pull Request Process

1. **Create a branch**:
```bash
git checkout -b feature/my-feature
```

2. **Make your changes**

3. **Test thoroughly**:
```bash
./quick-build.sh
node scripts/build-config.js
opencode
# Test your changes
```

4. **Commit**:
```bash
git add .
git commit -m "feat: add new feature"
```

5. **Push**:
```bash
git push origin feature/my-feature
```

6. **Create PR**:
- Use the [PR template](../.github/pull_request_template.md)
- Link related issues
- Provide clear description
- Include test results

### PR Review Process

- Automated CI checks must pass
- Documentation must be updated
- At least one maintainer approval required
- Address review feedback promptly

## Development Workflow

### Daily Development

```bash
# Start of day - pull latest
git pull origin main

# Make changes
# ... edit files ...

# Build and test
node scripts/build-config.js
opencode
@tool-utility test

# Commit
git add .
git commit -m "feat: description"
git push
```

### Testing Your Changes

**Build Test**:
```bash
node scripts/build-config.js
```

**JSON Validation**:
```bash
cat ~/.config/opencode/opencode.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

**Agent Test**:
```bash
opencode
@your-agent test your change
```

**Full Test**:
```bash
./quick-build.sh
```

## Questions?

- **General**: Open an issue with question label
- **Agent development**: Tag with `agents` label
- **Documentation**: Tag with `documentation` label

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in relevant documentation

Thank you for helping make OpenCode Base-Layer better!
