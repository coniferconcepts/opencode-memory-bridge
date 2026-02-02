/**
 * OpenCode Hook Interface Definitions
 * 
 * This module defines the standard TypeScript interfaces for all OpenCode hooks,
 * providing type safety and consistency across the hook system.
 * 
 * Based on Claude Mem architecture, adapted for OpenCode's enhanced granularity.
 * 
 * @module universal/hooks/interface
 */

// =============================================================================
// Core Hook Types
// =============================================================================

/**
 * Generic interface for all OpenCode hooks
 * 
 * @template TInput - The type of data passed to the hook handler
 * @template TOutput - The type of data returned from the operation
 */
export interface OpenCodeHook<TInput, TOutput> {
	/** Unique identifier for the hook */
	name: string

	/** Handler function executed when the hook is triggered */
	handler: (input: TInput, output: TOutput) => Promise<void>

	/** Optional priority (lower = earlier execution, default: 100) */
	priority?: number

	/** Optional description of what this hook does */
	description?: string
}

/**
 * Hook registration entry used by the hook registry
 */
export interface HookRegistration<TInput = unknown, TOutput = unknown> {
	/** Hook name matching the event type */
	name: string

	/** The hook implementation */
	hook: OpenCodeHook<TInput, TOutput>

	/** Whether this hook is enabled */
	enabled: boolean

	/** When this hook was registered */
	registeredAt: Date

	/** Source of the hook (plugin name or 'user') */
	source: string
}

/**
 * Result of hook execution
 */
export interface HookExecutionResult {
	/** Whether the hook executed successfully */
	success: boolean

	/** Execution duration in milliseconds */
	durationMs: number

	/** Error if hook failed (doesn't block other hooks) */
	error?: Error

	/** Hook name that was executed */
	hookName: string
}

// =============================================================================
// Session Lifecycle Hooks
// =============================================================================

/**
 * Input data for session-related hooks
 */
export interface SessionHookInput {
	/** Unique session identifier */
	sessionId: string

	/** Project name or identifier */
	project: string

	/** Working directory for the session */
	directory: string

	/** When the session event occurred */
	timestamp: Date

	/** Additional session metadata */
	metadata?: SessionMetadata
}

/**
 * Session metadata containing context information
 */
export interface SessionMetadata {
	/** Session start time */
	startedAt?: Date

	/** Last activity timestamp */
	lastActivityAt?: Date

	/** Total number of tool calls in session */
	toolCallCount?: number

	/** Number of messages exchanged */
	messageCount?: number

	/** Session duration in milliseconds (if ended) */
	durationMs?: number

	/** Whether session was explicitly stopped vs timed out */
	explicitlyStopped?: boolean

	/** User who initiated the session (if available) */
	userId?: string

	/** Custom properties for extensibility */
	[key: string]: unknown
}

/**
 * Output data from session operations
 */
export interface SessionHookOutput {
	/** The session object (if created/updated) */
	session?: SessionContext

	/** Whether the operation was successful */
	success: boolean

	/** Error message if operation failed */
	error?: string
}

/**
 * Full session context object
 */
export interface SessionContext {
	/** Session ID */
	id: string

	/** Project name */
	project: string

	/** Working directory */
	directory: string

	/** Session state */
	state: 'active' | 'idle' | 'stopped' | 'ended'

	/** Session metadata */
	metadata: SessionMetadata

	/** Context observations injected at session start */
	contextObservations?: ContextObservation[]
}

/**
 * Context observation for injection into sessions
 */
export interface ContextObservation {
	/** Observation ID */
	id: string

	/** Type of observation */
	type: 'file' | 'tool' | 'summary' | 'custom'

	/** Observation content */
	content: string

	/** Relevance score (0-1) */
	relevance: number

	/** When this observation was created */
	createdAt: Date

	/** Source of the observation */
	source: string
}

// =============================================================================
// Tool Execution Hooks
// =============================================================================

