// eslint.config.js — sans @eslint/js
import tsParser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignorés
  { ignores: ["dist/**", "build/**", "node_modules/**", "coverage/**", "supabase/functions/**"] },

  // Base commune JS/TS/React (on n’utilise PAS js.configs.recommended)
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { window: "readonly", document: "readonly" },
    },
    plugins: {
      "@typescript-eslint": ts,
      import: importPlugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": { node: { extensions: [".js", ".jsx", ".ts", ".tsx"] } },
    },
    rules: {
      // “dur”
      "no-redeclare": "error",
      "no-duplicate-imports": "error",
      "import/no-unresolved": "error",
      "react-hooks/rules-of-hooks": "error",

      // “soft” pour réduire le bruit
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "warn",
      "eqeqeq": ["warn", "smart"],
    },
  },

  // Tests (si présents)
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
];
