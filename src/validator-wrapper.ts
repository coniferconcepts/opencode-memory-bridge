/**
 * Guardrail Validator Wrapper
 * 
 * Responsibility:
 * - Programmatically invoke the guardrail-validator agent.
 * - Handle timeouts and fail-closed logic for Tier 1.
 * - Parse JSON verdicts.
 * 
 * @module src/integrations/claude-mem/validator-wrapper
 */

import { spawnSync } from 'child_process';
import { logger } from './logger.js';

export interface ValidationVerdict {
  verdict: 'PASS' | 'WARN' | 'BLOCK';
  violations: any[];
  confidence: number;
}

/**
 * Invoke the guardrail-validator agent via headless CLI.
 */
export async function invokeGuardrailValidator(
  diff: string, 
  manifest: string, 
  subset: 'tier1' | 'tier2' | 'tier3' | 'all' = 'all'
): Promise<ValidationVerdict> {
  const startTime = Date.now();
  const timeoutMs = 45000; // Increased timeout for GPT-5

  try {
    logger.info('WORKER', `Invoking guardrail-validator for ${subset}...`, { 
      diffLength: diff.length,
      manifestLength: manifest.length 
    });

    // In production, we use the 'opencode' CLI to invoke the subagent
    // This ensures we use the correct model, context, and ZEN credits.
    const prompt = `Validate the following changes against ${subset} guardrails.\n\nDiff:\n${diff}\n\nContext Manifest:\n${manifest}`;
    
    const result = spawnSync('opencode', [
      '--agent', 'guardrail-validator',
      '--print',
      prompt
    ], { 
      timeout: timeoutMs,
      encoding: 'utf-8'
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      logger.error('WORKER', 'Guardrail validator CLI failed', { 
        status: result.status, 
        stderr: result.stderr 
      });
      // Fallback to BLOCK for safety if CLI fails
      return {
        verdict: 'BLOCK',
        violations: [{ guardrail_id: 'CLI_ERROR', severity: 'CRITICAL', evidence: result.stderr }],
        confidence: 0
      };
    }

    // Parse JSON from stdout
    try {
      const output = result.stdout.trim();
      // Find the JSON block in the output (in case there's extra text)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in validator output');
      
      const verdict = JSON.parse(jsonMatch[0]);
      return verdict as ValidationVerdict;
    } catch (e) {
      logger.error('WORKER', 'Failed to parse validator output', { output: result.stdout });
      return {
        verdict: 'BLOCK',
        violations: [{ guardrail_id: 'PARSE_ERROR', severity: 'CRITICAL', evidence: 'Invalid JSON output' }],
        confidence: 0
      };
    }

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    
    if (error.message?.includes('timeout') || executionTime >= timeoutMs) {
      if (subset === 'tier1') {
        return {
          verdict: 'BLOCK',
          violations: [{ guardrail_id: 'TIMEOUT', severity: 'CRITICAL', evidence: 'Validator timed out' }],
          confidence: 0
        };
      }
      return {
        verdict: 'WARN',
        violations: [{ guardrail_id: 'TIMEOUT', severity: 'MEDIUM', evidence: 'Validator timed out' }],
        confidence: 0
      };
    }

    throw error;
  }
}
