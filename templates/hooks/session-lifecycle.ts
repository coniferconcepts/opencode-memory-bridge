/**
 * Session Lifecycle Hook Template
 * 
 * This template provides a complete implementation for handling session lifecycle events
 * in the OpenCode system. It demonstrates best practices for session management,
 * state tracking, and cleanup.
 * 
 * ## Usage
 * 
 * Copy this file to your project and customize the handlers:
 * ```bash
 * cp templates/hooks/session-lifecycle.ts my-project/hooks/session-manager.ts
 * ```
 * 
 * ## Features
 * 
 * - Session state management
 * - Automatic cleanup
 * - Idle detection
 * - Summary generation
 * - Non-blocking persistence
 * - Error handling
 * 
 * @module hooks/session-lifecycle
 * @requires universal/hooks
 * @example
 * ```typescript
 * import { sessionLifecycleHooks } from './hooks/session-manager'
 * import { hookRegistry } from '~/universal/hooks/registry'
 * 
 * // Register all session hooks
 * sessionLifecycleHooks.forEach(hook => hookRegistry.register(hook))
 * ```
 */

import type {
	OpenCodeHook,
	SessionHookInput,
	SessionHookOutput,
	SessionContext,
	SessionMetadata,
	ContextObservation,
	isSessionHookInput,
} from '../../universal/hooks'

// =============================================================================
// Configuration
// =============================================================================

interface SessionManagerConfig {
	/** Generate summaries on session stop */
	enableSummaries: boolean

	/** Maximum session duration before warning (ms) */
	maxSessionDurationMs: number

	/** Idle timeout threshold (ms) */
	idleTimeoutMs: number

	/** Number of observations to inject at start */
	contextObservationLimit: number

	/** Custom metadata fields to track */
	customMetadataFields?: string[]
}

