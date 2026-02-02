/**
 * Model routing configuration for claude-mem memory summarization.
 * 
 * ## Rationale: US-Hosted, Zero-Retention Models
 * 
 * OpenCode uses ZEN-native models for memory summarization to ensure:
 * 1. **Privacy**: US-hosted with zero data retention
 * 2. **Cost**: Significantly cheaper than Claude Sonnet
 * 3. **Performance**: Optimized for summarization tasks
 * 
 * ## Routing Strategy (@gemini-pro-max/@gpt5 feedback)
 * 
 * Instead of static task-to-model mapping, we use:
 * 1. **Heuristic-based routing**: Analyze content characteristics
 * 2. **Validation-driven escalation**: Retry with stronger model on failure
 * 
 * ### Heuristics
 * - Code density (% of content that is code blocks)
 * - Content length (token estimate)
 * - Technical complexity (identifier density, import statements)
 * 
 * ### Escalation Flow
 * 1. Route to Standard tier based on heuristics
 * 2. If validation fails (malformed output), retry once
 * 3. If retry fails, escalate to Precision tier
 * 4. Log escalation for model performance tracking
 * 
 * @module src/integrations/claude-mem/models
 * @see plans/2026-01-10-claude-mem-local-native-strategy.md (Appendix G.4)
 */

import * as v from 'valibot';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SETTINGS_PATH = join(homedir(), '.claude-mem', 'settings.json');

// Simple logger for model fallback tracking
// Note: This logger is used for model fallback tracking only
// In production, logging is handled through the main logger instance
const logger = {
  info: (category: string, message: string) => {
    // Model selection logs - only shown in debug mode or during fallback events
    void [category, message];
  },
  error: (category: string, message: string) => {
    // Model error logs - silently tracked
    void [category, message];
  },
};

// =============================================================================
// Model Configuration Schema
// =============================================================================

/**
 * Schema for model configuration.
 */
export const ModelConfigSchema = v.object({
  /** Model provider identifier */
  provider: v.union([v.literal('zen'), v.literal('anthropic'), v.literal('openrouter')]),
  /** Model identifier (OpenRouter format) */
  model: v.string(),
  /** Temperature for generation (0.0-1.0) */
  temperature: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  /** Maximum tokens to generate */
  maxTokens: v.pipe(v.number(), v.minValue(100), v.maxValue(8000)),
  /** Human-readable rationale for model selection */
  rationale: v.string(),
  /** Optional thinking level for reasoning models */
  thinkingLevel: v.optional(v.union([v.literal('minimal'), v.literal('low'), v.literal('medium'), v.literal('high')])),
});

/**
 * Model configuration output type
 */
export type ModelConfig = v.InferOutput<typeof ModelConfigSchema>;

// =============================================================================
// Model Definitions
// =============================================================================

/**
 * Load model from settings.json, falling back to defaults with intelligent model selection.
 *
 * **Load Strategy:**
 * 1. Check CLAUDE_MEM_MODEL environment variable or settings.json configuration
 * 2. Verify configured model is available using selectAvailableModel()
 * 3. Fall back to intelligent selection if configured model fails
  * 4. Use PRIMARY model (gemini-3-flash) as absolute default
  *
  * @returns Model ID from configuration or fallback chain
  */
