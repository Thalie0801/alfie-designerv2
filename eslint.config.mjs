import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const tsConfigs = tsPlugin.configs['flat/recommended-type-checked'] ?? [];

export default [
  { ignores: ['node_modules', 'dist', 'build', '.next', 'coverage'] },
  js.configs.recommended,
  ...tsConfigs,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: null },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react,
      'react-hooks': reactHooks
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: new URL('.', import.meta.url)
      },
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {}
  },
  {
    files: ['supabase/functions/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
        ResponseInit: 'readonly',
        RequestInfo: 'readonly',
        fetch: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_$', varsIgnorePattern: '^(_|__|_[A-Za-z].*)$' }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off'
    }
  }
];
