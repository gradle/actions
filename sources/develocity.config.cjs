const { fromPropertiesFile, inGradleUserHome } = require('@gradle-tech/develocity-agent/api/config');

module.exports = {
  server: {
    url: 'https://ge.solutions-team.gradle.com/',
    accessKey: fromPropertiesFile(inGradleUserHome())
  },
}
