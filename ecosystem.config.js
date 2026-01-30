module.exports = {
  apps: [{
    name: 'wedding-photos-api',
    script: './dist/server.js',
    instances: 4, // Use 4 cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3333
    },
    // Performance optimizations
    node_args: '--max-old-space-size=896', // Leave headroom for other processes
    error_file: '/dev/null', // Docker logs handle this
    out_file: '/dev/null',
    merge_logs: true,
    // Auto-restart on issues
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Graceful reload
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }]
};
