module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2018' } }],
  },
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  // Resets the i18n locale to English before each test — the specs assert on
  // English strings, and a locale switch would otherwise leak between suites.
  setupFilesAfterEnv: ['<rootDir>/src/__mocks__/setupLocale.ts'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts'
  }
};
