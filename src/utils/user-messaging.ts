/**
 * User messaging infrastructure for the memory plugin.
 *
 * Responsibility:
 * - Display non-error informational messages to users
 * - Provide consistent formatting with emoji support
 * - Output to stderr (non-interfering with stdout)
 *
 * Inspired by: Claude Mem SessionStart user-message hook
 */

import { writeFileSync } from 'fs'

/**
 * User message type - controls styling and icon
 */
export type UserMessageType = 'info' | 'success' | 'warning'

/**
 * Link configuration for user messages
 */
export interface UserMessageLink {
  /** Display text for the link */
  text: string
  /** URL the link points to */
  url: string
}

/**
 * Options for displaying a user message
 */
export interface UserMessageOptions {
  /** Message type - controls styling */
  type: UserMessageType
  /** Optional title (shown in bold) */
  title?: string
  /** Main message content */
  message: string
  /** Optional link to include */
  link?: UserMessageLink
  /** Whether to include emoji (default: true) */
  emoji?: boolean
}

/**
 * Emoji mappings for message types
 */
const TYPE_EMOJI: Record<UserMessageType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
}

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

/**
 * Type-specific color mapping
 */
const TYPE_COLORS: Record<UserMessageType, string> = {
  info: COLORS.blue,
  success: COLORS.green,
  warning: COLORS.yellow,
}

/**
 * Display a user-facing message to stderr.
 *
 * **Why stderr?** User messages are informational, not program output.
 * Using stderr ensures they don't interfere with piped stdout operations.
 *
 * **Formatting:**
 * - Title (if provided): Bold with type color
 * - Message: Normal weight, slightly dimmed
 * - Link (if provided): Cyan, underlined style via terminal escape
 *
 * @param options - Message configuration
 */
export function displayUserMessage(options: UserMessageOptions): void {
  const { type, title, message, link, emoji = true } = options

  const color = TYPE_COLORS[type]
  const icon = emoji ? `${TYPE_EMOJI[type]} ` : ''

  // Build output lines
  const lines: string[] = []

  // Title line
  if (title) {
    lines.push(`${icon}${COLORS.bold}${color}${title}${COLORS.reset}`)
  } else {
    lines.push(`${icon}${color}${message}${COLORS.reset}`)
  }

  // Message line (indented if title exists)
  if (title) {
    lines.push(`   ${COLORS.dim}${message}${COLORS.reset}`)
  }

  // Link line
  if (link) {
    lines.push(`   ${COLORS.cyan}→ ${link.text}: ${link.url}${COLORS.reset}`)
  }

  // Empty line for visual separation
  lines.push('')

  // Output to stderr
  const output = lines.join('\n')
  process.stderr.write(output)
}

/**
 * Display a success message.
 * Convenience wrapper around displayUserMessage.
 */
export function showSuccess(title: string, message: string, link?: UserMessageLink): void {
  displayUserMessage({
    type: 'success',
    title,
    message,
    link,
    emoji: true
  })
}

/**
 * Display an info message.
 * Convenience wrapper around displayUserMessage.
 */
export function showInfo(title: string, message: string, link?: UserMessageLink): void {
  displayUserMessage({
    type: 'info',
    title,
    message,
    link,
    emoji: true
  })
}

/**
 * Display a warning message.
 * Convenience wrapper around displayUserMessage.
 */
export function showWarning(title: string, message: string, link?: UserMessageLink): void {
  displayUserMessage({
    type: 'warning',
    title,
    message,
    link,
    emoji: true
  })
}
