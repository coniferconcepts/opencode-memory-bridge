/**
 * Observation Extractor
 * 
 * Responsibility:
 * - Extract structured observations from raw tool outputs using AI.
 * - Match the quality and format of the Claude Code plugin.
 * - Optimized for Gemini 3 Flash with strategic prompting.
 * 
 * @module src/integrations/claude-mem/extractor
 */

import * as v from 'valibot';
import { getConfiguredModel, type ModelConfig } from './models.js';
import { logger } from './logger.js';
import { scrubData } from './scrubber.js';
import type { ZenNativeExtractor } from './zen-native.js';

/**
 * Schema for extracted observation from LLM.
 */
export const ExtractedObservationSchema = v.object({
  title: v.pipe(v.string(), v.maxLength(80)),
  type: v.union([
    v.literal('decision'),
    v.literal('bugfix'),
    v.literal('feature'),
    v.literal('refactor'),
    v.literal('discovery'),
    v.literal('change')
  ]),
  narrative: v.pipe(v.string(), v.minLength(10)),
  concepts: v.array(v.string()),
  facts: v.array(v.string()),
});

export type ExtractedObservation = v.InferOutput<typeof ExtractedObservationSchema>;

const EXTRACTION_PROMPT = `<role>
You are MemoryArchitect, a senior engineering historian who transforms raw tool executions into durable, strategic knowledge artifacts. Your narratives are read by future engineers who need to understand not just WHAT happened, but WHY it matters and HOW it connects to the broader system.
</role>

<task>
Analyze the following tool execution and extract a structured observation that captures the strategic significance of this action. CRITICAL: Use the tool_type_heuristics section to select the MOST SPECIFIC type, not the generic "discovery" type.
</task>

<context>
Tool: {tool}
Arguments: {args}
Output: {output}
</context>

<tool_type_heuristics>
Use these patterns to guide TYPE classification (most specific wins):

DECISION - Strategic Architectural Choices:
- Keywords: "chose", "decided", "selected", "implemented approach", "opted for"
- Pattern: Multiple options evaluated, one selected with rationale
- Tool patterns: bash (deploy, infrastructure), write (config/architecture), edit (major design changes)
- Example: "Chose Redis over Memcached for distributed cache due to hash slot management"

BUGFIX - Error Correction and Resolution:
- Keywords: "fixed", "resolved", "corrected", "race condition", "off-by-one", "null pointer"
- Pattern: Identified error, implemented fix, verified solution
- Tool patterns: bash (test failures, error reproduction), edit (removing buggy code), write (patches)
- Example: "Fixed race condition in outbox processor where concurrent writes corrupted batch state"

FEATURE - New Capability Addition:
- Keywords: "added", "implemented new", "enhanced with", "now supports", "introduced"
- Pattern: New functionality shipped, extends system capability
- Tool patterns: write (new module), bash (feature test/deploy), edit (adding methods/endpoints)
- Example: "Added execution timing metadata to queue messages for latency tracking"

REFACTOR - Structural Improvement (No Behavior Change):
- Keywords: "extracted", "consolidated", "reorganized", "restructured", "simplified", "cleaned"
- Pattern: Code reorganized for clarity/maintainability, no functional change
- Tool patterns: edit (code reorganization), write (extracted module), grep (search for consolidation)
- Example: "Extracted metadata schema into shared module to reduce duplication across 4 handlers"

DISCOVERY - Learning About System Internals:
- Keywords: "learned", "discovered", "found", "realized", "understands that"
- Pattern: Investigation revealed new understanding (NOT implementation-based)
- Tool patterns: read (code inspection), grep (pattern search), bash (exploration, inspection, testing theories)
- Constraint: Use ONLY when the primary action is learning/investigation, not building/fixing
- Example: "Learned that D1 schema uses FTS5 for semantic search, enabling substring queries"

CHANGE - Generic Modification (Use Sparingly - Last Resort):
- Keywords: "updated", "modified", "changed"
- Pattern: When no other type clearly applies
- Constraint: Use only when observation is truly generic or low-signal
- Example: "Updated README with new installation instructions"
</tool_type_heuristics>

<planning_process>
Before generating output, internally reason through:
1. What was the PRIMARY INTENT? (build/fix/learn/choose/clean)
2. Is this building something new (feature), fixing a bug (bugfix), reorganizing code (refactor), making a strategic choice (decision), or learning something (discovery)?
3. Which tool was used? (tool + intent pattern often predicts type)
4. Would a future engineer read this as "someone learned X" or "someone built/fixed Y"?
5. BEWARE: Do NOT classify as "discovery" just because bash output contains error traces. Error investigation + fix = bugfix. Error investigation alone = discovery.
6. BEWARE: Do NOT classify as "change" unless truly generic/low-signal (last resort only).
</planning_process>

<output_requirements>
1. **Title**: A concise, action-oriented title (max 80 chars) that captures the strategic essence.
   - BAD: "read: schema.ts" / "bash: output"
   - GOOD: "Discovered D1 schema uses FTS5 for semantic search"
   - GOOD: "Fixed race condition in outbox processor batch writes"

2. **Type**: Classify as ONE of (from most to least specific):
   - decision: Deliberate architectural or implementation choice (multiple options evaluated)
   - bugfix: Correction of an error or unexpected behavior
   - feature: New capability or enhancement (new code shipped)
   - refactor: Structural improvement without behavior change (reorganization)
   - discovery: New understanding about system/domain (investigation/learning only)
   - change: Generic modification (use ONLY as last resort for truly generic actions)

3. **Narrative**: 2-4 sentences that tell the STORY of this action:
   - Sentence 1: What was done and the immediate context
   - Sentence 2: Why this matters or what problem it solves
   - Sentence 3: Implications, risk, or tradeoffs
   - Sentence 4 (optional): Follow-up or next steps

4. **Concepts**: 3-8 domain concepts this relates to (kebab-case, deduped):
   - Examples: "error-handling", "queue-processing", "schema-migration", "security-validation"

5. **Facts**: 2-8 specific, atomic, durable facts learned (grounded in output):
   - BAD: "The file was modified"
   - GOOD: "R2 objects require explicit Content-Type headers for browser rendering"
</output_requirements>

<anti_patterns>
DO NOT:
- Classify error investigation + fix as "discovery" (it's bugfix)
- Use "discovery" for reading code to understand implementation (it's discovery only if new understanding is gained)
- Use "change" for any action with clear intent (decision/bugfix/feature/refactor all trump change)
- Confuse "learned about the system" (discovery) with "deployed a fix for the system" (bugfix/feature)
</anti_patterns>

<constraints>
- Output MUST be valid JSON only. No markdown, no code fences, no commentary.
- If the tool execution is trivial (e.g., listing files), still extract meaningful context.
- NEVER include secrets, API keys, or PII in your output. Replace with "[REDACTED]".
- Prefer specificity over generality in facts.
- Facts MUST be directly supported by the provided arguments/output.
- TYPE classification is CRITICAL: use the heuristics section first, planning_process to confirm, then assign.
</constraints>

Respond with the JSON object only:`;

