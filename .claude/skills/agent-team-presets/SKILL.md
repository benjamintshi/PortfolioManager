---
name: agent-team-presets
description: Pre-configured agent team templates for common multi-agent workflows. Includes review team, feature team, debug team, and migration team. Use when you need parallel agents for complex tasks.
invoke: user
---

# Agent Team Presets

## Usage
Tell Claude which team preset you want:
- "Create a review team for this PR"
- "Spin up a feature team for [feature]"
- "Debug team for [issue]"
- "Migration team for [migration task]"

---

## Preset 1: Review Team (3 agents)
**Use when**: PR review, pre-release audit, code quality check

| Agent | Role | Focus |
|-------|------|-------|
| security-reviewer | Security Auditor | Auth, injection, secrets, OWASP |
| perf-reviewer | Performance Analyst | N+1, caching, allocations, indexes |
| arch-reviewer | Architecture Reviewer | Patterns, coupling, maintainability, naming |

**Prompt template**:
```
Create a review team with 3 reviewers:
1. security-reviewer: Review for security vulnerabilities (OWASP top 10, auth, secrets)
2. perf-reviewer: Review for performance issues (N+1, missing indexes, unnecessary allocations)
3. arch-reviewer: Review for architecture (patterns, naming, coupling, testability)

Files to review: [file list or git diff]
After all complete, synthesize into a single prioritized review.
```

---

## Preset 2: Feature Team (2-4 agents)
**Use when**: Medium-to-large feature development

| Agent | Role | Focus |
|-------|------|-------|
| backend-dev | Backend Developer | API, services, database, business logic |
| frontend-dev | Frontend Developer | UI components, state, API client |
| test-dev | Test Engineer | Integration tests, edge cases |
| docs-writer | Documentation | API docs, README, changelog |

**Prompt template**:
```
Create a feature team to implement [feature description]:
1. backend-dev: Implement [backend scope]. Files: src/api/, src/services/
2. frontend-dev: Implement [frontend scope]. Files: src/components/, src/pages/
3. test-dev: Write integration tests. Files: tests/
Share task list. Backend and frontend can work in parallel.
Test agent starts after both are done.
```

---

## Preset 3: Debug Team (3 agents)
**Use when**: Complex production issue with multiple hypotheses

| Agent | Role | Focus |
|-------|------|-------|
| hypothesis-1 | Investigator A | Test theory: [hypothesis 1] |
| hypothesis-2 | Investigator B | Test theory: [hypothesis 2] |
| hypothesis-3 | Investigator C | Test theory: [hypothesis 3] |

**Prompt template**:
```
Create a debug team for: [issue description]
3 investigators, each testing a different hypothesis:
1. hypothesis-1: [theory 1] — check [files/logs/queries]
2. hypothesis-2: [theory 2] — check [files/logs/queries]
3. hypothesis-3: [theory 3] — check [files/logs/queries]
Each shares findings. Converge on root cause.
```

---

## Preset 4: Migration Team (2-3 agents)
**Use when**: Language migration, framework upgrade, architecture refactor

| Agent | Role | Focus |
|-------|------|-------|
| migrator | Migration Worker | Convert files, update syntax |
| validator | Verification Agent | Run tests, check types, verify equivalence |
| doc-updater | Doc Updater | Update docs, configs, CI |

**Prompt template**:
```
Create a migration team to [migration description]:
1. migrator: Convert [scope] from [old] to [new]. Work in batches.
2. validator: After each batch, run tests and typecheck. Report failures.
3. doc-updater: Update package.json/Cargo.toml/pom.xml, CI config, README.
Migrator and validator alternate. Doc-updater works in parallel.
```

---

## Best Practices
- **Independence**: Assign each agent files/directories that don't overlap
- **Shared task list**: Let agents claim tasks from a shared list
- **Verification**: Always include a validator agent in the team
- **Context budget**: Agent teams use 3-5x more tokens — use for tasks worth parallelizing
- **Cleanup**: Tell the lead to stop teammates when done
