---
name: context-engineering
description: >-
  上下文工程：积极管理 token 预算，防止 context 溢出导致质量下降或超时。
  Use when working on multi-step tasks, dispatching sub-agents, or when context is getting large.
  借鉴 DeerFlow 2.0 的 Context Engineering 设计。
---

# Context Engineering — 上下文管理最佳实践

> 来源: 字节跳动 DeerFlow 2.0 的核心设计理念。
> Context 是最稀缺的资源。积极管理它，不要等到满了才发现。

## 核心原则

```
Context 满了 → 模型开始忘记早期指令 → 输出质量下降 → 任务失败
Context 管理好 → 每一步都有清晰上下文 → 输出稳定 → 任务成功
```

## 3 个实践

### 1. 子代理任务摘要回传（Sub-Agent Summarization）

**问题**: 子代理完成后回传几千 token 的原始输出，撑爆父 session 的 context。

**做法**: 子代理 prompt 末尾加强制摘要指令：

```
## 完成后输出格式（严格遵守）
只输出以下摘要，不超过 200 字：

### 结果摘要
- 完成了什么: [1句话]
- 修改了哪些文件: [列表]
- 验证结果: [通过/失败]
- 未解决问题: [如有]

不要输出完整代码、不要输出调试过程、不要复述任务描述。
```

**效果**: 子代理结果从 ~3000 token 压缩到 ~100 token。

### 2. 中间结果卸载到文件（Filesystem Offload）

**问题**: 读取大文件（如 849 行的 TriangleScanner.ts）后内容留在 context，后续步骤不需要但仍占空间。

**做法**: 分析结果写入文件，context 只保留路径：

```
错误做法:
  读取 TriangleScanner.ts (849行) → 留在 context
  读取 routes.ts (370行) → 留在 context
  读取 db/index.ts (444行) → 留在 context
  = 1663 行代码占据 context

正确做法:
  读取 TriangleScanner.ts → 分析 → 写摘要到 specs/analysis.md
  读取 routes.ts → 分析 → 追加到 specs/analysis.md
  读取 db/index.ts → 分析 → 追加到 specs/analysis.md
  context 只保留: "分析结果见 specs/analysis.md"
```

**适用场景**:
- 代码审查：读完写摘要，不留原文
- 数据分析：结果写文件，不留原始数据
- 多文件操作：每完成一个文件就释放

### 3. 任务间 Context 压缩（Inter-Task Compaction）

**问题**: 多步骤任务中，前面步骤的细节仍占 context，后面步骤空间不足。

**做法**: 每完成一个 task，执行摘要压缩：

```
Task 1 完成 → 
  写 "Task 1 完成: 创建了 Cargo.toml + src/main.rs，编译通过" 到 checkpoint
  前面的编译输出、尝试过的方案等细节不再需要

Task 2 开始 → 
  只需要知道 "Task 1 已完成，项目骨架就绪"
  不需要 Task 1 的 500 行代码细节
```

**在 /spec-execute 中的应用**:
```
对每个 Task:
  1. 执行 task
  2. 验证通过后，写 1 行摘要到 TASKS.md: "✅ Task N: 完成, files: [list]"
  3. 如果 context 超过 60%，执行 /compact
  4. 继续下一个 task
```

## 子代理派发模板（融入 Context Engineering）

```
你是 [角色]。任务：[描述]

## 上下文（精简版，不要读原始文件除非必须）
- 项目路径: [path]
- 技术栈: [简述]
- 前置任务已完成: [1行摘要]

## 你要做的
[具体任务描述]

## ⚠️ Context 管理规则
1. 不要一次性读取超过 3 个文件
2. 读取文件后提取需要的信息，不要把整个文件内容留在脑子里
3. 如果需要参考多个文件，先列出需要的信息点，再逐个查找

## 完成后输出格式（严格遵守，不超过 200 字）
### 结果摘要
- 完成了什么: 
- 修改文件: 
- 验证: 
- 问题: 
```

## 何时触发

- **自动**: 子代理 prompt 中嵌入摘要指令
- **手动**: 长任务中感觉变慢时执行 /checkpoint + /compact
- **Hook**: session-summary hook 在每 30 次工具调用后提醒

## 与 /checkpoint 的关系

| 工具 | 目的 | 触发 |
|------|------|------|
| /checkpoint | 保存进度供下次 session 恢复 | 手动/session 结束 |
| /compact | Claude Code 内置，压缩 context | 手动/hook 提醒 |
| context-engineering | 预防性管理，避免需要 compact | 持续（融入工作流） |
