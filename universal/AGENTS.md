# Universal AGENTS.md Template

## Project Overview (OpenCode)

<!-- REQUIRED: Replace with your project description -->
**INSERT PROJECT DESCRIPTION HERE**

<!-- EXAMPLE:
**MyApp** is a cross-platform fitness tracking application with:
- Web dashboard built with TanStack Start
- Native mobile app built with Expo
- Edge API running on Cloudflare Workers
- Real-time sync across all devices
-->

This project follows a unified full-stack architecture with:
- **State**: Legend State v3 (observables, NOT TanStack Query)
- **Validation**: Valibot (NOT Zod/Yup)
- **UI**: Tamagui (NOT Tailwind)
- **API**: tRPC + Hono on Cloudflare Workers
- **Database**: Drizzle ORM + Cloudflare D1
- **Auth**: Better Auth
- **Runtime**: Bun (NOT npm/pnpm)
- **Linting**: Biome (NOT ESLint/Prettier)
- **Testing**: Vitest

### Quick Start
- **Configuration:** `opencode.json` (root) + `.opencode/opencode.json` (mirror)
- **Global Agents:** Loaded from `~/.config/opencode/opencode.json`
- **Project Agents:** Defined in local `opencode.json` extending global config
- **Init Script:** `~/.opencode/scripts/init-project.sh`

### Available Commands (Global)
```bash
# Core Validation (use bun, never npm)
bun run check                 # Fast parallel validation (lint + type + test)
bun run check:fast            # Ultra-fast (lint + type only)
bun run fix                   # One-command fix (lint + types + validation)

# Pre-flight Validation
bun run pre-dev               # Validate environment before starting
bun run dev:safe              # Smart start with auto-fix

# Critical Validation (ALWAYS RUN BEFORE COMMIT)
bun run validate:fields       # Validate field mappings (P04 - Data Loss Risk)
bun run validate:all          # Run all validations

# Agent Management
bun run agents:sync           # Sync registry to both config locations
bun run agents:validate       # Validate agent configuration
bun run agents:check          # Full health check

# Model Management
bun run switch-model          # Manage agent model assignments
bun run switch-model list     # List all agents with current models
bun run switch-model validate # Validate tier-locks and consistency
```

---

## 🚨 Critical Guardrails

> **Single Source of Truth**: All non-negotiable guardrails should be documented here.
> Agents MUST follow all guardrails defined in this project.

### Technology Stack (NEVER Deviate)
- **NEVER use TanStack Query** - Use Legend State v3 ONLY
- **NEVER use Zod or Yup** - Use Valibot ONLY
- **NEVER use Tailwind** - Use Tamagui tokens ONLY
- **NEVER use npm or pnpm** - Use Bun ONLY
- **NEVER use REST/GraphQL directly** - Use tRPC ONLY
- **NEVER use ESLint/Prettier** - Use Biome ONLY

### Legend State (CRITICAL)
1. **ALWAYS use `fieldId`** - Match API response field name exactly
2. **NEVER use TanStack Query** - Use Legend State observables + synced
3. **ALWAYS persist with MMKV** (mobile) or localStorage (web)
4. **NEVER mutate observables directly** - Use `.set()`, `.assign()`, or actions
5. **ALWAYS use `use$()` hook** - For React components to track observables
6. **ALWAYS use synced patterns** - Use `synced()`, `syncedCrud()`, or `syncedQuery()` for remote data

### Valibot (CRITICAL)
1. **ALWAYS infer types from schemas** - `type User = v.InferOutput<typeof userSchema>`
2. **NEVER use Zod/Yup** - Valibot ONLY for validation
3. **ALWAYS validate API inputs** - Use in tRPC procedures
4. **NEVER skip validation** - Validate all user inputs and form data
5. **ALWAYS use pipes for transforms** - `v.pipe(v.string(), v.email())`
6. **ALWAYS use `safeParse`** for form validation - Handle errors gracefully

### Tamagui (CRITICAL)
1. **ALWAYS use tokens** - `$purple9`, `$space4`, `$size5` (NO hex codes!)
2. **NEVER use Tailwind or raw styles** - Tamagui ONLY
3. **ALWAYS create universal components** - Must work on web AND native
4. **NEVER hardcode pixel values** - Use token-based sizing
5. **ALWAYS use `styled()`** - For reusable component variants
6. **ALWAYS use theme tokens** - Support light/dark mode with `$color`, `$background`

