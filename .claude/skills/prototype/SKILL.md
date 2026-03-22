---
name: prototype
description: >-
  从 PRD 快速生成可交互原型。产出 HTML 原型页面供用户预览和确认。
  Use when user wants to see what a feature looks like before full implementation.
---

# 快速原型 — PRD 到可交互 Demo

## 触发条件
- 用户说"先做个原型看看"
- PRD 已确认，但想在正式开发前验证 UI/交互
- 需要和利益相关者对齐预期

## 流程

### 1. 读取 PRD
从 `specs/{feature}/PRD.md` 读取:
- 用户故事
- 功能需求
- 验收标准
- 设计参考 (如有)

### 2. 生成原型
在 `specs/{feature}/prototype/` 目录生成**单文件 HTML 原型**:

```html
<!-- specs/{feature}/prototype/index.html -->
<!-- 零依赖，直接浏览器打开 -->
<!DOCTYPE html>
<html>
<head>
  <title>{Feature} 原型</title>
  <style>/* Tailwind CDN 或内联样式 */</style>
</head>
<body>
  <!-- 交互式原型 -->
  <!-- 用真实感的假数据 -->
  <!-- 关键交互可点击 -->
</body>
</html>
```

### 原型要求
- **零依赖**: 单个 HTML 文件，浏览器直接打开
- **真实感**: 用真实样例数据，不用 Lorem ipsum
- **可交互**: 关键操作可点击/输入（用 JS 模拟）
- **响应式**: 适配桌面和移动端
- **标注**: 用注释标注对应的 AC 编号

### 3. 呈现给用户
```
原型已生成: specs/{feature}/prototype/index.html
请用浏览器打开查看。

需要调整的地方：
1. [如果有明显需要确认的设计决策]
2. [交互方式是否符合预期]
```

### 4. 迭代
根据用户反馈修改原型，直到确认满意。
确认后更新 PRD 的"设计参考"，链接到原型文件。

## 输出
```
specs/{feature}/
├── PRD.md
├── DESIGN.md
├── TASKS.md
└── prototype/
    └── index.html    # 可交互原型
```

## 关键原则
- **快**: 10分钟出原型，不是完美设计稿
- **真实**: 假数据也要合理（真实的价格、名称、数量）
- **聚焦**: 只做核心流程，不做全部页面
- **用完即弃**: 原型不是生产代码，确认后可删除
