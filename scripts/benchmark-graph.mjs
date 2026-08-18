import { performance } from 'node:perf_hooks'

import { createRuntimeGraph } from '../packages/core/dist/index.js'
import { layoutFlowNodes } from '../packages/ui/dist/layout.js'
import {
  createFlowElements,
  filterGraphSnapshot,
} from '../packages/ui/dist/model.js'

const nodeCount = 500
const runtimeBudgetMs = 250
const filterBudgetMs = 100
const layoutBudgetMs = 2_000
const store = {}
const atoms = Array.from({ length: nodeCount }, (_, index) => ({
  debugLabel: `benchmarkAtom${index}`,
  toString: () => `benchmarkAtom${index}`,
}))
const values = new Map(atoms.map((atom, index) => [atom, index]))
const dependents = new Map()
atoms.slice(0, -1).forEach((atom, index) => {
  dependents.set(atom, new Set([atoms[index + 1]]))
})

const runtime = createRuntimeGraph()
const runtimeStart = performance.now()
runtime.syncAtomSnapshot(store, { values, dependents })
const runtimeMs = performance.now() - runtimeStart
const snapshot = runtime.getSnapshot()

const filterStart = performance.now()
const filtered = filterGraphSnapshot(snapshot, {
  query: 'benchmarkAtom499',
  showPrivateAtoms: false,
  storeId: 'all',
})
const filterMs = performance.now() - filterStart

const flow = createFlowElements(
  snapshot,
  undefined,
  new Set(),
  new Set(),
)
const layoutStart = performance.now()
const positioned = layoutFlowNodes(flow.nodes, flow.edges)
const layoutMs = performance.now() - layoutStart

const report = {
  nodes: snapshot.nodes.length,
  edges: snapshot.edges.length,
  filteredNodes: filtered.nodes.length,
  positionedNodes: positioned.length,
  runtimeMs: Number(runtimeMs.toFixed(2)),
  filterMs: Number(filterMs.toFixed(2)),
  layoutMs: Number(layoutMs.toFixed(2)),
  budgets: {
    runtimeMs: runtimeBudgetMs,
    filterMs: filterBudgetMs,
    layoutMs: layoutBudgetMs,
  },
}

console.log(JSON.stringify(report, null, 2))

if (runtimeMs >= runtimeBudgetMs) {
  throw new Error(`Runtime sync exceeded ${runtimeBudgetMs}ms`)
}
if (filterMs >= filterBudgetMs) {
  throw new Error(`Graph filter exceeded ${filterBudgetMs}ms`)
}
if (layoutMs >= layoutBudgetMs) {
  throw new Error(`Dagre layout exceeded ${layoutBudgetMs}ms`)
}
