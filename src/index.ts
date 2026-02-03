// ZEN-native memory extraction active (v3)
import type { Plugin } from "@opencode-ai/plugin"

import { homedir } from 'os';
import { join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';

// Import shared constants
import {
  CLAUDE_MEM_BASE_URL,
  HEALTH_CHECK_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  shouldSkipTool,
  shouldExtractImmediately,
  shouldIgnoreFileEvent,
  shouldRecordObservation,
  OPENCODE_SOURCE,
  OPENCODE_SOURCE_VERSION,
  MAX_OBSERVATION_CONTENT_SIZE,
  INJECTION_ENABLED_DEFAULT,
  INGESTOR_TRIGGER_EVERY_N_OBSERVATIONS,
  CHECKPOINT_TTL_MS,
  IDLE_TIMEOUT_MINUTES,
} from './constants.js';

import { resolveClaudeMemPaths } from './paths.js';
import { outbox } from './outbox.js';
import { buildInjectionBlock } from './manifest.js';
import { extractObservation, createFallbackExtracted } from './extractor.js';
import { logger } from './logger.js';
import { getMemoryConfig } from './config.js';
import { ZenNativeExtractor } from './zen-native.js';
import { generateSessionSummary, createSummaryObservation } from './summarization.js';
import { displayUserMessage } from './utils/user-messaging.js';
import { smartInstall, checkDependencies, type DependencyCheckResult } from './utils/smart-install.js';

let ingestorTriggerInFlight: Promise<void> | null = null;

/**
 * Session state (module-level for persistence across hooks)
 */
let currentSessionId: string | null = getResumeSessionId()
let sessionStartTime: Date | null = currentSessionId ? new Date() : null
let observationCount = 0

/**
 * Map to track tool arguments between before/after hooks.
 */
const callArgsMap = new Map<string, any>();

/**
 * Map to track execution timing metadata for tool calls.
 */
const callTimingMap = new Map<string, { started_at: string; started_at_ms: number }>();

/**
 * Array to track file.watcher event timestamps for rate limiting.
 * Stores timestamps of the last 100 events for rate limiting calculations.
 */
let fileEventTimestamps: number[] = [];

const CHECKPOINT_PATH = join(homedir(), '.claude-mem', 'checkpoint.json');

/**
 * Save session checkpoint for resumption
 */
function saveCheckpoint(sessionId: string) {
  try {
    // SEC-004: Set file mode 0o600 to prevent other users from reading session IDs.
    writeFileSync(CHECKPOINT_PATH, JSON.stringify({
      sessionId,
      timestamp: Date.now()
    }), { mode: 0o600 });
  } catch (e) {
    void e;
    // best-effort
  }
}

/**
 * Get session ID to resume if recent
 */
function getResumeSessionId(): string | null {
  try {
    if (!existsSync(CHECKPOINT_PATH)) return null;
    const data = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf-8'));
    const age = Date.now() - data.timestamp;
    if (age < CHECKPOINT_TTL_MS) {
      return data.sessionId;
    }
  } catch (e) {
    void e;
    // best-effort
  }
  return null;
}

/**
 * Check if the claude-mem worker is healthy
 */
async function isWorkerHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
    
    const response = await fetch(`${CLAUDE_MEM_BASE_URL}/api/health`, {
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Ensure the claude-mem worker is running.
 * Uses the global installation's worker-service.cjs.
 * Non-blocking startup with jittered backoff.
 */
async function ensureWorkerRunning($: any): Promise<void> {
  // Fast path: already healthy
  if (await isWorkerHealthy()) {
    return
  }

  let paths;
  try {
    paths = resolveClaudeMemPaths();
  } catch (e) {
    void e;
    // Plugin should not hard-fail if claude-mem is not installed.
    return;
  }

  // Start the worker in background (non-blocking)
  (async () => {
    try {
      // Exponential backoff with jitter for lock acquisition
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await $`bun "${paths.workerService}" start`.quiet()
          break; 
        } catch (e) {
          logger.debug('plugin', 'Worker start attempt failed', { attempt, error: String(e) });
          const delay = Math.min(100 * Math.pow(1.6, attempt), 1600) + Math.random() * 100;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Wait for health check (up to 5 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500))
        if (await isWorkerHealthy()) {
          // Trigger outbox drain once healthy
          outbox.drain().catch(() => {});
          return
        }
      }
    } catch (e) {
      void e;
      // Silent failure in background
    }
  })();
}

/**
 * Trigger the local federated ingestor (best effort).
 *
 * This ingests JSONL outbox files into per-project .oc/memory.db.
 *
 * Note: This is intentionally fire-and-forget; failures should not
 * interfere with OpenCode operation.
 */
async function triggerIngestorOnce($: any, reason: string): Promise<void> {
  if (ingestorTriggerInFlight) return ingestorTriggerInFlight;

  // Reason is for local debugging; we intentionally keep this silent here.
  void reason;

  ingestorTriggerInFlight = (async () => {
    try {
      const paths = resolveClaudeMemPaths();
      const ingestorPath = join(paths.root, 'src', 'ingestor.ts');
      await $`bun run "${ingestorPath}" --once`.quiet();
    } catch (e) {
      logger.debug('plugin', 'Ingestor trigger failed', { error: String(e) });
    } finally {
      ingestorTriggerInFlight = null;
    }
  })();

  return ingestorTriggerInFlight;
}

/**
 * Generate a session summary from recent observations in the outbox.
 *
 * This aggregates all observations captured during the session into a coherent
 * 6-field narrative using superior AI-powered summarization.
 *
 * Called on session.idle when idle timeout is exceeded or on explicit session stop.
 * 
 * @param sessionId - The session identifier
 * @param durationMs - Session duration in milliseconds
 * @param summaryType - Type of summary: 'final' for explicit stop, 'checkpoint' for idle timeout
 */
async function summarizeSession(
  sessionId: string,
  durationMs: number = 0,
  summaryType: 'final' | 'checkpoint' = 'checkpoint'
): Promise<void> {
  try {
    // Query outbox database for recent observations from this session
    // We need access to the outbox's database to query observations
    let recentObservations: any[] = [];

    try {
      // Get outbox.db queries (accessing through module-level if available)
      // For now, we'll use a simplified approach by checking what's in outbox
      const db = (outbox as any).db;
      if (db) {
        recentObservations = db.query(`
          SELECT
            type, title, narrative, files_modified, files_read,
            concepts, source_tool
          FROM pending_observations
          WHERE session_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).all(sessionId) as any[];
      }
    } catch (e) {
      logger.debug('summarization', 'Failed to query outbox for observations', {
        error: e instanceof Error ? e.message : String(e)
      });
      // Continue without observations - fallback will create generic summary
      recentObservations = [];
    }

    const durationMinutes = Math.round(durationMs / 1000 / 60) || 0;

    // Generate summary using AI extraction infrastructure
    const summary = await generateSessionSummary(
      sessionId,
      durationMinutes,
      recentObservations,
      logger
    );

    if (!summary) {
      logger.debug('summarization', 'Session summarization returned null');
      return;
    }

    // Create a summary observation and push to outbox
    const projectName = process.env.OPENCODE_PROJECT || 'default';
    const cwd = process.cwd();

    const summaryObs = createSummaryObservation(
      sessionId,
      summary,
      projectName,
      cwd,
      summaryType
    );

    await outbox.push({
      ...summaryObs,
      session_id: sessionId,
      source: OPENCODE_SOURCE,
      tool: 'session_summary',
      project: projectName,
      cwd: cwd,
      timestamp: new Date().toISOString(),
      content: summaryObs.text // Map text to content for OutboxObservation
    });

    logger.info('summarization', `${summaryType === 'final' ? 'Final' : 'Checkpoint'} session summary pushed to outbox`, {
      sessionId,
      observationCount: recentObservations.length,
      summaryType
    });
  } catch (error) {
    logger.error('summarization', 'Failed to summarize session', {
      sessionId,
      error: error instanceof Error ? error.message : String(error)
    });
    // Non-blocking failure - don't interrupt OpenCode workflow
  }
}

/**
 * Generate a unique session ID for OpenCode
 */
function generateSessionId(): string {
  return `opencode-session-${Date.now()}`
}

/**
 * Fetch context from claude-mem for the current project
 * 
 * Aligned with official Claude Mem standards:
 * - 50 observations (MANIFEST_MAX_OBSERVATIONS)
 * - 10 session summaries (MAX_SESSION_SUMMARIES)
 * - Progressive disclosure: 5 full details + 45 compact index
 */
async function fetchContext(project: string, limit: number = 50): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    
    const response = await fetch(
      `${CLAUDE_MEM_BASE_URL}/api/context/recent?project=${encodeURIComponent(project)}&limit=${limit}`,
      { signal: controller.signal }
    )
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      return null
    }
    
    return await response.text()
  } catch {
    return null
  }
}

/**
 * Register a new session with claude-mem
 */
async function registerSession(
  sessionId: string,
  project: string,
  directory: string
): Promise<boolean> {
  try {
    const response = await fetch(`${CLAUDE_MEM_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        source: OPENCODE_SOURCE,
        source_version: OPENCODE_SOURCE_VERSION,
        project,
        directory,
        started_at: new Date().toISOString()
      })
    })
    
    return response.ok
  } catch {
    return false
  }
}

/**
 * Capture an observation from tool execution.
 * Uses Durable Outbox pattern.
 */
async function captureObservation(
  sessionId: string,
  project: string,
  directory: string,
  tool: string,
  output: string,
  title?: string
): Promise<void> {
  outbox.push({
    session_id: sessionId,
    source: OPENCODE_SOURCE,
    project,
    cwd: directory,
    tool,
    title: title || `Untitled (${tool})`,
    content: output.slice(0, MAX_OBSERVATION_CONTENT_SIZE),
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if context injection is enabled for the current project
 */
function isInjectionEnabled(projectName: string): boolean {
  if (process.env.CLAUDE_MEM_INJECTION_ENABLED === 'true') return true;
  if (process.env.CLAUDE_MEM_INJECTION_ENABLED === 'false') return false;
  
  // Explicitly enable for content-tracker
  if (projectName === 'content-tracker') return true;
  
  return INJECTION_ENABLED_DEFAULT;
}

/**
 * Request session summarization
 */
export async function triggerSummarization(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${CLAUDE_MEM_BASE_URL}/api/sessions/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        use_opencode_model: true
      })
    })
    
    return response.ok
  } catch {
    return false
  }
}

