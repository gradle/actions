import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const develocityReporter = require.resolve('@gradle-tech/develocity-agent/jest-reporter')

export default {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts', 'json'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  reporters: [
    'default',
    develocityReporter
  ],
  verbose: true
}
