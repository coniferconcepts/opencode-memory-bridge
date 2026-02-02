# Expert Agent Enhancement - Quick Execution Guide

## Overview
This guide provides the exact commands to execute the expert agent enhancement process using @kimi-premium and @context7-super-expert.

---

## 🚀 QUICK START (Copy-Paste Ready)

### Option 1: Run Full Enhancement (Recommended)

Copy and paste this entire block to run the complete enhancement:

```
@kimi-premium You are the orchestrator for the expert agent enhancement process. 

Read the comprehensive enhancement prompt from /Users/benjaminerb/CODE/opencode-global-config/EXPERT_ENHANCEMENT_PROMPT.txt and execute it.

Your mission is to enhance all expert subagents with authoritative documentation patterns.

Execute in 3 waves:

WAVE 1 - Parallel Documentation Queries (Call all 6 simultaneously):
- Invoke @context7-super-expert to research Valibot with queries: "Valibot schema composition patterns and best practices", "Valibot v.InferOutput vs v.InferInput type inference patterns", "Valibot pipe transformations and custom validation patterns", "Valibot integration with tRPC for input validation", "Valibot form validation patterns with error handling", "Valibot performance optimization for validation pipelines", "Valibot v1.0 breaking changes and migration from v0.x"

- Invoke @context7-super-expert to research Legend State v3 with queries: "Legend State v3 observable patterns and reactivity model", "Legend State syncedCrud configuration and field mapping", "Legend State fieldId and fieldUpdatedAt mapping patterns", "Legend State persistence with MMKV and localStorage", "Legend State offline-first data synchronization patterns", "Legend State React integration with use$() hook", "Legend State state normalization and relationship handling"

- Invoke @context7-super-expert to research Tamagui with queries: "Tamagui design tokens and theming configuration", "Tamagui cross-platform component design patterns", "Tamagui styled() function and component variants", "Tamagui responsive layout with media queries", "Tamagui performance optimization for universal components", "Tamagui animation patterns with @tamagui/animations"

- Invoke @context7-super-expert to research Cloudflare with queries: "Cloudflare Workers architecture patterns and best practices", "Cloudflare Workers bundle size optimization and limits", "Cloudflare D1 database operations and schema design", "Cloudflare D1 batch operations and query optimization", "Cloudflare D1 migrations with Drizzle Kit", "Cloudflare R2 object storage best practices"

- Invoke @context7-super-expert to research Security with queries: "Better Auth authentication patterns and best practices", "Better Auth secure session management", "Better Auth OAuth flow security", "Better Auth integration with tRPC and Hono", "tRPC security patterns for input validation"

- Invoke @context7-super-expert to research Testing with queries: "Vitest best practices and configuration patterns", "Vitest expectTypeOf for compile-time type testing", "Vitest mocking patterns with vi.fn()", "MSW patterns for API mocking", "Unit testing field mapping transformations"

Wait for all Wave 1 results before proceeding to Wave 2.
```

### Option 2: Enhance Single Expert

For targeted enhancement of just one expert:

```
@kimi-premium Enhance only the @valibot-expert with authoritative documentation.

Step 1: Invoke @context7-super-expert to research Valibot:
- Query Context7 for "Valibot" library ID
- Query: "Valibot schema composition patterns and best practices"
- Query: "Valibot type inference patterns with v.InferOutput and v.InferInput"
- Query: "Valibot pipe transformations and custom validation"
- Query: "Valibot integration with tRPC for input validation"
- Query: "Common Valibot mistakes and anti-patterns"
- Query: "Valibot v1.0 breaking changes"

Step 2: Synthesize the findings into an enhanced prompt with:
- P0/P1/P2/P3 guardrails
- High-level patterns with code examples
- Common pitfalls and solutions
- Integration patterns with tRPC and forms
- Version-specific notes for v1.0

Step 3: Write to universal/prompts/agents/valibot-expert-enhanced.txt using the template from EXPERT_ENHANCEMENT_PROMPT.txt

Return a summary of what was enhanced.
```

---

## 📋 DETAILED EXECUTION STEPS

### Phase 1: Read the Prompt

First, have kimi-2.5 read the comprehensive prompt:

```
@kimi-premium Read and analyze /Users/benjaminerb/CODE/opencode-global-config/EXPERT_ENHANCEMENT_PROMPT.txt to understand:
1. Which experts need enhancement
2. What information to gather from each
3. The structure for enhanced prompts
4. The 3-wave execution plan

Confirm your understanding before proceeding.
```

### Phase 2: Execute Wave 1 (Parallel Queries)

Invoke context7-super-expert for all 6 experts simultaneously:

**Valibot Research:**
```
@context7-super-expert Research Valibot validation library:

1. Resolve library ID for "valibot"
2. Query authoritative documentation for:
   - "Valibot schema composition patterns and best practices"
   - "Valibot v.InferOutput type inference patterns"
   - "Valibot pipe transformations and custom validations"
   - "Valibot integration with tRPC for input validation"
   - "Valibot form validation with error handling"
   - "Valibot async validation with external data"
   - "Valibot union and intersection type patterns"
   - "Valibot v1.0 migration from v0.x"
   - "Common Valibot mistakes beginners make"

Return structured findings with code examples, ALWAYS/NEVER rules, and version info.
```

