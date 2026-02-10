import { fromPropertiesFile, inGradleUserHome } from '@gradle-tech/develocity-agent/api/config';

const config = {
  server: {
    url: 'https://ge.solutions-team.gradle.com/',
    accessKey: fromPropertiesFile(inGradleUserHome())
  }
};

export default config;
