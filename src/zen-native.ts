import type { PluginInput } from "@opencode-ai/plugin";
import { ExtractedObservation, ExtractedObservationSchema } from './extractor.js';
import { logger } from './logger.js';
import * as v from 'valibot';

import { appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * ZEN-native LLM completion using a hidden background session.
 * 
 * ## Architecture
 * 1. Create a dedicated "memory-extraction" session on plugin init
 * 2. Use `session.prompt()` for completions
 * 3. Session is intended to be internal (naming convention used)
 * 
 * ## Trade-offs
 * - ✅ Uses host's ZEN authentication (no OPENCODE_API_KEY needed)
 * - ✅ Respects user's model preferences
 * - ⚠️ Creates a session (visible in session list)
 * - ⚠️ Slightly higher latency than direct API call
 */
export class ZenNativeExtractor {
  private client: PluginInput['client'];
  private extractionSessionId: string | null = null;
  private readonly MODEL = {
    providerID: 'opencode',
    // FIX: Updated to 'gemini-3-flash' to resolve 404 errors - ZEN API model identifier mismatch
    modelID: process.env.CLAUDE_MEM_ZEN_MODEL || 'gemini-3-flash'  // ZEN model ID
  };
  private readonly FALLBACK_MODEL = {
    providerID: 'opencode',
    modelID: 'gpt-5.1-codex-mini'  // Fallback model when primary is unavailable
  };
  private debugLogPath = join(homedir(), '.oc', 'zen-native-debug.log');
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private modelAvailabilityCache = new Map<string, { available: boolean; timestamp: number }>();
  private readonly MODEL_CACHE_TTL = 60000; // 1 minute cache for model availability

  constructor(client: PluginInput['client']) {
    this.client = client;
  }

  isReady(): boolean {
    return this.ready;
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
    try {
      appendFileSync(this.debugLogPath, logEntry);
    } catch (e) {}
    logger.debug('zen-native', message, data);
  }

  /**
   * Check model availability via lightweight health check against ZEN API.
   *
   * Makes a minimal test request to verify the model is accessible before
   * attempting extraction. Includes 5-second timeout to avoid blocking operations.
   *
   * Results are cached for 1 minute to reduce redundant API calls.
   *
   * @param modelID - The model identifier to check (e.g., 'gemini-3-flash')
   * @returns true if model responds with 200, false if 404/timeout/error
   */
  private async checkModelAvailability(modelID: string): Promise<boolean> {
    // Check cache first
    const cached = this.modelAvailabilityCache.get(modelID);
    if (cached && Date.now() - cached.timestamp < this.MODEL_CACHE_TTL) {
      this.log(`Model availability cached: ${modelID} = ${cached.available}`);
      return cached.available;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    try {
      // Make lightweight health check request to ZEN API
      // Using a minimal completion request to verify model accessibility
      const apiKey = process.env.OPENCODE_API_KEY;
      if (!apiKey) {
        this.log('Skipping model availability check: OPENCODE_API_KEY not set');
        // Assume available if no API key (will fall back to session later)
        this.modelAvailabilityCache.set(modelID, { available: true, timestamp: Date.now() });
        return true;
      }

      const zenApiUrl = process.env.OPENCODE_DISPATCHER_URL || 'https://opencode.ai/zen/v1/chat/completions';

      const response = await fetch(zenApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelID,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 10,
        }),
        signal: controller.signal
      });

      const available = response.status === 200;

      // Cache result
      this.modelAvailabilityCache.set(modelID, { available, timestamp: Date.now() });

      this.log(`Model availability check: ${modelID} = ${available} (HTTP ${response.status})`);

      if (!available && response.status === 404) {
        this.log(`Model ${modelID} returned 404 - model not found or deprecated`);
      }

      return available;
    } catch (error) {
      // Timeout or network error
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (errorMsg.includes('abort')) {
        this.log(`Model availability check timeout for ${modelID} (5s exceeded)`);
      } else {
        this.log(`Model availability check failed for ${modelID}`, { error: errorMsg });
      }

      // Cache failure
      this.modelAvailabilityCache.set(modelID, { available: false, timestamp: Date.now() });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Initialize the hidden extraction session.
   * Called once during plugin initialization.
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.log('Initializing extraction session...');
        
        // Create a session for memory extraction
        const result = await this.client.session.create({
          body: {
            title: '[claude-mem] Memory Extraction (internal)',
          }
        });
        
        if (result.data) {
          this.extractionSessionId = result.data.id;
          this.ready = true;
          this.log(`Extraction session created: ${this.extractionSessionId}`);
        } else {
          this.log('Failed to create extraction session (no data returned)', result);
        }
      } catch (error) {
        this.log('Failed to create extraction session', { error: String(error) });
      }
    })();

    return this.initPromise;
  }

  /**
   * Extract structured observation using ZEN via the host session.
   *
   * Implements a three-tier strategy with model availability checking:
   * 1. Model Health Check: Verify primary model is accessible (5s timeout)
   * 2. SDK Session: Uses `client.session.prompt` in a dedicated background session.
   *    - Falls back to FALLBACK_MODEL if primary model unavailable
   * 3. CLI Delegation: Uses `opencode run` for non-interactive completion.
   *
   * @param tool - The name of the tool that was executed
   * @param args - The arguments passed to the tool
   * @param output - The raw output from the tool execution
   * @param $ - The BunShell instance for CLI delegation
   * @returns A structured observation or null if extraction fails
   */
  async extract(
    tool: string,
    args: Record<string, unknown>,
    output: string,
    $: any
  ): Promise<ExtractedObservation | null> {
    // Ensure init is complete
    if (this.initPromise) await this.initPromise;

    const prompt = this.buildExtractionPrompt(tool, args, output);
    this.log(`Extracting for tool: ${tool}`);

    // Strategy 0: Check primary model availability before SDK session
    let modelToUse = this.MODEL;
    let primaryAvailable = false;

    try {
      primaryAvailable = await this.checkModelAvailability(this.MODEL.modelID);
      if (!primaryAvailable) {
        logger.warn('zen', `Model ${this.MODEL.modelID} unavailable, will retry`);
        this.log(`Primary model ${this.MODEL.modelID} unavailable, attempting fallback...`);

        // Check if fallback model is available
        const fallbackAvailable = await this.checkModelAvailability(this.FALLBACK_MODEL.modelID);
        if (fallbackAvailable) {
          modelToUse = this.FALLBACK_MODEL;
          this.log(`Fallback model ${this.FALLBACK_MODEL.modelID} available, using fallback`);
        } else {
          logger.warn('zen', `Fallback model ${this.FALLBACK_MODEL.modelID} also unavailable, attempting extraction anyway`);
          this.log(`Both primary and fallback models unavailable, will continue with SDK session`);
        }
      }
    } catch (error) {
      this.log('Model availability check encountered error', { error: String(error) });
      // Continue with SDK session regardless of health check failure
    }

    // Strategy 1: Try SDK session (Pattern A) - Preferred as it's faster
    if (this.extractionSessionId) {
      try {
        this.log(`Requesting extraction via session ${this.extractionSessionId} with model ${modelToUse.modelID}...`);

        const result = await this.client.session.prompt({
          path: { id: this.extractionSessionId },
          body: {
            model: modelToUse,
            parts: [{ type: 'text', text: prompt }],
          }
        });

        this.log('Received response from SDK session', { hasData: !!result.data });

        if (result.data?.parts) {
          const textPart = result.data.parts.find((p: any) => p.type === 'text');
          if (textPart && 'text' in textPart) {
            this.log('Successfully extracted via SDK session');
            return this.parseResponse(textPart.text);
          }
        }
        this.log('SDK session returned no text', result);
      } catch (error) {
        this.log('SDK session extraction failed', { error: String(error) });
      }
    }

    // Strategy 2: Try CLI delegation (Pattern B) - Fallback
    try {
      this.log('Attempting CLI extraction...');

      // Use opencode run to get completion (non-interactive)
      // We use --agent orchestrator to ensure we use a high-quality model
      // SEC-005: Use JSON.stringify to escape prompt for shell safety
      const result = await $`opencode run --agent orchestrator ${JSON.stringify(prompt)}`.text();

      if (result && result.trim()) {
        this.log('Successfully extracted via CLI');
        return this.parseResponse(result);
      }
      this.log('CLI returned empty result');
    } catch (error) {
      this.log('CLI extraction failed', { error: String(error) });
    }

    // Strategy 3: Fall through to extraction_failed gracefully
    this.log('All extraction strategies exhausted, returning null');
    return null;
  }

  /**
   * Cleanup: delete the extraction session when plugin unloads.
   * 
   * Ensures that internal sessions don't clutter the user's session list
   * after the OpenCode instance is disposed.
   */
  async cleanup(): Promise<void> {
    if (this.extractionSessionId) {
      try {
        this.log(`Cleaning up extraction session ${this.extractionSessionId}...`);
        
        // CR-006: Add retry logic for session deletion
        let success = false;
        for (let i = 0; i < 3; i++) {
          try {
            await this.client.session.delete({
              path: { id: this.extractionSessionId }
            });
            success = true;
            break;
          } catch (e) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (!success) {
          this.log('Failed to delete extraction session after 3 attempts');
        }
        
        this.extractionSessionId = null;
      } catch (error) {
        this.log('Failed to delete extraction session', { error: String(error) });
      }
    }
  }

  /**
   * Build the extraction prompt for the LLM.
   */
  private buildExtractionPrompt(tool: string, args: any, output: string): string {
    return `<task>Extract a structured observation from this tool execution.</task>
<context>
Tool: ${tool}
Arguments: ${JSON.stringify(args, null, 2)}
Output: ${output.slice(0, 4000)}
</context>
<output_format>
Respond with ONLY a JSON object:
{
  "title": "string (max 80 chars)",
  "type": "decision|bugfix|feature|refactor|discovery|change",
  "narrative": "string (2-4 sentences)",
  "concepts": ["string"],
  "facts": ["string"]
}
</output_format>`;
  }

  /**
   * Parse and validate the LLM response.
   * 
   * Handles potential markdown code fences and validates against the schema.
   */
  private parseResponse(text: string): ExtractedObservation {
    try {
      // CR-005: Use more specific pattern for log stripping to avoid removing valid JSON
      const cleanText = text.split('\n')
        .filter(line => !line.trim().match(/^\[\d{4}-\d{2}-\d{2}/))
        .join('\n');

      // CR-007: Use non-greedy matching for JSON to avoid capturing multiple objects
      const jsonMatch = cleanText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);
      return v.parse(ExtractedObservationSchema, parsed);
    } catch (e) {
      this.log('Failed to parse LLM response', { text, error: String(e) });
      throw e;
    }
  }
}
