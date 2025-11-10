// @ts-check
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import unused from "eslint-plugin-unused-imports";
import simpleSort from "eslint-plugin-simple-import-sort";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      "*.css",
      "*.svg",
      "tailwind.config.ts",
      "vite.config.ts",
      "scripts/**",
      "services/**",
      "examples/**",
      "packages/**",
      "postcss.config.js",
      ".eslint.config.js",
      "eslint.config.js"
    ]
  },

  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: process.cwd()
      },
      globals: {
        console: "readonly",
        fetch: "readonly",
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
      import: importPlugin,
      "unused-imports": unused,
      "simple-import-sort": simpleSort
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      ...js.configs.recommended.rules,

      // TypeScript
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" }
      ],

      // React
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Imports
      "import/first": "warn",
      "import/newline-after-import": "warn",
      "import/no-duplicates": "warn",
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",

      // General JS
      "no-undef": "off"
    }
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      globals: {
        Deno: "readonly",
        console: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        performance: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "simple-import-sort/imports": "off",
      "simple-import-sort/exports": "off"
    }
  }
];
