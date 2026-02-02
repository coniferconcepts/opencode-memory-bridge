/**
 * Context Injection Hook Template
 * 
 * This template provides a complete implementation for injecting contextual
 * information into OpenCode sessions. It demonstrates best practices for
 * memory retrieval, context building, and intelligent injection.
 * 
 * ## Usage
 * 
 * Copy this file to your project and customize the handlers:
 * ```bash
 * cp templates/hooks/context-injection.ts my-project/hooks/context-manager.ts
 * ```
 * 
 * ## Features
 * 
 * - Memory-based context retrieval
 * - Relevance scoring
 * - Context source prioritization
 * - Token budget management
 * - Caching for performance
 * - Fallback strategies
 * - Multi-source context merging
 * 
 * @module hooks/context-injection
 * @requires universal/hooks
 * @example
 * ```typescript
 * import { contextInjectionHook } from './hooks/context-manager'
 * import { hookRegistry } from '~/universal/hooks/registry'
 * 
 * // Register context injection hook
 * hookRegistry.register(contextInjectionHook)
 * ```
 */

import type {
	OpenCodeHook,
	ContextInjectionInput,
	ContextInjectionOutput,
	ContextObservation,
	ContextSource,
	SessionHookInput,
} from '../../universal/hooks'

// =============================================================================
// Configuration
// =============================================================================

interface ContextInjectionConfig {
	/** Maximum context length in characters */
	maxContextLength: number

	/** Maximum number of observations to inject */
	maxObservations: number

	/** Minimum relevance score (0-1) */
	minRelevanceScore: number

	/** Enable caching */
	enableCaching: boolean

	/** Cache TTL in milliseconds */
	cacheTtlMs: number

	/** Context sources in priority order */
	sources: ContextSource[]

	/** Enable fallback to generic context */
	enableFallback: boolean

	/** Custom context formatter */
	formatContextFn?: (observations: ContextObservation[]) => string
}

const DEFAULT_CONFIG: ContextInjectionConfig = {
	maxContextLength: 8000, // ~2000 tokens
	maxObservations: 50,
	minRelevanceScore: 0.6,
	enableCaching: true,
	cacheTtlMs: 5 * 60 * 1000, // 5 minutes
	sources: [
		{ id: 'memory', name: 'Session Memory', type: 'memory', available: true, priority: 1 },
		{ id: 'files', name: 'File Context', type: 'file', available: true, priority: 2 },
		{ id: 'db', name: 'Database', type: 'database', available: false, priority: 3 },
	],
	enableFallback: true,
}

// =============================================================================
// Caching
// =============================================================================

interface CacheEntry {
	context: string
	observations: ContextObservation[]
	timestamp: number
}

const contextCache = new Map<string, CacheEntry>()

/**
 * Get cached context if valid
 */
function getCachedContext(sessionId: string): CacheEntry | undefined {
	if (!DEFAULT_CONFIG.enableCaching) {
		return undefined
	}

	const cached = contextCache.get(sessionId)
	if (!cached) {
		return undefined
	}

	const age = Date.now() - cached.timestamp
	if (age > DEFAULT_CONFIG.cacheTtlMs) {
		contextCache.delete(sessionId)
		return undefined
	}

	console.log(`[Context] Cache hit for session ${sessionId}`)
	return cached
}

/**
 * Set context in cache
 */
function setCachedContext(
	sessionId: string,
	context: string,
	observations: ContextObservation[],
): void {
	if (!DEFAULT_CONFIG.enableCaching) {
		return
	}

	contextCache.set(sessionId, {
		context,
		observations,
		timestamp: Date.now(),
	})
}

/**
 * Invalidate cache for session
 */
export function invalidateContextCache(sessionId: string): void {
	contextCache.delete(sessionId)
	console.log(`[Context] Cache invalidated for ${sessionId}`)
}

/**
 * Clear all cached contexts
 */
export function clearContextCache(): void {
	contextCache.clear()
	console.log('[Context] Cache cleared')
}

// =============================================================================
// Context Building
// =============================================================================

/**
 * Build context from multiple sources
 */
