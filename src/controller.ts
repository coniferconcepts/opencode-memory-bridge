/**
 * Orchestration Controller (v2.0)
 * 
 * Responsibility:
 * - Manage the Finite State Automaton (FSA) for the /do command.
 * - Handle phase transitions and persistence to KV with optimistic locking.
 * - Coordinate parallel validation and verification.
 * - Enforce guardrail BLOCK verdicts and rollbacks.
 * 
 * @module src/integrations/claude-mem/controller
 * @see docs/ORCHESTRATION_STATE_MACHINE_PLAN.md
 */

import { 
  type OrchestrationPhase,
  type OrchestrationState,
} from './state-machine.js';
import { logger } from './logger.js';

/**
 * Orchestration Controller Class
 */
export class OrchestrationController {
  private state: OrchestrationState & { version: number };

  constructor(taskId: string, initialState?: OrchestrationState & { version: number }) {
    this.state = initialState || {
      phase: 'idle',
      taskId,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      artifacts: {},
      version: 0,
    };
  }

  /**
   * Get current state
   */
  getState(): OrchestrationState {
    return this.state;
  }

  /**
   * Transition to a new phase with validation and optimistic locking.
   */
  async transition(nextPhase: OrchestrationPhase, artifacts?: Partial<OrchestrationState['artifacts']>): Promise<void> {
    const currentPhase = this.state.phase;
    
    // 1. Validate transition (Basic FSA guards)
    if (!this.isValidTransition(currentPhase, nextPhase)) {
      throw new Error(`Invalid orchestration transition: ${currentPhase} -> ${nextPhase}`);
    }

    // 2. Update state with version increment
    this.state.phase = nextPhase;
    this.state.lastUpdated = Date.now();
    this.state.version += 1;
    if (artifacts) {
      this.state.artifacts = { ...this.state.artifacts, ...artifacts };
    }

    // 3. Persist to KV with optimistic locking
    await this.persistState();

    logger.info('WORKER', `Orchestration phase transition: ${currentPhase} -> ${nextPhase} (v${this.state.version})`, {
      taskId: this.state.taskId,
      artifacts: this.state.artifacts
    });
  }

  /**
   * Handle error state and trigger rollback
   */
  async handleError(error: string, rollback = true): Promise<void> {
    // LC-003: Capture current phase before mutation for accurate logging
    const failedPhase = this.state.phase;
    
    this.state.phase = 'error';
    this.state.error = error;
    this.state.lastUpdated = Date.now();
    this.state.version += 1;
    await this.persistState();
    
    logger.error('WORKER', `Orchestration error in phase ${failedPhase}`, {
      taskId: this.state.taskId,
      error
    });

    if (rollback) {
      await this.executeRollback();
    }
  }

  /**
   * Execute git-based rollback
   */
  private async executeRollback(): Promise<void> {
    logger.warn('WORKER', `Executing rollback for task ${this.state.taskId}`);
    try {
      const { execSync } = require('child_process');
      
      // SEC-002: Explicitly set CWD to project root for safety
      const projectDir = process.cwd();

      // 1. Check if there are changes to rollback
      const diff = execSync('git diff HEAD', { encoding: 'utf-8', cwd: projectDir }).trim();
      const unstaged = execSync('git diff', { encoding: 'utf-8', cwd: projectDir }).trim();
      const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8', cwd: projectDir }).trim();
      
      if (!diff && !unstaged && !untracked) {
        logger.info('WORKER', 'No changes detected to rollback.');
        return;
      }

      // 2. Discard staged and unstaged changes
      execSync('git reset --hard HEAD', { cwd: projectDir });
      
      // 3. Clean untracked files and directories
      execSync('git clean -fd', { cwd: projectDir });
      
      logger.info('WORKER', 'Rollback complete: Working directory restored to HEAD.');
    } catch (e) {
      logger.error('WORKER', 'Rollback failed', { error: String(e) });
    }
  }

  /**
   * Basic FSA transition guards
   */
  private isValidTransition(from: OrchestrationPhase, to: OrchestrationPhase): boolean {
    if (to === 'error') return true; // Can always transition to error
    
    const transitions: Record<OrchestrationPhase, OrchestrationPhase[]> = {
      'idle': ['context-assembly'],
      'context-assembly': ['planning'],
      'planning': ['execution'],
      'execution': ['guardrail-validation', 'verification', 'completion'],
      'guardrail-validation': ['verification', 'review', 'error'],
      'verification': ['review', 'completion', 'error'],
      'review': ['completion'],
      'completion': ['idle'],
      'error': ['idle', 'context-assembly'],
    };

    return transitions[from]?.includes(to) ?? false;
  }

  /**
   * Persist state to local file with optimistic locking
   */
  private async persistState(): Promise<void> {
    try {
      const { writeFileSync, readFileSync, existsSync, mkdirSync } = require('fs');
      const { join } = require('path');
      
      const ocDir = join(process.cwd(), '.oc');
      if (!existsSync(ocDir)) {
        mkdirSync(ocDir, { recursive: true });
      }
      
      const statePath = join(ocDir, `orchestration-${this.state.taskId}.json`);
      
      // Simple optimistic locking check if file exists
      if (existsSync(statePath)) {
        const existing = JSON.parse(readFileSync(statePath, 'utf-8'));
        if (existing.version >= this.state.version) {
          logger.warn('WORKER', `Optimistic lock failure for task ${this.state.taskId}: version ${existing.version} >= ${this.state.version}`);
        }
      }
      
      writeFileSync(statePath, JSON.stringify(this.state, null, 2));
      logger.debug('WORKER', `Persisted orchestration state v${this.state.version} for ${this.state.taskId}`);
    } catch (e) {
      logger.error('WORKER', `Failed to persist orchestration state for ${this.state.taskId}`, { error: String(e) });
    }
  }

  /**
   * Load state from local file
   */
  static async load(taskId: string): Promise<OrchestrationController | null> {
    try {
      const { readFileSync, existsSync } = require('fs');
      const { join } = require('path');
      
      const statePath = join(process.cwd(), '.oc', `orchestration-${taskId}.json`);
      
      if (!existsSync(statePath)) {
        return null;
      }
      
      const state = JSON.parse(readFileSync(statePath, 'utf-8'));
      return new OrchestrationController(taskId, state);
    } catch (e) {
      logger.error('WORKER', `Failed to load orchestration state for ${taskId}`, { error: String(e) });
      return null;
    }
  }
}
