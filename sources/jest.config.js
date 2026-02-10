const develocityReporter = require.resolve('@gradle-tech/develocity-agent/jest-reporter');

module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts', 'json'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  reporters: [
      'default',
      develocityReporter
  ],
  verbose: true
}