/**
 * Input data for tool-related hooks
 */
export interface ToolHookInput {
	/** Tool name being executed */
	tool: string

	/** Unique call identifier */
	callId: string

	/** Tool arguments */
	args: Record<string, unknown>

	/** Session ID this tool call belongs to */
	sessionId: string

	/** When the tool was called */
	timestamp: Date

	/** Index of this tool call in the session (0-based) */
	callIndex: number
}

/**
 * Output data from tool execution
 */
export interface ToolHookOutput {
	/** Tool execution result */
	result: unknown

	/** Execution duration in milliseconds */
	durationMs: number

	/** Whether execution was successful */
	success: boolean

	/** Error information if failed */
	error?: ToolError

	/** Size of output in bytes */
	outputSize?: number
}

/**
 * Tool execution error details
 */
export interface ToolError {
	/** Error code */
	code: string

	/** Error message */
	message: string

	/** Stack trace (if available) */
	stack?: string

	/** Whether error is recoverable */
	recoverable: boolean
}

/**
 * Tool execution context for hook handlers
 */
export interface ToolExecutionContext {
	/** The tool input */
	input: ToolHookInput

	/** The tool output (available in 'after' hooks) */
	output?: ToolHookOutput

	/** Previous tool calls in this session */
	previousCalls: ToolHookInput[]

	/** Session context */
	session: SessionContext
}

// =============================================================================
// Message Hooks
// =============================================================================

/**
 * Input data for message-related hooks
 */
export interface MessageHookInput {
	/** Message content */
	content: string

	/** Message role (user, assistant, system) */
	role: 'user' | 'assistant' | 'system'

	/** When the message was created */
	timestamp: Date

	/** Session ID */
	sessionId: string

	/** Message ID */
	messageId: string

	/** Index in the conversation */
	index: number

	/** Token count (if available) */
	tokenCount?: number
}

/**
 * Output data from message processing
 */
export interface MessageHookOutput {
	/** Processed content (may be modified by hooks) */
	content: string

	/** Whether message was processed successfully */
	success: boolean

	/** Processing metadata */
	metadata?: MessageMetadata
}

/**
 * Message processing metadata
 */
export interface MessageMetadata {
	/** Whether context was injected */
	contextInjected?: boolean

	/** Number of context observations added */
	observationCount?: number

	/** Processing duration in milliseconds */
	processingMs?: number

	/** Whether message triggered any tools */
	triggersTools?: boolean
}

// =============================================================================
// Context Injection Hooks
// =============================================================================

/**
 * Input for context injection hooks
 */
export interface ContextInjectionInput {
	/** Session being started */
	session: SessionHookInput

	/** Current conversation context (if any) */
	conversationHistory?: MessageHookInput[]

	/** Available context sources */
	availableSources: ContextSource[]

	/** Maximum context length allowed */
	maxContextLength: number
}

/**
 * Context source definition
 */
export interface ContextSource {
	/** Source identifier */
	id: string

	/** Source name */
	name: string

	/** Source type */
	type: 'memory' | 'file' | 'database' | 'external'

	/** Whether this source is available */
	available: boolean

	/** Priority (lower = higher priority) */
	priority: number
}

/**
 * Output from context injection
 */
export interface ContextInjectionOutput {
	/** Context to inject into the session */
	contextToInject: string

	/** Observations included in the context */
	observations: ContextObservation[]

	/** Total context size in characters */
	totalSize: number

	/** Sources that contributed context */
	sourcesUsed: string[]

	/** Whether injection was successful */
	success: boolean
}

// =============================================================================
// File System Hooks
// =============================================================================

/**
 * Input for file system watcher hooks
 */
export interface FileWatcherInput {
	/** File path that changed */
	path: string

	/** Type of change */
	event: 'created' | 'updated' | 'deleted' | 'renamed'

	/** When the change occurred */
	timestamp: Date

	/** File content hash (if available) */
	contentHash?: string

	/** Session ID */
	sessionId: string
}