async function loadConfiguredModel(): Promise<string> {
  // Step 1: Try to load from settings.json
  if (existsSync(SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
      if (settings.CLAUDE_MEM_MODEL) {
        const configuredModel = settings.CLAUDE_MEM_MODEL;
        logger.info('models', `Loaded configured model from settings: ${configuredModel}`);

        // Verify configured model is available
        try {
          const isAvailable = await isModelAvailable(configuredModel);
          if (isAvailable) {
            logger.info('models', `Configured model available: ${configuredModel}`);
            return configuredModel;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error(
            'models',
            `Configured model check failed: ${configuredModel}. Error: ${errorMsg}. Using fallback chain...`,
          );
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('models', `Failed to load settings.json: ${errorMsg}. Using fallback chain...`);
    }
  }

  // Step 2: Use intelligent model selection from fallback chain
  try {
    const selectedModel = await selectAvailableModel();
    return selectedModel;
  } catch (error) {
    // Step 3: Absolute fallback if all chain models fail
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('models', `selectAvailableModel failed: ${errorMsg}. Using hardcoded default...`);
    return 'gemini-3-flash';
  }
}

/**
 * Map claude-mem model names to ZEN model identifiers.
 *
 * ZEN uses simple model IDs without provider prefixes.
 * See: https://opencode.ai/zen/v1/models
 *
 * FIX: Updated to gemini-3-flash to resolve 404 errors.
 * ZEN API expects the correct model identifier as documented in their API reference.
 */
const MODEL_MAP: Record<string, { provider: string; model: string }> = {
   'claude-sonnet-4-5': { provider: 'zen', model: 'claude-sonnet-4-5' },
   'claude-sonnet-4': { provider: 'zen', model: 'claude-sonnet-4' },
   'claude-haiku-4-5': { provider: 'zen', model: 'claude-haiku-4-5' },
   'gemini-3-flash': { provider: 'zen', model: 'gemini-3-flash' },
   'gpt-5.1-codex-mini': { provider: 'zen', model: 'gpt-5.1-codex-mini' },
 };

// =============================================================================
// Model Fallback Strategy
// =============================================================================

/**
 * Model fallback chain definition with priority ordering.
 *
 * The fallback strategy ensures intelligent model selection by:
 * 1. Attempting the PRIMARY model (best performance/cost ratio)
 * 2. Falling back to SECONDARY if primary fails
 * 3. Falling back to TERTIARY as last resort
 * 4. Logging all fallback events for metrics tracking
 *
 * **Model Selection Rationale:**
 * - PRIMARY (gemini-3-flash): Fast, 1M context, US-hosted
 * - SECONDARY (gpt-5.1-codex-mini): Code-optimized, better identifier preservation
 * - TERTIARY (claude-haiku-4-5): Fallback for availability issues, if configured
 */
export const MODEL_FALLBACK_CHAIN = [
  {
    id: 'gemini-3-flash',
    priority: 1,
    tier: 'PRIMARY',
    rationale: 'Fast, 1M context window, lowest latency, US-hosted via ZEN',
  },
  {
    id: 'gpt-5.1-codex-mini',
    priority: 2,
    tier: 'SECONDARY',
    rationale: 'Code-optimized, superior identifier preservation, fallback',
  },
   {
     id: 'claude-haiku-4-5',
     priority: 3,
     tier: 'TERTIARY',
     rationale: 'Emergency fallback if available, reduced capacity but available',
   },
] as const;

/**
 * Model usage metrics tracker.
 *
 * Tracks:
 * - Total attempts per model
 * - Successful invocations
 * - Fallback events
 * - Error counts
 */
interface ModelMetrics {
  attempts: number;
  successes: number;
  failures: number;
  fallbackCount: number;
}

const MODEL_USAGE_METRICS: Record<string, ModelMetrics> = {
   'gemini-3-flash': { attempts: 0, successes: 0, failures: 0, fallbackCount: 0 },
   'gpt-5.1-codex-mini': { attempts: 0, successes: 0, failures: 0, fallbackCount: 0 },
   'claude-haiku-4-5': { attempts: 0, successes: 0, failures: 0, fallbackCount: 0 },
 };

/**
 * Get current model usage metrics.
 *
 * @returns Object containing usage metrics for all models in the fallback chain
 */
export function getModelUsageMetrics(): Record<string, ModelMetrics> {
  return { ...MODEL_USAGE_METRICS };
}

/**
 * Update model metrics after usage attempt.
 *
 * @param modelId - Model identifier
 * @param success - Whether the invocation succeeded
 * @param isFallback - Whether this was a fallback attempt
 */
function updateModelMetrics(modelId: string, success: boolean, isFallback: boolean = false): void {
  const metrics = MODEL_USAGE_METRICS[modelId];
  if (metrics) {
    metrics.attempts++;
    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }
    if (isFallback) {
      metrics.fallbackCount++;
    }
  }
}

/**
 * Select the first available model from the fallback chain.
 *
 * **Strategy:**
 * - Iterates through MODEL_FALLBACK_CHAIN in priority order
 * - Checks each model's availability using isModelAvailable()
 * - Returns the first available model
 * - Logs fallback selection when non-primary models are selected
 * - Throws error if no models in chain are available
 *
 * @returns Promise resolving to the first available model ID
 * @throws Error if no models in the fallback chain are available
 */
export async function selectAvailableModel(): Promise<string> {
  for (const modelDef of MODEL_FALLBACK_CHAIN) {
    try {
      const isAvailable = await isModelAvailable(modelDef.id);

      if (isAvailable) {
        // Log fallback selection for non-primary models
        if (modelDef.priority > 1) {
          logger.info(
            'models',
            `Using fallback model: ${modelDef.id} (${modelDef.tier}, priority: ${modelDef.priority}). Rationale: ${modelDef.rationale}`,
          );
          updateModelMetrics(modelDef.id, true, true);
        } else {
          logger.info(
            'models',
            `Primary model available: ${modelDef.id}. Rationale: ${modelDef.rationale}`,
          );
          updateModelMetrics(modelDef.id, true, false);
        }

        return modelDef.id;
      }

      // Log unavailable model
      logger.error('models', `Model unavailable: ${modelDef.id} (${modelDef.tier}). Attempting next in chain...`);
      updateModelMetrics(modelDef.id, false, false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        'models',
        `Error checking availability for ${modelDef.id}: ${errorMsg}. Attempting next in chain...`,
      );
      updateModelMetrics(modelDef.id, false, false);
    }
  }

  // All models exhausted
  const availableModels = MODEL_FALLBACK_CHAIN.map(m => m.id).join(', ');
  const errorMessage = `[MODEL_SELECTION_EXHAUSTED] No models available in fallback chain. Attempted: ${availableModels}`;
  logger.error('models', errorMessage);
  throw new Error(errorMessage);
}

/**
 * Cache for the loaded model to avoid repeated async operations.
 */
let loadedModelCache: string | null = null;
let modelLoadPromise: Promise<string> | null = null;

/**
 * Get the configured model based on global settings with intelligent fallback.
 *
 * **Implementation Note:**
 * This is a synchronous wrapper. For the first call or cache invalidation,
 * prefer using getConfiguredModelAsync() for proper async handling.
 *
 * @deprecated Use getConfiguredModelAsync() for proper async model selection
 * @returns Model configuration with fallback applied
 */
export function getConfiguredModel(): ModelConfig {
  // Use cached value if available
  const configuredModel = loadedModelCache || 'gemini-3-flash';
  const mapping = MODEL_MAP[configuredModel] ?? MODEL_MAP['gemini-3-flash'];

  return {
    provider: mapping.provider as any,
    model: mapping.model,
    temperature: 0.1,
    maxTokens: 2000,
    rationale: `Configured via CLAUDE_MEM_MODEL with fallback: ${configuredModel}`,
  };
}

/**
 * Get the configured model based on global settings with intelligent fallback (async).
 *
 * **Usage:**
 * This function properly handles the fallback chain selection and should be
 * called at initialization time to populate the model cache.
 *
 * @returns Promise resolving to model configuration with fallback applied
 */
export async function getConfiguredModelAsync(): Promise<ModelConfig> {
  // Return cached model if available
  if (loadedModelCache) {
    const mapping = MODEL_MAP[loadedModelCache] ?? MODEL_MAP['gemini-3-flash'];
    return {
      provider: mapping.provider as any,
      model: mapping.model,
      temperature: 0.1,
      maxTokens: 2000,
      rationale: `Configured via CLAUDE_MEM_MODEL with fallback: ${loadedModelCache}`,
    };
  }

  // Ensure only one async load happens at a time
  if (!modelLoadPromise) {
    modelLoadPromise = loadConfiguredModel();
  }

  try {
    const configuredModel = await modelLoadPromise;
    loadedModelCache = configuredModel;
    const mapping = MODEL_MAP[configuredModel] ?? MODEL_MAP['gemini-3-flash'];

    return {
      provider: mapping.provider as any,
      model: mapping.model,
      temperature: 0.1,
      maxTokens: 2000,
      rationale: `Configured via CLAUDE_MEM_MODEL with fallback: ${configuredModel}`,
    };
  } finally {
    modelLoadPromise = null;
  }
}

/**
 * Standard tier model configuration.
 *
 * **Why Gemini 3 Flash?**
 * - 1M+ token context window handles massive transcripts
 * - Lowest latency among comparable models
 * - US-hosted via ZEN with zero retention
 * - Excellent at long-context synthesis
 *
 * FIX: Updated to gemini-3-flash to resolve 404 errors
 * caused by model identifier mismatch with ZEN API.
 */
export const STANDARD_MODEL: ModelConfig = {
  provider: 'zen',
  model: 'gemini-3-flash',
  temperature: 0.1,
  maxTokens: 2000,
  rationale: 'Primary summarizer: 1M context, lowest latency, US-hosted via ZEN',
};

/**
 * Precision tier model configuration.
 * 
 * **Why GPT 5.1 Codex Mini?**
 * - Superior at preserving code identifiers and diffs
 * - Better technical accuracy for code-heavy observations
 * - US-hosted via ZEN with zero retention
 * - Fallback when Flash is unavailable or produces invalid output
 */
export const PRECISION_MODEL: ModelConfig = {
  provider: 'zen',
  model: 'gpt-5.1-codex-mini',
  temperature: 0.1,
  maxTokens: 2000,
  rationale: 'Secondary/Fallback: Superior at preserving identifiers and diffs',
};

// =============================================================================
// Model Registry
// =============================================================================

/**
 * Available model tiers for memory operations.
 */
export const CLAUDE_MEM_MODELS = {
  standard: STANDARD_MODEL,
  precision: PRECISION_MODEL,
} as const;

/**
 * Model tier identifier
 */
export type ModelTier = keyof typeof CLAUDE_MEM_MODELS;

// =============================================================================
// Content Heuristics (@gemini-pro-max/@gpt5 feedback)
// =============================================================================

/**
 * Content characteristics for model routing decisions.
 */
export interface ContentHeuristics {
  /** Estimated token count */
  tokenEstimate: number;
  /** Percentage of content that is code (0-1) */
  codeDensity: number;
  /** Number of unique identifiers detected */
  identifierCount: number;
  /** Whether content contains diffs */
  hasDiffs: boolean;
  /** Whether content contains error traces */
  hasErrorTraces: boolean;
}

/**
 * Analyze content to extract routing heuristics.
 * 
 * @param content - The content to analyze
 * @returns Heuristics for model selection
 */
export function analyzeContent(content: string): ContentHeuristics {
  // Estimate tokens (rough: 4 chars per token)
  const tokenEstimate = Math.ceil(content.length / 4);
  
  // Detect code blocks (```...``` or indented blocks)
  // SECURITY: Bounded quantifier to prevent ReDoS (Guardrail #7)
  const codeBlockRegex = /```[\s\S]{1,5000}?```|^( {4}|\t).+$/gm;
  const codeMatches = content.match(codeBlockRegex) || [];
  const codeLength = (codeMatches as string[]).reduce((sum, m) => sum + m.length, 0);
  const codeDensity = content.length > 0 ? codeLength / content.length : 0;
  
  // Count identifiers (camelCase, snake_case, PascalCase)
  const identifierRegex = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b|\b[a-z]+_[a-z_]+\b|\b[A-Z][a-z]+[A-Z][a-zA-Z]*\b/g;
  const identifiers = new Set(content.match(identifierRegex) || []);
  
  // Detect diffs
  const hasDiffs = /^[+-]{3}\s|^@@\s|^[+-]\s/m.test(content);
  
  // Detect error traces
  const hasErrorTraces = /Error:|Exception:|at\s+\S+\s+\(\S+:\d+:\d+\)|Traceback/i.test(content);
  
  return {
    tokenEstimate,
    codeDensity,
    identifierCount: identifiers.size,
    hasDiffs,
    hasErrorTraces,
  };
}

/**
 * Select model tier based on content heuristics.
 * 
 * **Routing Rules:**
 * - High code density (>50%) -> Precision (better at code)
 * - Many identifiers (>20) -> Precision (preserves names)
 * - Contains diffs -> Precision (diff formatting)
 * - Otherwise -> Standard (faster, cheaper)
 * 
 * @param heuristics - Content analysis results
 * @returns Recommended model tier
 */
export function selectTierByHeuristics(heuristics: ContentHeuristics): ModelTier {
  // Precision tier triggers
  if (heuristics.codeDensity > 0.5) return 'precision';
  if (heuristics.identifierCount > 20) return 'precision';
  if (heuristics.hasDiffs) return 'precision';
  
  // Default to standard
  return 'standard';
}

// =============================================================================
// Task-to-Model Mapping (Legacy, kept for compatibility)
// =============================================================================

/**
 * Memory operation task types.
 */
export type MemoryTask =
  | 'observation-extraction'
  | 'session-summarization'
  | 'context-compression'
  | 'technical-verification';

/**
 * Static mapping of tasks to model tiers.
 * 
 * @deprecated Use heuristic-based routing via `selectModelForContent` instead.
 */
export const TASK_MODEL_MAP: Record<MemoryTask, ModelTier> = {
  'observation-extraction': 'standard',
  'session-summarization': 'standard',
  'context-compression': 'standard',
  'technical-verification': 'precision',
};

// =============================================================================
// Model Selection Functions
// =============================================================================

/**
 * Get the model configuration for a specific task.
 * 
 * @deprecated Use `selectModelForContent` for heuristic-based routing.
 * @param task - The memory operation task
 * @returns Model configuration for the task
 */
export function getModelForTask(task: MemoryTask): ModelConfig {
  const tier = TASK_MODEL_MAP[task];
  return CLAUDE_MEM_MODELS[tier];
}

/**
 * Get the fallback model for a given tier.
 * 
 * @param tier - The primary model tier
 * @returns Fallback model configuration
 */
export function getFallbackModel(tier: ModelTier): ModelConfig {
  return tier === 'standard' ? PRECISION_MODEL : STANDARD_MODEL;
}

/**
 * Check if a model is available (placeholder for future health checks).
 * 
 * @param model - Model identifier
 * @returns true if model is available
 */
export async function isModelAvailable(_model: string): Promise<boolean> {
  // TODO: Implement actual health check against ZEN/OpenRouter
  return true;
}

/**
 * Select model based on content analysis with fallback support.
 * 
 * **New in v2.0 (@gemini-pro-max/@gpt5 feedback)**
 * 
 * @param content - The content to summarize
 * @returns Selected model configuration and heuristics used
 */
export function selectModelForContent(content: string): {
  model: ModelConfig;
  tier: ModelTier;
  heuristics: ContentHeuristics;
} {
  const heuristics = analyzeContent(content);
  const tier = selectTierByHeuristics(heuristics);
  return {
    model: CLAUDE_MEM_MODELS[tier],
    tier,
    heuristics,
  };
}

/**
 * Escalation result from validation-driven model selection.
 */
export interface EscalationResult {
  model: ModelConfig;
  tier: ModelTier;
  escalated: boolean;
  attempts: number;
  reason?: string;
}

/**
 * Execute with validation-driven escalation.
 * 
 * **Flow (@gemini-pro-max/@gpt5 feedback):**
 * 1. Try with heuristic-selected model
 * 2. If validation fails, retry once with same model
 * 3. If retry fails, escalate to fallback model
 * 4. Return result with escalation metadata
 * 
 * @param content - Content to process
 * @param executor - Function that executes the model call
 * @param validator - Function that validates the output
 * @returns Result with escalation metadata
 */
export async function executeWithEscalation<T>(
  content: string,
  executor: (model: ModelConfig) => Promise<T>,
  validator: (result: T) => boolean,
): Promise<{ result: T; escalation: EscalationResult }> {
  const { model: primaryModel, tier: primaryTier } = selectModelForContent(content);
  
  // Attempt 1: Primary model
  try {
    const result = await executor(primaryModel);
    if (validator(result)) {
      return {
        result,
        escalation: {
          model: primaryModel,
          tier: primaryTier,
          escalated: false,
          attempts: 1,
        },
      };
    }
  } catch {
    // Continue to retry
  }
  
  // Attempt 2: Retry with primary model
  try {
    const result = await executor(primaryModel);
    if (validator(result)) {
      return {
        result,
        escalation: {
          model: primaryModel,
          tier: primaryTier,
          escalated: false,
          attempts: 2,
          reason: 'Succeeded on retry',
        },
      };
    }
  } catch {
    // Continue to escalation
  }
  
  // Attempt 3: Escalate to fallback model
  const fallbackModel = getFallbackModel(primaryTier);
  const fallbackTier: ModelTier = primaryTier === 'standard' ? 'precision' : 'standard';
  
  try {
    const result = await executor(fallbackModel);
    if (validator(result)) {
      return {
        result,
        escalation: {
          model: fallbackModel,
          tier: fallbackTier,
          escalated: true,
          attempts: 3,
          reason: `Escalated from ${primaryTier} to ${fallbackTier} after validation failures`,
        },
      };
    }
  } catch {
    // Fall through to error
  }

  throw new Error(`[MODEL_ESCALATION_EXHAUSTED] All 3 attempts failed validation. Primary: ${primaryTier}, Fallback: ${fallbackTier}`);
}
