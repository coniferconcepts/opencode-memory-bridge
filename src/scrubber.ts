/**
 * Secret scrubber for tool events.
 * 
 * Responsibility:
 * - Redact sensitive patterns (API keys, JWTs, tokens) from tool inputs and outputs.
 * - Prevent leakage of PII into permanent memory.
 * 
 * @module src/integrations/claude-mem/scrubber
 */

/**
 * Common secret patterns to redact.
 */
const SECRET_PATTERNS = [
  // API Keys & Tokens (keyword-based)
  /(?:key|api|token|secret|password|auth|authorization|credential|pwd|pass|access_token|refresh_token|sid|session_id|jwt|bearer|ghp_|sk-|AIza|xox[p|b|o|r]-|sq0csp-|sq0atp-|amzn\.mws\.|SG\.)\s*[:=]\s*["']?([a-zA-Z0-9\-._~+/]{8,})["']?/gi,
  // Standalone API Keys (prefix-based)
  /\b(sk-[a-zA-Z0-9]{15,})\b/g,
  /\b(ghp_[a-zA-Z0-9]{30,})\b/g,
  // Telegram Bot Token (CRITICAL)
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  // Cloudflare API Token (HIGH)
  // NOTE: A bare 40-char base64url string is far too broad and causes false positives.
  // We only match Cloudflare-like tokens when they appear in a Cloudflare-ish context.
  /(?:cloudflare|cf)[\w\s-]{0,20}(?:api[\w\s-]{0,10})?(?:token|key)\s*[:=]\s*["']?([A-Za-z0-9_-]{40})["']?/gi,
  /\bCF-Api-Token:\s*([A-Za-z0-9_-]{40})\b/gi,
  // Anthropic API Key (HIGH)
  /\bsk-ant-[a-zA-Z0-9-]{90,}\b/g,
  // Google Service Account (JSON key_id)
  /"private_key_id":\s*"[^"]+"/g,
  // Authorization Headers
  /Authorization:\s*(?:Bearer|Basic)\s+([a-zA-Z0-9\-._~+/]{8,})/gi,
  // Cookies
  /Cookie:\s*([^;]+)/gi,
  // .env file contents
  /^[A-Z0-9_]+\s*=\s*(.+)$/gm,
  // AWS Access Keys (CRITICAL)
  /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g,
  // Private Keys (CRITICAL)
  /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP|ENCRYPTED)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA|DSA|EC|OPENSSH|PGP|ENCRYPTED)?\s*PRIVATE KEY-----/g,
  // JWT Tokens (CRITICAL)
  /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  // Password in URL (CRITICAL)
  /[a-zA-Z]{3,10}:\/\/[^\s:@]+:[^\s:@]+@/gi,
  // Stripe Keys (HIGH)
  /\b(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}\b/g,
  // Twilio (HIGH)
  /\b(?:SK|AC)[0-9a-fA-F]{32}\b/g,
  // Slack Webhook URLs (HIGH)
  /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8,}\/B[a-zA-Z0-9_]{8,}\/[a-zA-Z0-9_]{24,}/g,
  // Generic hex/base64 strings that look like keys (min 32 chars)
  /\b[a-f0-9]{32,}\b/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

/**
 * Redaction placeholder.
 */
const REDACTION_MARKER = '<REDACTED:SECRET>';

/**
 * Strip <private>...</private> blocks entirely.
 *
 * This is an explicit opt-out mechanism for content that should never be
 * persisted into memory, even in redacted form.
 */
/**
 * Remove `<private>...</private>` blocks entirely.
 *
 * This is an explicit opt-out mechanism for content that must never be persisted,
 * even in redacted form.
 *
 * @param content - Raw tool output/input
 * @returns Content with private blocks removed
 */
export function stripPrivateTags(content: string): string {
  if (!content) return content;
  return content.replace(/<private>[\s\S]*?<\/private>/gi, '');
}

