---
name: arena-page
description: 创建 Arena 风格的新页面。输入页面名称和描述，生成完整的 TSX 页面（hero section + 统计卡片 + 内容区）。
---

# 创建 Arena 风格页面

根据用户提供的页面名称和描述，生成一个完整的 Arena Design System 页面。

## 输入
用户提供：页面名称（如"资产管理"）、页面描述、需要展示的数据字段。

## 页面结构模板

每个 Arena 页面必须包含以下区块，按顺序排列：

### 1. Hero Section
```tsx
<section className="relative pt-16">
  <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
  <div className="absolute inset-0 opacity-20" style={{
    backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 20%, rgba(59,130,246,0.15), transparent),
                      radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139,92,246,0.1), transparent)`
  }} />
  <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
    <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
        <PageIcon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-gradient-primary">页面标题</span>
        </h1>
        <p className="text-sm text-neutral-400">页面描述</p>
      </div>
      {/* 操作按钮区 */}
    </div>
  </div>
  <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
</section>
```

### 2. 统计卡片区（如有）
```tsx
<section className="relative max-w-[1400px] mx-auto px-6 py-6">
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div className="stat-card animate-fade-in-up" style={{ animationDelay: '0ms' }}>
      <!-- 使用 StatCard 模式 -->
    </div>
  </div>
</section>
```

### 3. 内容区
```tsx
<section className="relative max-w-[1400px] mx-auto px-6 pb-6">
  <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
    <!-- 具体内容 -->
  </div>
</section>
```

## 关键结构规则（常见错误！）
- 页面 return 用 `<>...</>` Fragment，**不得**用 `<div className="space-y-6">` 或 `<div className="p-6">` 包裹
- Hero section 必须是全宽渐变背景（`pt-16` + absolute gradient），**不得**做成圆角 glass card
- 每个 section 必须有 `max-w-[1400px] mx-auto px-6`
- 间距由 section 的 `py-6` / `pb-6` / `pb-16` 控制，不用 `space-y-*`

## 其他规则
- 读取 `.claude/rules/frontend-arena.md` 获取完整的设计 token 和组件约定
- 页面文件放在 `frontend/src/pages/` 目录
- 使用 lucide-react 图标
- 数字使用 `font-data tabular-nums` 类
- 入场动画使用 `animate-fade-in-up` 配合延迟
- 如需注册路由，同时更新 `frontend/src/App.tsx` 和 `frontend/src/components/Header.tsx`