async function buildContext(
	input: ContextInjectionInput,
): Promise<{ context: string; observations: ContextObservation[]; sourcesUsed: string[] }> {
	const allObservations: ContextObservation[] = []
	const sourcesUsed: string[] = []

	// Sort sources by priority
	const sortedSources = [...DEFAULT_CONFIG.sources].sort(
		(a, b) => a.priority - b.priority,
	)

	// Gather observations from each source
	for (const source of sortedSources) {
		if (!source.available) {
			continue
		}

		try {
			const observations = await fetchObservationsFromSource(source, input)

			if (observations.length > 0) {
				allObservations.push(...observations)
				sourcesUsed.push(source.id)
			}

			// Check if we have enough observations
			if (allObservations.length >= DEFAULT_CONFIG.maxObservations) {
				break
			}
		} catch (error) {
			console.warn(`[Context] Failed to fetch from ${source.id}:`, error)
		}
	}

	// Sort by relevance and limit
	const sortedObservations = allObservations
		.filter((obs) => obs.relevance >= DEFAULT_CONFIG.minRelevanceScore)
		.sort((a, b) => b.relevance - a.relevance)
		.slice(0, DEFAULT_CONFIG.maxObservations)

	// Format context
	const context = formatContext(sortedObservations)

	return { context, observations: sortedObservations, sourcesUsed }
}

/**
 * Fetch observations from a specific source
 */
async function fetchObservationsFromSource(
	source: ContextSource,
	input: ContextInjectionInput,
): Promise<ContextObservation[]> {
	switch (source.type) {
		case 'memory':
			return fetchMemoryObservations(input)

		case 'file':
			return fetchFileObservations(input)

		case 'database':
			return fetchDatabaseObservations(input)

		case 'external':
			return fetchExternalObservations(input, source)

		default:
			return []
	}
}

/**
 * Fetch observations from memory store
 */
async function fetchMemoryObservations(
	input: ContextInjectionInput,
): Promise<ContextObservation[]> {
	// Implement memory retrieval
	// Example:
	// const memories = await memoryStore.query({
	//   project: input.session.project,
	//   sessionId: input.session.sessionId,
	//   limit: DEFAULT_CONFIG.maxObservations,
	//   minRelevance: DEFAULT_CONFIG.minRelevanceScore
	// })

	// return memories.map(m => ({
	//   id: m.id,
	//   type: 'memory',
	//   content: m.content,
	//   relevance: m.relevance,
	//   createdAt: m.createdAt,
	//   source: m.source
	// }))

	console.log(`[Context] Fetching memory observations for ${input.session.project}`)

	// Placeholder return
	return []
}

/**
 * Fetch observations from file system
 */
async function fetchFileObservations(
	input: ContextInjectionInput,
): Promise<ContextObservation[]> {
	// Implement file-based context retrieval
	// Example: Get relevant files, recent changes, etc.

	console.log(`[Context] Fetching file observations from ${input.session.directory}`)

	// Placeholder return
	return []
}

/**
 * Fetch observations from database
 */
async function fetchDatabaseObservations(
	input: ContextInjectionInput,
): Promise<ContextObservation[]> {
	// Implement database query
	// Example: Query project knowledge, patterns, etc.

	console.log(`[Context] Fetching database observations`)

	// Placeholder return
	return []
}

/**
 * Fetch observations from external source
 */
async function fetchExternalObservations(
	input: ContextInjectionInput,
	source: ContextSource,
): Promise<ContextObservation[]> {
	// Implement external API call
	// Example: Query documentation, external knowledge base, etc.

	console.log(`[Context] Fetching from external source: ${source.name}`)

	// Placeholder return
	return []
}

// =============================================================================
// Context Formatting
// =============================================================================

/**
 * Format observations into injectable context
 */
function formatContext(observations: ContextObservation[]): string {
	// Use custom formatter if provided
	if (DEFAULT_CONFIG.formatContextFn) {
		try {
			return DEFAULT_CONFIG.formatContextFn(observations)
		} catch {
			// Fall through to default
		}
	}

	if (observations.length === 0) {
		return ''
	}

	// Default formatting
	const lines: string[] = []

	lines.push('## Relevant Context')
	lines.push('')

	// Group by type
	const grouped = groupObservationsByType(observations)

	for (const [type, items] of Object.entries(grouped)) {
		if (items.length === 0) continue

		lines.push(`### ${capitalize(type)}`)
		lines.push('')

		for (const obs of items.slice(0, 10)) {
			// Limit items per type
			const content = truncateContent(obs.content, 200)
			lines.push(`- ${content} (${(obs.relevance * 100).toFixed(0)}% relevant)`)
		}

		lines.push('')
	}

	let context = lines.join('\n')

	// Ensure we don't exceed max length
	if (context.length > DEFAULT_CONFIG.maxContextLength) {
		context = context.substring(0, DEFAULT_CONFIG.maxContextLength)
		context += '\n\n[Context truncated due to length]'
	}

	return context
}

/**
 * Group observations by their type
 */
function groupObservationsByType(
	observations: ContextObservation[],
): Record<string, ContextObservation[]> {
	const grouped: Record<string, ContextObservation[]> = {}

	for (const obs of observations) {
		if (!grouped[obs.type]) {
			grouped[obs.type] = []
		}
		grouped[obs.type].push(obs)
	}

	return grouped
}

