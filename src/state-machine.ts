/**
 * OpenCode Orchestration State Machine
 * 
 * ## Rationale: Formal Orchestration Gates
 * 
 * The `/do` command implements a formal state machine to ensure that
 * complex tasks are executed with high quality and zero regressions.
 * 
 * ### States:
 * 1. **idle**: Waiting for command
 * 2. **context-assembly**: Gathering Spatial + Deep memory
 * 3. **planning**: Creating memory-first implementation plan
 * 4. **execution**: Deploying subagents for implementation
 * 5. **verification**: Validating changes against evidence
 * 6. **review**: Independent code quality analysis
 * 7. **completion**: Committing changes and reporting learnings
 * 8. **error**: Handling failures and rollback
 * 
 * @module src/integrations/claude-mem/state-machine
 * @see plans/2026-01-11-claude-mem-implementation-plan.md (Phase 9)
 */

import * as v from 'valibot';

/**
 * Orchestration phase identifiers.
 */
export const OrchestrationPhaseSchema = v.picklist([
  'idle',
  'context-assembly',
  'planning',
  'execution',
  'guardrail-validation',
  'verification',
  'review',
  'completion',
  'error',
]);

/**
 * Orchestration phase output type
 */
export type OrchestrationPhase = v.InferOutput<typeof OrchestrationPhaseSchema>;

/**
 * Artifacts produced during orchestration.
 */
export const OrchestrationArtifactsSchema = v.object({
  planPath: v.optional(v.string()),
  diffPath: v.optional(v.string()),
  testLogPath: v.optional(v.string()),
  reviewPath: v.optional(v.string()),
  commitHash: v.optional(v.string()),
});

/**
 * State machine context.
 */
export const OrchestrationStateSchema = v.object({
  phase: OrchestrationPhaseSchema,
  taskId: v.string(),
  startTime: v.number(),
  lastUpdated: v.number(),
  artifacts: OrchestrationArtifactsSchema,
  error: v.optional(v.string()),
});

/**
 * Orchestration state output type
 */
export type OrchestrationState = v.InferOutput<typeof OrchestrationStateSchema>;

/**
 * Entry/Exit criteria for each phase.
 */
export const PHASE_CRITERIA = {
  'context-assembly': {
    entry: 'User issues /do or /make-plan command',
    exit: 'Spatial and Deep memory gathered and manifest created',
  },
  'planning': {
    entry: 'Context manifest available',
    exit: 'Memory-first plan approved by user or validator',
  },
  'execution': {
    entry: 'Approved plan available',
    exit: 'Implementation subagent reports success and provides diff',
  },
  'guardrail-validation': {
    entry: 'Implementation diff available',
    exit: 'Guardrail Validator Agent reports PASS or WARN',
  },
  'verification': {
    entry: 'Guardrail validation complete',
    exit: 'Verification subagent provides logs showing all tests passed',
  },
  'review': {
    entry: 'Verification evidence available',
    exit: 'Review subagent provides sign-off or actionable feedback',
  },
  'completion': {
    entry: 'Review sign-off available',
    exit: 'Changes committed and learnings reported to memory',
  },
} as const;
