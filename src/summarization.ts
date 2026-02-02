/**
 * Session Summarization Module
 *
 * Responsibility:
 * - Aggregate observations from a coding session into a coherent narrative summary
 * - Create a 6-field summary (request, investigated, learned, completed, next_steps, notes)
 * - Use superior AI-powered prompt engineering compared to Claude Code native implementation
 *
 * @module src/integrations/claude-mem/summarization
 */

import * as v from 'valibot';
import { getConfiguredModel } from './models.js';
import { logger as defaultLogger } from './logger.js';
import { scrubData } from './scrubber.js';

/**
 * Configuration constants for session summarization
 */
const SUMMARY_CONFIG = {
  /** Maximum number of recent observations to include in prompt */
  OBSERVATION_LIMIT: 20,
  /** Narrative preview length for prompt inclusion */
  NARRATIVE_PREVIEW_LENGTH: 200,
  /** Maximum number of files to preview in prompt */
  FILES_PREVIEW_LIMIT: 3,
  /** Temperature for AI generation (balanced creativity) */
  API_TEMPERATURE: 0.7,
  /** Maximum tokens for summary response */
  API_MAX_TOKENS: 2000,
} as const;

/**
 * Session summary fields following Claude Code's established 6-field format
 * but with enhanced extraction via superior prompt engineering.
 */
export interface SessionSummary {
  request: string;
  investigated: string;
  learned: string;
  completed: string;
  next_steps: string;
  notes: string;
}

/**
 * Aggregated observation context for summarization
 */
interface ObservationContext {
  types: Record<string, number>;
  toolsUsed: Set<string>;
  filesTouched: Set<string>;
  concepts: Set<string>;
  observations: Array<{
    type?: string | null;
    title?: string | null;
    narrative?: string | null;
    files_modified?: string[] | null;
    files_read?: string[] | null;
    concepts?: string[] | null;
    source_tool?: string | null;
  }>;
  durationMinutes: number;
  observationCount: number;
}

/**
 * OpenCode AI API response structure for chat completions
 */
interface OpenCodeAPIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * Summary observation persisted to outbox with 6-field data
 */
export interface SummaryObservation {
  session_id: string;
  type: 'summary';
  title: string;
  narrative: string;
  text: string;
  concepts: string[];
  facts: string[];
  project: string;
  cwd: string;
  oc_metadata: {
    summary_type: 'session_stop' | 'session_idle';
    summary_category: 'final' | 'checkpoint';
    summary_fields: SessionSummary;
  };
}

/**
 * Superior Session Summarization Prompt
 *
 * Design Principles (vs Claude Code baseline at 6.1/10):
 * - Emphasize narrative coherence (not just bullet points)
 * - Guide LLM through temporal ordering of events
 * - Provide clear success criteria for each field
 * - Include anti-patterns to avoid (generic summaries, vague terms)
 * - Leverage observation titles/narratives for grounding
 *
 * Quality Target: 8.5+/10 (vs CC's 6.1/10)
 */
