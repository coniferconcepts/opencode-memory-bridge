/**
 * Schema validation helpers for @mem-facilitator.
 *
 * Guardrails:
 * - #18: Strict validation before processing
 *
 * @module src/validation/mem-facilitator-validator
 */

import * as v from 'valibot';
import {
  MemFacilitatorInputSchema,
  MemFacilitatorOutputSchema,
  type MemFacilitatorInput,
  type MemFacilitatorOutput,
} from '../schemas/mem-facilitator.js';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: string[] };

/**
 * Format Valibot issues into human-readable strings.
 */
function formatIssues(issues: any[]): string[] {
  return issues.map(issue => {
    const path = issue.path
      ?.map((part: any) => (part.key !== undefined ? String(part.key) : ''))
      .filter(Boolean)
      .join('.');
    const message = issue.message || 'Unknown validation error';
    return path ? `${path}: ${message}` : message;
  });
}

/**
 * Validate mem-facilitator input payload.
 */
export function validateMemFacilitatorInput(payload: unknown): ValidationResult<MemFacilitatorInput> {
  const result = v.safeParse(MemFacilitatorInputSchema, payload);
  if (result.success) {
    return { success: true, data: result.output };
  }
  return { success: false, issues: formatIssues(result.issues) };
}

/**
 * Validate mem-facilitator output payload.
 */
export function validateMemFacilitatorOutput(payload: unknown): ValidationResult<MemFacilitatorOutput> {
  const result = v.safeParse(MemFacilitatorOutputSchema, payload);
  if (result.success) {
    return { success: true, data: result.output };
  }
  return { success: false, issues: formatIssues(result.issues) };
}