**Legend State Research:**
```
@context7-super-expert Research Legend State v3:

1. Resolve library ID for "legend-state"
2. Query authoritative documentation for:
   - "Legend State v3 observable patterns and reactivity"
   - "Legend State syncedCrud configuration and field mapping"
   - "Legend State fieldId and fieldUpdatedAt usage"
   - "Legend State persistence with MMKV and localStorage"
   - "Legend State offline-first sync patterns"
   - "Legend State use$() hook and React integration"
   - "Legend State computed values and transformations"
   - "Legend State optimistic updates with rollback"
   - "Legend State v3 vs v2 breaking changes"
   - "Common Legend State mistakes"

Return structured findings with code examples, field mapping patterns, and anti-patterns.
```

**Tamagui Research:**
```
@context7-super-expert Research Tamagui UI framework:

1. Resolve library ID for "tamagui"
2. Query authoritative documentation for:
   - "Tamagui design tokens and theming configuration"
   - "Tamagui cross-platform component patterns"
   - "Tamagui styled() function and variants"
   - "Tamagui responsive layout with media queries"
   - "Tamagui performance optimization"
   - "Tamagui animation patterns"
   - "Tamagui theme switching"
   - "Tamagui custom token extensions"
   - "Tamagui v1.x breaking changes"
   - "Common Tamagui styling mistakes"

Return structured findings with token examples, component patterns, and anti-patterns.
```

**Cloudflare Research:**
```
@context7-super-expert Research Cloudflare platform:

1. Resolve library ID for "cloudflare workers"
2. Query authoritative documentation for:
   - "Cloudflare Workers architecture patterns"
   - "Cloudflare Workers bundle size optimization"
   - "Cloudflare D1 database operations"
   - "Cloudflare D1 batch operations"
   - "Cloudflare D1 migrations with Drizzle"
   - "Cloudflare R2 object storage"
   - "Cloudflare KV caching strategies"
   - "Cloudflare Queues processing"
   - "Hono framework with Cloudflare Workers"
   - "Common Cloudflare platform mistakes"

Return structured findings with examples, limits, and best practices.
```

**Security Research:**
```
@context7-super-expert Research security patterns:

1. Resolve library ID for "better-auth"
2. Query authoritative documentation for:
   - "Better Auth authentication patterns"
   - "Better Auth session management"
   - "Better Auth OAuth security"
   - "Better Auth tRPC integration"
   - "tRPC security patterns"
   - "Hono security middleware"
   - "Cloudflare Workers security headers"
   - "API rate limiting patterns"
   - "Common authentication security mistakes"

Return structured findings with security rules and implementation examples.
```

**Testing Research:**
```
@context7-super-expert Research Vitest testing:

1. Resolve library ID for "vitest"
2. Query authoritative documentation for:
   - "Vitest best practices and configuration"
   - "Vitest expectTypeOf type testing"
   - "Vitest mocking with vi.fn()"
   - "MSW API mocking patterns"
   - "React Testing Library patterns"
   - "Field mapping test patterns"
   - "tRPC procedure testing"
   - "Legend State observable testing"
   - "Common testing mistakes"

Return structured findings with test patterns and examples.
```

### Phase 3: Execute Wave 2 (Synthesis)

After all Wave 1 results are in, invoke kimi-2.5 to synthesize:

```
@kimi-premium You now have the Context7 research results for all 6 experts.

For EACH expert, synthesize the findings into an enhanced prompt following the template from EXPERT_ENHANCEMENT_PROMPT.txt:

1. **valibot-expert**: Create enhanced prompt with:
   - P0: NEVER use Zod/Yup, ALWAYS validate inputs
   - P1: ALWAYS use type inference, NEVER skip safeParse in forms
   - Patterns: Schema composition, pipe transformations, tRPC integration
   - Pitfalls: Type coercion, missing validation, error exposure
   - Integrations: tRPC, React Hook Form, Hono

2. **legend-state-expert**: Create enhanced prompt with:
   - P0: NEVER use TanStack Query, ALWAYS use fieldId
   - P1: ALWAYS persist with MMKV/localStorage, NEVER mutate directly
   - Patterns: syncedCrud, observable composition, computed values
   - Pitfalls: Missing fieldId, direct mutation, sync misconfiguration
   - Integrations: React, tRPC, MMKV

3. **tamagui-expert**: Create enhanced prompt with:
   - P0: NEVER use Tailwind, ALWAYS use tokens
   - P1: NEVER hardcode pixels, ALWAYS use styled()
   - Patterns: Token usage, cross-platform design, responsive layouts
   - Pitfalls: Inline styles, platform breakage, hardcoded values
   - Integrations: React, Legend State, Expo

4. **cloudflare-expert**: Create enhanced prompt with:
   - P0: NEVER exceed 1MB bundle, NEVER use Node.js APIs
   - P1: ALWAYS use D1 batches, ALWAYS handle errors
   - Patterns: Edge architecture, D1 optimization, KV caching
   - Pitfalls: Bundle bloat, sync blocking, missing transactions
   - Integrations: Hono, tRPC, D1, Drizzle

5. **security-expert**: Create enhanced prompt with:
   - P0: NEVER roll own auth, ALWAYS use Better Auth
   - P1: NEVER expose secrets, ALWAYS validate inputs
   - Patterns: Better Auth config, session management, OAuth
   - Pitfalls: Weak sessions, missing validation, secret exposure
   - Integrations: Better Auth, tRPC, Hono

6. **test-reviewer**: Create enhanced prompt with:
   - P0: NEVER skip field mapping tests
   - P1: ALWAYS use expectTypeOf, ALWAYS mock external APIs
   - Patterns: Unit tests, integration tests, type testing
   - Pitfalls: Shallow tests, missing mocks, no type tests
   - Integrations: Vitest, MSW, React Testing Library

Write each enhanced prompt to:
- universal/prompts/agents/valibot-expert-enhanced.txt
- universal/prompts/agents/legend-state-expert-enhanced.txt
- universal/prompts/agents/tamagui-expert-enhanced.txt
- universal/prompts/agents/cloudflare-expert-enhanced.txt
- universal/prompts/agents/security-expert-enhanced.txt
- universal/prompts/agents/test-reviewer-enhanced.txt

Confirm each file is written successfully.
```

