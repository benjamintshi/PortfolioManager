---
name: code-review
description: Multi-perspective code review. Reviews code for correctness, security, performance, and maintainability. Use for PR reviews or pre-commit checks.
allowed-tools: Read, Bash, Grep
---

# Code Review Skill

When reviewing code, follow this structured approach:

## 1. Understand Context
- Read the changed files and their surrounding context
- Understand the purpose of the change (commit message, PR description, or ask)

## 2. Review Checklist (parallel if using agent team)

### Correctness
- Does the code do what it claims?
- Edge cases handled? (null, empty, overflow, concurrency)
- Error handling complete and correct?
- No off-by-one errors?

### Security
- Input validation on all external data?
- No SQL injection, XSS, or path traversal?
- Secrets handled properly?
- Auth/authz checks present?

### Performance
- No N+1 queries?
- Appropriate indexing for new queries?
- No unnecessary allocations in hot paths?
- Caching where appropriate?

### Maintainability
- Functions < 50 lines? Clear naming?
- No duplication? DRY?
- Tests added/updated?
- Documentation updated?

## 3. Output Format
```
## Review Summary
**Verdict**: ✅ Approve / ⚠️ Approve with comments / ❌ Request changes

### Critical Issues (must fix)
- [file:line] Description

### Suggestions (nice to have)
- [file:line] Description

### Positives
- What was done well
```

## Agent Team Mode
When invoked with `/code-review --team`:
- Spawn 3 parallel reviewers: security-reviewer, performance-reviewer, architecture-reviewer
- Each produces independent findings
- Synthesize into single review with deduplicated, prioritized issues