/**
 * Trigger the local federated ingestor (best effort).
 */
export async function triggerIngestion($: any, reason: string): Promise<void> {
  return triggerIngestorOnce($, reason);
}

export { buildInjectionBlock } from './manifest.js';
export { OrchestrationController } from './controller.js';
export { invokeGuardrailValidator } from './validator-wrapper.js';
export { isInjectionEnabled, getMemoryConfig } from './config.js';
export { Ingestor } from './ingestor.js';
export { createClaudeMemClient } from './client.js';
export { CLAUDE_MEM_BASE_URL, HYBRID_SEARCH_CONFIG } from './constants.js';
export { restartWorker } from './lifecycle.js';
export { outbox } from './outbox.js';
export {
  executeHybridSearch,
  simpleSearch,
  hybridSearchWithScoring,
  fullIntelligenceSearch,
  SearchExecutionError,
  type HybridSearchExecutionOptions,
} from './search-orchestration.js';
export {
  hybridSearch,
  expandAndRankByRelationships,
  type HybridSearchOptions,
  type HybridSearchResult,
  type SemanticSearchResult,
  type ExpandAndRankOptions,
} from './hybrid-search.js';

/**
 * Map to track message roles by ID.
 */
const messageRoleMap = new Map<string, string>();

/**
 * Set to track processed message IDs to prevent duplicate capture.
 */
