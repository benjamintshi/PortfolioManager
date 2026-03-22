---
name: deploy
description: Guided deployment workflow with pre-flight checks, build verification, and rollback plan. Use when deploying to staging or production.
allowed-tools: Read, Bash, Grep
---

# Deploy Skill

## Pre-flight Checklist
Before deploying, verify ALL of the following:

1. **Branch**: On correct branch? Up to date with main?
2. **Tests**: `npm test` / `pytest` / `cargo test` / `mvn test` passing?
3. **Build**: Production build succeeds without warnings?
4. **Lint**: No lint errors?
5. **Env**: Environment variables configured for target?
6. **Migrations**: Database migrations ready? Reversible?
7. **Changelog**: Updated with changes?

## Deployment Steps
```
1. Create deployment tag: git tag -a v{version} -m "Release v{version}"
2. Run production build
3. Run database migrations (if any)
4. Deploy to target environment
5. Verify health check endpoint
6. Run smoke tests
7. Monitor logs for 5 minutes
```

## Rollback Plan
If deployment fails:
1. Revert to previous version immediately
2. Rollback database migrations if applied
3. Verify rollback with health check
4. Document what went wrong in incident log

## Output
```
## Deployment Report
- **Version**: v{version}
- **Target**: staging / production
- **Pre-flight**: ✅ All checks passed / ❌ Failed: [list]
- **Status**: ✅ Success / ❌ Failed at step X
- **Rollback**: Not needed / Executed successfully
```
