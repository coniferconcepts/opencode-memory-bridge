#!/usr/bin/env node
/**
 * Intelligent Routing System
 * 
 * This script implements the dynamic registry filtering and routing
 * for the OpenCode agent system.
 * 
 * Usage: node router.js "user request" [options]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  metadataPath: process.env.AGENT_METADATA || path.join(__dirname, '../config/agent-metadata.json'),
  cachePath: process.env.ROUTING_CACHE || path.join(__dirname, '../.cache/routing-cache.json'),
  statsPath: process.env.ROUTING_STATS || path.join(__dirname, '../.cache/routing-stats.json'),
  maxAgents: parseInt(process.env.MAX_AGENTS) || 5,
  confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.70,
  cacheTTL: parseInt(process.env.CACHE_TTL) || 300, // seconds
};

// Cache management
class RoutingCache {
  constructor(cachePath) {
    this.cachePath = cachePath;
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        return JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading cache:', e.message);
    }
    return {};
  }

  saveCache() {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      console.error('Error saving cache:', e.message);
    }
  }

  generateKey(request, context = {}) {
    const data = JSON.stringify({ request, tech: context.techStack });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  get(request, context) {
    const key = this.generateKey(request, context);
    const cached = this.cache[key];
    
    if (!cached) return null;
    
    // Check TTL
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > CONFIG.cacheTTL) {
      delete this.cache[key];
      return null;
    }
    
    return {
      ...cached.result,
      cacheHit: true,
      cacheAge: age
    };
  }

  set(request, context, result) {
    const key = this.generateKey(request, context);
    this.cache[key] = {
      result,
      timestamp: Date.now()
    };
    this.saveCache();
  }
}

// Agent metadata loader
class AgentRegistry {
  constructor(metadataPath) {
    this.metadataPath = metadataPath;
    this.agents = this.loadAgents();
  }

  loadAgents() {
    try {
      const data = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));
      return data.agents || {};
    } catch (e) {
      console.error('Error loading agent metadata:', e.message);
      return {};
    }
  }

  getAll() {
    return Object.values(this.agents);
  }

  getById(id) {
    return this.agents[id] || null;
  }
}

// Routing algorithm
class IntelligentRouter {
  constructor(registry, cache) {
    this.registry = registry;
    this.cache = cache;
  }

  detectTechStack(request, context = {}) {
    const techPatterns = {
      'legend-state': /\b(legend[\s-]?state|syncedcrud|observable|@legendapp\/state)\b/i,
      'valibot': /\b(valibot|v\.pipe|v\.object|inferoutput)\b/i,
      'tamagui': /\b(tamagui|\$[a-z]+[0-9]|styled\(|<Stack|yStack)\b/i,
      'cloudflare': /\b(cloudflare|workers|d1|r2|kv|wrangler)\b/i,
      'hono': /\b(hono|new Hono|trpcServer)\b/i,
      'trpc': /\b(trpc|procedure|router|@trpc)\b/i,
      'drizzle': /\b(drizzle|orm|db\.query|schema)\b/i,
      'react': /\b(react|useState|useEffect|component)\b/i,
      'typescript': /\b(typescript|\.ts|type\s+|interface\s+)\b/i,
      'better-auth': /\b(better.?auth|auth\(|session|oauth)\b/i,
    };

    const detected = [];
    const text = request + ' ' + (context.codeSnippet || '');

    for (const [tech, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(text)) {
        detected.push(tech);
      }
    }

    return detected;
  }

  calculateRelevanceScore(agent, request, techStack) {
    let score = 0;
    const requestLower = request.toLowerCase();

    // 1. Keyword matches (weight: 0.30)
    const keywordMatches = agent.triggers.keywords.filter(k => 
      requestLower.includes(k.toLowerCase())
    ).length;
    const keywordScore = Math.min(keywordMatches / 3, 1) * 0.30;
    score += keywordScore;

    // 2. Pattern matches (weight: 0.15)
    let patternMatches = 0;
    for (const pattern of agent.triggers.patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(request)) {
          patternMatches++;
        }
      } catch (e) {
        // Invalid regex, skip
      }
    }
    const patternScore = Math.min(patternMatches / 2, 1) * 0.15;
    score += patternScore;

    // 3. Technology stack match (weight: 0.35)
    const techMatches = agent.capabilities.technologies.filter(t =>
      techStack.includes(t.toLowerCase())
    ).length;
    const techScore = (techMatches > 0 ? 1 : 0) * 0.35;
    score += techScore;

    // 4. Historical success rate (weight: 0.20)
    const historicalScore = (agent.stats?.successRate || 0.5) * 0.20;
    score += historicalScore;

    return Math.min(score, 1.0);
  }

  filterAgents(request, context = {}) {
    const techStack = this.detectTechStack(request, context);
    const agents = this.registry.getAll();
    
    const scored = agents.map(agent => ({
      agent,
      score: this.calculateRelevanceScore(agent, request, techStack),
      techStack
    }));

    // Sort by score and take top N
    const filtered = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 15); // Keep top 15 for GPT-5 Nano to decide

    return {
      agents: filtered,
      techStack
    };
  }

  formatForPrompt(filtered) {
    return filtered.agents.map(({ agent, score }) => `
@${agent.id} | ${agent.name} | Relevance: ${(score * 100).toFixed(0)}%
Capabilities: ${agent.capabilities.primary.slice(0, 3).join(', ')}
Technologies: ${agent.capabilities.technologies.slice(0, 3).join(', ')}
Keywords: ${agent.triggers.keywords.slice(0, 5).join(', ')}
Success Rate: ${(agent.stats?.successRate * 100 || 50).toFixed(0)}%
`).join('\n');
  }

  async route(request, context = {}) {
    // Check cache
    const cached = this.cache.get(request, context);
    if (cached) {
      return {
        ...cached,
        fromCache: true
      };
    }

    // Filter agents
    const filtered = this.filterAgents(request, context);
    
    // Format for prompt
    const registrySubset = this.formatForPrompt(filtered);

    // Build routing prompt
    const routingPrompt = this.buildRoutingPrompt(request, context, registrySubset, filtered.techStack);

    // Return routing context (actual GPT-5 Nano call happens in OpenCode)
    const result = {
      request,
      techStack: filtered.techStack,
      registrySubset,
      routingPrompt,
      candidateCount: filtered.agents.length,
      timestamp: Date.now()
    };

    // Cache the routing context
    this.cache.set(request, context, result);

    return result;
  }

  buildRoutingPrompt(request, context, registrySubset, techStack) {
    return `
You are an intelligent routing agent. Analyze the user request and select the best agents.

USER REQUEST: ${request}

TECHNOLOGY STACK DETECTED: ${techStack.join(', ')}

AVAILABLE AGENTS (${registrySubset.split('\n').filter(l => l.startsWith('@')).length} candidates):
${registrySubset}

Select 1 primary agent (confidence >0.90) and 0-2 secondary agents (confidence 0.70-0.89).

Respond with ONLY JSON:
{
  "routing": {
    "primary": ["@agent-id"],
    "secondary": ["@agent-id"],
    "optional": []
  },
  "confidence": {"@agent-id": 0.95},
  "reasoning": "Brief explanation",
  "estimatedTokens": 3500
}
`;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node router.js "user request" [tech1,tech2]');
    console.log('');
    console.log('Options:');
    console.log('  AGENT_METADATA      Path to agent-metadata.json');
    console.log('  ROUTING_CACHE       Path to cache file');
    console.log('  MAX_AGENTS          Maximum agents to return (default: 5)');
    console.log('  CONFIDENCE_THRESHOLD Minimum confidence (default: 0.70)');
    process.exit(1);
  }

  const request = args[0];
  const techStack = args[1] ? args[1].split(',') : [];

  const registry = new AgentRegistry(CONFIG.metadataPath);
  const cache = new RoutingCache(CONFIG.cachePath);
  const router = new IntelligentRouter(registry, cache);

  console.log(`Routing request: "${request}"`);
  console.log('');

  const result = await router.route(request, { techStack });

  console.log('Detected Tech Stack:', result.techStack.join(', '));
  console.log('Candidate Agents:', result.candidateCount);
  console.log('From Cache:', result.fromCache ? 'Yes' : 'No');
  console.log('');
  console.log('Routing Prompt for GPT-5 Nano:');
  console.log('---');
  console.log(result.routingPrompt);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use as module
module.exports = { IntelligentRouter, AgentRegistry, RoutingCache };
