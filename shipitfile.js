module.exports = function (shipit) {
  require('shipit-deploy')(shipit)

  shipit.initConfig({
    default: {
      workspace: '/tmp/github-monitor',
      deployTo: '/app/cti-hant-counter',
      repositoryUrl: 'https://github.com/zackexplosion/HanCount',
    },
    production: {
      servers: 'zack@YEE'
    }
  })

  shipit.on('deployed', async function () {
    try {
      await shipit.remote(`cd ${shipit.currentPath} && nvm use && yarn`)
    } catch (error) {
      console.log(error)
    }
    shipit.start('startApp')
  })

  shipit.task('startApp', async () => {
    const name = 'cti-hant-counter'
    const current_path = `${shipit.config.deployTo}/current`
    try {
      // await shipit.remote(`pm2 start ${current_path}/index.js --name ${name}`)
      await shipit.remote(`pm2 start ecosystem.config.js --name ${name}`)
    } catch (error) {
      await shipit.remote(`pm2 restart ${name}`)
    }

  })
}