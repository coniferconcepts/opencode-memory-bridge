/**
 * Tool Observation Hook Template
 * 
 * This template provides a complete implementation for capturing and processing
 * tool execution observations in the OpenCode system. It demonstrates best
 * practices for non-blocking observation capture, filtering, and persistence.
 * 
 * ## Usage
 * 
 * Copy this file to your project and customize the handlers:
 * ```bash
 * cp templates/hooks/tool-observation.ts my-project/hooks/tool-tracker.ts
 * ```
 * 
 * ## Features
 * 
 * - Tool execution monitoring
 * - Before/after interception
 * - Smart filtering
 * - Content summarization
 * - Non-blocking persistence
 * - Batch processing
 * - Performance tracking
 * 
 * @module hooks/tool-observation
 * @requires universal/hooks
 * @example
 * ```typescript
 * import { toolObservationHooks } from './hooks/tool-tracker'
 * import { hookRegistry } from '~/universal/hooks/registry'
 * 
 * // Register all tool observation hooks
 * toolObservationHooks.forEach(hook => hookRegistry.register(hook))
 * ```
 */

import type {
	OpenCodeHook,
	ToolHookInput,
	ToolHookOutput,
	ToolExecutionContext,
	ToolError,
	isToolHookInput,
} from '../../universal/hooks'

// =============================================================================
// Configuration
// =============================================================================

interface ToolObservationConfig {
	/** Tools to observe (empty = all tools) */
	observedTools: string[]

	/** Tools to skip entirely */
	skipTools: string[]

	/** Maximum content size to store (bytes) */
	maxContentSize: number

	/** Enable performance tracking */
	trackPerformance: boolean

	/** Batch size for persistence */
	batchSize: number

	/** Flush interval in milliseconds */
	flushIntervalMs: number

	/** Custom summarization function */
	summarizeFn?: (result: unknown) => string
}

