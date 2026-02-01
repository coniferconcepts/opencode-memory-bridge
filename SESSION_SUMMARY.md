# OpenCode Global Configuration - Summary

## Overview

This repository contains a **comprehensive, production-ready global OpenCode configuration** optimized for modern TypeScript full-stack development with Legend State, Tamagui, tRPC, and Hono. It distills best practices from production projects like content-tracker and BounceWorkouts.

## 🎯 What's New

Based on your BounceWorkouts preferences, the configuration now includes:

### New Technology-Specific Agents
- **@legend-state-expert** - Legend State v3 observable state, persistence, sync
- **@valibot-expert** - Valibot schema validation, type inference
- **@tamagui-expert** - Tamagui UI components, tokens, cross-platform design
- **@context7-super-expert** - Deep documentation retrieval via Context7 MCP

### Updated Stack Templates
Both **TanStack Start** and **Expo Native** stacks now include:
- Legend State v3 (NOT TanStack Query)
- Valibot validation (NOT Zod/Yup)
- Tamagui UI (NOT Tailwind)
- tRPC + Hono API layer
- Drizzle ORM + Cloudflare D1
- Better Auth
- Bun runtime (NOT npm/pnpm)
- Biome linting (NOT ESLint/Prettier)
- Vitest testing

### Critical Guardrails Added
1. **P04 Field Mapping** - NEVER direct mapping, ALWAYS use transformers
2. **Legend State fieldId** - MUST match API field names
3. **Valibot ONLY** - NO Zod or Yup
4. **Tamagui tokens ONLY** - NO hardcoded hex or pixel values
5. **Bun ONLY** - NO npm or pnpm

## 📁 Repository Structure

```
opencode-global-config/
├── README.md                           # Main documentation
├── LICENSE                             # MIT License
├── .gitignore                          # Git ignore rules
├── SESSION_SUMMARY.md                  # This file
├── config/
│   └── opencode.json                   # Global config template (24 agents)
├── universal/
│   ├── AGENTS.md                       # Project template
│   └── prompts/
│       ├── base-orchestrator.txt       # Base prompt templates
│       ├── base-subagent.txt
│       └── agents/                     # 24 agent-specific prompts
│           ├── code-reviewer.txt
│           ├── planner.txt
│           ├── solo-orchestrator.txt
│           ├── legend-state-expert.txt # NEW
│           ├── valibot-expert.txt      # NEW
│           ├── tamagui-expert.txt      # NEW
│           ├── context7-super-expert.txt # NEW
│           ├── cloudflare-expert.txt
│           ├── security-expert.txt
│           └── ... (24 total)
├── stacks/
│   ├── cloudflare-worker/              # CF Workers + D1 + R2
│   │   └── README.md
│   ├── tanstack-start/                 # Full-stack web
│   │   └── README.md                   # Updated with Legend State, Valibot, etc.
│   └── expo-native/                    # React Native mobile
│       └── README.md                   # Updated with Legend State, Valibot, etc.
├── scripts/
│   └── init-project.sh                 # Project initialization
└── docs/
    └── SETUP_GUIDE.md                  # Detailed setup instructions
```

## 🤖 Complete Agent List (24 Total)

### Primary Agents (Orchestrators)
| Agent | Model | Purpose |
|-------|-------|---------|
| @code-reviewer | glm-4.7 | Code review pipeline coordinator |
| @planner | glm-4.7 | Task decomposition and multi-expert coordination |
| @solo-orchestrator | glm-4.7 | Solo developer workflow with self-review |

### Technology Experts (NEW!)
| Agent | Model | Purpose |
|-------|-------|---------|
| @legend-state-expert | glm-4.7 | Legend State v3, syncedCrud, persistence |
| @valibot-expert | glm-4.7 | Valibot validation, schemas, type inference |
| @tamagui-expert | glm-4.7 | Tamagui UI, tokens, cross-platform design |
| @context7-super-expert | glm-4.7 | Deep docs via Context7 MCP |

