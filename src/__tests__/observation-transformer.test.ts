import { describe, it, expect } from 'bun:test';
import {
  transformObservation,
  transformToMemFacilitatorFormat,
  hasValidContent,
  filterValidObservations,
} from '../integration/observation-transformer';
import type { MemoryObservation } from '../schemas';

describe('observation-transformer', () => {
  const mockObservation: MemoryObservation = {
    id: 123,
    memory_session_id: 'session-456',
    project: 'content-tracker',
    type: 'decision',
    title: 'Retry Logic Decision',
    subtitle: 'Queue processing',
    narrative: 'Decided to use exponential backoff with max 3 retries.',
    text: null,
    facts: '["exponential backoff", "max 3 retries"]',
    concepts: '["queue", "retry"]',
    files_read: null,
    files_modified: null,
    prompt_number: 5,
    created_at: '2026-01-26T10:00:00Z',
    created_at_epoch: 1737885600000,
  };

  describe('transformObservation', () => {
    it('maps narrative to content', () => {
      const result = transformObservation(mockObservation);
      expect(result.content).toBe('Decided to use exponential backoff with max 3 retries.');
    });

    it('falls back to text when narrative is null', () => {
      const obs = { ...mockObservation, narrative: null, text: 'Text content' };
      const result = transformObservation(obs);
      expect(result.content).toBe('Text content');
    });

    it('falls back to title when narrative and text are null', () => {
      const obs = { ...mockObservation, narrative: null, text: null };
      const result = transformObservation(obs);
      expect(result.content).toBe('Retry Logic Decision');
    });

    it('maps created_at_epoch to timestamp', () => {
      const result = transformObservation(mockObservation);
      expect(result.timestamp).toBe(1737885600000);
    });

    it('parses JSON facts', () => {
      const result = transformObservation(mockObservation);
      expect(result.metadata.facts).toEqual(['exponential backoff', 'max 3 retries']);
    });

    it('handles invalid JSON gracefully', () => {
      const obs = { ...mockObservation, facts: 'not json' };
      const result = transformObservation(obs);
      expect(result.metadata.facts).toBe('not json');
    });
  });

  describe('transformToMemFacilitatorFormat', () => {
    it('transforms array of observations', () => {
      const results = transformToMemFacilitatorFormat([mockObservation, mockObservation]);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(123);
    });
  });

  describe('hasValidContent', () => {
    it('returns true when narrative exists', () => {
      expect(hasValidContent(mockObservation)).toBe(true);
    });

    it('returns false when all content fields are null/empty', () => {
      const obs = { ...mockObservation, narrative: null, text: null, title: '' };
      expect(hasValidContent(obs)).toBe(false);
    });
  });

  describe('filterValidObservations', () => {
    it('filters out observations without content', () => {
      const invalid = { ...mockObservation, narrative: null, text: null, title: '' };
      const results = filterValidObservations([mockObservation, invalid]);
      expect(results).toHaveLength(1);
    });
  });
});