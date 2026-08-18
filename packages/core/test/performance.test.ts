import { describe, expect, it } from 'vitest'

import {
  createRuntimeGraph,
  type RuntimeAtom,
} from '../src/index.js'

const createAtomIdentity = (index: number): RuntimeAtom => ({
  debugLabel: `benchmarkAtom${index}`,
  toString: () => `benchmarkAtom${index}`,
})

describe('RuntimeGraph performance and lifecycle budgets', () => {
  it('syncs a 500-node dependency graph within the M5 budget', () => {
    const runtime = createRuntimeGraph()
    const store = {}
    const atoms = Array.from({ length: 500 }, (_, index) =>
      createAtomIdentity(index),
    )
    const values = new Map<RuntimeAtom, unknown>(
      atoms.map((atom, index) => [atom, index]),
    )
    const dependents = new Map<RuntimeAtom, ReadonlySet<RuntimeAtom>>()
    atoms.slice(0, -1).forEach((atom, index) => {
      dependents.set(atom, new Set([atoms[index + 1]!]))
    })
    let notifications = 0
    runtime.subscribe(() => {
      notifications += 1
    })

    const startedAt = performance.now()
    runtime.syncAtomSnapshot(store, { values, dependents })
    const duration = performance.now() - startedAt

    expect(runtime.getSnapshot().nodes).toHaveLength(500)
    expect(runtime.getSnapshot().edges).toHaveLength(499)
    expect(duration).toBeLessThan(250)
    expect(notifications).toBe(1)

    runtime.syncAtomSnapshot(store, { values, dependents })
    expect(notifications).toBe(1)
  })

  it('returns to an empty visible graph after 100 lifecycle cycles', () => {
    const runtime = createRuntimeGraph()

    for (let index = 0; index < 100; index += 1) {
      const store = {}
      const atom = createAtomIdentity(index)
      const unregister = runtime.registerConsumer({
        store,
        atom,
        component: {
          id: `test/lifecycle#Component${index}`,
          name: `Component${index}`,
          file: `test/lifecycle-${index}.tsx`,
        },
        access: 'read',
      })
      runtime.syncAtomSnapshot(store, {
        values: new Map([[atom, index]]),
        dependents: new Map(),
      })
      unregister()
      runtime.releaseStore(store)
    }

    expect(runtime.getSnapshot()).toEqual({ nodes: [], edges: [] })
  })
})
