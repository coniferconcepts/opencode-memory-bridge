# Expert Agent Enhancement - Complete Package Summary

**Date**: 2026-02-01  
**Version**: 1.0.0  
**Models**: kimi-2.5 + context7-super-expert  

---

## 📦 What Was Created

This comprehensive enhancement package enables the automated improvement of all library/subdomain expert subagents using authoritative documentation from Context7.

### 1. **EXPERT_ENHANCEMENT_PROMPT.txt** (609 lines, 18KB)
The master runnable prompt that defines the complete enhancement process.

**Contents**:
- Complete workflow for enhancing 6 expert subagents
- Detailed Context7 query templates for each technology
- Enhancement template structure (P0-P3 guardrails, patterns, pitfalls, integrations)
- 3-wave execution plan (Query → Synthesize → Validate)
- File paths and validation criteria
- Success criteria and quality metrics

**Target Experts**:
1. @valibot-expert (validation library)
2. @legend-state-expert (state management)
3. @tamagui-expert (UI framework)
4. @cloudflare-expert (platform)
5. @security-expert (security patterns)
6. @test-reviewer (testing patterns)

### 2. **QUICK_EXECUTION_GUIDE.md** (391 lines, 15KB)
Copy-paste ready guide for immediate execution.

**Contents**:
- Pre-written commands for full and single-expert enhancement
- Phase-by-phase execution steps
- Exact subagent invocation syntax
- Monitoring and troubleshooting commands
- Success criteria checklist
- Output file reference

### 3. **scripts/enhance-experts.sh** (420 lines, 12KB)
Bash automation script for manual execution.

**Features**:
- `full` command - Enhance all experts
- `single` command - Enhance one expert
- `validate` command - Check enhanced prompts
- `report` command - Generate summary
- `clean` command - Remove enhanced files
- Wave-based execution support
- Comprehensive logging

---

## 🚀 How to Execute

### Quick Start (Easiest)

Copy this block and run:

```
@kimi-premium Read /Users/benjaminerb/CODE/opencode-global-config/EXPERT_ENHANCEMENT_PROMPT.txt and execute the complete enhancement process in 3 waves:

WAVE 1: Invoke @context7-super-expert in parallel for all 6 experts (valibot, legend-state, tamagui, cloudflare, security, test) with the specific queries from the prompt.

WAVE 2: After all Wave 1 results, synthesize findings into enhanced prompts for each expert with P0-P3 guardrails, patterns, pitfalls, and integrations.

WAVE 3: Validate all enhanced prompts and generate summary reports.
```

### Step-by-Step

1. **Read the prompt** (kimi-2.5):
   ```
   @kimi-premium Read and understand EXPERT_ENHANCEMENT_PROMPT.txt
   ```

2. **Query documentation** (context7-super-expert, parallel):
   ```
   @context7-super-expert Research Valibot with queries: [...]
   @context7-super-expert Research Legend State with queries: [...]
   @context7-super-expert Research Tamagui with queries: [...]
   @context7-super-expert Research Cloudflare with queries: [...]
   @context7-super-expert Research Security with queries: [...]
   @context7-super-expert Research Testing with queries: [...]
   ```

3. **Synthesize** (kimi-2.5):
   ```
   @kimi-premium Create enhanced prompts from the Context7 findings
   ```

4. **Validate** (kimi-2.5):
   ```
   @kimi-premium Validate all enhanced prompts and generate reports
   ```

---

## 🎯 What Gets Enhanced

### For Each Expert:

1. **Critical Guardrails** (P0-P3):
   - **P0**: Data loss/corruption prevention
   - **P1**: Security vulnerability prevention
   - **P2**: Performance/reliability best practices
   - **P3**: Maintainability/code quality rules

2. **High-Level Patterns**:
   - 5+ architectural patterns per expert
   - Code examples for each pattern
   - Trade-off analysis
   - Use case guidance

3. **Common Pitfalls**:
   - 5+ anti-patterns per expert
   - Symptoms and recognition
   - Solutions and fixes
   - Prevention strategies

4. **Integration Patterns**:
   - How to integrate with related technologies
   - Integration code examples
   - Caveats and warnings

5. **Version-Specific Notes**:
   - Current version information
   - Breaking changes
   - Migration paths
   - Deprecated features

6. **Authoritative References**:
   - Context7 documentation links
   - Official examples
   - Related patterns

---

## 📁 Output Files

After execution:

