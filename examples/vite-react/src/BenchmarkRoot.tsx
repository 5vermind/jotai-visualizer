import {
  JotaiVisualizer,
  RuntimeGraphProvider,
  createRuntimeGraph,
  type RuntimeAtom,
} from '@jotai-visualizer/react'

const nodeCount = 500
const store = {}
const atoms: RuntimeAtom[] = Array.from({ length: nodeCount }, (_, index) => ({
  debugLabel: `benchmarkAtom${index}`,
  toString: () => `benchmarkAtom${index}`,
}))
const values = new Map<RuntimeAtom, unknown>(
  atoms.map((target, index) => [target, index]),
)
const dependents = new Map<RuntimeAtom, ReadonlySet<RuntimeAtom>>()
atoms.slice(0, -1).forEach((target, index) => {
  dependents.set(target, new Set([atoms[index + 1]!]))
})
const runtime = createRuntimeGraph()
runtime.syncAtomSnapshot(store, { values, dependents })

export function BenchmarkRoot() {
  return (
    <RuntimeGraphProvider runtime={runtime}>
      <main>
        <header className="hero">
          <p className="eyebrow">M5 browser benchmark</p>
          <h1>500-node graph</h1>
          <p>Pan and zoom the synthetic dependency chain.</p>
        </header>
      </main>
      <JotaiVisualizer initialOpen title="Jotai Visualizer · 500 node benchmark" />
    </RuntimeGraphProvider>
  )
}
