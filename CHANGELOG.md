# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub community files (issue templates, PR template, CI workflow)
- CHANGELOG.md for version tracking

## [1.0.0] - 2026-02-01

### Added
- **Initial release** with 27 specialized agents
- **Primary Orchestrators**: @planner, @code-reviewer, @solo-orchestrator
- **Intelligent Router**: @router with auto-delegation (60-80% context reduction)
- **Technology Specialists**:
  - @legend-state-expert - Legend State v3 patterns
  - @valibot-expert - Schema validation and type inference
  - @tamagui-expert - UI components and tokens
  - @cloudflare-expert - Workers, D1, R2, KV
  - @context7-super-expert - Deep documentation lookup
  - @security-expert and @gpt5-security - Security audits
- **Review & Quality Agents**: @deep-reviewer, @test-reviewer, @fast-validator, @guardrail-validator, @always-works-validator
- **Utility Agents**: @tool-utility, @flash-lite, @glm-flash, @glm-executor, @kimi-premium, @codexmax-implementation, @dependency-guardian, @doc-guardian, @terminal-error-reviewer, @frontend-designer, @memory-bridge
- **Build System**: Recursive file reference resolution with `scripts/build-config.js`
- **Stack Templates**: TanStack Start, Expo Native, Cloudflare Workers
- **Documentation**: Complete setup guides, agent hierarchy, routing docs
- **Scripts**: `init-project.sh`, `quick-build.sh`, `verify.sh`
- **Configuration**: Full routing metadata and agent registry

### Technical Stack
- **State Management**: Legend State v3 (NOT TanStack Query)
- **Validation**: Valibot (NOT Zod/Yup)
- **UI Framework**: Tamagui (NOT Tailwind)
- **API Layer**: tRPC + Hono
- **Database**: Drizzle ORM + Cloudflare D1
- **Auth**: Better Auth
- **Runtime**: Bun
- **Linting**: Biome
- **Testing**: Vitest

### Guardrails
- P04 Field Mapping compliance (transformers only, no direct mapping)
- Legend State fieldId requirements
- Tamagui token enforcement
- Bun-only runtime validation
- Valibot schema requirements

[Unreleased]: https://github.com/coniferconcepts/opencode-global-config/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/coniferconcepts/opencode-global-config/releases/tag/v1.0.0
