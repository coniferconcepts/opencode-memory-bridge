# Development Workflows

Standardized processes for consistent, high-quality development.

## What Are Workflows?

Workflows are predefined, step-by-step processes for common development tasks. They ensure consistency and quality across all projects.

## Core Workflows

### Feature Development

Complete process for building new features.

**Steps:**
1. **Planning** (@planner)
   - Decompose feature into tasks
   - Identify required agents
   - Estimate complexity

2. **Analysis** (@solo-orchestrator)
   - Review existing code patterns
   - Identify integration points
   - Check for similar features

3. **Implementation** (@solo-orchestrator)
   - Build according to plan
   - Follow established patterns
   - Use appropriate specialists

4. **Testing** (@test-reviewer)
   - Unit tests
   - Integration tests
   - Edge case coverage

5. **Review** (@code-reviewer)
   - Static analysis
   - Functional review
   - Security check
   - Performance review

6. **Validation** (@guardrail-validator)
   - Run all guardrails
   - Check compliance
   - Verify standards

7. **Documentation** (@doc-guardian)
   - Update README
   - Add inline comments
   - Update API docs

8. **Finalization**
   - Commit with conventional message
   - Update changelog
   - Create PR

**Usage:**
```
@planner implement the user dashboard feature
```

### Bug Fix Process

Systematic approach to fixing bugs.

**Steps:**
1. **Reproduction** (@terminal-error-reviewer)
   - Reproduce the bug
   - Document steps
   - Identify scope

2. **Analysis** (@deep-reviewer)
   - Root cause analysis
   - Impact assessment
   - Solution options

3. **Fix** (@solo-orchestrator)
   - Implement minimal fix
   - Add regression test
   - Verify fix works

4. **Validation** (@guardrail-validator)
   - Run tests
   - Check for side effects
   - Verify no new issues

5. **Documentation**
   - Document the bug
   - Update troubleshooting guide
   - Add to knowledge base

**Usage:**
```
@terminal-error-reviewer diagnose this login error
```

### Refactoring Protocol

Safe code restructuring.

**Steps:**
1. **Assessment** (@deep-reviewer)
   - Identify refactoring targets
   - Assess risk
   - Plan approach

2. **Preparation**
   - Ensure tests pass
   - Create backup branch
   - Document current behavior

3. **Incremental Changes** (@solo-orchestrator)
   - Small, focused changes
   - Run tests after each
   - Commit frequently

4. **Validation** (@code-reviewer)
   - Verify behavior unchanged
   - Check performance
   - Review code quality

5. **Cleanup**
   - Remove old code
   - Update documentation
   - Merge to main

**Usage:**
```
@deep-reviewer analyze the current data layer for refactoring
```

### Release Management

Publishing new versions.

**Steps:**
1. **Version Bump**
   - Determine version (semver)
   - Update package.json
   - Update version files

2. **Changelog** (@doc-guardian)
   - Document changes
   - Credit contributors
   - Highlight breaking changes

3. **Pre-Release Checks** (@guardrail-validator)
   - Run full test suite
   - Security audit
   - Performance baseline

4. **Build & Tag**
   - Create release build
   - Git tag with version
   - Push to repository

5. **Deployment**
   - Deploy to staging
   - Smoke tests
   - Deploy to production
   - Monitor metrics

6. **Post-Release**
   - Monitor errors
   - Collect feedback
   - Document lessons

**Usage:**
```
@planner prepare release v1.2.0
```

## Planning Workflows

### Project Kickoff

Starting a new project.

**Steps:**
1. Choose stack template
2. Initialize with `init-project.sh`
3. Set up CI/CD
4. Configure monitoring
5. Create initial documentation

### Milestone Planning

Breaking down major milestones.

**Steps:**
1. Define milestone goals
2. Identify deliverables
3. Estimate timelines
4. Assign agents/workers
5. Create tracking

### Sprint Planning

Iteration planning.

**Steps:**
1. Review previous sprint
2. Prioritize backlog
3. Estimate stories
4. Assign tasks
5. Set goals

## Incident Workflows

### Incident Response

Handling production issues.

**Steps:**
1. **Detection** - Alert received
2. **Acknowledgment** - Assign owner
3. **Assessment** - Scope and severity
4. **Mitigation** - Stop the bleeding
5. **Resolution** - Fix the root cause
6. **Verification** - Confirm fixed
7. **Post-Mortem** - Document and learn

### Rollback Procedure

Emergency rollback.

**Steps:**
1. Assess need for rollback
2. Identify last good version
3. Execute rollback
4. Verify system stable
5. Communicate status
6. Plan forward fix

## Maintenance Workflows

### Dependency Updates

Safe dependency management.

**Steps:**
1. Check for updates
2. Review changelogs
3. Test in isolation
4. Update incrementally
5. Run full test suite
6. Monitor for issues

### Database Maintenance

Database optimization.

**Steps:**
1. Analyze query performance
2. Identify slow queries
3. Add indexes if needed
4. Archive old data
5. Update statistics
6. Verify improvements

## Custom Workflows

### Creating a Workflow

Define in `.opencode/workflows/`:

```yaml
# .opencode/workflows/custom-workflow.yaml
name: Custom Workflow
version: 1.0.0

triggers:
  - manual
  - scheduled

steps:
  1_step_name:
    agent: @agent-name
    action: Description of action
    guardrails: [guardrail-1, guardrail-2]
    
  2_next_step:
    agent: @other-agent
    action: Next action
    depends_on: 1_step_name
```

### Workflow Templates

Use built-in templates:

```bash
@tool-utility create-workflow from-template feature-development
```

## Workflow Automation

### Git Hooks

Pre-commit workflow:
```bash
#!/bin/sh
# .git/hooks/pre-commit
@guardrail-validator run all
```

### CI/CD Integration

GitHub Actions workflow:
```yaml
name: Development Workflow
on: [push]
jobs:
  quality:
    steps:
      - run: @guardrail-validator run all
      - run: @test-reviewer run tests
```

### Scheduled Workflows

Automated maintenance:
```yaml
name: Weekly Maintenance
schedule: "0 0 * * 0"  # Sundays at midnight
steps:
  - update-dependencies
  - security-audit
  - performance-check
```

## Best Practices

### 1. Follow Workflows Consistently

Don't skip steps - they're there for a reason.

### 2. Customize When Needed

Adapt workflows to your project, but keep core steps.

### 3. Document Deviations

If you must skip a step, document why.

### 4. Review Workflow Effectiveness

Regularly review if workflows are helping or hindering.

### 5. Share Improvements

Contribute workflow improvements back to base-layer.

## Workflow Metrics

Track workflow effectiveness:

- **Completion rate** - How often workflows complete
- **Time to completion** - Average workflow duration
- **Error rate** - Issues caught by workflows
- **Rework rate** - How often work needs redoing

## Troubleshooting

### Workflow Too Slow

- Skip non-critical steps in development
- Parallelize independent steps
- Cache intermediate results

### Workflow Too Rigid

- Add conditional steps
- Create variant workflows
- Use configuration for flexibility

### Steps Being Skipped

- Check agent availability
- Verify configuration
- Review guardrail settings

## Further Reading

- [Architecture Proposal](../../architecture/PROPOSAL.md) - Workflow system design
- [Contributing Guide](../../development/contributing.md) - Adding workflows