const DEFAULT_CONFIG: ToolObservationConfig = {
	observedTools: [], // Empty = observe all
	skipTools: ['Read', 'List', 'Grep', 'Glob'], // Skip read-only tools
	maxContentSize: 50000, // 50KB max
	trackPerformance: true,
	batchSize: 10,
	flushIntervalMs: 5000,
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Pending observations queue for batch processing
 */
interface PendingObservation {
	id: string
	tool: string
	sessionId: string
	callId: string
	args: Record<string, unknown>
	result?: unknown
	error?: ToolError
	durationMs: number
	timestamp: Date
	callIndex: number
	outputSize?: number
}

const pendingObservations: PendingObservation[] = []

/**
 * Tool execution history per session
 */
const sessionToolHistory = new Map<string, ToolHookInput[]>()

/**
 * Performance metrics store
 */
const performanceMetrics = new Map<
	string,
	{ count: number; totalDuration: number; errors: number }
>()

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate unique ID for observations
 */
function generateObservationId(): string {
	return `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if tool should be observed
 */
function shouldObserveTool(tool: string): boolean {
	// Skip explicitly excluded tools
	if (DEFAULT_CONFIG.skipTools.includes(tool)) {
		return false
	}

	// If observedTools is empty, observe all (except skipped)
	if (DEFAULT_CONFIG.observedTools.length === 0) {
		return true
	}

	// Otherwise, only observe specified tools
	return DEFAULT_CONFIG.observedTools.includes(tool)
}

/**
 * Summarize tool output for storage
 */
function summarizeResult(result: unknown): string {
	// Use custom summarizer if provided
	if (DEFAULT_CONFIG.summarizeFn) {
		try {
			return DEFAULT_CONFIG.summarizeFn(result)
		} catch {
			// Fall through to default
		}
	}

	// Default summarization
	if (result === null || result === undefined) {
		return 'No output'
	}

	if (typeof result === 'string') {
		// Truncate long strings
		if (result.length > DEFAULT_CONFIG.maxContentSize) {
			return result.substring(0, DEFAULT_CONFIG.maxContentSize) + '... [truncated]'
		}
		return result
	}

	if (typeof result === 'object') {
		try {
			const json = JSON.stringify(result)
			if (json.length > DEFAULT_CONFIG.maxContentSize) {
				return json.substring(0, DEFAULT_CONFIG.maxContentSize) + '... [truncated]'
			}
			return json
		} catch {
			return '[Object serialization failed]'
		}
	}

	return String(result)
}

/**
 * Calculate output size in bytes
 */
function calculateOutputSize(result: unknown): number {
	if (typeof result === 'string') {
		return new Blob([result]).size
	}
	if (typeof result === 'object') {
		try {
			return new Blob([JSON.stringify(result)]).size
		} catch {
			return 0
		}
	}
	return 0
}

// =============================================================================
// Hook 1: Tool Execute Before
// =============================================================================

/**
 * Tool execute before hook - Intercept tool execution
 * 
 * Triggered before a tool is executed. Use this to:
 * - Validate tool arguments
 * - Log tool calls
 * - Modify arguments
 * - Check permissions
 * - Setup tracking
 * 
 * @priority 10 (Early execution)
 * @blocking Yes (Can prevent execution)
 * @timeout 1000ms
 */
export const toolExecuteBeforeHook: OpenCodeHook<ToolHookInput, ToolHookOutput> =
	{
		name: 'tool.execute.before',
		priority: 10,
		description: 'Intercept and track tool execution start',

		handler: async (input, output) => {
			// Validate input
			if (!isToolHookInput(input)) {
				console.error('[Tool] Invalid input format')
				return
			}

			// Check if we should observe this tool
			if (!shouldObserveTool(input.tool)) {
				return
			}

			try {
				console.log(
					`[Tool] Executing ${input.tool} (call ${input.callIndex})`,
				)

				// Track in session history
				const history = sessionToolHistory.get(input.sessionId) || []
				history.push(input)
				sessionToolHistory.set(input.sessionId, history)

				// Validate arguments (example)
				const validationResult = validateToolArguments(input.tool, input.args)
				if (!validationResult.valid) {
					console.warn(
						`[Tool] Validation warning for ${input.tool}:`,
						validationResult.error,
					)
				}

				// Log tool call (non-blocking)
				logToolCall(input).catch((err) => {
					console.warn(`[Tool] Failed to log call:`, err)
				})
			} catch (error) {
				console.error(`[Tool] Error in before hook:`, error)
				// Don't block execution on hook error
			}
		},
	}

/**
 * Validate tool arguments
 */
function validateToolArguments(
	tool: string,
	args: Record<string, unknown>,
): { valid: boolean; error?: string } {
	// Implement validation logic
	// Example:
	// if (tool === 'Write' && !args.filePath) {
	//   return { valid: false, error: 'filePath is required' }
	// }

	return { valid: true }
}

/**
 * Log tool call to external system
 */
async function logToolCall(input: ToolHookInput): Promise<void> {
	// Implement logging
	// Example:
	// await analytics.track({
	//   event: 'tool_called',
	//   properties: {
	//     tool: input.tool,
	//     sessionId: input.sessionId,
	//     timestamp: input.timestamp
	//   }
	// })
}

// =============================================================================
// Hook 2: Tool Execute After
// =============================================================================

/**
 * Tool execute after hook - Capture tool results
 * 
 * Triggered after a tool completes execution. Use this to:
 * - Capture tool output as observations
 * - Log results
 * - Transform output
 * - Track performance
 * - Update session state
 * 
 * @priority 50
 * @blocking No (Non-blocking)
 * @timeout 10000ms
 */
export const toolExecuteAfterHook: OpenCodeHook<ToolHookInput, ToolHookOutput> =
	{
		name: 'tool.execute.after',
		priority: 50,
		description: 'Capture and store tool execution results',

		handler: async (input, output) => {
			// Check if we should observe this tool
			if (!shouldObserveTool(input.tool)) {
				return
			}

			try {
				console.log(
					`[Tool] Completed ${input.tool} in ${output.durationMs}ms`,
				)

				// Track performance metrics
				if (DEFAULT_CONFIG.trackPerformance) {
					trackPerformance(input.tool, output.durationMs, !output.success)
				}

				// Create observation
				const observation: PendingObservation = {
					id: generateObservationId(),
					tool: input.tool,
					sessionId: input.sessionId,
					callId: input.callId,
					args: sanitizeArgs(input.args),
					result: output.success ? summarizeResult(output.result) : undefined,
					error: output.error,
					durationMs: output.durationMs,
					timestamp: input.timestamp,
					callIndex: input.callIndex,
					outputSize: output.outputSize || calculateOutputSize(output.result),
				}

				// Add to batch queue
				pendingObservations.push(observation)

				// Flush if batch is full
				if (pendingObservations.length >= DEFAULT_CONFIG.batchSize) {
					await flushObservations()
				}

				// Non-blocking: Create enriched observation
				createEnrichedObservation(input, output, observation).catch((err) => {
					console.warn(`[Tool] Failed to create enriched observation:`, err)
				})
			} catch (error) {
				console.error(`[Tool] Error in after hook:`, error)
				// Non-blocking - don't throw
			}
		},
	}

/**
 * Sanitize arguments for storage (remove sensitive data)
 */
function sanitizeArgs(
	args: Record<string, unknown>,
): Record<string, unknown> {
	const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth']
	const sanitized: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(args)) {
		// Check if key contains sensitive terms
		const isSensitive = sensitiveKeys.some((sensitive) =>
			key.toLowerCase().includes(sensitive),
		)

		if (isSensitive) {
			sanitized[key] = '[REDACTED]'
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

/**
 * Track performance metrics
 */
function trackPerformance(
	tool: string,
	durationMs: number,
	isError: boolean,
): void {
	const metrics = performanceMetrics.get(tool) || {
		count: 0,
		totalDuration: 0,
		errors: 0,
	}

	metrics.count++
	metrics.totalDuration += durationMs
	if (isError) {
		metrics.errors++
	}

	performanceMetrics.set(tool, metrics)

	// Log slow operations
	if (durationMs > 1000) {
		console.warn(`[Tool] Slow execution: ${tool} took ${durationMs}ms`)
	}
}

/**
 * Flush pending observations to storage
 */
async function flushObservations(): Promise<void> {
	if (pendingObservations.length === 0) {
		return
	}

	const batch = pendingObservations.splice(0, DEFAULT_CONFIG.batchSize)

	try {
		console.log(`[Tool] Flushing ${batch.length} observations`)

		// Implement batch persistence
		// Example:
		// await observationStore.saveBatch(batch)

		// Log success
		console.log(`[Tool] Successfully persisted ${batch.length} observations`)
	} catch (error) {
		console.error(`[Tool] Failed to flush observations:`, error)

		// Re-queue failed observations (with retry limit)
		batch.forEach((obs) => {
			// Add retry count
			;(obs as unknown as { retryCount: number }).retryCount =
				((obs as unknown as { retryCount?: number }).retryCount || 0) + 1

			if ((obs as unknown as { retryCount: number }).retryCount < 3) {
				pendingObservations.push(obs)
			}
		})
	}
}

/**
 * Create enriched observation with additional context
 */
async function createEnrichedObservation(
	input: ToolHookInput,
	output: ToolHookOutput,
	baseObservation: PendingObservation,
): Promise<void> {
	// Get session history for context
	const history = sessionToolHistory.get(input.sessionId) || []

	// Build execution context
	const context: ToolExecutionContext = {
		input,
		output,
		previousCalls: history.slice(0, -1), // Exclude current
		session: {
			id: input.sessionId,
			project: '', // Would be populated from session store
			directory: '',
			state: 'active',
			metadata: {},
		},
	}

	// Implement enrichment
	// Example:
	// const enriched = {
	//   ...baseObservation,
	//   context: {
	//     previousTool: history[history.length - 2]?.tool,
	//     sessionDuration: calculateSessionDuration(input.sessionId),
	//     toolSequence: history.map(h => h.tool)
	//   }
	// }
	// await observationStore.saveEnriched(enriched)

	console.log(`[Tool] Created enriched observation for ${input.tool}`)
}

// =============================================================================
// Batch Processing Setup
// =============================================================================

/**
 * Periodic flush interval
 * Ensures observations are persisted even if batch size isn't reached
 */
function startFlushInterval(): void {
	setInterval(async () => {
		if (pendingObservations.length > 0) {
			await flushObservations()
		}
	}, DEFAULT_CONFIG.flushIntervalMs)
}

// Start the flush interval when module loads
startFlushInterval()

// =============================================================================
// Performance Monitoring
// =============================================================================

/**
 * Get performance statistics for tools
 */
export function getToolPerformanceStats(): Record<
	string,
	{
		count: number
		avgDurationMs: number
		errorRate: number
	}
> {
	const stats: Record<
		string,
		{ count: number; avgDurationMs: number; errorRate: number }
	> = {}

	for (const [tool, metrics] of performanceMetrics.entries()) {
		stats[tool] = {
			count: metrics.count,
			avgDurationMs: metrics.totalDuration / metrics.count,
			errorRate: metrics.errors / metrics.count,
		}
	}

	return stats
}

/**
 * Log performance summary
 */
export function logPerformanceSummary(): void {
	const stats = getToolPerformanceStats()

	console.log('\n[Tool] Performance Summary:')
	console.log('─'.repeat(60))

	for (const [tool, metrics] of Object.entries(stats)) {
		console.log(
			`${tool.padEnd(20)} ` +
				`Calls: ${metrics.count.toString().padStart(4)} | ` +
				`Avg: ${metrics.avgDurationMs.toFixed(2).padStart(8)}ms | ` +
				`Errors: ${(metrics.errorRate * 100).toFixed(1)}%`,
		)
	}

	console.log('─'.repeat(60))
}

// =============================================================================
// Session Cleanup
// =============================================================================

/**
 * Cleanup session tool history
 * Call this from session.deleted hook
 */
export function cleanupSession(sessionId: string): void {
	sessionToolHistory.delete(sessionId)
	console.log(`[Tool] Cleaned up history for session ${sessionId}`)
}

// =============================================================================
// Export All Hooks
// =============================================================================

/**
 * Complete set of tool observation hooks
 * 
 * Register these hooks to capture tool execution data:
 * 
 * ```typescript
 * import { toolObservationHooks } from './hooks/tool-tracker'
 * import { hookRegistry } from '~/universal/hooks/registry'
 * 
 * toolObservationHooks.forEach(hook => {
 *   hookRegistry.register(hook)
 * })
 * ```
 */
export const toolObservationHooks = [
	toolExecuteBeforeHook,
	toolExecuteAfterHook,
]

/**
 * Individual hook exports for selective registration
 */
export { toolExecuteBeforeHook, toolExecuteAfterHook }

/**
 * Utility exports
 */
export {
	getToolPerformanceStats,
	logPerformanceSummary,
	cleanupSession,
	flushObservations,
	DEFAULT_CONFIG as toolObservationConfig,
}

// =============================================================================
// Default Export
// =============================================================================

export default toolObservationHooks