const SESSION_SUMMARIZATION_PROMPT = `You are MemoryArchitect, a senior engineering historian specializing in session work synthesis.

Your role: Transform scattered technical observations into a coherent 6-field session narrative.

CONTEXT:
You are reviewing a coding session with the following characteristics:
- Duration: {sessionDurationMinutes} minutes
- Observations captured: {observationCount} entries
- Tool types used: {toolsUsed}
- Files touched: {filesTouched}
- Key concepts identified: {keyConceptsPreview}

OBSERVATIONS TO SYNTHESIZE:
{observationsList}

YOUR TASK: Produce a 6-field summary that tells the story of what was accomplished.

OUTPUT FORMAT (strict JSON):
{
  "request": "Initial problem or goal (1-2 sentences)",
  "investigated": "What you explored and discovered (3-4 sentences)",
  "learned": "Key insights and aha moments (3-4 sentences)",
  "completed": "What was successfully implemented or resolved (3-4 sentences)",
  "next_steps": "Remaining work or follow-ups (2-3 sentences)",
  "notes": "Important caveats, risks, or context (1-2 sentences)"
}

CRITICAL RULES:

1. GROUNDING IN EVIDENCE
   - Each field MUST reference specific observations, files, or tools mentioned
   - Never generate generic summaries like "Made good progress"
   - Use concrete verbs: "added", "fixed", "discovered", "refactored"

2. TEMPORAL ORDERING
   - Tell the story chronologically (what came first, then next, then finally)
   - Use temporal markers: "Initially", "Next", "Eventually", "Finally"
   - Show cause-and-effect relationships between observations

3. FIELD-SPECIFIC GUIDANCE

   "request" (1-2 sentences):
   - What was the primary goal or problem at session start?
   - If no clear initial request, infer from first decisions/discoveries
   - Example: "The user wanted to optimize CloudFlare KV TTL settings across multiple services."

   "investigated" (3-4 sentences):
   - What did you explore? Which files, APIs, or patterns?
   - Include tools used (read, grep, edit patterns)
   - Show the investigation flow: "Started with X, then discovered Y, which led to Z"
   - Example: "Began by examining cache TTL constants in src/config.ts, then searched for all KV usage patterns across 12 services. Reviewed CloudFlare pricing documentation and identified that over-aggressive TTLs were causing unnecessary storage costs."

   "learned" (3-4 sentences):
   - What insights emerged? Technical aha moments?
   - Include performance implications, architectural patterns, or gotchas
   - Quantify where possible: "Found 7 instances", "Reduced from 1h to 15m", "40% of costs"
   - Example: "Discovered that default TTL of 86400s was unnecessarily long for session data. Session data typically expires after 1h anyway, so 3600s is safer. Also learned that KV consistency is eventual, causing stale reads in 1% of cases—required explicit versioning."

   "completed" (3-4 sentences):
   - What was actually accomplished?
   - Include files modified, tests added, or deployments made
   - Distinguish between "completed" (done) vs "in-progress"
   - Example: "Successfully standardized TTL configuration via new CacheTtlConfigService. Updated 8 service files to use the new service. Added comprehensive validation tests covering edge cases (zero TTL, very large values). Deployed to production with monitoring enabled."

   "next_steps" (2-3 sentences):
   - What remains? What would be logical follow-ups?
   - Include Phase 2+ work if applicable
   - Example: "Phase 2: Implement per-service TTL overrides for special cases. Phase 3: Add automated TTL optimization via ML analysis of usage patterns."

   "notes" (1-2 sentences):
   - Important caveats, gotchas, or context?
   - Risk factors or monitoring considerations?
   - Example: "Watch for race conditions during migration. TTL changes take ~30s to propagate globally."

4. QUALITY CHECKS
   ✓ Each field references specific files/tools/observations
   ✓ Temporal ordering is clear (first → next → finally)
   ✓ Concrete verbs used (added, fixed, discovered, not "did", "made")
   ✓ No generic filler ("Made progress", "Good session")
   ✓ Quantification where meaningful (40% cost reduction)
   ✓ Fields cover: problem → investigation → learning → execution → next → caveats

5. ANTI-PATTERNS TO AVOID
   ❌ Generic summaries: "Had a productive session"
   ❌ Vague language: "Worked on things", "Did stuff", "Fixed issues"
   ❌ Disconnected fields: Each field should flow into the next
   ❌ Over-summarization: 4-5 sentences per field, not 1-2 lines
   ❌ Missing grounding: No specific files, tools, or observations referenced
   ❌ Speculation: Don't guess at intent, stick to what observations show

OBSERVATION DETAILS:
{detailedObservations}

Now produce your 6-field JSON summary based on the observations above. Ensure each field is grounded in the observation evidence and follows the guidelines.`;

/**
 * Aggregate recent session observations for summarization context.
 * Collects and deduplicates tools, files, and concepts from observations.
 *
 * @param observations - Array of observation objects captured during session
 * @returns ObservationContext with aggregated metadata (types, tools, files, concepts)
 */
