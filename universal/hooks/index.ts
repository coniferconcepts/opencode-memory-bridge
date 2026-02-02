/**
 * OpenCode Hook System
 * 
 * Central export point for all hook-related types, interfaces, and utilities.
 * 
 * @example
 * ```typescript
 * import { 
 *   OpenCodeHook, 
 *   SessionHookInput, 
 *   ToolHookInput,
 *   isSessionHookInput 
 * } from '~/universal/hooks'
 * 
 * const myHook: OpenCodeHook<SessionHookInput, SessionHookOutput> = {
 *   name: 'session.created',
 *   handler: async (input, output) => {
 *     // Hook implementation
 *   }
 * }
 * ```
 * 
 * @module universal/hooks
 */

// Core interfaces
export type {
	OpenCodeHook,
	HookRegistration,
	HookExecutionResult,
	TypedHookHandler,
} from './interface'

// Session hooks
export type {
	SessionHookInput,
	SessionHookOutput,
	SessionMetadata,
	SessionContext,
	ContextObservation,
} from './interface'

// Tool hooks
export type {
	ToolHookInput,
	ToolHookOutput,
	ToolError,
	ToolExecutionContext,
} from './interface'

// Message hooks
export type {
	MessageHookInput,
	MessageHookOutput,
	MessageMetadata,
} from './interface'

// Context injection hooks
export type {
	ContextInjectionInput,
	ContextInjectionOutput,
	ContextSource,
} from './interface'

// File watcher hooks
export type {
	FileWatcherInput,
	FileWatcherOutput,
	FileObservation,
	FileWatcherMetadata,
} from './interface'

// Configuration
export type {
	HookConfig,
	HookSystemConfig,
} from './interface'

// Performance monitoring
export type {
	HookPerformanceMetrics,
	HookPerformanceStats,
} from './interface'

// Error handling
export type { HookError, HookErrorType } from './interface'

// Type guards
export {
	isSessionHookInput,
	isToolHookInput,
	isMessageHookInput,
	isContextObservation,
} from './interface'

// Utilities
export { createHookError, DEFAULT_HOOK_CONFIG } from './interface'

// Type mappings
export type { HookName, HookTypeMap, HookInput, HookOutput } from './interface'
