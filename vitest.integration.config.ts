import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/integration/**/*.test.ts'],
    globalSetup: ['./src/test/integration/global-setup.ts'],
    // Integration tests hit real network — give them room
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Run sequentially — tests share a live DB
    pool: 'forks',
    singleFork: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
