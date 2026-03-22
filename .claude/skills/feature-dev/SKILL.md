---
name: feature-dev
description: End-to-end feature development workflow with agent team. Plans, implements, tests, and reviews a new feature using parallel agents. Use for medium-to-large feature development.
allowed-tools: Read, Bash, Write, Edit, Grep
---

# Feature Development Skill

## Workflow (4 phases)

### Phase 1: Plan (Plan Mode)
Before writing any code:

1. **Understand requirements**: What does this feature do? Who uses it? Success criteria?
2. **Explore existing code**: Read related files, understand current patterns
3. **Design**:
   - Which files need to change?
   - New files needed?
   - Database changes?
   - API changes?
   - What could go wrong?
4. **Write plan**: Save to `docs/plans/feature-{name}.md`

### Phase 2: Implement (Agent Team - Squad Mode)
Spawn parallel agents based on feature scope:

**Backend Agent**:
- Implement service/business logic
- Add API endpoints
- Database migrations
- Run: build + unit tests

**Frontend Agent** (if applicable):
- UI components
- API client integration
- Run: build + component tests

**Test Agent**:
- Integration tests
- Edge case tests
- Run: full test suite

### Phase 3: Verify
After all agents complete:
1. `build` — must pass with 0 errors
2. `test` — all tests pass
3. `lint` — no warnings
4. `typecheck` — clean
5. Manual: review the diff, check for forgotten files

### Phase 4: Ship
1. `git diff --stat` — confirm only expected files changed
2. Commit with conventional commit message
3. Open PR with description:
   - What changed and why
   - How to test
   - Screenshots (if UI)
   - Breaking changes (if any)

## Acceptance Criteria Template
```markdown
## Feature: {name}
- [ ] Criterion 1: specific, verifiable
- [ ] Criterion 2: specific, verifiable
- [ ] Tests added for all criteria
- [ ] No regressions in existing tests
- [ ] Documentation updated
```