### Platform & Security
| Agent | Model | Purpose |
|-------|-------|---------|
| @cloudflare-expert | glm-4.7 | Workers, D1, tRPC patterns |
| @security-expert | glm-4.7 | Security patterns and anti-patterns |
| @gpt5-security | gpt-5.2 | Security audits |

### Review & Quality
| Agent | Model | Purpose |
|-------|-------|---------|
| @deep-reviewer | glm-4.7 | Deep architectural analysis |
| @test-reviewer | glm-4.7 | Test coverage and quality |
| @fast-validator | glm-4.7 | Fast pattern matching |
| @guardrail-validator | glm-4.7 | Guardrail compliance |
| @always-works-validator | glm-4.7 | Production-readiness checks |

### Utilities
| Agent | Model | Purpose |
|-------|-------|---------|
| @tool-utility | glm-4.7 | Mechanical file operations |
| @flash-lite | gemini-3-flash | Read-only reconnaissance |
| @glm-flash | glm-4.7-free | Fast GLM via OpenRouter |
| @glm-executor | glm-4.7-free | Mechanical code executor |
| @kimi-premium | kimi-k2.5 | Premium reasoning |
| @codexmax-implementation | gpt-5.2-codex | Precise TypeScript |
| @dependency-guardian | glm-4.7 | Dependency evaluation |
| @doc-guardian | glm-4.7 | Documentation maintenance |
| @terminal-error-reviewer | glm-4.7 | Error diagnosis |
| @frontend-designer | glm-4.7 | UI/UX design |
| @memory-bridge | glm-4.7 | Context continuity |

## 🚀 Quick Start

### 1. Set Up Global Config

```bash
# Clone to standard location
git clone https://github.com/YOUR_USERNAME/opencode-global-config.git ~/.opencode

# Copy global configuration
mkdir -p ~/.config/opencode
cp ~/.opencode/config/opencode.json ~/.config/opencode/

# Verify
ls -la ~/.config/opencode/opencode.json
ls -la ~/.opencode/universal/prompts/agents/
```

### 2. Initialize a New Project

```bash
cd ~/CODE/my-new-project
~/.opencode/scripts/init-project.sh

# Select your stack:
# 1) TanStack Start - Web app with Legend State, Valibot, Tamagui
# 2) Expo Native - Mobile app with same stack
# 3) Cloudflare Worker - API/server focused
# 4) Minimal - Base configuration
```

### 3. Start Coding with Agents

```bash
# Legend State patterns
@legend-state-expert help me set up syncedCrud for workouts

# Valibot validation
@valibot-expert create a schema for user registration

# Tamagui UI
@tamagui-expert review my component for token usage

# Deep documentation lookup
@context7-super-expert look up Legend State v3 offline-first best practices

# Field mapping validation (CRITICAL!)
bun run validate:fields
```

## 🛡️ Critical Guardrails

### Technology Stack (NEVER Deviate)
```
State:      Legend State v3 (NOT TanStack Query/Zustand/Redux)
Validation: Valibot (NOT Zod/Yup)
UI:         Tamagui (NOT Tailwind/NativeWind)
API:        tRPC + Hono (NOT REST/GraphQL directly)
Database:   Drizzle ORM + Cloudflare D1
Auth:       Better Auth
Runtime:    Bun (NOT npm/pnpm)
Linting:    Biome (NOT ESLint/Prettier)
Testing:    Vitest
```

### CRITICAL: Field Mapping (P04)
**ALWAYS validate before committing:**
```bash
bun run validate:fields    # Prevents silent data loss!
```

**NEVER do direct field mapping:**
```typescript
// ❌ WRONG - Direct mapping (causes data loss!)
const workoutUI = { ...dbRecord, id: dbRecord.workoutId }

// ✅ CORRECT - Use transformer
const workoutUI = toWorkoutUI(dbRecord)
```

