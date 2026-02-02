/**
 * JSON Repair Utility for LLM outputs.
 * 
 * Responsibility:
 * - Fix common LLM JSON errors (truncated output, missing braces).
 * - Ensure output matches Schema v2.
 * 
 * @module src/integrations/claude-mem/repair
 */

/**
 * Attempt to repair malformed JSON emitted by an LLM.
 *
 * Repairs performed:
 * - Strips fenced ```json code blocks
 * - Appends missing closing braces/brackets for truncated output
 *
 * @param json - Raw JSON (or JSON-in-markdown) string
 * @returns Repaired JSON string (best-effort)
 */
export function repairJson(json: string): string {
  let repaired = json.trim();

  // 1. Remove markdown code blocks if present
  repaired = repaired.replace(/^```json\s*/, '').replace(/```$/, '');

  // 2. Fix truncated JSON (missing closing braces/brackets)
  const stack: string[] = [];
  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop();
      }
    }
  }

  // Append missing closers in reverse order
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}
