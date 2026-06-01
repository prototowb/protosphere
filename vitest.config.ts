import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/test/**',
        'src/lib/emojiMap.ts',
        'src/lib/emojiNames.ts',
        // Side-effect modules that can't be meaningfully unit-tested
        'src/lib/supabase.ts',
        'src/lib/markdown.ts',
      ],
      thresholds: {
        // Global: tracks the overall floor — raise as coverage improves
        lines: 8,
        functions: 7,
        branches: 10,
        statements: 8,
        // Domain layer: enforce high coverage on the pure functions we test
        'src/lib/automod.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/lib/formatters.ts': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/lib/mentions.ts': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/lib/messageSearch.ts': { lines: 95, functions: 95, branches: 95, statements: 95 },
        'src/lib/permissions.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/lib/roles.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/lib/unread.ts': { lines: 95, functions: 95, branches: 95, statements: 95 },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