### Legend State CRITICAL Rules
1. **ALWAYS use `fieldId`** - Match API field name exactly
2. **ALWAYS use `use$()` hook** - For React component reactivity
3. **NEVER use TanStack Query** - Use Legend State + synced
4. **ALWAYS persist with MMKV** (mobile) or localStorage (web)

### Valibot CRITICAL Rules
1. **NEVER use Zod/Yup** - Valibot ONLY
2. **ALWAYS infer types** - `type User = v.InferOutput<typeof userSchema>`
3. **ALWAYS validate API inputs** - Use in tRPC procedures
4. **ALWAYS use pipes** - `v.pipe(v.string(), v.email())`

### Tamagui CRITICAL Rules
1. **ALWAYS use tokens** - `$purple9`, `$space4`, `$size5`
2. **NEVER hardcode values** - NO hex codes, NO pixel values
3. **ALWAYS universal components** - Work on web AND native
4. **NEVER Tailwind** - Tamagui ONLY

## 📝 Example Usage

### Legend State + syncedCrud
```typescript
import { observable, syncedCrud } from '@legendapp/state'

const workouts$ = observable(syncedCrud({
  initial: [],
  fieldId: 'workoutId',      // CRITICAL: Match API field name
  fieldUpdatedAt: 'updatedAt',
  list: () => api.workouts.list(),
  create: (w) => api.workouts.create(w),
}))

// React component
import { use$ } from '@legendapp/state/react'
function WorkoutList() {
  const workouts = use$(workouts$)
  return workouts.map(w => <Card key={w.workoutId} workout={w} />)
}
```

### Valibot Schema
```typescript
import * as v from 'valibot'

const userSchema = v.object({
  userId: v.pipe(v.string(), v.uuid()),
  email: v.pipe(v.string(), v.email()),
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
})

type User = v.InferOutput<typeof userSchema>
```

### Tamagui Component
```tsx
import { YStack, Text, Button } from '@myapp/ui'

function WorkoutCard({ workout, onStart }) {
  return (
    <YStack
      padding="$4"              // Token, not 16
      backgroundColor="$purple9" // Token, not #8B5CF6
      borderRadius="$4"         // Token, not 8
    >
      <Text color="$white" fontSize="$6">
        {workout.title}
      </Text>
      <Button theme="active" onPress={onStart}>
        Start
      </Button>
    </YStack>
  )
}
```

## 🔧 Files Modified/Added

### New Agent Prompts (4 files)
- `universal/prompts/agents/legend-state-expert.txt`
- `universal/prompts/agents/valibot-expert.txt`
- `universal/prompts/agents/tamagui-expert.txt`
- `universal/prompts/agents/context7-super-expert.txt`

### Updated Stack READMEs (2 files)
- `stacks/tanstack-start/README.md` - Complete stack documentation
- `stacks/expo-native/README.md` - Complete stack documentation

### Updated Config Files (2 files)
- `config/opencode.json` - Added 4 new agents (24 total)
- `~/.config/opencode/opencode.json` - Active global config

### Updated Templates (1 file)
- `universal/AGENTS.md` - Updated with Bun commands and current stack

## 📊 Stats

- **Total Agents**: 24
- **New Agents**: 4 (legend-state, valibot, tamagui, context7-super)
- **Stack Templates**: 3 (TanStack Start, Expo Native, Cloudflare Worker)
- **Technology Guardrails**: 10+
- **Lines of Documentation**: ~5,000

## 🎉 Ready to Use!

Your optimized global OpenCode configuration is complete!

### Next Steps:
1. Push to GitHub: `git init && git add . && git commit -m "Add Legend State, Valibot, Tamagui support" && git push`
2. Initialize your first project: `~/.opencode/scripts/init-project.sh`
3. Start coding with @legend-state-expert, @valibot-expert, @tamagui-expert!

**Remember**: Always run `bun run validate:fields` before committing to prevent data loss!

---

**Version**: 2.0.0
**Last Updated**: 2026-02-01
**Tech Stack**: Legend State v3, Valibot, Tamagui, tRPC, Hono, Bun, Drizzle, Better Auth