const DEFAULT_CONFIG: SessionManagerConfig = {
	enableSummaries: true,
	maxSessionDurationMs: 4 * 60 * 60 * 1000, // 4 hours
	idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
	contextObservationLimit: 50,
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Session state store
 * Using Map for O(1) lookups and automatic cleanup
 */
const sessionStore = new Map<string, SessionContext>()

/**
 * Get session context by ID
 */
function getSession(sessionId: string): SessionContext | undefined {
	return sessionStore.get(sessionId)
}

/**
 * Set session context
 */
function setSession(sessionId: string, context: SessionContext): void {
	sessionStore.set(sessionId, context)
}

/**
 * Remove session context
 */
function removeSession(sessionId: string): boolean {
	return sessionStore.delete(sessionId)
}

/**
 * Get all active sessions
 */
function getActiveSessions(): SessionContext[] {
	return Array.from(sessionStore.values()).filter(
		(s) => s.state === 'active',
	)
}

// =============================================================================
// Hook 1: Session Created
// =============================================================================

/**
 * Session created hook - Initialize session resources
 * 
 * Triggered when a new session is created. Use this to:
 * - Initialize session metadata
 * - Load historical context
 * - Set up session-specific resources
 * - Validate configuration
 * 
 * @priority 10 (Early execution)
 * @blocking Yes
 * @timeout 5000ms
 */
export const sessionCreatedHook: OpenCodeHook<
	SessionHookInput,
	SessionHookOutput
> = {
	name: 'session.created',
	priority: 10,
	description: 'Initialize session resources and metadata',

	handler: async (input, output) => {
		// Validate input
		if (!isSessionHookInput(input)) {
			console.error('[Session Created] Invalid input format')
			output.success = false
			output.error = 'Invalid session input'
			return
		}

		try {
			console.log(`[Session] Creating session ${input.sessionId}`)

			// Initialize session metadata
			const metadata: SessionMetadata = {
				startedAt: input.timestamp,
				lastActivityAt: input.timestamp,
				toolCallCount: 0,
				messageCount: 0,
				...input.metadata,
			}

			// Create session context
			const sessionContext: SessionContext = {
				id: input.sessionId,
				project: input.project,
				directory: input.directory,
				state: 'active',
				metadata,
				contextObservations: [],
			}

			// Store session
			setSession(input.sessionId, sessionContext)

			// Non-blocking initialization
			initializeSessionResources(input.sessionId).catch((err) => {
				console.warn(
					`[Session] Failed to initialize resources for ${input.sessionId}:`,
					err,
				)
			})

			// Update output
			output.session = sessionContext
			output.success = true

			console.log(`[Session] Session ${input.sessionId} initialized`)
		} catch (error) {
			console.error(
				`[Session] Error creating session ${input.sessionId}:`,
				error,
			)
			output.success = false
			output.error =
				error instanceof Error ? error.message : 'Unknown error'

			// Don't throw - session should continue even if hook fails
		}
	},
}

/**
 * Initialize session-specific resources
 * Non-blocking background initialization
 */
async function initializeSessionResources(sessionId: string): Promise<void> {
	// Example: Load user preferences, connect to external services, etc.
	// This runs in the background and won't block session start

	console.log(`[Session] Initializing resources for ${sessionId}`)

	// Simulate async resource initialization
	await new Promise((resolve) => setTimeout(resolve, 100))

	console.log(`[Session] Resources initialized for ${sessionId}`)
}

// =============================================================================
// Hook 2: Session Start
// =============================================================================

/**
 * Session start hook - First user prompt handling
 * 
 * Triggered when the user submits their first prompt. Use this to:
 * - Display welcome/informational messages
 * - Inject initial context
 * - Validate session configuration
 * - Log session start
 * 
 * @priority 20
 * @blocking Yes
 * @timeout 5000ms
 */
export const sessionStartHook: OpenCodeHook<
	SessionHookInput,
	SessionHookOutput
> = {
	name: 'session.start',
	priority: 20,
	description: 'Handle first user prompt and inject context',

	handler: async (input, output) => {
		const session = getSession(input.sessionId)

		if (!session) {
			console.warn(`[Session] Start called for unknown session ${input.sessionId}`)
			output.success = false
			output.error = 'Session not found'
			return
		}

		try {
			console.log(`[Session] Starting session ${input.sessionId}`)

			// Update last activity
			session.metadata.lastActivityAt = input.timestamp

			// Display user message (if configured)
			displaySessionMessage(session)

			// Inject context observations
			const observations = await loadContextObservations(
				input.project,
				DEFAULT_CONFIG.contextObservationLimit,
			)

			session.contextObservations = observations

			// Non-blocking: Persist session start
			persistSessionStart(session).catch((err) => {
				console.warn(`[Session] Failed to persist start:`, err)
			})

			output.session = session
			output.success = true

			console.log(
				`[Session] Session ${input.sessionId} started with ${observations.length} observations`,
			)
		} catch (error) {
			console.error(`[Session] Error starting session:`, error)
			output.success = false
			output.error =
				error instanceof Error ? error.message : 'Unknown error'
		}
	},
}

/**
 * Display informational message to user
 */
function displaySessionMessage(session: SessionContext): void {
	const observationCount = session.contextObservations?.length || 0

	if (observationCount > 0) {
		// Output to stderr (informational)
		console.error(
			`📝 Context loaded: ${observationCount} observations available`,
		)
	}
}

/**
 * Load context observations from memory store
 */
async function loadContextObservations(
	project: string,
	limit: number,
): Promise<ContextObservation[]> {
	// Implement your context loading logic here
	// This is a placeholder implementation

	console.log(`[Session] Loading observations for project: ${project}`)

	// Simulate loading observations
	const observations: ContextObservation[] = []

	// Add your observation loading logic here
	// Example:
	// const memories = await memoryStore.query({ project, limit })
	// return memories.map(m => ({
	//   id: m.id,
	//   type: 'memory',
	//   content: m.content,
	//   relevance: m.score,
	//   createdAt: m.createdAt,
	//   source: m.source
	// }))

	return observations
}

/**
 * Persist session start to storage
 */
async function persistSessionStart(session: SessionContext): Promise<void> {
	// Implement your persistence logic here
	console.log(`[Session] Persisting start for ${session.id}`)
}

// =============================================================================
// Hook 3: Session Idle
// =============================================================================

/**
 * Session idle hook - Handle inactivity timeout
 * 
 * Triggered when session has been inactive. Use this to:
 * - Generate checkpoint summaries
 * - Persist intermediate state
 * - Trigger background processing
 * - Notify monitoring systems
 * 
 * @priority 50
 * @blocking No (Non-blocking)
 * @timeout 30000ms
 */
export const sessionIdleHook: OpenCodeHook<
	SessionHookInput,
	SessionHookOutput
> = {
	name: 'session.idle',
	priority: 50,
	description: 'Handle session idle timeout',

	handler: async (input, output) => {
		const session = getSession(input.sessionId)

		if (!session) {
			console.warn(`[Session] Idle called for unknown session ${input.sessionId}`)
			output.success = false
			return
		}

		try {
			console.log(`[Session] Session ${input.sessionId} is idle`)

			// Update state
			session.state = 'idle'

			// Calculate duration
			const durationMs =
				input.timestamp.getTime() -
				(session.metadata.startedAt?.getTime() || input.timestamp.getTime())

			session.metadata.durationMs = durationMs

			// Generate checkpoint summary (if enabled)
			if (DEFAULT_CONFIG.enableSummaries) {
				generateCheckpointSummary(session, durationMs).catch((err) => {
					console.warn(`[Session] Failed to generate idle summary:`, err)
				})
			}

			// Persist idle state
			persistIdleState(session, durationMs).catch((err) => {
				console.warn(`[Session] Failed to persist idle state:`, err)
			})

			output.session = session
			output.success = true

			console.log(
				`[Session] Idle handling complete for ${input.sessionId} (${Math.round(durationMs / 60000)} min)`,
			)
		} catch (error) {
			console.error(`[Session] Error handling idle:`, error)
			output.success = false
			// Non-blocking - don't throw
		}
	},
}

/**
 * Generate checkpoint summary for idle session
 */
async function generateCheckpointSummary(
	session: SessionContext,
	durationMs: number,
): Promise<void> {
	console.log(
		`[Session] Generating checkpoint for ${session.id} (${durationMs}ms)`,
	)

	// Implement summary generation
	// Example:
	// const summary = await createSummary({
	//   sessionId: session.id,
	//   durationMs,
	//   toolCalls: session.metadata.toolCallCount,
	//   messages: session.metadata.messageCount
	// })
	// await memoryStore.save(summary)
}

/**
 * Persist idle session state
 */
async function persistIdleState(
	session: SessionContext,
	durationMs: number,
): Promise<void> {
	console.log(`[Session] Persisting idle state for ${session.id}`)

	// Implement persistence
	// Example:
	// await db.sessions.update(session.id, {
	//   state: 'idle',
	//   durationMs,
	//   lastActivityAt: session.metadata.lastActivityAt
	// })
}

// =============================================================================
// Hook 4: Session Stop
// =============================================================================

/**
 * Session stop hook - Handle explicit session termination
 * 
 * Triggered when session is explicitly stopped (not idle timeout). Use this to:
 * - Generate final session summary
 * - Mark session as stopped (not completed)
 * - Trigger outbox drain
 * - Send user notifications
 * 
 * @priority 50
 * @blocking No (Non-blocking)
 * @timeout 30000ms
 */
export const sessionStopHook: OpenCodeHook<
	SessionHookInput,
	SessionHookOutput
> = {
	name: 'session.stop',
	priority: 50,
	description: 'Handle explicit session stop',

	handler: async (input, output) => {
		const session = getSession(input.sessionId)

		if (!session) {
			console.warn(`[Session] Stop called for unknown session ${input.sessionId}`)
			output.success = false
			return
		}

		try {
			console.log(`[Session] Session ${input.sessionId} stopped by user`)

			// Update state
			session.state = 'stopped'
			session.metadata.explicitlyStopped = true

			// Calculate final duration
			const durationMs =
				input.timestamp.getTime() -
				(session.metadata.startedAt?.getTime() || input.timestamp.getTime())

			session.metadata.durationMs = durationMs

			// Generate final summary (if enabled)
			if (DEFAULT_CONFIG.enableSummaries) {
				generateFinalSummary(session, durationMs).catch((err) => {
					console.warn(`[Session] Failed to generate final summary:`, err)
				})
			}

			// Drain outbox
			drainOutbox(session.id).catch((err) => {
				console.warn(`[Session] Failed to drain outbox:`, err)
			})

			// Persist stop state
			persistStopState(session, durationMs).catch((err) => {
				console.warn(`[Session] Failed to persist stop state:`, err)
			})

			output.session = session
			output.success = true

			console.log(
				`[Session] Stop handling complete for ${input.sessionId}`,
			)
		} catch (error) {
			console.error(`[Session] Error handling stop:`, error)
			output.success = false
			// Non-blocking - don't throw
		}
	},
}

/**
 * Generate final session summary
 */
async function generateFinalSummary(
	session: SessionContext,
	durationMs: number,
): Promise<void> {
	console.log(`[Session] Generating final summary for ${session.id}`)

	// Implement final summary generation
	// This is different from checkpoint - includes full context
	// Example:
	// const finalSummary = await createFinalSummary({
	//   sessionId: session.id,
	//   durationMs,
	//   observations: session.contextObservations,
	//   metadata: session.metadata
	// })
	// await memoryStore.save(finalSummary)
}

/**
 * Drain outbox - ensure all pending operations complete
 */
async function drainOutbox(sessionId: string): Promise<void> {
	console.log(`[Session] Draining outbox for ${sessionId}`)

	// Implement outbox draining
	// Example:
	// await outbox.drain({ sessionId })
}

/**
 * Persist stop state
 */
async function persistStopState(
	session: SessionContext,
	durationMs: number,
): Promise<void> {
	console.log(`[Session] Persisting stop state for ${session.id}`)

	// Implement persistence
	// Example:
	// await db.sessions.update(session.id, {
	//   state: 'stopped',
	//   durationMs,
	//   stoppedAt: new Date()
	// })
}

// =============================================================================
// Hook 5: Session Deleted
// =============================================================================

/**
 * Session deleted hook - Cleanup resources
 * 
 * Triggered when session is permanently removed. Use this to:
 * - Cleanup temporary files
 * - Remove session-specific resources
 * - Update analytics
 * - Archive data if needed
 * 
 * @priority 100
 * @blocking No (Non-blocking)
 * @timeout 10000ms
 */
export const sessionDeletedHook: OpenCodeHook<
	SessionHookInput,
	SessionHookOutput
> = {
	name: 'session.deleted',
	priority: 100,
	description: 'Cleanup session resources',

	handler: async (input, output) => {
		const session = getSession(input.sessionId)

		try {
			console.log(`[Session] Cleaning up session ${input.sessionId}`)

			// Cleanup resources
			await cleanupSessionResources(input.sessionId)

			// Remove from store
			removeSession(input.sessionId)

			// Archive if needed (non-blocking)
			if (session) {
				archiveSessionData(session).catch((err) => {
					console.warn(`[Session] Failed to archive:`, err)
				})
			}

			output.success = true

			console.log(`[Session] Cleanup complete for ${input.sessionId}`)
		} catch (error) {
			console.error(`[Session] Error during cleanup:`, error)
			output.success = false
			// Non-blocking - don't throw
		}
	},
}

/**
 * Cleanup session-specific resources
 */
async function cleanupSessionResources(sessionId: string): Promise<void> {
	console.log(`[Session] Cleaning up resources for ${sessionId}`)

	// Implement resource cleanup
	// Example:
	// await tempFileManager.cleanup(sessionId)
	// await cache.invalidate(`session:${sessionId}`)
	// await websocketManager.disconnect(sessionId)
}

/**
 * Archive session data for long-term storage
 */
async function archiveSessionData(session: SessionContext): Promise<void> {
	console.log(`[Session] Archiving data for ${session.id}`)

	// Implement archiving
	// Example:
	// await archive.store({
	//   sessionId: session.id,
	//   project: session.project,
	//   durationMs: session.metadata.durationMs,
	//   createdAt: session.metadata.startedAt,
	//   summary: await generateArchiveSummary(session)
	// })
}

// =============================================================================
// Export All Hooks
// =============================================================================

/**
 * Complete set of session lifecycle hooks
 * 
 * Register these hooks to handle all session lifecycle events:
 * 
 * ```typescript
 * import { sessionLifecycleHooks } from './hooks/session-manager'
 * import { hookRegistry } from '~/universal/hooks/registry'
 * 
 * sessionLifecycleHooks.forEach(hook => {
 *   hookRegistry.register(hook)
 * })
 * ```
 */
export const sessionLifecycleHooks = [
	sessionCreatedHook,
	sessionStartHook,
	sessionIdleHook,
	sessionStopHook,
	sessionDeletedHook,
]

/**
 * Individual hook exports for selective registration
 */
export {
	sessionCreatedHook,
	sessionStartHook,
	sessionIdleHook,
	sessionStopHook,
	sessionDeletedHook,
}

// =============================================================================
// Default Export
// =============================================================================

export default sessionLifecycleHooks
