/**
 * Deterministic sensitive data scrubbing for @mem-facilitator.
 *
 * Guardrails:
 * - #7: No unbounded regex (all quantifiers are bounded).
 */
export const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,100}/g, // Stripe-like keys
  /Bearer [a-zA-Z0-9]{20,200}/g, // Bearer tokens
  /eyJ[a-zA-Z0-9_-]{100,500}/g, // JWTs
  /\b[a-f0-9]{32}\b/gi, // Hex keys
  /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}\b/g, // Emails
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{3}-\d{3}-\d{4}\b/g, // Phone numbers
];

export function scrubSensitive(text: string): string {
  let scrubbed = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }

  return scrubbed;
}