/**
 * Output from file watcher hook
 */
export interface FileWatcherOutput {
	/** Whether to process this file change */
	shouldProcess: boolean

	/** Any extracted observations from the file */
	observations?: FileObservation[]

	/** Processing metadata */
	metadata?: FileWatcherMetadata
}

/**
 * File observation extracted from file changes
 */
export interface FileObservation {
	/** File path */
	path: string

	/** Type of observation */
	type: 'change' | 'dependency' | 'pattern'

	/** Description of the observation */
	description: string

	/** When observed */
	observedAt: Date
}

/**
 * File watcher metadata
 */
export interface FileWatcherMetadata {
	/** Whether file matched ignore patterns */
	ignored: boolean

	/** File size in bytes */
	fileSize?: number

	/** Processing duration in milliseconds */
	processingMs: number
}

// =============================================================================
// Hook Configuration
// =============================================================================

/**
 * Configuration for individual hooks
 */
export interface HookConfig {
	/** Whether this hook is enabled */
	enabled: boolean

	/** Hook-specific options */
	options?: Record<string, unknown>

	/** Hooks that should run before this one */
	dependsOn?: string[]

	/** Maximum execution time in milliseconds */
	timeoutMs?: number

	/** Whether hook errors should be logged */
	logErrors: boolean
}

/**
 * Global hook system configuration
 */
export interface HookSystemConfig {
	/** Default timeout for all hooks */
	defaultTimeoutMs: number

	/** Whether to enable performance monitoring */
	performanceMonitoring: boolean

	/** Whether to log all hook executions */
	debugLogging: boolean

	/** Hook-specific configurations by name */
	hooks: Record<string, HookConfig>
}

/**
 * Default hook configuration
 */
