module.exports = {
  apps: [{
    name: 'crm-electrical',
    script: '.output/server/index.mjs',
    cwd: '/var/www/crm/crm-electrical',
    env_file: '/var/www/crm/crm-electrical/.env',
    instances: 1,
    exec_mode: 'fork'
  }]
}
