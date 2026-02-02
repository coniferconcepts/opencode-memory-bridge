/**
 * Importance Scoring System
 *
 * Multi-dimensional scoring for observations to surface high-value content.
 * Scores range 0-100 with four tiers: critical (90+), high (70-89), medium (40-69), low (0-39)
 *
 * Scoring formula:
 * - Type score: 30 points (decision=30, bugfix=25, feature=20, refactor=15, change=12, discovery=10)
 * - Content quality: 30 points (narrative length, facts count, concepts count)
 * - Recency: 20 points (exponential decay over 30 days)
 * - ROI: 10 points (based on discovery tokens spent)
 * - References: 10 points (backward references from other observations)
 * Total: 100 points
 */

export type ObservationType = 'decision' | 'bugfix' | 'feature' | 'refactor' | 'change' | 'discovery';
export type ImportanceTier = 'critical' | 'high' | 'medium' | 'low';

export interface ScoringFactors {
  type_score: number;
  content_quality: number;
  recency: number;
  roi: number;
  references: number;
}

export interface ScoringResult {
  score: number;
  tier: ImportanceTier;
  factors: ScoringFactors;
}

/**
 * Calculate type-based score component (30 points max)
 */
function getTypeScore(type: ObservationType): number {
  const scores: Record<ObservationType, number> = {
    decision: 30,
    bugfix: 25,
    feature: 20,
    refactor: 15,
    change: 12,
    discovery: 10
  };
  return scores[type] || 10;
}

/**
 * Calculate content quality score (30 points max)
 * Based on:
 * - Narrative length (0-10 points)
 * - Facts count (0-10 points)
 * - Concepts count (0-10 points)
 */
function getContentQualityScore(
  narrativeLength: number,
  factsCount: number,
  conceptsCount: number
): number {
  let score = 0;

  // Narrative length scoring
  if (narrativeLength > 500) {
    score += 10;
  } else if (narrativeLength > 200) {
    score += 5;
  } else if (narrativeLength > 50) {
    score += 2;
  }

  // Facts count scoring
  if (factsCount >= 5) {
    score += 10;
  } else if (factsCount >= 3) {
    score += 5;
  } else if (factsCount >= 1) {
    score += 3;
  }

  // Concepts count scoring
  if (conceptsCount >= 8) {
    score += 10;
  } else if (conceptsCount >= 5) {
    score += 5;
  } else if (conceptsCount >= 3) {
    score += 3;
  }

  return Math.min(score, 30); // Cap at 30
}

/**
 * Calculate recency score (20 points max)
 * Uses exponential decay over 30 days
 * score = 20 * exp(-days_old / 30)
 */
function getRecencyScore(createdAtEpoch: number): number {
  const now = Date.now();
  const ageMs = now - createdAtEpoch;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Exponential decay: 20 * e^(-days/30)
  const decayFactor = Math.exp(-ageDays / 30);
  const score = 20 * decayFactor;

  return Math.max(0, Math.min(score, 20));
}

/**
 * Calculate ROI score (10 points max)
 * Based on discovery tokens spent (normalize to 5000 token baseline)
 */
function getRoiScore(discoveryTokens: number = 0): number {
  // Ensure discoveryTokens is never negative
  const tokens = Math.max(0, discoveryTokens);
  const normalizedTokens = Math.min(tokens / 5000, 1.0);
  return 10 * normalizedTokens;
}

/**
 * Calculate references score (10 points max)
 * Based on how many other observations reference this one
 * Cap at 5 references (= 10 points max)
 */
function getReferencesScore(referenceCount: number = 0): number {
  return Math.min(2 * referenceCount, 10);
}

/**
 * Calculate importance score for an observation
 * Returns score (0-100) and tier classification
 */
export function calculateImportanceScore(options: {
  type: ObservationType;
  narrativeLength?: number;
  factsCount?: number;
  conceptsCount?: number;
  createdAtEpoch: number;
  discoveryTokens?: number;
  referenceCount?: number;
}): ScoringResult {
  const {
    type,
    narrativeLength = 0,
    factsCount = 0,
    conceptsCount = 0,
    createdAtEpoch,
    discoveryTokens = 0,
    referenceCount = 0
  } = options;

  const factors: ScoringFactors = {
    type_score: getTypeScore(type),
    content_quality: getContentQualityScore(narrativeLength, factsCount, conceptsCount),
    recency: getRecencyScore(createdAtEpoch),
    roi: getRoiScore(discoveryTokens),
    references: getReferencesScore(referenceCount)
  };

  // Calculate total score
  const score = Math.round(
    factors.type_score +
    factors.content_quality +
    factors.recency +
    factors.roi +
    factors.references
  );

  // Determine tier
  let tier: ImportanceTier;
  if (score >= 90) {
    tier = 'critical';
  } else if (score >= 70) {
    tier = 'high';
  } else if (score >= 40) {
    tier = 'medium';
  } else {
    tier = 'low';
  }

  return {
    score: Math.min(score, 100),
    tier,
    factors
  };
}

/**
 * Batch update importance scores for observations
 * Used during schema migration or periodic recalculation
 */
export function batchCalculateScores(observations: Array<{
  id: string;
  type: ObservationType;
  narrative?: string;
  facts?: unknown[];
  concepts?: unknown[];
  createdAtEpoch: number;
  discoveryTokens?: number;
  referenceCount?: number;
}>): Map<string, ScoringResult> {
  const scores = new Map<string, ScoringResult>();

  for (const obs of observations) {
    const result = calculateImportanceScore({
      type: obs.type,
      narrativeLength: obs.narrative?.length || 0,
      factsCount: Array.isArray(obs.facts) ? obs.facts.length : 0,
      conceptsCount: Array.isArray(obs.concepts) ? obs.concepts.length : 0,
      createdAtEpoch: obs.createdAtEpoch,
      discoveryTokens: obs.discoveryTokens,
      referenceCount: obs.referenceCount
    });
    scores.set(obs.id, result);
  }

  return scores;
}
