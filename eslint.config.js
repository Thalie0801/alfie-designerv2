import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      react,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "no-irregular-whitespace": "error",
      "no-control-regex": "off",
      "no-useless-escape": "off",
      "no-empty": "off",
      "no-case-declarations": "off",
      "no-unused-vars": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/prop-types": "off",
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        Deno: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "examples/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);
