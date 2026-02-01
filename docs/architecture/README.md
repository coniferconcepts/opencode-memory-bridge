# OpenCode Base-Layer Architecture

## Overview

The OpenCode Base-Layer is designed as a **5-layer architecture** that provides everything needed for AI-assisted software development, from project initialization through production operations.

## The Five Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. CONTEXT & KNOWLEDGE LAYER                                               │
│     Business domains, integrations, lessons learned                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  4. INFRASTRUCTURE LAYER                                                    │
│     CI/CD, observability, security, cost optimization                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  3. PROJECT-SPECIFIC LAYER                                                  │
│     Business logic, features, migrations, overrides                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  2. TEMPLATE LAYER                                                          │
│     Stack-specific templates (TanStack Start, Expo Native, etc.)            │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. UNIVERSAL BASE LAYER                                                    │
│     Agents, patterns, guardrails, workflows, testing                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer 1: Universal Base Layer

The foundation providing core capabilities used across all projects.

### Components

**Agents** (`universal/agents/`)
- 50+ specialized AI agents organized by domain
- Orchestrators for high-level coordination
- Specialists for specific technologies and domains
- Quality agents for testing and validation
- Utility agents for operations

**Patterns** (`universal/patterns/`)
- Battle-tested code patterns
- Architecture patterns (feature-based structure, API layer)
- Component patterns (data tables, forms, modals)
- Hook patterns (URL state, local storage, debounce)
- Instantiable templates with dependencies

**Guardrails** (`universal/guardrails/`)
- Automated safety checks
- Security (no secrets, SQL injection prevention)
- Data integrity (field mapping, migration safety)
- Code quality (type safety, test coverage)
- Architecture (circular dependencies, layer violations)

**Workflows** (`universal/workflows/`)
- Standardized development processes
- Feature development, bug fixes, refactoring
- Planning, release management
- Incident response, maintenance procedures

**Testing** (`universal/testing/`)
- Testing strategies (unit, integration, e2e)
- Test utilities and fixtures
- Configuration templates

**Scripts** (`universal/scripts/`)
- Project initialization and scaffolding
- Development automation
- Deployment procedures
- Maintenance utilities

**Knowledge** (`universal/knowledge/`)
- Pattern evolution tracking
- Agent effectiveness metrics
- Project retrospectives
- Error pattern analysis
- Architecture decision records

## Layer 2: Template Layer

Stack-specific project templates that accelerate project initialization.

### Current Stacks
- **TanStack Start** - Full-stack web applications
- **Expo Native** - React Native mobile applications
- **Cloudflare Worker** - Edge/API compute

### Future Stacks (Proposed)
- Desktop (Electron)
- CLI Tools
- Microservices
- Browser Extensions
- Game Development
- Data Pipelines

Each stack includes:
- Pre-configured project structure
- Stack-specific tooling setup
- Specialized agents
- Stack-specific guardrails
- Deployment configurations

## Layer 3: Project-Specific Layer

When a project initializes using `init-project.sh`, it creates:

```
my-project/
├── .opencode/               # Project-specific OpenCode config
│   ├── project-agents/      # Custom agents
│   ├── business-rules/      # Domain rules
│   ├── overrides/           # Base-layer overrides
│   └── memories/            # Project context
├── src/
│   ├── business/            # Domain logic
│   ├── features/            # Feature implementations
│   └── infrastructure/      # Tech code
├── docs/                    # Project docs
├── tests/                   # Test suites
└── migrations/              # DB migrations
```

## Layer 4: Infrastructure Layer

Production-ready infrastructure components.

### CI/CD (`infra/ci-cd/`)
- GitHub Actions workflows
- Deployment configurations (Cloudflare, Docker, Kubernetes)
- Automated testing pipelines
- Rollback procedures

### Observability (`infra/observability/`)
- Structured logging
- Metrics collection
- Distributed tracing
- Dashboards

### Security (`infra/security/`)
- Security policies
- Automated scanning
- Compliance checks
- Incident response

## Layer 5: Context & Knowledge Layer

Pre-built knowledge for common scenarios.

### Business Domains (`context/business-domains/`)
- E-commerce
- Content Management
- Social Platforms
- SaaS Platforms
- Healthcare
- Finance

### Integrations (`context/integrations/`)
- Payments (Stripe, PayPal)
- Communication (SendGrid, Twilio)
- Storage (S3, R2, GCS)
- Auth (Better Auth, Auth0, Clerk)
- Monitoring (Sentry, PostHog, Datadog)

## Design Principles

1. **Progressive Enhancement**: Start minimal, add complexity only when needed
2. **Sensible Defaults**: Everything works out of the box
3. **Explicit Overrides**: Easy to customize without breaking updates
4. **Knowledge Persistence**: Cross-project learning improves the base
5. **AI-Native**: Built for human-AI collaboration
6. **Production-Ready**: Everything is battle-tested
7. **Open & Extensible**: Easy to add custom components

## Current vs. Proposed

### Current State (v1.0.0)
- 27 agents across 3 categories
- 3 stack templates
- Basic guardrails
- Manual workflows
- Limited patterns

### Proposed Future State
- 50+ agents across 6 categories
- 10+ stack templates
- Comprehensive guardrail system
- Automated workflow engine
- Rich pattern library with instantiation
- Full observability stack
- Business domain knowledge bases

See [PROPOSAL.md](PROPOSAL.md) for detailed future architecture specification.

## Architecture Decision Records

Key architectural decisions are documented in [decisions/](decisions/):

- Why file-based references instead of database
- Why recursive resolution vs. single-level
- Why agent-based vs. monolithic AI
- Stack selection criteria

## Success Metrics

Target outcomes for this architecture:

- **Time to First Feature**: < 30 minutes
- **Bug Rate**: 50% reduction
- **Developer Velocity**: 2x increase
- **Onboarding Time**: < 1 week
- **Maintenance**: 70% reduction

## Contributing

Architecture improvements are welcome! See [Contributing Guide](../development/contributing.md).
