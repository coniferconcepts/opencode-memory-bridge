# SQLite EXPLAIN QUERY PLAN - Detailed Results
## Day 14 Analysis

### Query 1: Source ID Lookup
```sql
SELECT * FROM observation_relationships WHERE source_id = 1 LIMIT 10
```

**Plan**:
```
QUERY PLAN
`--SEARCH observation_relationships USING INDEX idx_relationships_source (source_id=?)
```

**Analysis**:
- Uses: `idx_relationships_source` (single key index)
- Type: SEARCH (indexed lookup, not table scan)
- Selectivity: Very high (only matching source_id)
- Time: ~14ms
- Status: ✅ OPTIMAL

---

### Query 2: Target ID Lookup
```sql
SELECT * FROM observation_relationships WHERE target_id = 1 LIMIT 10
```

**Plan**:
```
QUERY PLAN
`--SEARCH observation_relationships USING INDEX idx_relationships_target (target_id=?)
```

**Analysis**:
- Uses: `idx_relationships_target` (single key index)
- Type: SEARCH
- Selectivity: Very high
- Time: ~11ms
- Status: ✅ OPTIMAL

---

### Query 3: High-Confidence Relationships (BOTTLENECK)
```sql
SELECT * FROM observation_relationships
WHERE confidence >= 0.7
ORDER BY confidence DESC
LIMIT 10
```

**Plan**:
```
QUERY PLAN
`--SEARCH observation_relationships USING INDEX idx_relationships_high_confidence (confidence>?)
```

**Analysis**:
- Uses: `idx_relationships_high_confidence` (partial index)
- Type: SEARCH with range condition
- Selectivity: LOW (92% of rows match confidence >= 0.7)
- Rows scanned: ~297,703
- Rows returned: 10 (requires scanning through 297K to get top 10)
- Time: ~858ms
- Status: ❌ PROBLEM

**Issue**:
While the partial index is well-designed, returning a limited number of high-confidence results requires scanning through nearly all matching rows due to the ordering requirement. For a query that returns 50 results instead of 10, the problem gets worse (not linearly worse, but still significant).

**Why It Happens**:
- Partial index filters to 297K rows: `WHERE confidence >= 0.7`
- `ORDER BY confidence DESC` requires traversing this set in descending order
- Getting only the top N requires reading through the set until N results found
- This is inherently expensive for very selective results from large sets

**Solution Needed**:
Denormalize into a categorical `confidence_tier` (very_high/high/standard) so the index can filter more aggressively before ordering.

---

### Query 4: Bidirectional Relationship Lookup
```sql
SELECT * FROM observation_relationships
WHERE source_id = 1 OR target_id = 1
```

**Plan**:
```
QUERY PLAN
`--MULTI-INDEX OR
   |--INDEX 1
   |  `--SEARCH observation_relationships USING INDEX idx_relationships_source (source_id=?)
   `--INDEX 2
      `--SEARCH observation_relationships USING INDEX idx_relationships_target (target_id=?)
```

**Analysis**:
- Uses: Both `idx_relationships_source` and `idx_relationships_target`
- Type: MULTI-INDEX OR (intelligent union)
- Behavior: SQLite evaluates both indices and combines results
- Time: ~12ms
- Status: ✅ EXCELLENT

**Why It's Good**:
SQLite's query planner recognizes the OR pattern and uses both indices efficiently without requiring a full table scan. The results are merged with automatic duplicate elimination if both conditions match.

---

### Query 5: Importance Score Filtering (SUBOPTIMAL)
```sql
SELECT id, title FROM observations
WHERE json_extract(oc_metadata, '$.importance_score') >= 70
LIMIT 10
```

**Plan**:
```
QUERY PLAN
`--SCAN observations
```

**Analysis**:
- Uses: No index (full table scan)
- Type: SCAN (sequential read of all rows)
- Rows scanned: 13,969 (all observations)
- Time: ~27ms
- Status: ⚠️ SUBOPTIMAL (but acceptable)

**Why No Index**:
- `json_extract()` function results cannot be indexed in SQLite < 3.47
- No generated column for numeric importance score exists yet
- Partial indices on categorical `meta_importance` exist but only capture text values

**Optimization Available**:
Create a generated integer column for numeric score with an index, reducing this to ~2-5ms.

---

### Query 6: Enriched Join (Observations + Relationships)
```sql
SELECT o.id, o.title, r.relationship_type, r.confidence
FROM observations o
LEFT JOIN observation_relationships r ON o.id = r.source_id
WHERE json_extract(o.oc_metadata, '$.importance_score') >= 70
LIMIT 10
```

