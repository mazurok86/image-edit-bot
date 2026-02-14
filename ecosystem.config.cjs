module.exports = {
  apps: [{
    name: 'image-edit-bot',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
