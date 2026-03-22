#!/usr/bin/env node
// Stop hook — 每轮对话结束后提醒保存进度

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    
    // 检查是否有 checkpoint 文件
    const fs = require('fs');
    const checkpointPath = '.claude/checkpoint.md';
    
    // 简单的调用计数 (通过环境变量)
    const callCount = parseInt(process.env.ECC_TOOL_CALLS || '0') + 1;
    
    // 每 30 次工具调用提醒一次
    if (callCount > 0 && callCount % 30 === 0) {
      console.error('[session] Context filling up. Consider `/checkpoint` to save progress, or `/compact` to free context.');
    }
    
    console.log(data);
  } catch (e) {
    console.log(data);
  }
});
