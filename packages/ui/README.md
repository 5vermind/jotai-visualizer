# @jotai-visualizer/ui

Framework-neutral React graph panel for Jotai Visualizer `RuntimeGraph` data.

```sh
npm install @jotai-visualizer/ui @jotai-visualizer/core
```

```tsx
import { GraphPanel } from '@jotai-visualizer/ui'

<GraphPanel runtime={runtime} />
```

The package includes React Flow, Dagre layout, Store/private filters, node
details, relationship highlighting, and atom revision feedback. Styles are
loaded by the main entry and are also exported as `@jotai-visualizer/ui/styles.css`.

- [Embedded Visualizer documentation](https://github.com/5vermind/jotai-visualizer/blob/main/docs/M3_EMBEDDED_VISUALIZER.md)
- [Performance](https://github.com/5vermind/jotai-visualizer/blob/main/docs/PERFORMANCE.md)
- [MIT License](./LICENSE)
