# Git 工作流 (通用)

## 分支
- 从 `main` 分支开发，PR 合并回 `main`
- 功能分支: `feat/xxx`, 修复分支: `fix/xxx`

## 提交
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- 提交信息简洁准确，描述"做了什么"而非"改了哪个文件"
- 一个提交一个关注点 — 不混合 feature 和 refactor

## Pre-commit
- lint + typecheck 必须通过
- 不提交 `.env`、secrets、编译产物
- 不提交 `console.log` / `print` 调试语句

## PR
- 测试全部通过
- 描述: 做了什么 + 为什么 + 怎么测
- 破坏性变更标注 `BREAKING CHANGE:`
