# @jotai-visualizer/vite

Development-only Vite integration for automatic Jotai hook instrumentation.

```sh
npm install --save-dev @jotai-visualizer/vite
```

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({
  plugins: [jotaiVisualizer(), react()],
})
```

The plugin is `apply: 'serve'`; production builds are not transformed.

- [Automatic instrumentation](https://github.com/5vermind/jotai-visualizer/blob/main/docs/M4_AUTOMATIC_INSTRUMENTATION.md)
- [Compatibility](https://github.com/5vermind/jotai-visualizer/blob/main/docs/COMPATIBILITY.md)
- [MIT License](./LICENSE)
