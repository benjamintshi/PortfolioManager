#!/usr/bin/env node
// PreToolUse + PostToolUse: * — 记录所有工具调用到 observations.jsonl
// 轻量版 Instinct 观察层：只记录，不分析

const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    
    // 确定项目 ID (git remote hash 或 cwd)
    let projectId = 'global';
    let projectName = 'global';
    try {
      const { execSync } = require('child_process');
      const remote = execSync('git remote get-url origin 2>/dev/null', { encoding: 'utf8' }).trim();
      if (remote) {
        // 简单 hash: 取前12字符
        const crypto = require('crypto');
        projectId = crypto.createHash('sha256').update(remote).digest('hex').slice(0, 12);
        projectName = path.basename(remote, '.git');
      }
    } catch {
      // 非 git 项目，用 cwd
      projectName = path.basename(process.cwd());
    }

    // 构造观察记录
    const observation = {
      ts: new Date().toISOString(),
      project: projectId,
      projectName,
      tool: input.tool_name || 'unknown',
      phase: input.tool_output ? 'post' : 'pre',
    };

    // 提取关键信息（不记录完整内容，控制大小）
    const ti = input.tool_input || {};
    if (ti.command) observation.command = ti.command.slice(0, 200);
    if (ti.file_path || ti.path) observation.file = (ti.file_path || ti.path);
    if (ti.old_string) observation.action = 'edit';
    if (ti.content) observation.action = 'write';
    
    // PostToolUse: 记录结果摘要
    if (input.tool_output) {
      const out = String(input.tool_output.content || input.tool_output || '');
      if (out.includes('error') || out.includes('Error') || out.includes('ERROR')) {
        observation.hasError = true;
      }
      observation.exitCode = input.tool_output.exit_code;
    }

    // 写入 observations.jsonl
    const obsDir = path.join(process.cwd(), '.claude', 'learning');
    if (!fs.existsSync(obsDir)) {
      fs.mkdirSync(obsDir, { recursive: true });
    }
    
    const obsFile = path.join(obsDir, 'observations.jsonl');
    
    // 文件大小限制: 超过 1MB 就轮转
    try {
      const stat = fs.statSync(obsFile);
      if (stat.size > 1024 * 1024) {
        const archive = obsFile + '.' + Date.now() + '.bak';
        fs.renameSync(obsFile, archive);
      }
    } catch { /* file doesn't exist yet */ }
    
    fs.appendFileSync(obsFile, JSON.stringify(observation) + '\n');

    // 透传原始数据
    console.log(data);
  } catch (e) {
    // 观察失败不阻塞工具执行
    console.log(data);
  }
});
