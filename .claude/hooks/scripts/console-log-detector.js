#!/usr/bin/env node
// PostToolUse: Edit/Write — 检测代码中的 debug 语句

const DEBUG_PATTERNS = {
  '.ts':   [/console\.log\(/],
  '.tsx':  [/console\.log\(/],
  '.js':   [/console\.log\(/],
  '.jsx':  [/console\.log\(/],
  '.py':   [/\bprint\s*\(/, /\bbreakpoint\s*\(/],
  '.rs':   [/\bprintln!\s*\(/, /\bdbg!\s*\(/],
  '.java': [/System\.out\.print/],
};

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const content = input.tool_input?.content || input.tool_input?.new_string || '';
    
    const ext = filePath.match(/\.[^.]+$/)?.[0] || '';
    const patterns = DEBUG_PATTERNS[ext];
    
    if (patterns && content) {
      const found = [];
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          found.push(pattern.source);
        }
      }
      if (found.length > 0) {
        console.error(`[WARNING] Debug statement detected in ${filePath}: ${found.join(', ')}. Remove before committing.`);
      }
    }

    console.log(data);
  } catch (e) {
    console.log(data);
  }
});
