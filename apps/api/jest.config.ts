export default {
  displayName: 'api',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@contractai-review/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
};