### Phase 4: Execute Wave 3 (Validation & Report)

```
@kimi-premium Validate all enhanced prompts and generate a summary report:

1. Read each enhanced prompt file and verify it contains:
   - P0/P1/P2/P3 guardrails sections
   - High-Level Patterns section with code examples
   - Common Pitfalls section
   - Integration Patterns section
   - Version-Specific Notes
   - Authoritative References

2. Generate /Users/benjaminerb/CODE/opencode-global-config/ENHANCEMENT_REPORT.md with:
   - Summary of enhancements for each expert
   - Key patterns discovered
   - Critical rules added
   - Version updates noted
   - Confidence assessment
   - Next steps

3. Create /Users/benjaminerb/CODE/opencode-global-config/ENHANCEMENT_SUMMARY.json with:
   - List of all enhanced experts
   - Key guardrails per expert
   - Confidence levels
   - File paths

Return the final validation status and report locations.
```

---

## 📊 MONITORING PROGRESS

### Check Wave 1 Status
```
@kimi-premium What is the status of all Wave 1 (Context7) queries? Have all 6 experts been researched?
```

### Check Wave 2 Status
```
@kimi-premium What is the status of Wave 2 (enhanced prompt generation)? Which experts have been enhanced so far?
```

### Validate Results
```
@kimi-premium Read all enhanced prompt files and confirm they follow the template structure. Report any missing sections or issues.
```

---

## 🎯 SUCCESS CRITERIA

After execution, verify:

1. ✅ All 6 enhanced prompt files exist in `universal/prompts/agents/`
2. ✅ Each file includes P0-P3 guardrails
3. ✅ Each file has 5+ high-level patterns with code
4. ✅ Each file has 5+ common pitfalls with solutions
5. ✅ Integration patterns cover related technologies
6. ✅ Version notes are current
7. ✅ Report and summary files generated

---

## 🆘 TROUBLESHOOTING

### If Context7 query fails:
```
@context7-super-expert Try alternative library name: instead of "valibot", try "valibot.dev" or just search for validation libraries
```

### If synthesis is incomplete:
```
@kimi-premium Continue enhancing [EXPERT_NAME]-expert. Complete the missing sections: [LIST SECTIONS]
```

### If file write fails:
```
@kimi-premium Verify the directory exists and permissions are correct. Try writing to: [ALTERNATIVE_PATH]
```

---

## 📁 OUTPUT FILES

After successful execution, you'll have:

```
universal/prompts/agents/
├── valibot-expert-enhanced.txt       # Enhanced Valibot expert
├── legend-state-expert-enhanced.txt  # Enhanced Legend State expert
├── tamagui-expert-enhanced.txt       # Enhanced Tamagui expert
├── cloudflare-expert-enhanced.txt    # Enhanced Cloudflare expert
├── security-expert-enhanced.txt      # Enhanced Security expert
└── test-reviewer-enhanced.txt        # Enhanced Testing expert

ENHANCEMENT_REPORT.md                 # Human-readable summary
ENHANCEMENT_SUMMARY.json              # Machine-readable summary
EXPERT_ENHANCEMENT_PROMPT.txt         # The master prompt (this process)
scripts/enhance-experts.sh            # Bash automation script
```

---

## 🔄 REGULAR UPDATES

Schedule quarterly re-enhancement:

```bash
# Add to crontab for quarterly runs
0 0 1 */3 * cd /Users/benjaminerb/CODE/opencode-global-config && ./scripts/enhance-experts.sh full >> logs/enhancement.log 2>&1
```

Or manually trigger:
```
@kimi-premium Re-run the expert enhancement process to check for new patterns and version updates since last enhancement.
```

---

**Last Updated**: 2026-02-01
**Version**: 1.0.0
**Maintainer**: OpenCode Configuration
