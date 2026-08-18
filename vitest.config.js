import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@jotai-visualizer/babel-plugin': fileURLToPath(
        new URL('./packages/babel-plugin/src/index.ts', import.meta.url),
      ),
      '@jotai-visualizer/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url),
      ),
      '@jotai-visualizer/react/instrumentation': fileURLToPath(
        new URL('./packages/react/src/instrumentation.ts', import.meta.url),
      ),
      '@jotai-visualizer/react': fileURLToPath(
        new URL('./packages/react/src/index.ts', import.meta.url),
      ),
      '@jotai-visualizer/ui': fileURLToPath(
        new URL('./packages/ui/src/index.ts', import.meta.url),
      ),
      '@jotai-visualizer/vite': fileURLToPath(
        new URL('./packages/vite/src/index.ts', import.meta.url),
      ),
    },
  },
})
