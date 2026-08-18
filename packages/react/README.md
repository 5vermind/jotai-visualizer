# @jotai-visualizer/react

Jotai runtime collection, tracked hooks, and the embedded Visualizer panel.

```sh
npm install @jotai-visualizer/react jotai react react-dom
```

```tsx
import {
  JotaiGraphCollector,
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
} from '@jotai-visualizer/react'

const runtime = createRuntimeGraph()

<RuntimeGraphProvider runtime={runtime}>
  <JotaiGraphCollector />
  <Application />
  <JotaiVisualizer />
</RuntimeGraphProvider>
```

Use `@jotai-visualizer/vite` to instrument ordinary Jotai hooks automatically.

- [Installation](https://github.com/5vermind/jotai-visualizer/blob/main/docs/INSTALLATION.md)
- [Compatibility](https://github.com/5vermind/jotai-visualizer/blob/main/docs/COMPATIBILITY.md)
- [Privacy](https://github.com/5vermind/jotai-visualizer/blob/main/docs/PRIVACY.md)
- [MIT License](./LICENSE)
