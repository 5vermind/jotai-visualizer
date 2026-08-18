# @jotai-visualizer/core

Framework-independent graph storage and runtime lifecycle primitives for
Jotai Visualizer.

```sh
npm install @jotai-visualizer/core
```

```ts
import { createGraphStore, createRuntimeGraph } from '@jotai-visualizer/core'

const graph = createGraphStore()
const runtime = createRuntimeGraph()
```

Includes atomic `GraphPatch` validation, immutable snapshots, object identity,
Store lifecycle, cycle-safe traversal, and privacy-first value previews.

- [Graph Core documentation](https://github.com/5vermind/jotai-visualizer/blob/main/docs/GRAPH_CORE.md)
- [Compatibility](https://github.com/5vermind/jotai-visualizer/blob/main/docs/COMPATIBILITY.md)
- [MIT License](./LICENSE)