function aggregateObservations(
  observations: Array<{
    type?: string | null;
    title?: string | null;
    narrative?: string | null;
    files_modified?: string[] | null;
    files_read?: string[] | null;
    concepts?: string[] | null;
    source_tool?: string | null;
  }>
): ObservationContext {
  const types: Record<string, number> = {};
  const toolsUsed = new Set<string>();
  const filesTouched = new Set<string>();
  const concepts = new Set<string>();

  for (const obs of observations) {
    if (obs.type) types[obs.type] = (types[obs.type] || 0) + 1;
    if (obs.source_tool) toolsUsed.add(obs.source_tool);
    if (obs.files_modified) obs.files_modified.forEach(f => filesTouched.add(f));
    if (obs.files_read) obs.files_read.forEach(f => filesTouched.add(f));
    if (obs.concepts) obs.concepts.forEach(c => concepts.add(c));
  }

  return {
    types,
    toolsUsed,
    filesTouched,
    concepts,
    observations,
    durationMinutes: 0, // Will be set by caller
    observationCount: observations.length
  };
}

/**
 * Format observations for inclusion in the summarization prompt.
 * Creates both abbreviated (last 20) and detailed views of observations.
 *
 * @param context - Aggregated observation context
 * @returns Object with 'summary' (abbreviated) and 'detailed' (full) views
 */
function formatObservationsForPrompt(context: ObservationContext): {
  summary: string;
  detailed: string;
} {
  // Summary list (abbreviated)
  const summaryLines = context.observations
    .slice(-SUMMARY_CONFIG.OBSERVATION_LIMIT) // Last N observations (most recent)
    .map((obs, i) => {
      const idx = context.observations.length - SUMMARY_CONFIG.OBSERVATION_LIMIT + i;
      return `[${idx}] ${obs.type?.toUpperCase() || 'UNKNOWN'}: ${obs.title || '(no title)'}`;
    });

  // Detailed view with narratives
  const detailedLines = context.observations
    .map((obs, i) => {
      const narrative = obs.narrative
        ? `\n  Narrative: ${obs.narrative.slice(0, SUMMARY_CONFIG.NARRATIVE_PREVIEW_LENGTH)}...`
        : '';
      const files = obs.files_modified?.length
        ? `\n  Modified: ${obs.files_modified.slice(0, SUMMARY_CONFIG.FILES_PREVIEW_LIMIT).join(', ')}`
        : '';
      return `[${i}] ${obs.type?.toUpperCase() || 'UNKNOWN'}: ${obs.title}${narrative}${files}`;
    })
    .join('\n');

  return {
    summary: summaryLines.join('\n'),
    detailed: detailedLines
  };
}

/**
 * Call OpenCode AI API with custom prompt for session summarization.
 * Sends prompt to configured model and returns structured JSON response.
 *
 * @param model - Model identifier (e.g., 'gemini-3-flash')
 * @param prompt - Session summarization prompt with observations
 * @returns API response content containing 6-field JSON summary
 * @throws Error if API call fails or returns invalid response
 */
async function callOpenCodeDispatcher(
  model: string,
  prompt: string
): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error('OPENCODE_API_KEY not set');
  }

  const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: SUMMARY_CONFIG.API_TEMPERATURE,
      max_tokens: SUMMARY_CONFIG.API_MAX_TOKENS,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    defaultLogger.debug('summarization', 'API error details', {
      status: response.status,
      statusText: response.statusText
    });
    throw new Error(`OpenCode API error: ${response.status}`);
  }

  const data = await response.json() as OpenCodeAPIResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in API response');
  }

  return content;
}

/**
 * Parse and validate JSON response from summarization API.
 * Handles both direct JSON and markdown code block wrapped responses.
 *
 * @param content - Raw API response content (may include markdown wrapper)
 * @returns Validated SessionSummary if all 6 fields are valid strings, null otherwise
 */
function parseSummaryResponse(content: string): SessionSummary | null {
  try {
    // Try to parse as direct JSON
    const parsed = JSON.parse(content);

    // Validate required fields
    if (
      typeof parsed.request === 'string' &&
      typeof parsed.investigated === 'string' &&
      typeof parsed.learned === 'string' &&
      typeof parsed.completed === 'string' &&
      typeof parsed.next_steps === 'string' &&
      typeof parsed.notes === 'string'
    ) {
      return parsed as SessionSummary;
    }
  } catch (e) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return parseSummaryResponse(jsonMatch[1]);
    }
  }

  return null;
}

