---
name: arena-component
description: 创建 Arena 风格的 UI 组件。输入组件需求，生成符合 Arena Design System 的 React 组件。
---

# 创建 Arena 风格组件

根据用户需求生成符合 Arena Design System 的 React 组件。

## 输入
用户提供：组件名称、用途描述、props 定义。

## 组件类别与模板

### Glass Card（玻璃卡片）
```tsx
<div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)] hover:border-[rgba(100,140,255,0.25)] transition-all">
  {children}
</div>
```

### Stat Card（统计卡片）
```tsx
<div className="stat-card animate-fade-in-up" style={{ animationDelay }}>
  <div className="flex items-start justify-between">
    <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
      <Icon className="size-5 text-primary" />
    </div>
  </div>
  <div className="mt-4">
    <div className="font-data text-2xl font-bold tracking-tight text-neutral-50">
      {value}
    </div>
    <p className="mt-1 text-sm text-neutral-400">{label}</p>
  </div>
</div>
```

### Tab Group（标签页切换）
```tsx
<div className="flex bg-arena-surface rounded-xl p-1 border border-[rgba(100,140,255,0.08)]">
  {tabs.map(tab => (
    <button key={tab.id} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
      activeTab === tab.id
        ? 'bg-primary-soft text-primary shadow-sm'
        : 'text-neutral-400 hover:text-neutral-200'
    }`}>
      <tab.icon className="w-4 h-4 inline mr-1.5" />
      {tab.label}
    </button>
  ))}
</div>
```

### Data Table（数据表格）
```tsx
<div className="glass rounded-lg border border-[rgba(100,140,255,0.1)] overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-[rgba(100,140,255,0.1)]">
        <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          {header}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[rgba(100,140,255,0.05)] hover:bg-arena-hover/50 transition-colors">
        <td className="px-4 py-3 text-sm text-neutral-200 font-data tabular-nums">
          {cell}
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Modal / Dialog
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
  <div className="relative glass-strong rounded-xl p-6 max-w-md w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
    {children}
  </div>
</div>
```

### Badge（徽章）
```tsx
// 成功
<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
// 危险
<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
// 主色
<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-primary/20">
```

### Input（输入框）
```tsx
<input className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200
  border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500
  focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20
  transition-all font-data" />
```

## 规则
- 组件文件放在 `frontend/src/components/` 目录
- 使用 TypeScript + 函数组件 + Hooks
- Props 使用 interface 定义
- 遵循 `.claude/rules/frontend-arena.md` 中的设计 token
- lucide-react 图标统一 strokeWidth={1.75}
- 所有数值显示使用 `font-data tabular-nums`
