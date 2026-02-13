module.exports = {
  apps: [{
    name: 'image-edit-bot',
    script: 'index.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