const processedMessageIds = new Set<string>();

/**
 * Main plugin export
 */
export const ClaudeMemBridge: Plugin = async ({ project: _project, client, $, directory }: any) => {
  // Determine project name from directory
  const projectName = directory.split('/').pop() || 'unknown'
  const config = await getMemoryConfig();
  const injectionEnabled = isInjectionEnabled(projectName)

  // Initialize logger with OpenCode client and verbosity
  logger.init({
    client,
    verbosity: config.verbosity,
    service: 'claude-mem-bridge'
  });

  // Initialize ZEN-native extractor (Pattern A: Hidden Background Session)
  const zenExtractor = new ZenNativeExtractor(client);
  zenExtractor.init().catch(e => logger.warn('plugin', 'zenExtractor.init failed', { error: String(e) }));
  
  if (currentSessionId && process.env.CLAUDE_MEM_DEBUG === 'true') {
    logger.debug('plugin', `Resumed session from checkpoint: ${currentSessionId}`);
  }

  return {
    /**
     * Event handler for session lifecycle events
     */
    event: async ({ event }: any) => {
      // Enhanced file.watcher.updated filtering with rate limiting and tool-active detection
      if (event.type === 'file.watcher.updated') {
        const filePath = event.properties?.file || '';
        
        // Enhanced ignore patterns (includes node_modules, .git, dist, build, and our own DB)
        const fileEventConfig = {
          ignorePatterns: [
            /node_modules/,
            /\.git/,
            /\.claude-mem/,
            /\.oc\/memory\.db/,  // Don't capture our own DB changes
            /dist\//,
            /build\//,
            /\.next\//,
            /\.cache\//,
            /\.turbo\//,
            /\.vercel\//,
          ],
          maxEventsPerMinute: 100,  // Rate limiting
          captureOnlyWhen: 'tool-active'  // Only during active tool use
        };
        
        // Check enhanced ignore patterns
        const shouldIgnoreEnhanced = fileEventConfig.ignorePatterns.some(pattern => pattern.test(filePath));
        if (shouldIgnoreEnhanced || shouldIgnoreFileEvent(filePath)) {
          return; // Silent skip - don't log anything
        }
        
        // Rate limiting: check if we're within the max events per minute
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        fileEventTimestamps = fileEventTimestamps.filter(ts => ts > oneMinuteAgo);
        
        if (fileEventTimestamps.length >= fileEventConfig.maxEventsPerMinute) {
          // Rate limit exceeded - skip silently
          return;
        }
        
        // Only capture during active tool use (when there are pending or recent tool calls)
        const lastToolActivity = Math.max(
          ...Array.from(callTimingMap.values()).map(t => t.started_at_ms),
          0
        );
        const isToolActive = (now - lastToolActivity) < 30000; // Active within last 30 seconds
        
        if (!isToolActive && fileEventConfig.captureOnlyWhen === 'tool-active') {
          return; // Skip - no active tool use
        }
        
        // Passed all filters - record the timestamp for rate limiting
        fileEventTimestamps.push(now);
      }

      // Debug logging: Only log if explicitly enabled
      if (process.env.CLAUDE_MEM_DEBUG === 'true') {
        logger.debug('plugin', `Event: ${event.type}`, {
          properties: JSON.stringify(event.properties).slice(0, 200)
        });
      }

      // Handle message.updated (track roles only - prompt capture consolidated in message.created)
      if (event.type === 'message.updated') {
        const info = event.properties?.info;
        if (info?.id) {
          messageRoleMap.set(info.id, info.role);
        }
        // Note: User prompt capture moved to message.created to prevent duplicates
      }

      // Note: message.part.updated prompt capture removed - consolidated in message.created

      // Handle command.executed (slash commands)
      if (event.type === 'command.executed' && currentSessionId) {
        const { name, arguments: args } = event.properties;
        if (process.env.CLAUDE_MEM_DEBUG === 'true') {
          logger.debug('plugin', `Command executed: /${name}`);
        }
        try {
          observationCount++
          outbox.push({
            session_id: currentSessionId,
            source: OPENCODE_SOURCE,
            project: projectName,
            cwd: directory,
            tool: 'command',
            title: `Command: /${name}`,
            type: 'discovery',
            narrative: `User executed slash command: /${name} ${args || ''}`,
            concepts: ['user-interaction', 'command-execution'],
            facts: [`Command: /${name}`, `Arguments: ${args || 'none'}`],
            content: args || '',
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          logger.debug('plugin', 'Failed to push command to outbox', { error: String(e) });
        }
      }

      // Handle session.created
      if (event.type === 'session.created') {
        if (process.env.CLAUDE_MEM_DEBUG === 'true') {
          logger.debug('plugin', `Session created: ${event.properties?.info?.id}`);
        }

        // SMART INSTALL: Check and install dependencies before other initialization
        let dependencyStatus: DependencyCheckResult | undefined
        try {
          dependencyStatus = await checkDependencies()
          if (dependencyStatus.needsInstall) {
            displayUserMessage({
              type: 'info',
              title: 'Memory Plugin Setup',
              message: `Installing dependencies (${dependencyStatus.reason})...`,
              emoji: true
            })
            await smartInstall($)
          }
        } catch (e) {
          logger.debug('plugin', 'Smart install check failed', { error: String(e) })
        }

        // Attempt to resume session
        currentSessionId = getResumeSessionId() || generateSessionId()
        sessionStartTime = new Date()
        observationCount = 0

        saveCheckpoint(currentSessionId)

        // Ensure worker is running (non-blocking)
        await ensureWorkerRunning($)

        // Register session (idempotent)
        registerSession(currentSessionId, projectName, directory).catch(() => {})

        // Fetch context and show user messaging
        if (injectionEnabled) {
          const context = await fetchContext(projectName)
          if (context && context.length > 100) {
            const tokenEstimate = Math.round(context.length / 4);
            if (process.env.CLAUDE_MEM_DEBUG === 'true') {
              logger.debug('plugin', `Injected ${tokenEstimate} tokens of historical context`);
            }

            // User messaging: Context loaded
            displayUserMessage({
              type: 'success',
              title: 'Claude-Mem Context Loaded',
              message: `${Math.min(50, Math.round(tokenEstimate / 10))} observations available from previous sessions`,
              link: { text: 'View in browser', url: 'http://localhost:37777/' },
              emoji: true
            })
          } else {
            // User messaging: First time setup
            displayUserMessage({
              type: 'info',
              title: 'Memory Plugin Active',
              message: 'No previous context found. Your session observations will be captured and summarized.',
              link: { text: 'Documentation', url: 'https://github.com/thedotmack/claude-mem' },
              emoji: true
            })
          }
        }

        // User messaging: Memory service status
        const isHealthy = await isWorkerHealthy()
        if (!isHealthy) {
          displayUserMessage({
            type: 'warning',
            title: 'Memory Service Starting',
            message: 'The memory worker is starting up. Some features may be unavailable for a few seconds.',
            emoji: true
          })
        }
      }
      
      // Handle session.compacted
      if (event.type === 'session.compacted' && currentSessionId) {
        try {
          await captureObservation(
            currentSessionId,
            projectName,
            directory,
            'session.compacted',
            'Session compacted due to context limit',
            'Session Compacted'
          )
        } catch (e) {
          logger.debug('plugin', 'Failed to capture compaction observation', { error: String(e) });
        }
      }
      
       // Handle session.idle with Stop-like behavior
        if (event.type === 'session.idle' && currentSessionId && sessionStartTime) {
          const durationMs = Date.now() - sessionStartTime.getTime()
          const durationMinutes = durationMs / 1000 / 60
          
          // Check if user explicitly stopped (via environment or signal)
          const userStopped = process.env.CLAUDE_MEM_USER_STOPPED === 'true' || 
                              process.env.CLAUDE_MEM_SESSION_STOP === 'true' ||
                              event.properties?.reason === 'user_stop' ||
                              event.properties?.explicitStop === true;
          
          // Trigger on explicit stop OR idle timeout with observations
          if (userStopped || (durationMinutes > IDLE_TIMEOUT_MINUTES && observationCount > 0)) {
            // Different log messages for stop vs idle
            logger.info('session',
              userStopped
                ? `Session stopped by user after ${Math.round(durationMinutes)} min, ${observationCount} observations captured`
                : `Session idle after ${Math.round(durationMinutes)} min, ${observationCount} observations captured`
            );

            // Try to ship queued observations and also ingest local JSONL into project memory.
            outbox.drain().catch((e) => logger.debug('plugin', 'Outbox drain failed', { error: String(e) }))
            triggerIngestorOnce($, userStopped ? 'session.stop' : 'session.idle').catch((e) => logger.debug('plugin', 'Ingestor trigger failed', { error: String(e) }))

            await summarizeSession(currentSessionId, durationMs).catch((e) => logger.debug('plugin', 'Summarization failed', { error: String(e) }))
          }
        }

       // Final safety trigger: ensure pending observations are ingested on shutdown
       if (event.type === 'server.instance.disposed') {
         triggerIngestorOnce($, 'server.disposed').catch((e) => logger.debug('plugin', 'Ingestor trigger failed', { error: String(e) }))
         await zenExtractor.cleanup().catch((e) => logger.debug('plugin', 'Zen cleanup failed', { error: String(e) }));
       }

       // Final safety trigger: ensure pending observations are ingested when a session is deleted
       if (event.type === 'session.deleted') {
         triggerIngestorOnce($, 'session.deleted').catch((e) => logger.debug('plugin', 'Ingestor trigger failed', { error: String(e) }))
         await zenExtractor.cleanup().catch((e) => logger.debug('plugin', 'Zen cleanup failed', { error: String(e) }));
       }

    },

    /**
     * Session Stop Hook
     * Triggered on explicit user stop (not idle timeout)
     * - Generate final session summary
     * - Mark session as "stopped" vs "completed"
     * - Trigger outbox drain
     */
    "session.stop": async (input: any, output: any) => {
      if (!currentSessionId || !sessionStartTime) return

      const durationMs = Date.now() - sessionStartTime.getTime()
      const durationMinutes = Math.round(durationMs / 1000 / 60)

      logger.info('session', `Session stopped by user after ${durationMinutes} min, ${observationCount} observations captured`)

      try {
        // Trigger outbox drain to ensure all observations are persisted
        await outbox.drain()

        // Generate final session summary
        await summarizeSession(currentSessionId, durationMs)

        // Trigger ingestor to process final observations
        await triggerIngestorOnce($, 'session.stop')

        // Clear checkpoint since session is explicitly stopped
        try {
          const checkpointPath = join(homedir(), '.claude-mem', 'checkpoint.json')
          if (existsSync(checkpointPath)) {
            // Use synchronous delete for cleanup
            const { unlinkSync } = await import('fs')
            unlinkSync(checkpointPath)
          }
        } catch (e) {
          logger.debug('plugin', 'Failed to clear checkpoint', { error: String(e) })
        }

        logger.info('session', 'Session stop processing complete')
      } catch (e) {
        logger.error('session', 'Session stop processing failed', { error: String(e) })
      }
    },

    /**
     * Message Created Hook (SINGLE SOURCE OF TRUTH for user prompt capture)
     * - Capture user prompt as an observation (always, when session exists)
     * - Inject context manifest into the conversation (only when injection enabled)
     */
    "message.created": async (input: any, output: any) => {
      if (process.env.CLAUDE_MEM_DEBUG === 'true') {
        logger.debug('plugin', `Message created: ${input.content?.slice(0, 50)}`);
      }
      if (!currentSessionId) return

      const userPrompt = input.content;

      // Always capture user prompts (regardless of injection setting)
      if (userPrompt) {
        if (process.env.CLAUDE_MEM_DEBUG === 'true') {
          logger.debug('plugin', `Capturing user prompt: ${userPrompt.slice(0, 50)}...`);
        }
        try {
          observationCount++
          outbox.push({
            session_id: currentSessionId,
            source: OPENCODE_SOURCE,
            project: projectName,
            cwd: directory,
            tool: 'user_prompt',
            title: `Prompt: ${userPrompt.slice(0, 50)}...`,
            type: 'discovery',
            narrative: `User submitted a prompt: ${userPrompt}`,
            concepts: ['user-interaction'],
            facts: [`User prompt: ${userPrompt}`],
            content: userPrompt,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          logger.warn('plugin', 'Failed to capture prompt observation', { error: String(e) });
        }
      }

      // Context injection only when enabled
      if (injectionEnabled) {
        try {
          const manifest = await buildInjectionBlock(projectName, userPrompt || '')
          if (manifest) {
            // message.created output.context is the documented way to inject context
            output.context.push(manifest)
          }
        } catch (e) {
          logger.debug('plugin', 'message.created hook failed', { error: String(e) });
        }
      }
    },
    
    /**
     * Tool Execute Before Hook
     * - Track arguments for later observation capture
     * - Capture start time for timing instrumentation
     */
    "tool.execute.before": async (input: any, output: any) => {
      if (process.env.CLAUDE_MEM_DEBUG === 'true') {
        logger.debug('plugin', `Tool before: ${input.tool} (${input.callID})`);
      }
      if (input.callID) {
        // SDK says output.args is where the arguments are
        callArgsMap.set(input.callID, output.args || {});
        // NEW: Capture start time for timing instrumentation
        const now = new Date();
        callTimingMap.set(input.callID, {
          started_at: now.toISOString(),
          started_at_ms: now.getTime()
        });
      }
    },

    /**
     * Tool Execute After Hook
     * - Capture observations from tool executions
     * - Skip noisy/low-value tools
     */
      "tool.execute.after": async (input: any, output: any) => {
        if (process.env.CLAUDE_MEM_DEBUG === 'true') {
          logger.debug('plugin', `Tool after: ${input.tool} (${input.callID})`);
        }
        if (!currentSessionId) return

        // Skip tools that don't provide valuable observations
        if (shouldSkipTool(input.tool)) {
          callArgsMap.delete(input.callID);
          return
        }

        // Retrieve arguments from before hook
        const args = callArgsMap.get(input.callID) || {};
        callArgsMap.delete(input.callID);

        // Phase D: Retrieve and clear timing data
        const timing = callTimingMap.get(input.callID);
        callTimingMap.delete(input.callID);

        const ended_at = new Date().toISOString();
        const ended_at_ms = Date.now();
        const execution_time_ms = timing ? ended_at_ms - timing.started_at_ms : undefined;

        // Phase D: Detect success/failure from output
        const success = !output.error &&
                        output.output !== undefined &&
                        output.output !== null &&
                        String(output.output).toLowerCase().indexOf('error') === -1;

        // Phase D: Sanitize error message
        let error_message: string | undefined;
        if (output.error) {
          const errorStr = String(output.error);
          // Remove stack traces (first line only)
          error_message = errorStr.split('\n')[0].slice(0, 500);
          // Remove file paths
          error_message = error_message.replace(/\/[^\s]+/g, '[path]');
          // Remove secrets
          error_message = error_message.replace(/[A-Za-z0-9+/=]{20,}/g, '[redacted]');
        }

        // Determine if this tool call is significant enough for AI-powered extraction
        const isHighValue = shouldExtractImmediately(input.tool, args);

        if (process.env.CLAUDE_MEM_DEBUG === 'true') {
          logger.debug('plugin', `Tool ${input.tool}: highValue=${isHighValue}`);
        }
        
        let extracted;
        if (isHighValue) {
          try {
            extracted = await extractObservation(
              input.tool,
              args,
              output.output || output.title || '',
              zenExtractor,
              $
            );
          } catch (e) {
            extracted = createFallbackExtracted(input.tool, args);
          }
        } else {
          // Low-value tool: skip AI extraction, use simple title
          extracted = createFallbackExtracted(input.tool, args);
        }

        // Phase 2: Filter low-value observations before recording
        if (!shouldRecordObservation(input.tool, extracted.title, extracted.narrative, extracted.type)) {
          if (process.env.CLAUDE_MEM_DEBUG === 'true') {
            logger.debug('plugin', `Skipped low-value observation: ${input.tool} - ${extracted.title?.slice(0, 50)}`);
          }
          return; // Don't record
        }

        // Capture observation (Durable Outbox)
        observationCount++
        outbox.push({
          session_id: currentSessionId,
          source: OPENCODE_SOURCE,
          project: projectName,
          cwd: directory,
          tool: input.tool,
          title: extracted.title,
          type: extracted.type,
          narrative: extracted.narrative,
          concepts: extracted.concepts,
          facts: extracted.facts,
          content: output.output || output.title || '',
          timestamp: new Date().toISOString(),
          oc_metadata: {
            execution_time_ms,
            success,
            error_message,
            started_at: timing?.started_at,
            ended_at,
          }
        });

        // Periodically run ingestor to keep per-project memory fresh.
        if (observationCount % INGESTOR_TRIGGER_EVERY_N_OBSERVATIONS === 0) {
          triggerIngestorOnce($, 'observation.checkpoint').catch((e) => logger.debug('plugin', 'Ingestor trigger failed', { error: String(e) }))
        }

      },


    /**
     * Session compacting hook - inject custom context
     */
    "experimental.session.compacting": async (input: any, output: any) => {
      if (!currentSessionId || !injectionEnabled) return
      
      try {
        // Fetch recent observations for compaction context
        const manifest = await buildInjectionBlock(projectName, '')
        if (manifest) {
          output.context.push(manifest)
        }
      } catch (e) {
        logger.debug('plugin', 'Compaction hook failed', { error: String(e) });
      }
    }
  }
}