/**
 * Truncate content to max length
 */
function truncateContent(content: string, maxLength: number): string {
	if (content.length <= maxLength) {
		return content
	}

	return content.substring(0, maxLength) + '...'
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1)
}

// =============================================================================
// Fallback Context
// =============================================================================

/**
 * Generate fallback context when no observations found
 */
function generateFallbackContext(input: ContextInjectionInput): string {
	if (!DEFAULT_CONFIG.enableFallback) {
		return ''
	}

	const lines: string[] = []

	lines.push('## Project Context')
	lines.push('')
	lines.push(`- **Project**: ${input.session.project}`)
	lines.push(`- **Directory**: ${input.session.directory}`)
	lines.push(`- **Session ID**: ${input.session.sessionId}`)
	lines.push('')
	lines.push('No previous context available for this session.')

	return lines.join('\n')
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Context injection hook
 * 
 * Triggered to gather and inject context into the conversation.
 * Use this to:
 * - Retrieve relevant memories
 * - Load file context
 * - Query external knowledge
 * - Build context manifest
 * 
 * @priority 1 (Highest - runs first)
 * @blocking Yes
 * @timeout 5000ms
 */
export const contextInjectionHook: OpenCodeHook<
	ContextInjectionInput,
	ContextInjectionOutput
> = {
	name: 'context.inject',
	priority: 1,
	description: 'Inject relevant context into sessions',

	handler: async (input, output) => {
		const startTime = performance.now()
		const sessionId = input.session.sessionId

		try {
			console.log(`[Context] Building context for session ${sessionId}`)

			// Check cache first
			const cached = getCachedContext(sessionId)
			if (cached) {
				output.contextToInject = cached.context
				output.observations = cached.observations
				output.totalSize = cached.context.length
				output.sourcesUsed = ['cache']
				output.success = true

				console.log(`[Context] Using cached context (${cached.context.length} chars)`)
				return
			}

			// Build context from sources
			const { context, observations, sourcesUsed } = await buildContext(input)

			// Use fallback if no context found
			const finalContext = context || generateFallbackContext(input)

			// Calculate size
			const totalSize = finalContext.length

			// Cache the context
			if (observations.length > 0) {
				setCachedContext(sessionId, finalContext, observations)
			}

			// Update output
			output.contextToInject = finalContext
			output.observations = observations
			output.totalSize = totalSize
			output.sourcesUsed = sourcesUsed
			output.success = true

			const duration = performance.now() - startTime

			console.log(
				`[Context] Injected ${observations.length} observations ` +
					`(${totalSize} chars) from ${sourcesUsed.length} sources ` +
					`in ${duration.toFixed(2)}ms`,
			)
		} catch (error) {
			console.error(`[Context] Error building context:`, error)

			// Return empty but successful to not block session
			output.contextToInject = ''
			output.observations = []
			output.totalSize = 0
			output.sourcesUsed = []
			output.success = true // Don't block on context failure

			// Optionally use fallback
			if (DEFAULT_CONFIG.enableFallback) {
				output.contextToInject = generateFallbackContext(input)
			}
		}
	},
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Manually trigger context refresh
 */
export async function refreshContext(
	session: SessionHookInput,
): Promise<{ context: string; observations: ContextObservation[] }> {
	// Invalidate cache
	invalidateContextCache(session.sessionId)

	// Build fresh context
	const input: ContextInjectionInput = {
		session,
		availableSources: DEFAULT_CONFIG.sources,
		maxContextLength: DEFAULT_CONFIG.maxContextLength,
	}

	const output: ContextInjectionOutput = {
		contextToInject: '',
		observations: [],
		totalSize: 0,
		sourcesUsed: [],
		success: false,
	}

	await contextInjectionHook.handler(input, output)

	return {
		context: output.contextToInject,
		observations: output.observations,
	}
}

/**
 * Add custom context source
 */
export function addContextSource(source: ContextSource): void {
	DEFAULT_CONFIG.sources.push(source)
	console.log(`[Context] Added source: ${source.name}`)
}

/**
 * Remove context source
 */
export function removeContextSource(sourceId: string): void {
	DEFAULT_CONFIG.sources = DEFAULT_CONFIG.sources.filter(
		(s) => s.id !== sourceId,
	)
	console.log(`[Context] Removed source: ${sourceId}`)
}

/**
 * Update configuration
 */
export function updateConfig(
	config: Partial<ContextInjectionConfig>,
): void {
	Object.assign(DEFAULT_CONFIG, config)
	console.log('[Context] Configuration updated')
}

// =============================================================================
// Default Export
// =============================================================================

export default contextInjectionHook
