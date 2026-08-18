# Installation

## Requirements

- Node.js 20.18.1 or newer
- React 18.3 or 19
- Jotai 2.20
- Vite 6.4 for automatic instrumentation

## Install

After npm registry publishing is enabled for the `@jotai-visualizer` scope:

```sh
npm install @jotai-visualizer/react
npm install --save-dev @jotai-visualizer/vite
```

Until then, download the five `0.1.0` tarballs from the
[GitHub Release](https://github.com/5vermind/jotai-visualizer/releases/tag/v0.1.0)
and install them together with local file paths.

```json
{
  "dependencies": {
    "@jotai-visualizer/core": "file:./vendor/jotai-visualizer-core-0.1.0.tgz",
    "@jotai-visualizer/ui": "file:./vendor/jotai-visualizer-ui-0.1.0.tgz",
    "@jotai-visualizer/react": "file:./vendor/jotai-visualizer-react-0.1.0.tgz"
  },
  "devDependencies": {
    "@jotai-visualizer/babel-plugin": "file:./vendor/jotai-visualizer-babel-plugin-0.1.0.tgz",
    "@jotai-visualizer/vite": "file:./vendor/jotai-visualizer-vite-0.1.0.tgz"
  },
  "pnpm": {
    "overrides": {
      "@jotai-visualizer/core": "file:./vendor/jotai-visualizer-core-0.1.0.tgz",
      "@jotai-visualizer/ui": "file:./vendor/jotai-visualizer-ui-0.1.0.tgz",
      "@jotai-visualizer/react": "file:./vendor/jotai-visualizer-react-0.1.0.tgz",
      "@jotai-visualizer/babel-plugin": "file:./vendor/jotai-visualizer-babel-plugin-0.1.0.tgz",
      "@jotai-visualizer/vite": "file:./vendor/jotai-visualizer-vite-0.1.0.tgz"
    }
  }
}
```

```sh
pnpm install
```

The overrides are required until internal scoped dependencies are available from npm.

## Configure Vite

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import jotaiVisualizer from '@jotai-visualizer/vite'

export default defineConfig({
  plugins: [jotaiVisualizer(), react()],
})
```

## Create the development root

```tsx
import {
  JotaiGraphCollector,
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
} from '@jotai-visualizer/react'

const runtime = createRuntimeGraph({
  valuePreview: {
    enabled: true,
    redact: (_value, { atomLabel }) =>
      /password|secret|token/i.test(atomLabel),
  },
})

export function DevRoot() {
  return (
    <RuntimeGraphProvider runtime={runtime}>
      <JotaiGraphCollector />
      <Application />
      <JotaiVisualizer />
    </RuntimeGraphProvider>
  )
}
```

## Remove it from production

```tsx
if (import.meta.env.DEV) {
  void import('./DevRoot.js').then(({ DevRoot }) => {
    root.render(<DevRoot />)
  })
} else {
  root.render(<Application />)
}
```

The dynamic import is required to remove Visualizer JavaScript and CSS from the
production graph.

## Multiple Stores

Render one collector for every Store and one Visualizer for the shared runtime.

```tsx
<RuntimeGraphProvider runtime={runtime}>
  <JotaiGraphCollector />
  <Provider store={customStore}>
    <JotaiGraphCollector store={customStore} />
    <Application />
  </Provider>
  <JotaiVisualizer />
</RuntimeGraphProvider>
```

## Verify

```sh
npm run dev
npm run build
```

Search the production output for `data-jotai-visualizer` if you want an additional
tree-shaking assertion.
