---
name: debug-prod
description: Structured production debugging workflow. Systematically investigate issues using logs, metrics, and code analysis. Use when diagnosing production bugs or incidents.
allowed-tools: Read, Bash, Grep
---

# Production Debug Skill

## Phase 1: Gather Evidence (don't guess)
1. **Reproduce**: Can you reproduce? What are the exact steps/conditions?
2. **Logs**: Search logs for error messages, stack traces, timestamps
3. **Timeline**: When did it start? What changed recently? (deploy, config, traffic)
4. **Scope**: How many users affected? One endpoint or system-wide?
5. **Metrics**: CPU/memory/disk/latency anomalies?

## Phase 2: Hypothesize (max 3)
Based on evidence, form up to 3 hypotheses ranked by likelihood:
```
H1 (most likely): [hypothesis] — Evidence: [what supports this]
H2: [hypothesis] — Evidence: [what supports this]
H3: [hypothesis] — Evidence: [what supports this]
```

## Phase 3: Verify (cheapest test first)
For each hypothesis, design the cheapest test:
- Read code/config (free)
- Query logs/DB (low cost)
- Add temporary logging (medium cost)
- Reproduce in staging (higher cost)
- Reproduce in prod with feature flag (highest cost)

## Phase 4: Fix & Verify
1. Implement the minimal fix
2. Write a test that would have caught this bug
3. Verify fix locally
4. Deploy with monitoring
5. Confirm the original symptoms are gone

## Phase 5: Post-mortem
```
## Incident Summary
- **Impact**: [users/duration/severity]
- **Root Cause**: [what actually broke and why]
- **Fix**: [what was changed]
- **Prevention**: [what to add so this can't happen again]
- **Detection**: [how to catch this faster next time]
```
