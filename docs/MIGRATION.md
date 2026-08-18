# Migration guide

## Manual tracked hooks to Vite instrumentation

Before M4:

```tsx
const count = useTrackedAtomValue(countAtom, {
  id: 'src/Counter.tsx#Counter',
  name: 'Counter',
  file: 'src/Counter.tsx',
})
```

With `@jotai-visualizer/vite`:

```tsx
const count = useAtomValue(countAtom)
```

Add `jotaiVisualizer()` before `react()` in `vite.config.ts`. Keep manual tracked hooks
for unsupported custom-hook or namespace-import patterns.

## Value preview changes

Value preview is opt-in. Create RuntimeGraph with `valuePreview.enabled: true` and define
a redaction callback before expecting values in atom nodes.

## Private atoms

Collectors now retain private atom metadata so the UI toggle can reveal them. They remain
hidden by default in the panel.

## Store disposal

If an application creates and permanently disposes custom Stores outside React Provider
lifecycle, call `runtime.releaseStore(store)` to remove atom identities and edges.

## Production entry

Conditional JSX alone may keep static Visualizer imports in a production bundle. Move all
Visualizer imports into a `DevRoot` module and dynamically import that module inside
`import.meta.env.DEV`.
