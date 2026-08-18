import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@jotai-visualizer/babel-plugin': fileURLToPath(
        new URL('./packages/babel-plugin/src/index.ts', import.meta.url),
      ),
    },
  },
})