/**
 * Extract a structured observation from tool execution.
 * 
 * Hybrid Strategy:
 * 1. Try ZEN via host session (no key needed)
 * 2. Fall back to direct ZEN API (if key available)
 * 3. Fall back to simple extraction (no LLM)
 */
export async function extractObservation(
  tool: string,
  args: any,
  output: string,
  zenExtractor?: ZenNativeExtractor,
  $: any = null
): Promise<ExtractedObservation> {
  
  // Strategy 1: Use host session if available (ZEN-native)
  if (zenExtractor && $) {
    try {
      const extracted = await zenExtractor.extract(tool, args, output, $);
      if (extracted) {
        logger.debug('[extractor]', 'Successfully extracted observation via host session', { tool, title: extracted.title });
        return extracted;
      }
    } catch (error) {
      logger.debug('[extractor]', 'Host session extraction failed, trying direct API', { error: String(error) });
    }
  }

  // Strategy 2: Use direct ZEN API if key is available
  const apiKey = process.env.OPENCODE_API_KEY;
  if (apiKey) {
    try {
      const model = getConfiguredModel();
      
      // Scrub data before sending to LLM to prevent secret leaks
      const scrubbedArgs = scrubData(args);
      const scrubbedOutput = scrubData(output).slice(0, 4000);

      const prompt = EXTRACTION_PROMPT
        .replace('{tool}', tool)
        .replace('{args}', JSON.stringify(scrubbedArgs, null, 2))
        .replace('{output}', scrubbedOutput);

      // Show transient status in OpenCode UI
      logger.status(`Extracting memory from ${tool}...`);

      // Attempt 1
      let response = await callOpenCodeDispatcher(model, prompt);
      let parsed = tryParseAndValidate(response);
      
      if (parsed) {
        logger.debug('[extractor]', 'Successfully extracted observation via direct API', { tool, title: parsed.title });
        return parsed;
      }

      // Attempt 2: Retry with repair prompt
      logger.debug('[extractor]', 'First attempt failed validation, retrying with repair', { tool });
      const repairPrompt = `The previous response was not valid JSON or failed schema validation. Please output ONLY a valid JSON object matching the required schema.\n\nOriginal task:\n${prompt}`;
      response = await callOpenCodeDispatcher(model, repairPrompt);
      parsed = tryParseAndValidate(response);
      
      if (parsed) return parsed;

    } catch (error) {
      logger.warn('[extractor]', 'Direct API extraction failed', { error: String(error), tool });
    } finally {
      logger.status('');
    }
  }

  // Strategy 3: Simple fallback (no LLM)
  return createFallbackExtracted(tool, args);
}

