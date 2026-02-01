# ✅ Update Complete - OpenCode Configuration

## Summary of Changes

Your global OpenCode configuration has been successfully updated with your preferred technologies from production projects like BounceWorkouts.

## 🆕 What Was Added/Updated

### 1. New Technology-Specific Agents (4)

#### @legend-state-expert
- **Purpose**: Legend State v3 observable state management
- **Expertise**: syncedCrud, persistence (MMKV/localStorage), fieldId configuration, offline-first patterns
- **Key Guardrails**: fieldId MUST match API, NEVER use TanStack Query, ALWAYS use `use$()` hook

#### @valibot-expert
- **Purpose**: Valibot schema validation and type inference
- **Expertise**: Schema composition, pipes, type inference (InferOutput), validation patterns
- **Key Guardrails**: NEVER use Zod/Yup, ALWAYS infer types from schemas

#### @tamagui-expert
- **Purpose**: Tamagui universal UI components
- **Expertise**: Tokens, theming, cross-platform components, responsive design
- **Key Guardrails**: ALWAYS use tokens ($purple9), NEVER hardcode hex/px values, NEVER use Tailwind

#### @context7-super-expert
- **Purpose**: Deep documentation retrieval via Context7 MCP
- **Expertise**: Library-specific documentation lookup, best practices from official sources
- **Integration**: Uses `use context7` tool for authoritative knowledge
- **Key Use Cases**: Legend State patterns, Valibot validation, Tamagui configuration, tRPC setup

### 2. Updated Stack Templates (2)

Both **TanStack Start** and **Expo Native** stacks now include complete documentation for your preferred technology stack:

**Included Technologies:**
- ✅ Legend State v3 (state management)
- ✅ Valibot (validation)
- ✅ Tamagui (UI components)
- ✅ tRPC + Hono (API layer)
- ✅ Drizzle ORM (database)
- ✅ Better Auth (authentication)
- ✅ Bun (runtime)
- ✅ Biome (linting)
- ✅ Vitest (testing)
- ✅ Cloudflare D1 (database hosting)

**Documentation Includes:**
- Project structure for monorepos
- Essential commands (all using `bun`)
- CRITICAL guardrails for each technology
- Best practices with code examples
- Example agent usage patterns
- Stack-specific agent recommendations

### 3. Updated Global Configuration

**File**: `~/.config/opencode/opencode.json` & `config/opencode.json`

**Changes:**
- Added 4 new agents (now 24 total)
- Configured MCP Context7 integration for @context7-super-expert
- Maintained all existing agents (@code-reviewer, @planner, @solo-orchestrator, etc.)

### 4. Updated Universal AGENTS.md Template

**Key Updates:**
- Added technology overview for the current stack
- Replaced `npm` commands with `bun` commands throughout
- Added CRITICAL guardrails for Legend State, Valibot, Tamagui
- Added P04 Field Mapping guardrails (DATA LOSS RISK)
- Added new agents to the agent table
- Added `bun run validate:fields` as critical pre-commit check
- Added technology-specific agent usage examples

## 🎯 Key Features of Your Configuration

### Technology Guardrails (CRITICAL)

Your configuration now enforces these non-negotiable rules:

```
State:      Legend State v3 ONLY (no TanStack Query/Zustand)
Validation: Valibot ONLY (no Zod/Yup)
UI:         Tamagui ONLY (no Tailwind)
API:        tRPC + Hono ONLY (no REST/GraphQL)
Runtime:    Bun ONLY (no npm/pnpm)
Linting:    Biome ONLY (no ESLint/Prettier)
```

### Field Mapping Protection (P04)

**CRITICAL: Run before every commit**
```bash
bun run validate:fields    # Prevents silent data loss!
```

Your configuration now emphasizes this pattern:
```typescript
// ❌ WRONG - Never do direct mapping
const workoutUI = { ...dbRecord, id: dbRecord.workoutId }

// ✅ CORRECT - Always use transformer
const workoutUI = toWorkoutUI(dbRecord)
```

