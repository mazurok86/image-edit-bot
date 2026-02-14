import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

const { configs } = js;

export default tseslint.config(
  configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      ...prettier.rules,
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);
