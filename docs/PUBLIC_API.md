# Public API for 0.1

Jotai Visualizer is ESM-only. Public package exports resolve exclusively to `dist` files.
Anything not reachable through the documented package exports is internal and may change
without notice during the 0.x series.

## `@jotai-visualizer/core`

Framework-independent APIs:

- `createGraphStore`
- `createRuntimeGraph`
- `createObjectIdRegistry`
- `createValuePreview`
- graph node/edge type guards
- GraphStore, RuntimeGraph, patch, snapshot, traversal, metadata, and preview types

Use this package to build a different UI or adapter without React/Jotai coupling.

## `@jotai-visualizer/ui`

- `GraphPanel`
- `layoutFlowNodes`
- `filterGraphSnapshot`
- `createFlowElements`
- `getConnectedNodeIds`
- related UI model and prop types
- `@jotai-visualizer/ui/styles.css`

The main entry imports the required React Flow and Visualizer styles.

## `@jotai-visualizer/react`

- `RuntimeGraphProvider`
- `JotaiGraphCollector`
- `JotaiVisualizer`
- `GraphSnapshotLogger`
- `createRuntimeGraph` re-export
- `useRuntimeGraph`
- `useRuntimeGraphSnapshot`
- manual fallback hooks: `useTrackedAtom`, `useTrackedAtomValue`, `useTrackedSetAtom`
- React/Jotai prop and runtime types

### Tooling-only subpath

`@jotai-visualizer/react/instrumentation` exports tracked hooks and
`registerVisualizerModule` for the Vite virtual module. Application code should use the
main entry unless it is implementing another build integration.

## `@jotai-visualizer/babel-plugin`

- default Babel plugin export
- instrumentation option, diagnostic, and metadata types

The plugin targets Babel 7. Vite users should normally install the Vite package instead.

## `@jotai-visualizer/vite`

- default Vite plugin export
- `transformJotaiModule` for programmatic adapters
- virtual module constants/source
- root filtering helper
- plugin option and transform result types

The default Vite plugin is development-only (`apply: 'serve'`).

## Stability

The following are intentionally not public:

- Jotai private Store maps and hooks
- React Flow node implementation details
- active runtime and delayed HMR cleanup registries
- built-in Jotai inspector Store maps and hook composition

Since this is version `0.1.0`, semver-compatible additions are expected, but APIs may still
need breaking changes before `1.0.0`. Breaking changes will be recorded in the changelog and
migration guide.