### tRPC + Hono (CRITICAL)
1. **ALWAYS use tRPC for type-safe APIs** - NEVER raw REST endpoints
2. **ALWAYS validate inputs with Valibot** - Use `v.parser()` in middleware
3. **ALWAYS use procedures** - Define reusable `publicProcedure`, `protectedProcedure`
4. **NEVER return raw DB objects** - Transform through field mappers
5. **ALWAYS handle errors consistently** - Use tRPC error codes
6. **ALWAYS use Hono for edge runtime** - Optimized for Cloudflare Workers

### Drizzle ORM + Cloudflare D1 (CRITICAL)
1. **ALWAYS use Drizzle Kit for migrations** - Never manual SQL changes
2. **ALWAYS define schemas explicitly** - Use `sqliteTable()` with all constraints
3. **ALWAYS use relations** - Define foreign keys with Drizzle relations
4. **NEVER use raw SQL without type safety** - Use Drizzle query builder
5. **ALWAYS use transactions** - For multi-table operations
6. **ALWAYS handle D1 limits** - Batch operations, watch query complexity

### Better Auth (CRITICAL)
1. **ALWAYS use Better Auth for authentication** - NEVER roll your own auth
2. **ALWAYS secure sensitive routes** - Use `authMiddleware` in Hono
3. **ALWAYS use proper session management** - Configure session expiration
4. **NEVER store passwords** - Better Auth handles hashing securely
5. **ALWAYS validate OAuth flows** - Verify state parameters
6. **ALWAYS use HTTPS in production** - Secure cookie settings

### Vitest (CRITICAL)
1. **ALWAYS write unit tests** - Every utility function
2. **ALWAYS test field mappings** - Critical for data integrity
3. **ALWAYS use `expectTypeOf`** - For compile-time type testing
4. **NEVER skip test coverage** - Maintain 80% minimum
5. **ALWAYS mock external services** - Use MSW for API mocking
6. **ALWAYS use `describe` blocks** - Organize tests logically

### Field Mappings (P04 - DATA LOSS RISK)
1. **NEVER do direct field mapping** - ALWAYS use `createEntityTransformer`
2. **ALWAYS transform DB fields for UI** - `workoutId` not `id` in UI
3. **NEVER forget field mapping validation** - Run `bun run validate:fields`
4. **ALWAYS validate before committing** - This prevents silent data loss!
5. **ALWAYS document field mappings** - Add JSDoc to transformer functions

### Production Safety
1. **NEVER deploy without validation** - Always run `bun run check` before deploying
2. **NEVER modify production data directly** - Use provided scripts only
3. **NEVER commit secrets** - `.env`, `.dev.vars`, and `*.secret*` files must be in `.gitignore`
4. **ALWAYS test in staging first** - Verify field mappings work correctly
5. **ALWAYS backup before migrations** - D1 snapshots before schema changes

### Security
6. **NEVER expose stack traces** in production (generic errors only)
7. **NEVER log sensitive data** (no tokens, keys, passwords, personal info)
8. **NEVER skip input validation** - validate before processing
9. **NEVER use hardcoded credentials** - environment variables only
10. **ALWAYS use CSP headers** - Content Security Policy for XSS prevention
11. **ALWAYS rate limit APIs** - Prevent abuse and DoS attacks

### Code Quality
12. **NEVER skip type checking** - TypeScript strict mode enabled
13. **NEVER commit without linting** - Biome must pass
14. **ALWAYS run tests** before committing (minimum 80% coverage target)
15. **ALWAYS validate field mappings** - Run `bun run validate:fields`
16. **ALWAYS review dependencies** - Check for security advisories

---

## 🛠️ Core Commands

### Essential Commands (Use These Only)
```bash
# Validation & Quality
bun run check                 # Fast parallel validation (Biome + type + test)
bun run check:fast            # Ultra-fast (Biome + type only)
bun run check:full            # Complete validation including security
bun run fix                   # One-command fix (lint + types + validation)

# Pre-flight & Development
bun run pre-dev               # Validate environment before starting
bun run dev:safe              # Smart start with auto-fix and validation

# Critical Validation (ALWAYS RUN BEFORE COMMIT)
bun run validate:fields       # Field mapping validation (P04 - DATA LOSS RISK!)
bun run validate:all          # Run all validations

# Development
bun run dev                   # Start all dev servers
bun run dev:web               # Start web app only
bun run dev:native            # Start native app only
bun run dev:server            # Start API server only

# Testing
bun run test                  # Run all tests
bun run test:watch            # Watch mode
bun run test:coverage         # Coverage report
bun run test:ui               # Vitest UI

# Database
bun run db:push               # Push schema changes
bun run db:generate           # Generate migrations
bun run db:migrate            # Run migrations
bun run db:studio             # Open Drizzle Studio
bun run db:seed               # Seed development data

# Deployment (Customize for your project)
bun run deploy:staging        # Deploy to staging
bun run deploy:production     # Deploy to production (with validation)
bun run deploy:safe           # Safe deployment with full validation
bun run rollback              # Emergency recovery

# Security
bun run security:scan         # Run all security checks
bun run security:audit        # Dependency vulnerability scan
```

