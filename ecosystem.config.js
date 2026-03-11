module.exports = {
  apps: [
    {
      name: 'portfolio-backend',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/Users/starblue/claude/portfolio-manager/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 6002,
        TZ: 'Asia/Shanghai',
      },
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      max_memory_restart: '512M',
      merge_logs: true,
      time: true
    },
    {
      name: 'portfolio-frontend',
      script: 'node_modules/.bin/vite',
      args: '--port 3007 --host',
      cwd: '/Users/starblue/claude/portfolio-manager/frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      restart_delay: 5000,
      max_restarts: 5,
      max_memory_restart: '256M',
      merge_logs: true,
      time: true
    }
  ]
};
