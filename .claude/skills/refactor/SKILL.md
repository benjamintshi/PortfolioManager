---
name: refactor
description: Safe refactoring workflow with incremental changes and continuous verification. Use for restructuring code, extracting modules, or improving architecture without changing behavior.
allowed-tools: Read, Bash, Write, Edit, Grep
---

# Refactor Skill

## Golden Rule
**Behavior must not change.** Every step must pass existing tests.

## Process

### 1. Scope
- What code is being refactored? (file, module, subsystem)
- Why? (too complex, performance, maintainability, preparation for new feature)
- What is NOT changing? (explicit boundaries)

### 2. Safety Net
Before any changes:
- [ ] Existing tests pass: `npm test` / `pytest` / `cargo test`
- [ ] Note current test coverage on affected files
- [ ] If no tests exist, write characterization tests FIRST

### 3. Incremental Steps
Break refactoring into small, independently verifiable steps:

```
Step 1: Extract function X from Y → run tests ✅
Step 2: Rename A to B → run tests ✅
Step 3: Move module C to new location → run tests ✅
Step 4: Update imports → run tests ✅
```

**Run tests after EVERY step.** If tests fail, revert that step immediately.

### 4. Common Refactoring Patterns
| Pattern | When |
|---------|------|
| Extract function/method | Function > 30 lines or does multiple things |
| Extract class/module | File > 300 lines or has multiple responsibilities |
| Introduce interface | Multiple implementations or test doubles needed |
| Replace conditional with polymorphism | Long if/switch chains on type |
| Inline temp | Variable used once, adds no clarity |
| Move method | Method uses more data from another class |

### 5. Verify
After all steps:
- [ ] All tests pass (same count or more)
- [ ] No new lint warnings
- [ ] No type errors
- [ ] `git diff --stat` — only expected files changed
- [ ] No behavioral changes (same API, same output)

### 6. Commit Strategy
- One commit per logical refactoring step (not one giant commit)
- Prefix: `refactor: description of change`
- Never mix refactoring with feature changes in the same commit
