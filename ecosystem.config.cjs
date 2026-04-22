module.exports = {
  apps: [
    {
      name: 'cerebroslide',
      script: './node_modules/.bin/tsx',
      args: 'server.ts',
      cwd: '/root/huidu/CerebroSlide',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3456
      },
      // 日志配置
      log_file: '/root/huidu/CerebroSlide/logs/combined.log',
      out_file: '/root/huidu/CerebroSlide/logs/out.log',
      error_file: '/root/huidu/CerebroSlide/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 自动重启配置
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // 内存限制，超过自动重启
      max_memory_restart: '500M',
      // 崩溃重启延迟
      restart_delay: 3000,
      // 监视文件变化（生产环境不启用）
      watch: false,
      // 健康检查
      health_check_grace_period: 30000,
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
    }
  ]
};
