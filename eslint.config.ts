import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import type { Linter } from 'eslint'

export default [
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // Vue SFC rules
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // ── TypeScript ─────────────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',    // covered by tsconfig noUnusedLocals
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // ── Vue ────────────────────────────────────────────────────────────────
      'vue/multi-word-component-names': 'off',       // project uses single-word names freely
      'vue/require-default-prop': 'off',             // optional props don't need defaults
      'vue/no-v-html': 'warn',                       // we use v-html intentionally (renderMessage)
      'vue/component-api-style': ['error', ['script-setup']],
      // HTML formatting — codebase uses compact style intentionally
      'vue/max-attributes-per-line': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',

      // ── General ───────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Test files: relax some rules
  {
    files: ['src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // Ignore build outputs and generated files
  {
    ignores: ['dist/**', 'node_modules/**', 'src/lib/emojiMap.ts', 'src/lib/emojiNames.ts'],
  },
] satisfies Linter.Config[]
