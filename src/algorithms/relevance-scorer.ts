/**
 * Deterministic relevance scoring for @mem-facilitator.
 *
 * Guardrails:
 * - #7: No unbounded regex (all quantifiers are bounded).
 */
export interface Observation {
  id: number;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface RelevanceScore {
  memId: number;
  score: number;
  timestamp: number;
}

export interface RelevanceOptions {
  now?: number;
}

const TOKEN_REGEX = /[a-z0-9]{1,64}/gi;

function normalize(text: string): string {
  if (!text) return '';
  const replaced = text.toLowerCase().replace(/\s/g, ' ');
  return replaced.replace(/ {2,200}/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text).match(TOKEN_REGEX) ?? [];
}

function uniqueTokens(tokens: string[], max = 200): Set<string> {
  const set = new Set<string>();
  for (const token of tokens) {
    set.add(token);
    if (set.size >= max) break;
  }
  return set;
}

export function semanticSimilarity(content: string, query: string): number {
  const contentSet = uniqueTokens(tokenize(content), 200);
  const querySet = uniqueTokens(tokenize(query), 50);
  if (contentSet.size === 0 || querySet.size === 0) return 0;

  let intersection = 0;
  for (const token of querySet) {
    if (contentSet.has(token)) intersection++;
  }

  const union = new Set([...contentSet, ...querySet]).size;
  return union === 0 ? 0 : intersection / union;
}

export function keywordDensity(content: string, query: string): number {
  const contentTokens = tokenize(content).slice(0, 500);
  const queryTokens = Array.from(uniqueTokens(tokenize(query), 50));
  if (contentTokens.length === 0 || queryTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  let matches = 0;
  for (const token of contentTokens) {
    if (querySet.has(token)) matches++;
  }

  return Math.min(1, matches / contentTokens.length);
}

export function typeRelevance(type: string, parentGoals: string[]): number {
  if (!parentGoals || parentGoals.length === 0) return 0;

  const normalizedType = normalize(type);
  const typeTokens = uniqueTokens(tokenize(normalizedType), 20);

  for (const goal of parentGoals) {
    const normalizedGoal = normalize(goal);
    if (normalizedGoal.includes(normalizedType)) return 1;
    const goalTokens = uniqueTokens(tokenize(normalizedGoal), 20);
    for (const token of goalTokens) {
      if (typeTokens.has(token)) return 0.5;
    }
  }

  return 0;
}

export function recencyBonus(timestamp: number, now: number): number {
  const ageMs = Math.max(0, now - timestamp);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decay = Math.exp(-ageDays / 30);
  return Math.max(0, Math.min(1, decay));
}

export function sessionContextMatch(
  obs: Observation,
  parentGoals: string[],
): number {
  if (!obs.metadata || !parentGoals || parentGoals.length === 0) return 0;

  const contextKeys = new Set(['session_id', 'session', 'context', 'project', 'topic', 'tag']);
  const contextValues: string[] = [];

  for (const [key, value] of Object.entries(obs.metadata)) {
    if (!contextKeys.has(key)) continue;
    if (typeof value === 'string' && value.length > 0) {
      contextValues.push(normalize(value));
    }
  }

  if (contextValues.length === 0) return 0;

  for (const goal of parentGoals) {
    const normalizedGoal = normalize(goal);
    for (const ctx of contextValues) {
      if (normalizedGoal.includes(ctx)) return 1;
      const ctxTokens = uniqueTokens(tokenize(ctx), 20);
      const goalTokens = uniqueTokens(tokenize(normalizedGoal), 20);
      for (const token of goalTokens) {
        if (ctxTokens.has(token)) return 0.5;
      }
    }
  }

  return 0;
}

export function calculateScore(
  obs: Observation,
  query: string,
  parentGoals: string[],
  options: RelevanceOptions = {},
): number {
  const now = options.now ?? Date.now();
  let score = 0;

  // Scoring weights rationale:
  // - Semantic similarity (40%): Primary relevance signal
  // - Type relevance (20%): Observation type alignment with goals
  // - Recency bonus (15%): Prefer recent observations
  // - Session context (15%): Same session/project context
  // - Keyword density (10%): Secondary relevance signal

  // Semantic similarity (40%)
  score += semanticSimilarity(obs.content, query) * 40;

  // Type relevance (20%)
  score += typeRelevance(obs.type, parentGoals) * 20;

  // Recency bonus (15%)
  score += recencyBonus(obs.timestamp, now) * 15;

  // Session context match (15%)
  score += sessionContextMatch(obs, parentGoals) * 15;

  // Keyword density (10%)
  score += keywordDensity(obs.content, query) * 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function scoreRelevance(
  observations: Observation[],
  query: string,
  parentGoals: string[],
  options: RelevanceOptions = {},
): RelevanceScore[] {
  return observations
    .map((obs) => ({
      memId: obs.id,
      score: calculateScore(obs, query, parentGoals, options),
      timestamp: obs.timestamp,
    }))
    .sort((a, b) => {
      // Primary: score desc
      if (b.score !== a.score) return b.score - a.score;
      // Secondary: recency desc
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      // Tertiary: memId desc
      return b.memId - a.memId;
    });
}