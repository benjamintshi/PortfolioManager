#!/usr/bin/env node
// PreToolUse: Bash — 阻止危险命令

const BLOCKED_PATTERNS = [
  /^rm\s+(-rf?\s+)?\/($|\s)/,           // rm -rf /
  /^rm\s+(-rf?\s+)?~($|\s)/,            // rm -rf ~
  /^sudo\s/,                              // sudo anything
  /\|\s*bash$/,                           // curl | bash
  /^chmod\s+777/,                         // chmod 777
  /^dd\s+.*of=\/dev\//,                  // dd to device
  /^mkfs/,                                // format filesystem
  />\s*\/dev\/sd/,                        // write to disk device
  /^:(){ :\|:& };:/,                     // fork bomb
];

const WARN_PATTERNS = [
  { pattern: /^git\s+push\s+(-f|--force)/, msg: 'Force push detected. Are you sure?' },
  { pattern: /^git\s+reset\s+--hard/, msg: 'Hard reset will lose uncommitted changes.' },
  { pattern: /^npm\s+run\s+dev\b/, msg: 'Long-running dev server. Consider using tmux/background.' },
  { pattern: /^docker\s+system\s+prune/, msg: 'This will remove unused Docker resources.' },
  { pattern: /DROP\s+(TABLE|DATABASE)/i, msg: 'Destructive SQL detected. Double-check.' },
];

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const command = input.tool_input?.command || '';
    
    // Block dangerous commands
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        console.error(`[BLOCKED] Dangerous command: ${command}`);
        process.exit(2); // exit 2 = block
      }
    }
    
    // Warn on risky commands
    for (const { pattern, msg } of WARN_PATTERNS) {
      if (pattern.test(command)) {
        console.error(`[WARNING] ${msg} Command: ${command}`);
      }
    }

    console.log(data);
  } catch (e) {
    console.log(data);
  }
});
