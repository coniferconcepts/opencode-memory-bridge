# OpenCode Configuration Improvement Plan

## Current State
✅ OpenCode is working with a resolved/inlined configuration (121KB, 24 agents)
❌ Original file reference system had issues with JSON escaping

## Goals
1. Verify the current setup works correctly
2. Test all 24 agents load properly
3. Clean up temporary files and backups
4. Optimize the configuration
5. Document the working solution
6. Potentially re-enable file references if they work now

## Improvement Tasks

### Phase 1: Verification (Priority: HIGH)
- [ ] Test that all 24 agents are accessible
- [ ] Verify intelligent routing works (@router agent)
- [ ] Test Context7 MCP integration
- [ ] Check that agents can read files and execute properly
- [ ] Verify the three-tier hierarchy works (orchestrators, specialists, utilities)

### Phase 2: Cleanup (Priority: HIGH)
- [ ] Remove all .backup files from ~/.opencode/universal/prompts/
- [ ] Remove all .original files from ~/.opencode/universal/prompts/
- [ ] Remove messed-up config backup directories
- [ ] Keep only essential backups (document what to keep)

### Phase 3: Optimization (Priority: MEDIUM)
- [ ] Analyze the 121KB config for duplicates or unnecessary content
- [ ] Check if we can re-enable {file:...} references now that files are properly escaped
- [ ] If file references work, convert back to reduce config size
- [ ] If not, optimize inlined content (remove duplicates, compress)

### Phase 4: Documentation (Priority: MEDIUM)
- [ ] Document the working setup
- [ ] Explain the file reference issue and solution
- [ ] Create troubleshooting guide
- [ ] Update README with final setup instructions

### Phase 5: Testing (Priority: HIGH)
- [ ] Test each major agent category:
  - Orchestrators: @planner, @code-reviewer, @solo-orchestrator
  - Specialists: @legend-state-expert, @valibot-expert, @tamagui-expert
  - Router: @router
  - Utilities: @tool-utility
- [ ] Test cross-domain task delegation
- [ ] Verify stack templates work (init-project.sh)

## Success Criteria
- All 24 agents load without errors
- File operations work correctly
- Agent delegation works
- Configuration is clean (no backup files in prompts)
- Documentation is complete
- Setup can be replicated

## OpenCode Prompt to Execute This Plan

See OC_IMPROVEMENT_PROMPT.txt for the executable prompt.