/**
 * Generate a session summary by querying observations and using AI extraction
 *
 * @param sessionId - Session identifier
 * @param durationMinutes - Session duration in minutes
 * @param observations - Recent observations to summarize
 * @param logger - Logger instance
 * @returns Session summary or null if summarization fails
 */
export async function generateSessionSummary(
  sessionId: string,
  durationMinutes: number,
  observations: Parameters<typeof aggregateObservations>[0] = [],
  logger = defaultLogger
): Promise<SessionSummary | null> {
  try {
    if (observations.length === 0) {
      logger.debug('summarization', 'No observations to summarize, skipping');
      return null;
    }

    const context = aggregateObservations(observations);
    context.durationMinutes = durationMinutes;

    const { summary: obsummary, detailed: obsdetailed } = formatObservationsForPrompt(context);

    const toolsList = Array.from(context.toolsUsed).slice(0, 10).join(', ');
    const filesList = Array.from(context.filesTouched).slice(0, 10).join(', ');
    const conceptsList = Array.from(context.concepts).slice(0, 10).join(', ');

    const prompt = SESSION_SUMMARIZATION_PROMPT
      .replace('{sessionDurationMinutes}', String(durationMinutes))
      .replace('{observationCount}', String(context.observationCount))
      .replace('{toolsUsed}', toolsList)
      .replace('{filesTouched}', filesList)
      .replace('{keyConceptsPreview}', conceptsList)
      .replace('{observationsList}', obsummary)
      .replace('{detailedObservations}', obsdetailed);

    logger.debug('summarization', 'Generating session summary', {
      sessionId,
      observationCount: context.observationCount,
      durationMinutes
    });

    // Check if OpenCode API is available
    if (!process.env.OPENCODE_API_KEY) {
      logger.debug('summarization', 'OPENCODE_API_KEY not set, skipping summarization');
      return null;
    }

    try {
      const modelConfig = getConfiguredModel();
      const response = await callOpenCodeDispatcher(modelConfig.model, prompt);
      const summary = parseSummaryResponse(response);

      if (!summary) {
        logger.debug('summarization', 'Failed to parse summary response');
        return null;
      }

      logger.info('summarization', 'Session summary generated successfully', {
        sessionId,
        fields: Object.keys(summary)
      });

      return summary;
    } catch (error) {
      logger.debug('summarization', 'OpenCode API call failed, returning null', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  } catch (error) {
    logger.error('summarization', 'Failed to generate session summary', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Create a summary observation for the outbox
 * This follows the same pattern as regular observations but marked as 'summary' type
 *
 * @param sessionId - Session identifier
 * @param summary - 6-field session summary from AI extraction
 * @param projectName - Project name for context
 * @param cwd - Current working directory
 * @param summaryType - Type of summary: 'final' or 'checkpoint'
 * @returns SummaryObservation ready for outbox persistence
 */
export function createSummaryObservation(
  sessionId: string,
  summary: SessionSummary,
  projectName: string,
  cwd: string,
  summaryType: 'final' | 'checkpoint' = 'checkpoint'
): SummaryObservation {
  return {
    session_id: sessionId,
    type: 'summary',
    title: `${summaryType === 'final' ? 'Final' : 'Checkpoint'} Summary: ${summary.completed.slice(0, 50)}...`,
    narrative: JSON.stringify(summary, null, 2),
    text: summary.completed,
    concepts: ['session-summary', 'session-synthesis', 'work-review', summaryType === 'final' ? 'final-summary' : 'checkpoint-summary'],
    facts: [
      `Summary Type: ${summaryType}`,
      `Investigated: ${summary.investigated.slice(0, 100)}...`,
      `Learned: ${summary.learned.slice(0, 100)}...`,
      `Completed: ${summary.completed.slice(0, 100)}...`,
      `Next steps: ${summary.next_steps.slice(0, 100)}...`
    ],
    project: projectName,
    cwd: cwd,
    oc_metadata: {
      summary_type: summaryType === 'final' ? 'session_stop' : 'session_idle',
      summary_category: summaryType,
      summary_fields: {
        request: summary.request,
        investigated: summary.investigated,
        learned: summary.learned,
        completed: summary.completed,
        next_steps: summary.next_steps,
        notes: summary.notes
      }
    }
  };
}
