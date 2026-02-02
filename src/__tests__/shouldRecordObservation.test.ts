import { describe, test, expect, beforeEach } from 'bun:test';
import {
  shouldRecordObservation,
  resetFilteredObservationCount,
  getFilteredObservationCount,
  SKIP_TITLE_PATTERNS,
  ALWAYS_RECORD_TOOLS,
  ALWAYS_RECORD_TYPES,
  MIN_NARRATIVE_LENGTH,
} from '../constants.js';

describe('shouldRecordObservation', () => {
  beforeEach(() => {
    resetFilteredObservationCount();
  });

  describe('ALWAYS_RECORD_TOOLS', () => {
    test('always records user_prompt regardless of other factors', () => {
      expect(shouldRecordObservation('user_prompt', 'Prompt: fix the bug', 'User requested...', 'discovery')).toBe(true);
      expect(shouldRecordObservation('user_prompt', 'Short', 'x', 'discovery')).toBe(true); // Short narrative OK
      expect(shouldRecordObservation('user_prompt', 'Read: package.json', '', 'discovery')).toBe(true); // Skip pattern title OK
    });

    test('always records command tool', () => {
      expect(shouldRecordObservation('command', 'Command: /commit', 'User ran commit', 'discovery')).toBe(true);
    });

    test('always records session_summary tool', () => {
      expect(shouldRecordObservation('session_summary', 'Session Summary', 'x', 'summary')).toBe(true);
    });
  });

  describe('ALWAYS_RECORD_TYPES', () => {
    test('always records decision type', () => {
      const longNarrative = 'We decided to use a microservices architecture because it provides better scalability and allows teams to work independently on different services.';
      expect(shouldRecordObservation('task', 'Architecture Decision', longNarrative, 'decision')).toBe(true);
    });

    test('always records bugfix type even with short narrative', () => {
      expect(shouldRecordObservation('edit', 'Bug: null check', 'Fixed NPE', 'bugfix')).toBe(true);
    });

    test('always records feature type', () => {
      const longNarrative = 'Implemented JWT auth with refresh tokens and secure storage to provide better security for user sessions.';
      expect(shouldRecordObservation('edit', 'Added authentication', longNarrative, 'feature')).toBe(true);
    });
  });

  describe('SKIP_TITLE_PATTERNS', () => {
    test('skips read: prefixed titles', () => {
      expect(shouldRecordObservation('read', 'Read: package.json', 'Read file contents', 'discovery')).toBe(false);
      expect(getFilteredObservationCount()).toBe(1);
    });

    test('skips grep: prefixed titles', () => {
      expect(shouldRecordObservation('grep', 'Grep: TODO', 'Searched for TODOs', 'discovery')).toBe(false);
    });

    test('skips bash: prefixed titles', () => {
      expect(shouldRecordObservation('bash', 'Bash: git status', 'Checked repo status', 'discovery')).toBe(false);
    });

    test('skips glob: prefixed titles', () => {
      expect(shouldRecordObservation('glob', 'Glob: **/*.ts', 'Found TypeScript files', 'discovery')).toBe(false);
    });

    test('skips write: prefixed titles', () => {
      expect(shouldRecordObservation('write', 'Write: config.ts', 'Added configuration file', 'discovery')).toBe(false);
    });

    test('skips edit: prefixed titles', () => {
      expect(shouldRecordObservation('edit', 'Edit: config.ts', 'Modified configuration', 'discovery')).toBe(false);
    });

    test('skips Untitled ( fallback titles', () => {
      expect(shouldRecordObservation('unknown', 'Untitled (unknown)', 'Did something', 'discovery')).toBe(false);
    });

    test('pattern matching is case-insensitive', () => {
      expect(shouldRecordObservation('read', 'READ: package.json', 'Read file', 'discovery')).toBe(false);
      expect(shouldRecordObservation('grep', 'GREP: pattern', 'Searched', 'discovery')).toBe(false);
    });
  });

  describe('MIN_NARRATIVE_LENGTH', () => {
    test('skips observations with empty narrative', () => {
      expect(shouldRecordObservation('task', 'Some Task', '', 'discovery')).toBe(false);
    });

    test('skips observations with narrative shorter than MIN_NARRATIVE_LENGTH', () => {
      const shortNarrative = 'x'.repeat(MIN_NARRATIVE_LENGTH - 1);
      expect(shouldRecordObservation('task', 'Some Task', shortNarrative, 'discovery')).toBe(false);
    });

    test('records observations with narrative at MIN_NARRATIVE_LENGTH', () => {
      const exactNarrative = 'x'.repeat(MIN_NARRATIVE_LENGTH);
      expect(shouldRecordObservation('task', 'Some Task', exactNarrative, 'discovery')).toBe(true);
    });

    test('records observations with narrative longer than MIN_NARRATIVE_LENGTH', () => {
      const longNarrative = 'x'.repeat(MIN_NARRATIVE_LENGTH + 50);
      expect(shouldRecordObservation('task', 'Some Task', longNarrative, 'discovery')).toBe(true);
    });

    test('trims whitespace when checking narrative length', () => {
      const paddedNarrative = '   ' + 'x'.repeat(MIN_NARRATIVE_LENGTH - 10) + '   ';
      expect(shouldRecordObservation('task', 'Some Task', paddedNarrative, 'discovery')).toBe(false);
    });
  });

  describe('filter counter', () => {
    test('increments counter when filtering by title pattern', () => {
      expect(getFilteredObservationCount()).toBe(0);
      shouldRecordObservation('read', 'Read: file.ts', 'Short', 'discovery');
      expect(getFilteredObservationCount()).toBe(1);
      shouldRecordObservation('grep', 'Grep: pattern', 'Short', 'discovery');
      expect(getFilteredObservationCount()).toBe(2);
    });

    test('increments counter when filtering by narrative length', () => {
      expect(getFilteredObservationCount()).toBe(0);
      shouldRecordObservation('task', 'Good Title', 'Too short', 'discovery');
      expect(getFilteredObservationCount()).toBe(1);
    });

    test('does not increment counter for recorded observations', () => {
      expect(getFilteredObservationCount()).toBe(0);
      const longNarrative = 'x'.repeat(MIN_NARRATIVE_LENGTH + 10);
      shouldRecordObservation('task', 'Good Title', longNarrative, 'discovery');
      expect(getFilteredObservationCount()).toBe(0);
    });

    test('resets counter correctly', () => {
      shouldRecordObservation('read', 'Read: file.ts', 'Short', 'discovery');
      expect(getFilteredObservationCount()).toBe(1);
      resetFilteredObservationCount();
      expect(getFilteredObservationCount()).toBe(0);
    });
  });

  describe('integration test cases from plan', () => {
    test('Read: package.json with short narrative - SKIP', () => {
      expect(shouldRecordObservation('read', 'Read: package.json', 'Read file contents', 'discovery')).toBe(false);
    });

    test('Bash: git status with short narrative - SKIP', () => {
      expect(shouldRecordObservation('bash', 'Bash: git status', 'Checked repo status', 'discovery')).toBe(false);
    });

    test('user_prompt - ALWAYS RECORD', () => {
      expect(shouldRecordObservation('user_prompt', 'Prompt: fix the bug', 'User requested...', 'discovery')).toBe(true);
    });

    test('command - ALWAYS RECORD', () => {
      expect(shouldRecordObservation('command', 'Command: /commit', 'User ran commit', 'discovery')).toBe(true);
    });

    test('feature type with long narrative - RECORD', () => {
      const longNarrative = 'Implemented JWT auth with refresh tokens and secure storage to provide better security for user sessions and prevent unauthorized access.';
      expect(shouldRecordObservation('edit', 'Added authentication', longNarrative, 'feature')).toBe(true);
    });

    test('bugfix type - RECORD regardless of narrative', () => {
      expect(shouldRecordObservation('edit', 'Bug: null check', 'Fixed NPE', 'bugfix')).toBe(true);
    });

    test('decision type with long narrative - RECORD', () => {
      const longNarrative = 'We decided to use a microservices architecture because it provides better scalability, allows independent deployment, and enables teams to work in parallel.';
      expect(shouldRecordObservation('task', 'Architecture Decision', longNarrative, 'decision')).toBe(true);
    });

    test('Grep: TODO with short narrative - SKIP', () => {
      expect(shouldRecordObservation('grep', 'Grep: TODO', 'Searched for TODOs', 'discovery')).toBe(false);
    });

    test('Write: config.ts with short narrative - SKIP', () => {
      expect(shouldRecordObservation('write', 'Write: config.ts', 'Added configuration file', 'discovery')).toBe(false);
    });

    test('write with feature type and long narrative - RECORD', () => {
      const longNarrative = 'Implemented the authentication module with JWT tokens, refresh handling, and secure session management to protect user accounts.';
      expect(shouldRecordObservation('write', 'Created auth module', longNarrative, 'feature')).toBe(true);
    });
  });
});