---

## 🤖 Agent System

### Global Agents (from ~/.config/opencode/)

| Agent | Role | Model | Purpose |
|-------|------|-------|---------|
| @code-reviewer | Primary | glm-4.7 | Code review pipeline coordinator |
| @planner | Primary | glm-4.7 | Task decomposition and orchestration |
| @solo-orchestrator | Primary | glm-4.7 | Solo developer workflow |
| @legend-state-expert | Subagent | glm-4.7 | Legend State v3 patterns, sync, persistence |
| @valibot-expert | Subagent | glm-4.7 | Valibot validation, schemas, type inference |
| @tamagui-expert | Subagent | glm-4.7 | Tamagui UI, tokens, theming, cross-platform |
| @cloudflare-expert | Subagent | glm-4.7 | Cloudflare Workers, D1, tRPC patterns |
| @security-expert | Subagent | glm-4.7 | Security patterns and anti-pattern scanning |
| @deep-reviewer | Subagent | glm-4.7 | Deep architectural analysis |
| @tool-utility | Subagent | glm-4.7 | Mechanical file operations |
| @dependency-guardian | Subagent | glm-4.7 | Dependency update evaluation |
| @guardrail-validator | Subagent | glm-4.7 | Guardrail compliance verification |
| @test-reviewer | Subagent | glm-4.7 | Test coverage and quality analysis |
| @context7-super-expert | Subagent | glm-4.7 | Deep documentation lookup via Context7 MCP |
| @flash-lite | Subagent | gemini-3-flash | Read-only reconnaissance |
| @kimi-premium | Subagent | kimi-k2.5 | Premium reasoning tasks |
| @gpt5-security | Subagent | gpt-5.2 | Security audits |
| @codexmax-implementation | Subagent | gpt-5.2-codex | Precise TypeScript implementation |

### Technology-Specific Agent Usage

```bash
# Legend State patterns
@legend-state-expert help me set up syncedCrud for workouts with fieldId mapping

# Valibot validation
@valibot-expert create a schema for user registration with proper type inference

# Tamagui UI
@tamagui-expert review my component for token usage and cross-platform compatibility

# tRPC procedures
@cloudflare-expert help me create a protected tRPC procedure with Better Auth

# Deep knowledge lookup
@context7-super-expert look up Legend State v3 best practices for offline-first sync

# Field mapping validation
@cloudflare-expert help with D1 schema design for field mapping transformers

# Security review
@security-expert audit my tRPC procedures for input validation

# Test coverage
@test-reviewer analyze coverage for my new utilities

# Drizzle ORM
@cloudflare-expert help design a Drizzle schema with proper relations for D1
```

### Project-Specific Agents
<!-- ADD YOUR PROJECT-SPECIFIC AGENTS HERE -->

<!-- EXAMPLE:
| Agent | Role | Model | Purpose |
|-------|------|-------|---------|
| @workout-domain-expert | Subagent | glm-4.7 | Workout/exercise domain logic |
| @analytics-expert | Subagent | glm-4.7 | Analytics and tracking implementation |
-->

---

## 🔄 Model Assignment

### switch-model Commands
```bash
bun run switch-model list              # List all agents
bun run switch-model list --by-role    # Group by role
bun run switch-model list --by-model   # Group by model
bun run switch-model set <agent> <model>  # Set agent model
bun run switch-model reset             # Reset to defaults
bun run switch-model validate          # Validate configuration
```

### Tier-Lock System
Critical agents can be pinned to specific models:
- `tier-lock: "opus"` - Pin to Claude Opus 4.5 (strategic planning)
- `tier-lock: "gpt5"` - Pin to GPT-5.2 (security, contracts)
- `tier-lock: "haiku"` - Pin to Claude Haiku 4.5 (fast execution)

---

## 📋 Dependency Management

