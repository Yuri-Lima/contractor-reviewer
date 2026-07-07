export default {
  displayName: 'api',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'mjs'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@contractai-review/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    // Prefer UMD build so Jest (CJS) can load marked without ESM transform
    '^marked$':
      '<rootDir>/../../node_modules/.pnpm/marked@16.4.2/node_modules/marked/lib/marked.umd.js',
  },
};
