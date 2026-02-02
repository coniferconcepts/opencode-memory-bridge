import { describe, it, expect } from 'bun:test';
import { filterImperative } from '../algorithms/deontic-filter';

describe('deontic filtering', () => {
  it('replaces imperative keywords and records matches', () => {
    const text = 'We MUST follow this and should not ignore it.';
    const result = filterImperative(text);

    expect(result.hasImperative).toBe(true);
    expect(result.originalTerms).toEqual(['MUST', 'should not']);
    expect(result.filtered).toBe(
      'We [historical:must] follow this and [historical:should not] ignore it.'
    );
  });

  it('leaves non-imperative text unchanged', () => {
    const text = 'This mustard recipe is great.';
    const result = filterImperative(text);

    expect(result.hasImperative).toBe(false);
    expect(result.originalTerms).toEqual([]);
    expect(result.filtered).toBe(text);
  });

  it('handles adversarial spacing and casing', () => {
    const text = 'You MUST\nNOT do that and DO\tNOT repeat it.';
    const result = filterImperative(text);

    expect(result.hasImperative).toBe(true);
    expect(result.filtered).toContain('[historical:must\nnot]');
    expect(result.filtered).toContain('[historical:do\tnot]');
  });

  it('does not match substrings (adversarial false positives)', () => {
    const text = 'shoulder exercises and mustard are unrelated.';
    const result = filterImperative(text);

    expect(result.hasImperative).toBe(false);
    expect(result.filtered).toBe(text);
  });
});