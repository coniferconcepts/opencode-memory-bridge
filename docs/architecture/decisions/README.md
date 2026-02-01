# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting key architectural decisions made in the OpenCode Base-Layer.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help teams understand why certain decisions were made and provide context for future changes.

## Format

Each ADR follows this structure:

```markdown
# ADR-XXX: Decision Title

## Status
- Proposed / Accepted / Deprecated / Superseded by ADR-YYY

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing or have agreed to implement?

## Consequences
What becomes easier or more difficult to do because of this change?

## Alternatives Considered
What other options were evaluated and why were they rejected?
```

## Current ADRs

### Core Architecture

- **ADR-001**: File-based Configuration vs Database Storage
  - *Decision*: Use JSON files with `{file:...}` references instead of a database
  - *Rationale*: Simplicity, version control, easy editing
  - *Status*: Accepted

- **ADR-002**: Recursive File Resolution vs Single-Level
  - *Decision*: Build system recursively resolves nested `{file:...}` references
  - *Rationale*: OpenCode only supports single-level resolution
  - *Status*: Accepted

- **ADR-003**: Agent-based vs Monolithic AI
  - *Decision*: Multiple specialized agents instead of one general AI
  - *Rationale*: Better performance, specialized knowledge, composability
  - *Status*: Accepted

- **ADR-004**: Stack Templates Architecture
  - *Decision*: Stack-specific templates with shared universal base
  - *Rationale*: Consistency across projects with stack-specific optimizations
  - *Status*: Accepted

### Technology Choices

- **ADR-005**: Legend State vs TanStack Query
  - *Decision*: Legend State v3 for state management
  - *Rationale*: Better React Native support, persistence, sync
  - *Status*: Accepted

- **ADR-006**: Valibot vs Zod
  - *Decision*: Valibot for schema validation
  - *Rationale*: Smaller bundle size, better tree-shaking
  - *Status*: Accepted

- **ADR-007**: Tamagui vs Tailwind
  - *Decision*: Tamagui for UI framework
  - *Rationale*: Universal components (web + native), design tokens
  - *Status*: Accepted

- **ADR-008**: Bun vs npm/pnpm
  - *Decision*: Bun as package manager and runtime
  - *Rationale*: Speed, built-in TypeScript support, all-in-one tool
  - *Status*: Accepted

### Future Proposals

See [PROPOSAL.md](../PROPOSAL.md) for architectural evolution proposals.

## Contributing

When proposing significant architectural changes:

1. Create a new ADR using the template above
2. Number sequentially (ADR-XXX)
3. Submit for review via pull request
4. Update this index

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
