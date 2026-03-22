---
name: perf-audit
description: Performance audit for code, queries, and architecture. Identifies bottlenecks and provides actionable fixes. Use when investigating slow endpoints, high memory usage, or scaling issues.
allowed-tools: Read, Bash, Grep
---

# Performance Audit Skill

## Audit Process

### 1. Identify the Bottleneck (measure first)
- **API latency**: Which endpoints are slow? P50/P95/P99?
- **Database**: Slow queries? Missing indexes? Table scans?
- **Memory**: Growing heap? Leaks? Large allocations?
- **CPU**: Hot functions? Tight loops? Unnecessary computation?
- **I/O**: Too many disk reads? Network calls? Serialization?

### 2. Database Performance
```sql
-- Find slow queries (PostgreSQL)
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 20;

-- Missing indexes (look for sequential scans on large tables)
EXPLAIN ANALYZE <your_query>;
```

Check for:
- [ ] N+1 queries (ORM lazy loading)
- [ ] Missing indexes on WHERE/JOIN/ORDER BY columns
- [ ] SELECT * instead of specific columns
- [ ] Unbounded queries (no LIMIT)
- [ ] Unnecessary JOINs

### 3. Application Performance
Check for:
- [ ] Synchronous I/O in hot paths
- [ ] Allocations in loops (create outside, reuse)
- [ ] Excessive logging in hot paths
- [ ] Missing caching for expensive computations
- [ ] Unbounded caches (no TTL, no max size)
- [ ] Event listener leaks
- [ ] Timer/interval leaks

### 4. Architecture
- [ ] Can this be async/background?
- [ ] Can this be cached? (with appropriate TTL)
- [ ] Can this be batched? (N calls → 1 call)
- [ ] Can this be paginated?
- [ ] Connection pooling configured?
- [ ] Rate limiting on expensive operations?

## Output Format
```
## Performance Audit Report

### Critical (must fix)
1. [component] Issue description — Impact: Xms → expected Yms
   Fix: [specific code change]

### Important (should fix)
1. [component] Issue — Impact: [estimate]
   Fix: [change]

### Monitoring Recommendations
- Add metric: [what to track]
- Alert threshold: [when to fire]
```