```
universal/prompts/agents/
├── valibot-expert-enhanced.txt       ← Enhanced Valibot expert
├── legend-state-expert-enhanced.txt  ← Enhanced Legend State expert
├── tamagui-expert-enhanced.txt       ← Enhanced Tamagui expert
├── cloudflare-expert-enhanced.txt    ← Enhanced Cloudflare expert
├── security-expert-enhanced.txt      ← Enhanced Security expert
└── test-reviewer-enhanced.txt        ← Enhanced Testing expert

ENHANCEMENT_REPORT.md                 ← Human-readable summary
ENHANCEMENT_SUMMARY.json              ← Machine-readable summary
```

---

## ✅ Success Criteria

The enhancement is successful when:

- [ ] All 6 enhanced prompt files exist
- [ ] Each has P0-P3 guardrail sections
- [ ] Each has 5+ high-level patterns with code
- [ ] Each has 5+ common pitfalls with solutions
- [ ] Integration patterns are documented
- [ ] Version notes are current
- [ ] Code examples are valid
- [ ] Authority is cited
- [ ] Report and summary are generated

---

## 🔄 Maintenance

### Quarterly Re-Enhancement

```bash
# Schedule with cron
0 0 1 */3 * cd /Users/benjaminerb/CODE/opencode-global-config && ./scripts/enhance-experts.sh full
```

### Manual Re-Run

```
@kimi-premium Re-run expert enhancement to check for new patterns and version updates.
```

---

## 📊 Key Features

### 1. **Authoritative Sources**
All enhancements come from Context7 MCP official documentation, not community opinions.

### 2. **Priority-Based Guardrails**
Rules are prioritized by impact:
- **P0**: Data loss/corruption (most critical)
- **P1**: Security vulnerabilities
- **P2**: Performance/reliability
- **P3**: Maintainability

### 3. **Actionable Patterns**
Each pattern includes:
- When to use it
- Code example
- Benefits
- Trade-offs

### 4. **Practical Anti-Patterns**
Each pitfall includes:
- How to recognize it
- Why it's wrong
- How to fix it
- How to prevent it

### 5. **Integration Focus**
Covers how experts' technologies work together:
- Valibot ↔ tRPC
- Legend State ↔ tRPC
- Tamagui ↔ Legend State
- Cloudflare ↔ Hono/tRPC/Drizzle

---

## 🆘 Support

### If Context7 Fails
- Try alternative library names
- Use more general queries
- Fall back to official docs websites

### If Synthesis is Slow
- Process experts one at a time
- Focus on critical (P0/P1) rules first
- Add patterns incrementally

### If Validation Fails
- Check for missing sections
- Verify code examples compile
- Ensure all experts have equal coverage

---

## 📈 Expected Outcomes

After running this enhancement:

1. **Expert prompts are 2-3x more comprehensive**
2. **Critical rules are explicitly prioritized**
3. **Code examples are from authoritative sources**
4. **Anti-patterns are documented with fixes**
5. **Integration patterns cover the full stack**
6. **Version-specific guidance is current**

---

## 🎓 Usage Examples

### Before Enhancement:
```
@valibot-expert Create a user schema
→ Basic schema with minimal guidance
```

### After Enhancement:
```
@valibot-expert Create a user schema
→ Schema with:
  - P1 guardrail: ALWAYS use v.InferOutput for types
  - Pattern: Pipe composition for transforms
  - Pitfall: Avoiding implicit coercion
  - Integration: tRPC input validation setup
  - Version: v1.0 syntax (not v0.x)
```

---

## 🏆 Quality Assurance

Every enhanced prompt is validated for:
- ✅ Correctness (code compiles)
- ✅ Completeness (all sections present)
- ✅ Authority (cited from Context7)
- ✅ Consistency (follows project conventions)
- ✅ Actionability (specific, not vague)

---

## 📚 Related Documentation

- `universal/AGENTS.md` - Main agent registry
- `universal/prompts/base-subagent.txt` - Base subagent template
- `docs/reference/agent-registry.md` - Agent documentation
- `EXPERT_ENHANCEMENT_PROMPT.txt` - This enhancement process

---

**Created By**: @kimi-premium  
**Enhancement Process**: 3-wave parallel execution  
**Documentation Source**: Context7 MCP authoritative docs  
**Target Stack**: Legend State v3 + Valibot + Tamagui + Cloudflare Workers + tRPC + Hono  

---

**END OF SUMMARY**

To begin enhancement, use the Quick Start command above or follow the detailed steps in QUICK_EXECUTION_GUIDE.md.
