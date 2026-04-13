---
name: arena-migrate
description: 将现有页面迁移到 Arena Design System。读取旧页面代码，逐步替换为 Arena 风格的组件和样式。
---

# 迁移页面到 Arena Design System

将指定的旧页面（使用 HSL 变量 + 侧边栏布局的旧风格）迁移为 Arena Design System 风格。

## 迁移步骤

### 1. 读取目标页面
先读取 `frontend/src/pages/{PageName}.tsx` 的完整代码，理解其数据结构和业务逻辑。

### 2. 样式映射表

旧 token → Arena token 对照：

| 旧样式 | Arena 替换 |
|--------|-----------|
| `bg-background` | `bg-arena-base` |
| `bg-card/80` | `glass` class |
| `bg-secondary` | `bg-arena-surface` |
| `text-foreground` | `text-neutral-50` (标题) / `text-neutral-200` (正文) |
| `text-muted-foreground` | `text-neutral-400` |
| `border-border/60` | `border border-[rgba(100,140,255,0.1)]` |
| `ring-1 ring-border/20` | 删除，改用 glass 的内置边框 |
| `bg-primary/15` | `bg-primary-soft` |
| `text-primary` | `text-primary` (不变) |
| `bg-destructive` | `bg-danger` |
| `text-destructive` | `text-danger` |
| `rounded-xl` | `rounded-lg` (使用 --arena-radius-lg) |
| `hover:scale-105` | 删除，改用 `hover:border-[rgba(100,140,255,0.25)]` |
| `tabular-nums` | `font-data tabular-nums` |
| `font-bold` (数字) | `font-data text-2xl font-bold tracking-tight text-neutral-50` |
| `p-6` (页面根) | 改用 section + max-w-[1400px] 布局 |

### 3. 结构改造（最关键！）
- 页面 return 改用 `<>...</>` Fragment，**禁止** `<div className="space-y-*">` 或 `<div className="p-6">` 作为根容器
- Hero section 必须是全宽渐变背景（`pt-16` + absolute gradient bg），**禁止**做成圆角 glass card
- 每个内容区域用独立 `<section className="relative max-w-[1400px] mx-auto px-6 py-6">` 包裹
- 间距由 section 的 `py-6` / `pb-6` / `pb-16` 控制，不用 `space-y-*` 控制页面级间距
- 最后一个 section 用 `pb-16` 留出底部空间
- 卡片改用 `glass scan-line rounded-lg` 
- 添加 `animate-fade-in-up` 入场动画

### 4. 验证
- 确保 `npm run build` 通过（无 TypeScript 错误）
- 确保业务逻辑和数据获取代码不变
- 确保颜色、间距、字体符合 Arena 规范

## 规则
- 读取 `.claude/rules/frontend-arena.md` 获取完整设计规范
- 只改样式，不改业务逻辑
- 保留所有 import 和 hooks
- select/input 等表单元素也要迁移到 Arena 样式
