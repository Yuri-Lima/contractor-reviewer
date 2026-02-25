import js from '@eslint/js';
import nxPlugin from '@nx/eslint-plugin';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.angular/**', '**/out-tsc/**', '**/coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@nx': nxPlugin, '@typescript-eslint': tseslint },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: ['@contractai-review/shared'],
          depConstraints: [
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      'no-useless-assignment': 'warn',
      'no-cond-assign': 'warn',
      'preserve-caught-error': 'warn',
      'no-useless-escape': 'warn',
      'no-prototype-builtins': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.jest },
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: { '@nx': nxPlugin },
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: ['@contractai-review/shared'],
          depConstraints: [
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
    },
  },
];
