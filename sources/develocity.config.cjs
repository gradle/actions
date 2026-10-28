const { fromPropertiesFile, inGradleUserHome } = require('@gradle-tech/develocity-agent/api/config');

module.exports = {
  server: {
    url: 'https://solutions.develocity.cloud/',
    accessKey: fromPropertiesFile(inGradleUserHome())
  },
}
