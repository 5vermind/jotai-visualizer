import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({
  plugins: [jotaiVisualizer(), react()],
})
