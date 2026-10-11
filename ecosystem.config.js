/**
 * PM2 24/7 Zero-Downtime Daemon Ecosystem Configuration
 * 
 * Usage:
 *   npx pm2 start ecosystem.config.js
 *   npx pm2 status
 *   npx pm2 logs
 *   npx pm2 stop ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: "mail-automation-backend",
      cwd: "./backend",
      script: "node",
      args: "-r tsx/cjs src/server.ts",
      autorestart: true,
      watch: false,
      max_restarts: 100,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "../logs/backend-error.log",
      out_file: "../logs/backend-out.log",
      time: true,
    },
    {
      name: "mail-automation-frontend",
      cwd: "./frontend",
      script: "npm",
      args: "run dev",
      autorestart: true,
      watch: false,
      max_restarts: 100,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "500M",
      env: {
        PORT: 3002,
      },
      error_file: "../logs/frontend-error.log",
      out_file: "../logs/frontend-out.log",
      time: true,
    },
  ],
};