export const DEFAULT_HOOK_CONFIG: HookSystemConfig = {
	defaultTimeoutMs: 5000,
	performanceMonitoring: true,
	debugLogging: false,
	hooks: {},
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for SessionHookInput
 */
export function isSessionHookInput(value: unknown): value is SessionHookInput {
	return (
		typeof value === 'object' &&
		value !== null &&
		'sessionId' in value &&
		typeof (value as SessionHookInput).sessionId === 'string' &&
		'project' in value &&
		typeof (value as SessionHookInput).project === 'string' &&
		'directory' in value &&
		typeof (value as SessionHookInput).directory === 'string' &&
		'timestamp' in value &&
		(value as SessionHookInput).timestamp instanceof Date
	)
}

/**
 * Type guard for ToolHookInput
 */
export function isToolHookInput(value: unknown): value is ToolHookInput {
	return (
		typeof value === 'object' &&
		value !== null &&
		'tool' in value &&
		typeof (value as ToolHookInput).tool === 'string' &&
		'callId' in value &&
		typeof (value as ToolHookInput).callId === 'string' &&
		'args' in value &&
		typeof (value as ToolHookInput).args === 'object'
	)
}

/**
 * Type guard for MessageHookInput
 */
export function isMessageHookInput(value: unknown): value is MessageHookInput {
	return (
		typeof value === 'object' &&
		value !== null &&
		'content' in value &&
		typeof (value as MessageHookInput).content === 'string' &&
		'role' in value &&
		['user', 'assistant', 'system'].includes(
			(value as MessageHookInput).role,
		) &&
		'timestamp' in value &&
		(value as MessageHookInput).timestamp instanceof Date
	)
}

/**
 * Type guard for ContextObservation
 */
export function isContextObservation(
	value: unknown,
): value is ContextObservation {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof (value as ContextObservation).id === 'string' &&
		'type' in value &&
		['file', 'tool', 'summary', 'custom'].includes(
			(value as ContextObservation).type,
		) &&
		'content' in value &&
		typeof (value as ContextObservation).content === 'string'
	)
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * All available hook names in the OpenCode system
 */
export type HookName =
	| 'session.created'
	| 'session.start'
	| 'session.idle'
	| 'session.stop'
	| 'session.deleted'
	| 'tool.execute.before'
	| 'tool.execute.after'
	| 'message.created'
	| 'message.processed'
	| 'chat.message'
	| 'context.inject'
	| 'file.watcher.updated'
	| 'file.watcher.created'
	| 'file.watcher.deleted'

/**
 * Hook type mapping for getting correct input/output types
 */
export interface HookTypeMap {
	'session.created': { input: SessionHookInput; output: SessionHookOutput }
	'session.start': { input: SessionHookInput; output: SessionHookOutput }
	'session.idle': { input: SessionHookInput; output: SessionHookOutput }
	'session.stop': { input: SessionHookInput; output: SessionHookOutput }
	'session.deleted': { input: SessionHookInput; output: SessionHookOutput }
	'tool.execute.before': { input: ToolHookInput; output: ToolHookOutput }
	'tool.execute.after': { input: ToolHookInput; output: ToolHookOutput }
	'message.created': { input: MessageHookInput; output: MessageHookOutput }
	'message.processed': { input: MessageHookInput; output: MessageHookOutput }
	'chat.message': { input: MessageHookInput; output: MessageHookOutput }
	'context.inject': {
		input: ContextInjectionInput
		output: ContextInjectionOutput
	}
	'file.watcher.updated': {
		input: FileWatcherInput
		output: FileWatcherOutput
	}
	'file.watcher.created': {
		input: FileWatcherInput
		output: FileWatcherOutput
	}
	'file.watcher.deleted': {
		input: FileWatcherInput
		output: FileWatcherOutput
	}
}

/**
 * Get input type for a specific hook
 */
export type HookInput<T extends HookName> = HookTypeMap[T]['input']

/**
 * Get output type for a specific hook
 */
export type HookOutput<T extends HookName> = HookTypeMap[T]['output']

/**
 * Typed hook handler function
 */
export type TypedHookHandler<T extends HookName> = (
	input: HookInput<T>,
	output: HookOutput<T>,
) => Promise<void>

// =============================================================================
// Performance Monitoring Types
// =============================================================================

/**
 * Performance metrics for a single hook execution
 */
export interface HookPerformanceMetrics {
	/** Hook name */
	hookName: string

	/** Execution start time */
	startTime: number

	/** Execution end time */
	endTime: number

	/** Duration in milliseconds */
	durationMs: number

	/** Memory usage before execution (bytes) */
	memoryBefore?: number

	/** Memory usage after execution (bytes) */
	memoryAfter?: number

	/** Whether execution exceeded timeout */
	timedOut: boolean
}

/**
 * Aggregated performance statistics
 */
export interface HookPerformanceStats {
	/** Hook name */
	hookName: string

	/** Total executions */
	totalExecutions: number

	/** Average duration in milliseconds */
	avgDurationMs: number

	/** 95th percentile duration */
	p95DurationMs: number

	/** Maximum duration recorded */
	maxDurationMs: number

	/** Error count */
	errorCount: number

	/** Timeout count */
	timeoutCount: number
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Hook-specific error types
 */
export type HookErrorType =
	| 'TIMEOUT'
	| 'VALIDATION'
	| 'EXECUTION'
	| 'CONFIGURATION'
	| 'DEPENDENCY'

/**
 * Hook error with context
 */
export interface HookError extends Error {
	/** Error type classification */
	type: HookErrorType

	/** Hook name where error occurred */
	hookName: string

	/** Whether error is recoverable */
	recoverable: boolean

	/** Additional context */
	context?: Record<string, unknown>
}

/**
 * Create a typed hook error
 */
export function createHookError(
	type: HookErrorType,
	message: string,
	hookName: string,
	recoverable = true,
	context?: Record<string, unknown>,
): HookError {
	const error = new Error(message) as HookError
	error.type = type
	error.hookName = hookName
	error.recoverable = recoverable
	error.context = context
	return error
}
