/**
 * Deterministic deontic (imperative) filtering for @mem-facilitator.
 *
 * Guardrails:
 * - #7: No unbounded regex (all quantifiers are bounded).
 */
export const IMPERATIVE_KEYWORDS = [
  'must',
  'must not',
  'shall',
  'shall not',
  'always',
  'never',
  'required',
  'mandatory',
  'do not',
  'should',
  'should not',
];

// NOTE: Order matters (longer phrases first) to avoid partial matches.
// SECURITY: Bounded whitespace quantifier to satisfy Guardrail #7.
export const IMPERATIVE_REGEX =
  /\b(?:must\s{1,3}not|shall\s{1,3}not|should\s{1,3}not|do\s{1,3}not|must|shall|should|always|never|required|mandatory)\b/gi;

export function filterImperative(text: string): {
  filtered: string;
  hasImperative: boolean;
  originalTerms: string[];
} {
  const matches: string[] = [];
  const filtered = text.replace(IMPERATIVE_REGEX, (match) => {
    matches.push(match);
    return `[historical:${match.toLowerCase()}]`;
  });

  return {
    filtered,
    hasImperative: matches.length > 0,
    originalTerms: matches,
  };
}