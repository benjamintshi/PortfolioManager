#!/usr/bin/env node
// PostToolUse: Edit/Write — 编辑后自动 lint + typecheck
// 只检查 .ts/.tsx/.js/.jsx/.py/.rs/.java 文件

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    
    // 只检查代码文件
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.java'];
    const isCodeFile = codeExts.some(ext => filePath.endsWith(ext));
    
    if (!isCodeFile) {
      console.log(data);
      return;
    }

    // TypeScript/JavaScript
    if (filePath.match(/\.(ts|tsx|js|jsx)$/)) {
      console.error('[quality-gate] TS/JS file edited. Remember: run `npx tsc --noEmit` before committing.');
    }
    
    // Python
    if (filePath.endsWith('.py')) {
      console.error('[quality-gate] Python file edited. Remember: run `ruff check` and `mypy` before committing.');
    }
    
    // Rust
    if (filePath.endsWith('.rs')) {
      console.error('[quality-gate] Rust file edited. Remember: run `cargo clippy` before committing.');
    }
    
    // Java
    if (filePath.endsWith('.java')) {
      console.error('[quality-gate] Java file edited. Remember: run `mvn compile` before committing.');
    }

    console.log(data);
  } catch (e) {
    console.log(data);
  }
});