/**
 * Create a fallback extracted observation for low-value or failed tools.
 */
export function createFallbackExtracted(tool: string, args: any): ExtractedObservation {
  let title = `${tool}: completed`;
  if (args) {
    if (tool === 'bash' && args.command) {
      title = `bash: ${args.command.split('\n')[0].slice(0, 50)}`;
    } else if (tool === 'read' && args.filePath) {
      title = `read: ${args.filePath.split('/').pop()}`;
    } else if (tool === 'write' && args.filePath) {
      title = `write: ${args.filePath.split('/').pop()}`;
    } else if (tool === 'edit' && args.filePath) {
      title = `edit: ${args.filePath.split('/').pop()}`;
    } else if (tool === 'grep' && args.pattern) {
      title = `grep: ${args.pattern}`;
    }
  }
  return {
    title,
    type: 'change',
    narrative: `Executed ${tool}. AI extraction failed; stored minimal observation.`,
    concepts: [tool, 'fallback'],
    facts: [`Tool ${tool} was executed`]
  };
}


/**
 * Try to parse JSON and validate against schema.
 */
function tryParseAndValidate(text: string): ExtractedObservation | null {
  try {
    // Handle potential markdown code fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    const parsed = JSON.parse(jsonStr);
    return v.parse(ExtractedObservationSchema, parsed);
  } catch (e) {
    return null;
  }
}

/**
 * Call the OpenCode ZEN API for memory extraction.
 * 
 * Uses the ZEN API endpoint (https://opencode.ai/zen/v1/) which routes
 * through OpenCode's infrastructure with zero data retention.
 */
async function callOpenCodeDispatcher(model: ModelConfig, prompt: string): Promise<string> {
  // ZEN API endpoint - the official OpenCode model gateway
  const ZEN_API_URL = 'https://opencode.ai/zen/v1/chat/completions';
  const DISPATCHER_URL = process.env.OPENCODE_DISPATCHER_URL || ZEN_API_URL;
  
  // OPENCODE_API_KEY is required - no fallback to prevent silent failures
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENCODE_API_KEY environment variable is required for memory extraction. ' +
      'Set it in your shell: export OPENCODE_API_KEY="your-key"'
    );
  }

  // SEC-003: Validate DISPATCHER_URL to prevent SSRF
  try {
    const url = new URL(DISPATCHER_URL);
    const allowedHostnames = ['localhost', '127.0.0.1', 'opencode.ai'];
    if (!allowedHostnames.includes(url.hostname) && !url.hostname.endsWith('.opencode.ai')) {
      throw new Error(`Invalid DISPATCHER_URL hostname: ${url.hostname}`);
    }
  } catch (e) {
    throw new Error(`Invalid DISPATCHER_URL: ${String(e)}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(DISPATCHER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: model.temperature,
        max_tokens: model.maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`ZEN API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
  }
}
