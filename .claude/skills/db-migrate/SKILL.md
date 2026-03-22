---
name: db-migrate
description: Generate and validate database migrations. Ensures reversibility, data safety, and index coverage. Use when adding/modifying database schema.
allowed-tools: Read, Bash, Write
---

# Database Migration Skill

## Before Writing Migration

### 1. Impact Analysis
- Which tables are affected?
- How much data is in these tables? (check row counts)
- Are there active queries hitting these columns?
- Will this require downtime? (if table lock needed)

### 2. Migration Plan
```
Change: [describe schema change]
Tables affected: [list]
Estimated rows: [counts]
Downtime required: yes/no
Rollback strategy: [how to undo]
```

## Migration Template

### Up (forward)
```sql
-- Migration: YYYYMMDD_HHMMSS_description
-- Purpose: [why this change is needed]

-- Step 1: Add new column (nullable first for zero-downtime)
ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT NULL;

-- Step 2: Backfill data
UPDATE orders SET status = 'pending' WHERE status IS NULL;

-- Step 3: Add constraint after backfill
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;

-- Step 4: Add index for query patterns
CREATE INDEX idx_orders_status ON orders(status);
```

### Down (rollback)
```sql
-- Rollback: YYYYMMDD_HHMMSS_description
DROP INDEX IF EXISTS idx_orders_status;
ALTER TABLE orders DROP COLUMN status;
```

## Validation Checklist
- [ ] Up migration runs on clean DB
- [ ] Down migration reverses all changes
- [ ] Up → Down → Up produces same result (idempotent)
- [ ] New columns added as nullable first (zero-downtime)
- [ ] Indexes added for new WHERE/JOIN/ORDER BY columns
- [ ] No data loss in rollback (or documented as acceptable)
- [ ] Large table? Use batched updates to avoid lock contention
- [ ] Foreign keys have ON DELETE behavior specified