```bash
# Reconnaissance
bun run deps:check          # Check outdated packages
bun run deps:health         # Full health ritual

# Assessment
bun run deps:assess         # AI-assisted assessment (@dependency-guardian)

# Updates
bun run deps:update:patch   # Patch versions only (safest)
bun run deps:update:minor   # Minor versions (moderate risk)
bun run deps:update:interactive  # Manual selection
```

**Guardrails:**
- Max 3 packages per batch
- Patch -> Minor -> Major order
- No updates on Friday (unless security)
- Major versions require research first
- **ALWAYS test field mappings after dependency updates**
- **ALWAYS run `bun run check` after updates**

---

## 🏗️ Code Standards

### TypeScript Standards
- **Strict mode enabled** - No `any` types without justification
- **Explicit return types** on public functions
- **Interface over type** for object shapes
- **Null safety** - Use optional chaining and nullish coalescing
- **No unchecked indexed access** - `noUncheckedIndexedAccess: true`
- **Path aliases** - Use `@/` imports, never relative `../../`

### Biome Formatting (NOT ESLint/Prettier)
- **Indent**: Tabs (not spaces)
- **Quotes**: Double quotes for strings
- **Semicolons**: No semicolons (automatic)
- **Line width**: 80 characters (enforced by Biome)
- **Trailing commas**: ES5 compatible
- **Organize imports**: Automatic sorting enabled

### Import Organization
- **Type imports**: Use `import type { Foo }` for type-only imports
- **Order**: External libs → Internal packages → Relative imports
- **Workspace packages**: Always use workspace aliases:
  ```typescript
  // ✅ CORRECT
  import { utils } from "@myproject/shared"
  import { Button } from "@myproject/ui"
  
  // ❌ WRONG
  import { utils } from "../../../packages/shared/src"
  ```

### Testing Standards
- **Unit tests** - Every utility function
- **Integration tests** - API endpoints and services
- **E2E tests** - Critical user flows
- **Target: 80% coverage minimum**
- **Naming**: `describe`, `it`, `expect` pattern
- **Mocking**: Use MSW for API, vi.fn() for functions

### Documentation Standards
- **JSDoc** for all public APIs
- **README.md** in every major directory
- **ADR** for architectural decisions (in `docs/adr/`)
- **Inline comments** only for complex logic (not "what", but "why")
- **CHANGELOG.md** for version releases

---

## 🔗 Related Documentation

- **[CLAUDE.md](CLAUDE.md)** - Master documentation (if exists)
- **[README.md](README.md)** - Project overview
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical design
- **[docs/](./docs/)** - Extended documentation
- **Stack READMEs** in `stacks/` directory:
  - [Web Stack (TanStack Start)](stacks/tanstack-start/README.md)
  - [Native Stack (Expo)](stacks/expo-native/README.md)
  - [API Stack (Cloudflare Worker)](stacks/cloudflare-worker/README.md)

---

## 🎯 Before You Commit

Always run these checks:
```bash
# 1. Lint and format
bun run check

# 2. Type check
bun run check-types

# 3. Field mapping validation (CRITICAL - P04)
bun run validate:fields

# 4. Run tests if you changed logic
bun test --run packages/shared/src/utils/your-file.test.ts

# 5. Commit with enhanced commit
ce "feat(scope): description"
```

### Pre-Commit Checklist
- [ ] Biome linting passes
- [ ] TypeScript compiles without errors
- [ ] Field mappings validated (`bun run validate:fields`)
- [ ] Tests pass (run affected tests only)
- [ ] No secrets in code
- [ ] No console.logs left in production code
- [ ] Documentation updated (if needed)

---

## 🆘 Troubleshooting

### Common Issues

**Field mapping validation fails**
```bash
# Run the validator with verbose output
bun run validate:fields --verbose

# Check specific entity transformers
bun run validate:fields --entity=workout
```

**Type errors after dependency update**
```bash
# Clean and reinstall
rm -rf node_modules bun.lockb
bun install
bun run check
```

**D1 connection issues**
```bash
# Verify wrangler config
bun run db:verify

# Reset local D1
bun run db:reset
```

**Legend State sync not working**
- Check `fieldId` matches API response exactly
- Verify MMKV/localStorage is properly initialized
- Ensure `synced()` is configured with correct fetcher

---

**Template Version**: 2.1.0
**Last Updated**: Generated from global OpenCode configuration
**Source**: `~/.opencode/universal/AGENTS.md`
