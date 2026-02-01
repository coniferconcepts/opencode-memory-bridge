#!/usr/bin/env node
/**
 * Routing Analytics & Feedback Loop
 * 
 * Tracks routing outcomes and generates improvement recommendations.
 * 
 * Usage: node analytics.js record|report|improve
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  statsPath: process.env.ROUTING_STATS || path.join(__dirname, '../.cache/routing-stats.json'),
  metadataPath: process.env.AGENT_METADATA || path.join(__dirname, '../config/agent-metadata.json'),
};

class RoutingAnalytics {
  constructor() {
    this.stats = this.loadStats();
    this.metadata = this.loadMetadata();
  }

  loadStats() {
    try {
      if (fs.existsSync(CONFIG.statsPath)) {
        return JSON.parse(fs.readFileSync(CONFIG.statsPath, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading stats:', e.message);
    }
    return {
      routings: [],
      agentStats: {},
      aggregate: {
        totalRoutings: 0,
        cacheHits: 0,
        avgConfidence: 0,
        avgLatency: 0
      }
    };
  }

  loadMetadata() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.metadataPath, 'utf8'));
    } catch (e) {
      console.error('Error loading metadata:', e.message);
      return { agents: {} };
    }
  }

  saveStats() {
    try {
      const dir = path.dirname(CONFIG.statsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG.statsPath, JSON.stringify(this.stats, null, 2));
    } catch (e) {
      console.error('Error saving stats:', e.message);
    }
  }

  recordRouting(routing) {
    const record = {
      id: this.generateId(),
      timestamp: Date.now(),
      request: routing.request,
      techStack: routing.techStack,
      selectedAgents: routing.selectedAgents,
      confidence: routing.confidence,
      latency: routing.latency,
      fromCache: routing.fromCache,
      outcome: routing.outcome || 'pending'
    };

    this.stats.routings.push(record);
    this.stats.aggregate.totalRoutings++;
    
    if (routing.fromCache) {
      this.stats.aggregate.cacheHits++;
    }

    // Update agent-specific stats
    for (const agentId of routing.selectedAgents) {
      if (!this.stats.agentStats[agentId]) {
        this.stats.agentStats[agentId] = {
          selections: 0,
          successes: 0,
          failures: 0,
          avgUserRating: 0,
          totalRatings: 0
        };
      }
      this.stats.agentStats[agentId].selections++;
    }

    // Recalculate aggregates
    this.recalculateAggregates();
    this.saveStats();

    return record;
  }

  recordOutcome(routingId, outcome) {
    const routing = this.stats.routings.find(r => r.id === routingId);
    if (!routing) {
      console.error(`Routing ${routingId} not found`);
      return;
    }

    routing.outcome = outcome.success ? 'success' : 'failure';
    routing.userRating = outcome.userRating;
    routing.tokenUsage = outcome.tokenUsage;
    routing.actualTime = outcome.actualTime;

    // Update agent stats
    for (const agentId of routing.selectedAgents) {
      const stats = this.stats.agentStats[agentId];
      if (outcome.success) {
        stats.successes++;
      } else {
        stats.failures++;
      }
      
      if (outcome.userRating) {
        stats.totalRatings++;
        stats.avgUserRating = (
          (stats.avgUserRating * (stats.totalRatings - 1)) + outcome.userRating
        ) / stats.totalRatings;
      }
    }

    this.saveStats();
  }

  recalculateAggregates() {
    const routings = this.stats.routings;
    if (routings.length === 0) return;

    this.stats.aggregate.avgConfidence = routings.reduce((sum, r) => 
      sum + Object.values(r.confidence || {}).reduce((a, b) => a + b, 0) / Object.keys(r.confidence || {}).length, 0
    ) / routings.length;

    this.stats.aggregate.avgLatency = routings.reduce((sum, r) => sum + (r.latency || 0), 0) / routings.length;
    this.stats.aggregate.cacheHitRate = this.stats.aggregate.cacheHits / routings.length;
  }

  generateReport() {
    const { aggregate, agentStats } = this.stats;
    
    console.log('=== Routing Analytics Report ===\n');
    
    console.log('Aggregate Metrics:');
    console.log(`  Total Routings: ${aggregate.totalRoutings}`);
    console.log(`  Cache Hit Rate: ${(aggregate.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`  Avg Confidence: ${(aggregate.avgConfidence * 100).toFixed(1)}%`);
    console.log(`  Avg Latency: ${aggregate.avgLatency.toFixed(0)}ms`);
    console.log('');

    console.log('Top Agents by Selection:');
    const sortedAgents = Object.entries(agentStats)
      .sort((a, b) => b[1].selections - a[1].selections)
      .slice(0, 10);
    
    for (const [agentId, stats] of sortedAgents) {
      const successRate = stats.selections > 0 
        ? (stats.successes / stats.selections * 100).toFixed(1)
        : 0;
      console.log(`  ${agentId}: ${stats.selections} selections, ${successRate}% success`);
    }
    console.log('');

    console.log('Recent Routings (last 10):');
    const recent = this.stats.routings.slice(-10);
    for (const r of recent) {
      const date = new Date(r.timestamp).toISOString().split('T')[0];
      console.log(`  ${date} | ${r.outcome} | ${r.selectedAgents.join(', ')}`);
    }
  }

  generateImprovements() {
    const recommendations = {
      keywordExpansions: [],
      capabilityGaps: [],
      promptOptimizations: [],
      agentRankings: []
    };

    // Find poor routings
    const poorRoutings = this.stats.routings.filter(r => 
      r.outcome === 'failure' || (r.userRating && r.userRating < 3)
    );

    // Suggest keyword expansions
    const failedKeywords = new Map();
    for (const routing of poorRoutings) {
      const words = routing.request.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4) {
          failedKeywords.set(word, (failedKeywords.get(word) || 0) + 1);
        }
      }
    }

    recommendations.keywordExpansions = Array.from(failedKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, failedCount: count }));

    // Identify capability gaps
    const allTech = new Set();
    for (const routing of this.stats.routings) {
      routing.techStack?.forEach(t => allTech.add(t));
    }

    const coveredTech = new Set();
    for (const agent of Object.values(this.metadata.agents)) {
      agent.capabilities.technologies.forEach(t => coveredTech.add(t));
    }

    recommendations.capabilityGaps = Array.from(allTech)
      .filter(t => !coveredTech.has(t))
      .map(t => ({ technology: t, occurrences: this.countTechOccurrences(t) }));

    // Agent performance rankings
    recommendations.agentRankings = Object.entries(this.stats.agentStats)
      .map(([id, stats]) => ({
        agentId: id,
        selections: stats.selections,
        successRate: stats.selections > 0 ? stats.successes / stats.selections : 0,
        avgRating: stats.avgUserRating
      }))
      .sort((a, b) => b.successRate - a.successRate);

    return recommendations;
  }

  countTechOccurrences(tech) {
    return this.stats.routings.filter(r => 
      r.techStack?.includes(tech)
    ).length;
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

// CLI
async function main() {
  const command = process.argv[2];
  const analytics = new RoutingAnalytics();

  switch (command) {
    case 'record':
      // Expect JSON from stdin
      let data = '';
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => {
        try {
          const routing = JSON.parse(data);
          const record = analytics.recordRouting(routing);
          console.log(JSON.stringify(record, null, 2));
        } catch (e) {
          console.error('Error parsing input:', e.message);
          process.exit(1);
        }
      });
      break;

    case 'report':
      analytics.generateReport();
      break;

    case 'improve':
      const recommendations = analytics.generateImprovements();
      console.log('=== Improvement Recommendations ===\n');
      console.log(JSON.stringify(recommendations, null, 2));
      break;

    default:
      console.log('Usage: node analytics.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  record    Record a routing outcome (reads JSON from stdin)');
      console.log('  report    Generate analytics report');
      console.log('  improve   Generate improvement recommendations');
      console.log('');
      console.log('Example:');
      console.log('  echo \'{...}\' | node analytics.js record');
      console.log('  node analytics.js report');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RoutingAnalytics };
