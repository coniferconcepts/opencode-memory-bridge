# Memory Plugin Deployment Guide

## Prerequisites

- Bun >= 1.0
- SQLite 3.x
- Node.js >= 18 (for npx)

## Installation

```bash
# Clone repository
git clone <repo-url>
cd content-tracker

# Install dependencies
bun install

# Build plugin
cd packages/memory-plugin
bun run build
```

## Database Setup

The plugin automatically creates the database at `~/.claude-mem/claude-mem.db`.

### Schema Migration

Phase 3 adds the `observation_relationships` table:

```bash
# The table is auto-created by the ingestor
# To manually create:
sqlite3 ~/.claude-mem/claude-mem.db < migrations/003_relationships.sql
```

### Data Population

```bash
# Populate importance scores (required for hybrid search)
bun run scripts/populate-importance-scores.ts

# Detect relationships (optional, improves search quality)
bun run scripts/detect-relationships.ts
```

## Configuration

### Environment Variables

```bash
CLAUDE_MEM_DEBUG=1          # Enable debug logging
CLAUDE_MEM_VERBOSITY=quiet  # quiet|normal|verbose
```

### Feature Flags

Edit `src/constants.ts` to adjust defaults:

```typescript
HYBRID_SEARCH_CONFIG = {
  defaultUseHybridScoring: true,      // Enable importance weighting
  defaultExpandByRelationships: false, // Enable relationship expansion
  defaultMaxNeighborsPerResult: 3,    // Max neighbors per result
}
```

## Verification

### Run Tests

```bash
cd packages/memory-plugin
bun test
```

Expected: 446 tests passing in <1 second

### Database Health Check

```bash
# Integrity check
sqlite3 ~/.claude-mem/claude-mem.db "PRAGMA integrity_check"

# Statistics
sqlite3 ~/.claude-mem/claude-mem.db "
SELECT 'Observations' as metric, COUNT(*) FROM observations
UNION ALL
SELECT 'Relationships', COUNT(*) FROM observation_relationships
UNION ALL
SELECT 'High importance (70+)', COUNT(*) FROM observations
  WHERE json_extract(oc_metadata, '\$.importance_score') >= 70
"
```

### Performance Validation

| Query | Target | Command |
|-------|--------|---------|
| Relationship | <50ms | `time sqlite3 ~/.claude-mem/claude-mem.db "SELECT * FROM observation_relationships WHERE source_id = 1 LIMIT 10"` |
| Graph depth-2 | <150ms | See troubleshooting guide |
| Hybrid search | <200ms | Run test suite |

## Rollback

### Per-Feature Rollback

```bash
# Disable hybrid search
# Set HYBRID_SEARCH_CONFIG.defaultUseHybridScoring = false

# Remove relationships
sqlite3 ~/.claude-mem/claude-mem.db "DROP TABLE observation_relationships"

# Clear importance scores
sqlite3 ~/.claude-mem/claude-mem.db "
UPDATE observations SET oc_metadata = json_remove(oc_metadata, '\$.importance_score')
"
```

### Full Rollback

```bash
# Backup database first!
cp ~/.claude-mem/claude-mem.db ~/.claude-mem/claude-mem.db.backup

# Reset to Phase 2
git checkout HEAD~1 -- packages/memory-plugin/
bun install
bun run build
```

## Monitoring

### Key Metrics

- Database size: Should grow ~1MB per 1000 observations
- Query latency: Monitor relationship queries
- Relationship ratio: ~23 relationships per observation (typical)

### Logs

```bash
# Watch plugin logs
tail -f ~/.claude-mem/logs/plugin.log
```

## Production Checklist

- [ ] All 446 tests passing
- [ ] Database integrity check passes
- [ ] Importance scores populated
- [ ] Relationships detected
- [ ] Performance targets met
- [ ] Backup strategy in place