**Plan**:
```
QUERY PLAN
|--SCAN o
`--SEARCH r USING COVERING INDEX idx_relationships_source (source_id=?) LEFT-JOIN
```

**Analysis**:
- Observations side: SCAN (due to WHERE on json_extract)
- Relationships side: SEARCH using covering index
- Type: Nested loop join
- Covering index: `idx_relationships_bidirectional` covers all needed columns
- Time: ~27ms (dominated by observation scan)
- Status: ✅ ACCEPTABLE

**Why It's Good**:
The relationships side uses a covering index, which means all columns needed are in the index itself without accessing the main table. This minimizes I/O for the inner side of the join.

**Optimization Path**:
Once the importance score index is added, the observations SCAN becomes an indexed lookup, potentially improving this to ~2-10ms.

---

### Query 7: Depth-2 Graph Traversal
```sql
WITH depth1 AS (
  SELECT target_id FROM observation_relationships WHERE source_id = 100
)
SELECT * FROM observation_relationships
WHERE source_id IN (SELECT target_id FROM depth1)
LIMIT 50
```

**Plan**:
```
QUERY PLAN
|--SEARCH observation_relationships USING INDEX idx_relationships_source (source_id=?)
`--LIST SUBQUERY 2
   `--SEARCH observation_relationships USING COVERING INDEX idx_relationships_bidirectional (source_id=?)
```

**Analysis**:
- Depth 1 (subquery): SEARCH using covering index `idx_relationships_bidirectional`
- Depth 2 (main): SEARCH using idx_relationships_source for each result from depth 1
- Type: Nested loop on indexed results
- Time: ~13ms
- Status: ✅ EXCELLENT

**Why It's So Fast**:
- The covering index on depth 1 is very efficient (returns all needed columns)
- Each depth-2 lookup is an indexed search (no table scans)
- With ~65 average relationships per observation, this scales well

**Graph Traversal Implication**:
This query pattern will support depth-N traversals very efficiently, making complex graph algorithms feasible.

---

### Query 8: Hybrid Search with Aggregation
```sql
SELECT o.id, o.title, COUNT(r.id) as rel_count
FROM observations o
LEFT JOIN observation_relationships r ON o.id = r.source_id
WHERE json_extract(o.oc_metadata, '$.importance_score') >= 70
GROUP BY o.id
ORDER BY rel_count DESC
LIMIT 10
```

**Plan**:
```
QUERY PLAN
|--SCAN o
|--SEARCH r USING COVERING INDEX idx_relationships_source (source_id=?) LEFT-JOIN
`--USE TEMP B-TREE FOR ORDER BY
```

**Analysis**:
- Observations scan: SCAN (due to WHERE on json_extract)
- Relationships join: SEARCH using covering index
- Aggregation: GROUP BY with COUNT
- Sorting: Uses temporary B-tree for ORDER BY
- Time: ~88ms
- Status: ✅ GOOD (44% of 200ms target)

**Why It's Reasonably Fast**:
- Covering index minimizes relationship lookups
- Aggregation happens before sorting (smaller dataset)
- GROUP BY + ORDER BY on aggregated results is fast

**Optimization Potential**:
Once importance score index is added, this could drop to ~30-50ms.

---

## Summary Table

| Query | Index Used | Time | Efficiency |
|-------|-----------|------|-----------|
| source_id | idx_relationships_source | 14ms | ✅ Optimal |
| target_id | idx_relationships_target | 11ms | ✅ Optimal |
| high-confidence | idx_relationships_high_confidence | 858ms | ❌ Bottleneck |
| bidirectional | Multi-index OR | 12ms | ✅ Excellent |
| importance filter | None (scan) | 27ms | ⚠️ Suboptimal |
| enriched join | idx_relationships_source (covering) | 27ms | ✅ Acceptable |
| depth-2 traversal | idx_relationships_bidirectional + source | 13ms | ✅ Excellent |
| hybrid aggregation | idx_relationships_source (covering) | 88ms | ✅ Good |

---

## Key Observations

### What's Working Well
1. **Single-key lookups** on source/target IDs are excellent (11-14ms)
2. **Bidirectional queries** leverage both indices efficiently (12ms)
3. **Graph traversal** uses covering indices optimally (13ms)
4. **Index coverage** is comprehensive with strategic partial/covering indices

### What Needs Improvement
1. **High-confidence filtering** (858ms) - denormalization needed
2. **Importance score filtering** (27ms) - generated column + index needed

### Strategic Insights
- The `idx_relationships_bidirectional` covering index is the most valuable (3 columns)
- Partial indices work but are less effective for very selective results
- JSON extraction without generated columns requires full table scans
- Graph algorithms will perform well given the current index design

---

## Performance Implications

### For Search Features
- Filtering by confidence alone is expensive
- Should combine with other filters to reduce result set first
- Consider pagination over strict top-N queries

### For Graph Algorithms
- Traversals are efficient at depth-1 and depth-2
- Should scale well to depth-3+ with similar patterns
- Could support dynamic graph analysis and path-finding

### For Hybrid Search
- Mixing observations and relationships works well
- Aggregations are affordable
- Sorting results post-join is acceptable

---

Generated: January 15, 2026
Database: ~/.claude-mem/claude-mem.db (13,969 obs, 323,832 rel, 184MB)
