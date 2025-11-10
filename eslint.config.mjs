// eslint.config.mjs — Vite + React + TS + Deno (Supabase)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const tsProject = ['./tsconfig.app.json', './tsconfig.node.json'];
const tsTypedConfigs = ts.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ['src/**/*.{ts,tsx}', 'actions/**/*.{ts,tsx}'],
  ignores: [...(config.ignores ?? []), 'supabase/functions/**', 'tailwind.config.ts', 'vite.config.ts'],
}));

export default [
  { ignores: ['node_modules', 'dist', 'build', '.next', 'coverage', 'eslint.config.mjs', 'packages/eslint-plugin-react', 'scripts/codex/**'] },
  js.configs.recommended,
  ...tsTypedConfigs,
  {
    files: ['src/**/*.{ts,tsx}', 'actions/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: tsProject,
        tsconfigRootDir: new URL('.', import.meta.url),
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-no-undef': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      'prefer-const': 'warn',
      'no-irregular-whitespace': 'error',
      'no-control-regex': 'error',
      'no-useless-escape': 'warn',
      'no-empty': 'warn',
    },
  },
  {
    files: ['tailwind.config.ts', 'vite.config.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        project: null,
      },
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'examples/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: {
        project: null,
      },
      globals: {
        Deno: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'warn',
      'no-useless-escape': 'off',
      'no-empty': 'off',
      'no-redeclare': 'off',
    },
  },
const typeCheckedFiles = [
  'src/**/*.{ts,tsx}',
  'actions/**/*.{ts,tsx}',
  'apps/**/*.{ts,tsx}',
  'examples/**/*.{ts,tsx}',
  'pages/**/*.{ts,tsx}',
  'packages/**/*.{ts,tsx}',
  'middleware.ts'
];

const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map(config => ({
  ...config,
  files: typeCheckedFiles,
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      project: ['./tsconfig.app.json'],
      tsconfigRootDir: new URL('.', import.meta.url)
    }
  }
}));

export default [
  { ignores: ['node_modules', 'dist', 'build', '.next', 'coverage', 'eslint.config.mjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { project: null },
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { react, 'react-hooks': reactHooks },
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

  ...typeCheckedConfigs,

  // ✅ Deno (Supabase Edge Functions)
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
  // ⬇️ Supabase Edge Functions (Deno runtime)
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
      'no-undef': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_$', varsIgnorePattern: '^(_|__|_[A-Za-z].*)$' }
      ]
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_$',
        varsIgnorePattern: '^(_|__|_[A-Za-z].*)$'
      }]
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_$', varsIgnorePattern: '^(_|__|_[A-Za-z].*)$' }
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off'
    }
  }
];