/**
 * Scrub secrets from a string.
 * 
 * @param content - The content to scrub
 * @returns Scrubbed content
 */
export function scrubSecrets(content: string): string {
  if (!content) return content;

  // Remove explicit private blocks first (never persist)
  let scrubbed = stripPrivateTags(content);

  for (const pattern of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, (match, ...args) => {
      // If there are capturing groups, we might want to redact only specific ones.
      // But for simplicity and safety, if it's a standalone key or a block, redact the whole thing.
      // If it's a keyword-based pattern (has groups), we redact the first group (the value).

      // The last two args are offset and string, so groups are args[0...n-2]
      const groups = args.slice(0, -2);
      if (groups.length > 0 && groups[0] !== undefined) {
        // Special case: if the match is a large block (like private key), redact the whole thing
        if (match.includes('-----BEGIN')) {
          return REDACTION_MARKER;
        }
        // Otherwise redact the first capturing group (the secret value)
        return match.replace(groups[0], REDACTION_MARKER);
      }
      return REDACTION_MARKER;
    });
  }

  return scrubbed;
}

const MAX_DEPTH = 50;

/**
 * Scrub secrets from a JSON object or string.
 * 
 * @param data - The data to scrub (string or object)
 * @param depth - Current recursion depth (internal use)
 * @param seen - Set of seen objects for circular reference detection (internal use)
 * @returns Scrubbed data (same type as input)
 * 
 * @example
 * const clean = scrubData({ api_key: 'sk-123', message: 'hello' });
 * // { api_key: '<REDACTED:SENSITIVE_KEY>', message: 'hello' }
 */
export function scrubData<T>(data: T, depth = 0, seen = new WeakSet<any>()): T {
  if (depth > MAX_DEPTH) {
    return '<REDACTED:MAX_DEPTH>' as unknown as T;
  }

  if (typeof data === 'string') {
    // scrubSecrets() also strips <private> tags
    return scrubSecrets(data) as unknown as T;
  }

  if (typeof data === 'object' && data !== null) {
    if (seen.has(data)) {
      return '<REDACTED:CIRCULAR>' as unknown as T;
    }
    seen.add(data);

    const scrubbed: any = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        scrubbed[key] = '<REDACTED:SENSITIVE_KEY>';
      } else {
        scrubbed[key] = scrubData(value, depth + 1, seen);
      }
    }
    return scrubbed as T;
  }

  return data;
}

/**
 * Check if a key name is sensitive.
 */
function isSensitiveKey(key: string): boolean {
  const sensitiveKeys = /^(password|passwd|pwd|secret|token|api_?key|auth|credential|private_?key|access_?key|secret_?key)$/i;
  return sensitiveKeys.test(key);
}

/**
 * Additional patterns for multi-project context.
 */
const ADDITIONAL_PATTERNS = [
  // Absolute paths (privacy)
  /\/Users\/[a-zA-Z0-9_-]+\//g,
  /\/home\/[a-zA-Z0-9_-]+\//g,
  /C:\\Users\\[a-zA-Z0-9_-]+\\/gi,
  
  // IP addresses (internal)
  /\b(?:192\.168|10\.|172\.(?:1[6-9]|2[0-9]|3[01]))\.\d{1,3}\.\d{1,3}\b/g,
  
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

/**
 * Scrub absolute paths to relative paths.
 * Preserves project-relative paths while removing user directories.
 * 
 * @param content - The content to scrub
 * @param projectRoot - The absolute path to the project root
 * @returns Content with absolute paths scrubbed
 */
export function scrubPaths(content: string, projectRoot: string): string {
  if (!content) return content;

  // Replace absolute project paths with relative
  const escaped = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const projectPattern = new RegExp(escaped + '/?', 'g');
  let result = content.replace(projectPattern, './');
  
  // Scrub other absolute paths
  for (const pattern of ADDITIONAL_PATTERNS) {
    result = result.replace(pattern, '<REDACTED>');
  }
  
  return result;
}