### Agent Usage Patterns

```bash
# Legend State patterns
@legend-state-expert help me set up syncedCrud for workouts

# Valibot validation
@valibot-expert create a schema for user registration

# Tamagui UI review
@tamagui-expert review my component for token usage

# Deep documentation lookup
@context7-super-expert look up Legend State v3 offline-first patterns

# Field mapping validation
@cloudflare-expert help with D1 schema design
```

## 📁 File Locations

### Active Global Config
- `~/.config/opencode/opencode.json` - 24 agents including 4 new ones
- `~/.opencode/` - Symlinked from `~/CODE/opencode-global-config/`

### GitHub Repository
- `~/CODE/opencode-global-config/` - Full repo ready to push
- **Total Files**: 38 (markdown, json, sh, txt)
- **New Files**: 4 agent prompts + updated stack READMEs + updated AGENTS.md

### Key Files Created/Modified

**New Agent Prompts:**
1. `universal/prompts/agents/legend-state-expert.txt`
2. `universal/prompts/agents/valibot-expert.txt`
3. `universal/prompts/agents/tamagui-expert.txt`
4. `universal/prompts/agents/context7-super-expert.txt`

**Updated Stack Docs:**
5. `stacks/tanstack-start/README.md` - Complete stack guide
6. `stacks/expo-native/README.md` - Complete stack guide

**Updated Templates:**
7. `universal/AGENTS.md` - Updated with current technology stack
8. `config/opencode.json` - 24 agents
9. `~/.config/opencode/opencode.json` - Active config
10. `SESSION_SUMMARY.md` - Complete documentation

## 🚀 How to Use

### 1. Push to GitHub (Recommended)
```bash
cd ~/CODE/opencode-global-config
git init
git add .
git commit -m "Add Legend State, Valibot, Tamagui, tRPC, Hono, Bun, Biome support"
git remote add origin https://github.com/YOUR_USERNAME/opencode-global-config.git
git push -u origin main
```

### 2. Initialize a New Project
```bash
cd ~/CODE/my-new-app
~/CODE/opencode-global-config/scripts/init-project.sh

# Select: 1) TanStack Start for web
#    or: 2) Expo Native for mobile
```

### 3. Start Using Your Agents
```bash
# Your agents are ready!
@legend-state-expert help with observable setup
@valibot-expert create validation schemas
@tamagui-expert review UI components
@context7-super-expert lookup documentation
```

## 📊 Configuration Stats

- **Total Agents**: 24 (20 existing + 4 new)
- **Stack Templates**: 3 (TanStack Start, Expo Native, Cloudflare Worker)
- **Technology Guardrails**: 10+ CRITICAL rules
- **Documentation**: ~5,500 lines across all files
- **Prompt Templates**: 24 agent-specific prompts

## 🎉 Benefits

1. **Consistency** - Same agents and standards across all your projects
2. **Best Practices** - Distilled from BounceWorkouts production experience
3. **Time Savings** - Automated project setup with `init-project.sh`
4. **Quality** - Built-in guardrails prevent common mistakes
5. **Deep Knowledge** - Context7 integration for authoritative documentation
6. **Technology Alignment** - Enforces your preferred stack (Legend State, Valibot, Tamagui)

## 📝 Next Steps

1. **Push to GitHub** to version control your configuration
2. **Test the init script** on a new project
3. **Try the new agents** on your existing BounceWorkouts project
4. **Customize further** - Add project-specific agents as needed
5. **Share with team** if working with others

## 🆘 Support

- **Setup Guide**: `docs/SETUP_GUIDE.md`
- **Stack Docs**: `stacks/*/README.md`
- **Session Summary**: `SESSION_SUMMARY.md`
- **Agent Prompts**: `universal/prompts/agents/`

---

**Your global OpenCode configuration is ready to use!**

Remember: Always run `bun run validate:fields` before committing to prevent data loss!
