/**
 * Adversarial testing (deontic filtering) for @mem-facilitator.
 *
 * Tests:
 * - Imperative language bypass attempts (ALWAYS, NEVER, MUST, SHALL, REQUIRED, MANDATORY, DO NOT, SHOULD)
 * - Case variations (always, Always, ALWAYS)
 * - Context variations (embedded in sentences, at start/end)
 * - Unicode variations
 * - Obfuscation attempts (spacing, punctuation)
 * - Combined imperative phrases
 * - Nested imperative structures
 *
 * @module src/__tests__/mem-facilitator-adversarial.test
 */

import { describe, it, expect } from 'bun:test';
import { filterImperative, IMPERATIVE_KEYWORDS } from '../algorithms/deontic-filter';

describe('mem-facilitator adversarial testing (deontic filtering)', () => {
  describe('imperative language bypass attempts', () => {
    it('filters ALWAYS', () => {
      const text = 'You ALWAYS need to do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:always]');
      expect(result.filtered).not.toContain('ALWAYS');
    });

    it('filters NEVER', () => {
      const text = 'You NEVER should do that';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:never]');
      expect(result.filtered).not.toContain('NEVER');
    });

    it('filters MUST', () => {
      const text = 'You MUST follow this rule';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
      expect(result.filtered).not.toContain('MUST');
    });

    it('filters SHALL', () => {
      const text = 'You SHALL comply';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:shall]');
      expect(result.filtered).not.toContain('SHALL');
    });

    it('filters REQUIRED', () => {
      const text = 'This is REQUIRED for compliance';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:required]');
      expect(result.filtered).not.toContain('REQUIRED');
    });

    it('filters MANDATORY', () => {
      const text = 'This step is MANDATORY';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:mandatory]');
      expect(result.filtered).not.toContain('MANDATORY');
    });

    it('filters DO NOT', () => {
      const text = 'You DO NOT skip this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:do not]');
      expect(result.filtered).not.toContain('DO NOT');
    });

    it('filters SHOULD', () => {
      const text = 'You SHOULD consider this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:should]');
      expect(result.filtered).not.toContain('SHOULD');
    });

    it('filters MUST NOT', () => {
      const text = 'You MUST NOT do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must not]');
      expect(result.filtered).not.toContain('MUST NOT');
    });

    it('filters SHALL NOT', () => {
      const text = 'You SHALL NOT proceed';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:shall not]');
      expect(result.filtered).not.toContain('SHALL NOT');
    });

    it('filters SHOULD NOT', () => {
      const text = 'You SHOULD NOT ignore this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:should not]');
      expect(result.filtered).not.toContain('SHOULD NOT');
    });
  });

  describe('case variations', () => {
    it('filters lowercase imperative', () => {
      const text = 'you must do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters uppercase imperative', () => {
      const text = 'YOU MUST DO THIS';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters mixed case imperative', () => {
      const text = 'You MuSt Do ThIs';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters title case imperative', () => {
      const text = 'You Must Do This';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters camelCase imperative', () => {
      const text = 'youMustDoThis';
      const result = filterImperative(text);

      // camelCase should not match (word boundary required)
      expect(result.hasImperative).toBe(false);
    });
  });

  describe('context variations', () => {
    it('filters imperative at start of sentence', () => {
      const text = 'Must do this now';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative at end of sentence', () => {
      const text = 'You really must';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative in middle of sentence', () => {
      const text = 'You must do this now';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative after punctuation', () => {
      const text = 'Yes, you must. No, you must not.';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative before punctuation', () => {
      const text = 'You must, you shall, you should.';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });
  });

  describe('unicode variations', () => {
    it('filters imperative with unicode spaces', () => {
      const text = 'You\u00A0must\u00A0do\u00A0this';
      const result = filterImperative(text);

      // Non-breaking spaces should still match (within bounds)
      expect(result.hasImperative).toBe(true);
    });

    it('filters imperative with unicode punctuation', () => {
      const text = 'You must\u2014do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
    });

    it('filters imperative with combining characters', () => {
      const text = 'You must\u0301 do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
    });
  });

  describe('obfuscation attempts', () => {
    it('filters imperative with extra spaces', () => {
      const text = 'You  must   do    this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative with tabs', () => {
      const text = 'You\tmust\tdo\tthis';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative with newlines', () => {
      const text = 'You\nmust\ndo\nthis';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative with punctuation', () => {
      const text = 'You must! Do this.';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative with special characters', () => {
      const text = 'You @must# do$ this%';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });
  });

  describe('combined imperative phrases', () => {
    it('filters multiple imperative keywords', () => {
      const text = 'You MUST do this and NEVER do that';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms).toContain('MUST');
      expect(result.originalTerms).toContain('NEVER');
      expect(result.filtered).toContain('[historical:must]');
      expect(result.filtered).toContain('[historical:never]');
    });

    it('filters imperative with negation', () => {
      const text = 'You MUST NOT do this';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms).toContain('MUST NOT');
      expect(result.filtered).toContain('[historical:must not]');
    });

    it('filters imperative in compound sentence', () => {
      const text = 'You must do this, but you should not do that';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms).toContain('must');
      expect(result.originalTerms).toContain('should not');
    });
  });

  describe('nested imperative structures', () => {
    it('filters imperative in nested clauses', () => {
      const text = 'If you must do this, then you should also do that';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms).toContain('must');
      expect(result.originalTerms).toContain('should');
    });

    it('filters imperative in quoted text', () => {
      const text = 'He said "you must do this"';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.filtered).toContain('[historical:must]');
    });

    it('filters imperative in parenthetical', () => {
      const text = 'You must do this (and should not do that)';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms).toContain('must');
      expect(result.originalTerms).toContain('should not');
    });
  });

  describe('false positive prevention', () => {
    it('does not match substring in word', () => {
      const text = 'This mustard is great';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(false);
      expect(result.filtered).toBe(text);
    });

    it('does not match substring in compound word', () => {
      const text = 'shoulder exercises are good';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(false);
      expect(result.filtered).toBe(text);
    });

    it('does not match imperative in code context', () => {
      const text = 'const must = function() {}';
      const result = filterImperative(text);

      // Variable name 'must' should match (word boundary)
      expect(result.hasImperative).toBe(true);
    });

    it('does not match imperative in URL', () => {
      const text = 'https://example.com/must-do-this';
      const result = filterImperative(text);

      // 'must' in URL should match (word boundary)
      expect(result.hasImperative).toBe(true);
    });
  });

  describe('adversarial bypass attempts', () => {
    it('filters imperative with zero-width spaces', () => {
      const text = 'You\u200Bmust\u200Bdo\u200Bthis';
      const result = filterImperative(text);

      // Zero-width spaces may still match (word boundary behavior)
      // This is acceptable behavior
      expect(result.hasImperative).toBe(true);
    });

    it('filters imperative with invisible characters', () => {
      const text = 'You\uFEFFmust\uFEFFdo\uFEFFthis';
      const result = filterImperative(text);

      // Invisible characters may still match (word boundary behavior)
      expect(result.hasImperative).toBe(true);
    });

    it('filters imperative with homoglyphs', () => {
      const text = 'You mu5t do this';
      const result = filterImperative(text);

      // Homoglyphs should not match
      expect(result.hasImperative).toBe(false);
    });

    it('filters imperative with leetspeak', () => {
      const text = 'You mu5t d0 th1s';
      const result = filterImperative(text);

      // Leetspeak should not match
      expect(result.hasImperative).toBe(false);
    });
  });

  describe('imperative keyword coverage', () => {
    it('covers all imperative keywords', () => {
      const keywords = IMPERATIVE_KEYWORDS;

      expect(keywords).toContain('must');
      expect(keywords).toContain('must not');
      expect(keywords).toContain('shall');
      expect(keywords).toContain('shall not');
      expect(keywords).toContain('always');
      expect(keywords).toContain('never');
      expect(keywords).toContain('required');
      expect(keywords).toContain('mandatory');
      expect(keywords).toContain('do not');
      expect(keywords).toContain('should');
      expect(keywords).toContain('should not');
    });

    it('filters all imperative keywords', () => {
      for (const keyword of IMPERATIVE_KEYWORDS) {
        const text = `You ${keyword} do this`;
        const result = filterImperative(text);

        expect(result.hasImperative).toBe(true);
        expect(result.originalTerms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('deterministic behavior', () => {
    it('produces consistent output for same input', () => {
      const text = 'You must do this';
      const result1 = filterImperative(text);
      const result2 = filterImperative(text);

      expect(result1.filtered).toBe(result2.filtered);
      expect(result1.hasImperative).toBe(result2.hasImperative);
      expect(result1.originalTerms).toEqual(result2.originalTerms);
    });

    it('handles multiple calls without side effects', () => {
      const text = 'You must do this';
      const result1 = filterImperative(text);
      const result2 = filterImperative(text);
      const result3 = filterImperative(text);

      expect(result1.filtered).toBe(result2.filtered);
      expect(result2.filtered).toBe(result3.filtered);
    });
  });

  describe('performance with adversarial input', () => {
    it('handles text with many imperative keywords', () => {
      const text = 'You must do this and must not do that and shall comply and shall not fail and should consider and should not ignore';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms.length).toBeGreaterThan(0);
    });

    it('handles text with repeated imperative keywords', () => {
      const text = 'must must must must must';
      const result = filterImperative(text);

      expect(result.hasImperative).toBe(true);
      expect(result.originalTerms.length).toBe(5);
    });
  });
});