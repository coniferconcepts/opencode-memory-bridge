/**
 * LRU cache for claude-mem summaries.
 * 
 * ## Rationale: Performance Optimization
 * 
 * Summarization is expensive (LLM call). Caching avoids redundant
 * calls for frequently accessed content.
 * 
 * @module src/integrations/claude-mem/cache
 */

import { SUMMARY_CACHE_SIZE, SUMMARY_CACHE_TTL_MS } from './constants.js';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Simple LRU cache implementation.
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number = SUMMARY_CACHE_SIZE, ttlMs: number = SUMMARY_CACHE_TTL_MS) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get a value from the cache.
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache.
   */
  set(key: K, value: V): void {
    // Delete if exists (to update position)
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Singleton cache for summaries
 */
export const summaryCache = new LRUCache<string, string>();

/**
 * Generate a cache key for a summary request.
 */
export function summaryCacheKey(
  content: string,
  options?: { maxLength?: number }
): string {
  // Use content hash + options as key
  const hash = simpleHash(content);
  const optionsStr = options ? JSON.stringify(options) : '';
  return `${hash}:${optionsStr}`;
}

/**
 * Simple string hash function.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
