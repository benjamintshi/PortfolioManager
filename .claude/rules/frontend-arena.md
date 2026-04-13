# Arena Design System — 前端规则

> 本项目前端采用 Arena 设计系统（深色 glassmorphism 风格），所有页面和组件必须遵循以下规范。

## 设计哲学
- **深空暗色**：背景使用 `--arena-bg-*` 系列（void → base → surface → elevated）
- **玻璃态**：卡片/面板使用 `.glass` 类（半透明 + backdrop-blur + 微光边框）
- **光效层次**：ambient orbs + grid overlay + scan-line + glow borders
- **数据优先**：数字使用 `.font-data`（等宽、tabular-nums），渐变文字用 `.text-gradient-*`

## 布局
- 顶部导航 `.glass-strong` 固定 h-16，不使用侧边栏
- 页面内容区 `max-w-[1400px] mx-auto px-6`
- 页面首部带 hero section（渐变背景 + 图标 + 标题 + 描述）
- 底部 footer 带 `border-t border-white/5`

## 颜色使用
- **文字层级**：neutral-50（标题）→ neutral-200（正文）→ neutral-400（次要）→ neutral-500（禁用）
- **主色**：`--arena-primary`（#3b82f6 蓝）用于交互元素、active 状态
- **语义色**：success（#10b981）、danger（#ef4444）、hot（#ec4899）
- **渐变**：`text-gradient-primary`（蓝→紫）用于页面大标题

## 组件约定

### 卡片
```
<div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
```
或使用 `.stat-card` 类（自带 glass + scan-line + hover glow）

### 按钮
```
className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
  text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)]
  hover:border-primary/40 hover:text-primary transition-all"
```

### Tab 切换
```
<div className="flex bg-arena-surface rounded-xl p-1 border border-[rgba(100,140,255,0.08)]">
  <button className="px-5 py-2 rounded-lg text-sm font-semibold
    bg-primary-soft text-primary shadow-sm">  // active
  <button className="px-5 py-2 rounded-lg text-sm font-semibold
    text-neutral-400 hover:text-neutral-200">  // inactive
</div>
```

### 统计数字
```
<div className="font-data text-2xl font-bold tracking-tight text-neutral-50">
  <span className="font-data tabular-nums">{value}</span>
</div>
<p className="mt-1 text-sm text-neutral-400">{label}</p>
```

### 图标徽章
```
<div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
  <Icon className="size-5 text-primary" />
</div>
```

## 动画
- 入场使用 `animate-fade-in-up`，可配合 `style={{ animationDelay: 'Nms' }}` 做错落效果
- 加载状态使用 `animate-spin`（RefreshCw 图标）
- 状态指示器使用 `animate-pulse-ring`

## 分隔线
```
<div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
```

## 页面结构（关键！）

每个页面组件的 return 必须使用 `<>...</>` Fragment 包裹，**不得使用 `<div className="space-y-6">` 或 `<div className="p-6">` 作为根容器**。

正确的页面结构：
```tsx
return (
  <>
    {/* 1. Hero Section — 必须有 pt-16 留出顶栏高度 */}
    <section className="relative pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
      <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
        {/* hero 内容 */}
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
    </section>

    {/* 2. 每个内容区域独立 section + max-w 居中 */}
    <section className="relative max-w-[1400px] mx-auto px-6 py-6">
      {/* 内容 */}
    </section>

    {/* 3. 最后一个 section 用 pb-16 留出底部空间 */}
    <section className="relative max-w-[1400px] mx-auto px-6 pb-16">
      {/* 内容 */}
    </section>
  </>
)
```

关键规则：
- `pt-16`: hero section 必须有，为固定顶栏留空间
- `max-w-[1400px] mx-auto px-6`: 每个 section 必须有，保证居中和水平边距
- **不得**用 `<div className="space-y-*">` 作为页面根容器（间距由 section 的 py/pb 控制）
- **不得**将 hero 做成 glass card（应该是全宽渐变背景，不是圆角卡片）
- 最后一个 section 用 `pb-16` 留底部空间

## 禁止
- 不使用 HSL 变量（旧系统），全部迁移到 `--arena-*`
- 不使用 `bg-card`、`bg-background`、`text-foreground` 等旧 token
- 不使用侧边栏布局
- 不使用纯白或纯黑背景
- 不使用 `<div className="p-6 space-y-*">` 作为页面根容器
- Hero section 不得是圆角卡片样式（`rounded-2xl glass-strong`），必须是全宽渐变背景
