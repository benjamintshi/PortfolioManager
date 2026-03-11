module.exports = {
  apps: [{
    name: 'portfolio-backend',
    script: 'node_modules/.bin/tsx',
    args: 'src/index.ts',
    cwd: '/Users/starblue/claude/portfolio-manager/backend',
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 6002,
      TZ: 'Asia/Shanghai',
      // Telegram配置（可选）
      TELEGRAM_CHAT_ID: '-5170247327' // 消息中心群
      // TELEGRAM_BOT_TOKEN: 'your-bot-token' // 如果有独立bot
    },
    
    env_development: {
      NODE_ENV: 'development',
      PORT: 6002,
      TZ: 'Asia/Shanghai'
    },
    
    // 日志配置
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // 重启配置
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '30s',
    
    // 内存和CPU配置
    max_memory_restart: '512M',
    
    // 进程管理
    kill_timeout: 10000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // 自动重启条件
    exp_backoff_restart_delay: 100,
    
    // 健康检查
    health_check_grace_period: 30000,
    
    // 其他配置
    node_args: '--max-old-space-size=512',
    merge_logs: true,
    time: true
  }],

  // 部署配置（可选）
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/master',
      repo: 'git@github.com:repo.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};