#!/usr/bin/env node
// Stop hook — 检测是否有值得记录的决策/模式

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const response = input.tool_output?.content || input.tool_output || '';
    
    // 检测决策类关键词
    const decisionPatterns = [
      /decided to/i,
      /chose .+ over/i,
      /rejected .+ because/i,
      /trade-?off/i,
      /方案[AB]|选择了|决定用|放弃了/,
    ];
    
    const hasDecision = decisionPatterns.some(p => p.test(String(response)));
    
    if (hasDecision) {
      console.error('[knowledge] Decision detected. Consider recording in specs/decisions.md or checkpoint for future reference.');
    }

    console.log(data);
  } catch (e) {
    console.log(data);
  }
});
