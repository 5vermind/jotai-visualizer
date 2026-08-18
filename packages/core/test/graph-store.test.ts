import { describe, expect, it, vi } from 'vitest'

import {
  createGraphStore,
  type GraphPatch,
} from '../src/index.js'

const basePatch: GraphPatch = {
  upsertNodes: [
    { kind: 'atom', id: 'a', storeId: 'store:1', label: 'A' },
    { kind: 'atom', id: 'b', storeId: 'store:1', label: 'B' },
  ],
  upsertEdges: [
    { kind: 'atom-dependency', id: 'a-to-b', source: 'a', target: 'b' },
  ],
}

describe('GraphStore', () => {
  it('applies the same patch idempotently and only notifies on changes', () => {
    const store = createGraphStore()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.applyPatch(basePatch)).toMatchObject({
      applied: true,
      changed: true,
    })
    const firstSnapshot = store.getSnapshot()
    expect(store.applyPatch(basePatch)).toEqual({
      applied: true,
      changed: false,
      issues: [],
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(firstSnapshot)
    expect(firstSnapshot.nodes).toHaveLength(2)
    expect(firstSnapshot.edges).toHaveLength(1)
    expect(Object.isFrozen(firstSnapshot)).toBe(true)
    expect(Object.isFrozen(firstSnapshot.nodes)).toBe(true)
  })

  it('rejects invalid patches atomically with structured issues', () => {
    const store = createGraphStore()
    store.applyPatch({
      upsertNodes: [
        { kind: 'atom', id: 'a', storeId: 'store:1', label: 'A' },
      ],
    })
    const before = store.getSnapshot()

    const result = store.applyPatch({
      upsertNodes: [
        { kind: 'component', id: 'component:new', label: 'NewComponent' },
      ],
      upsertEdges: [
        {
          kind: 'component-consumer',
          id: 'invalid-edge',
          source: 'missing-atom',
          target: 'component:new',
          access: 'read',
        },
      ],
    })

    expect(result.applied).toBe(false)
    expect(result.changed).toBe(false)
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-endpoint',
          path: 'upsertEdges[0].source',
        }),
      ]),
    )
    expect(store.getSnapshot()).toBe(before)
    expect(
      store.getSnapshot().nodes.some((node) => node.id === 'component:new'),
    ).toBe(false)
  })

  it('rejects edges whose endpoints do not match the edge schema', () => {
    const store = createGraphStore()
    const result = store.applyPatch({
      upsertNodes: [
        { kind: 'atom', id: 'a', storeId: 'store:1', label: 'A' },
        { kind: 'component', id: 'c', label: 'Component' },
      ],
      upsertEdges: [
        {
          kind: 'atom-dependency',
          id: 'a-to-component',
          source: 'a',
          target: 'c',
        },
      ],
    })

    expect(result).toMatchObject({
      applied: false,
      changed: false,
      issues: [expect.objectContaining({ code: 'invalid-endpoint-kind' })],
    })
    expect(store.getSnapshot()).toEqual({ nodes: [], edges: [] })
  })

  it('cascades node removal to every connected edge', () => {
    const store = createGraphStore()
    store.applyPatch({
      upsertNodes: [
        { kind: 'atom', id: 'a', storeId: 'store:1', label: 'A' },
        { kind: 'atom', id: 'b', storeId: 'store:1', label: 'B' },
        { kind: 'component', id: 'c', label: 'C' },
      ],
      upsertEdges: [
        {
          kind: 'atom-dependency',
          id: 'a-to-b',
          source: 'a',
          target: 'b',
        },
        {
          kind: 'component-consumer',
          id: 'b-to-c',
          source: 'b',
          target: 'c',
          access: 'read',
        },
      ],
    })

    store.applyPatch({ removeNodeIds: ['b'] })

    expect(store.getSnapshot().nodes.map((node) => node.id)).toEqual(['a', 'c'])
    expect(store.getSnapshot().edges).toEqual([])
  })

  it('traverses cyclic graphs without revisiting the starting node', () => {
    const store = createGraphStore()
    store.applyPatch({
      upsertNodes: [
        { kind: 'atom', id: 'a', storeId: 'store:1', label: 'A' },
        { kind: 'atom', id: 'b', storeId: 'store:1', label: 'B' },
        { kind: 'atom', id: 'c', storeId: 'store:1', label: 'C' },
        { kind: 'component', id: 'd', label: 'D' },
      ],
      upsertEdges: [
        { kind: 'atom-dependency', id: 'a-b', source: 'a', target: 'b' },
        { kind: 'atom-dependency', id: 'b-c', source: 'b', target: 'c' },
        { kind: 'atom-dependency', id: 'c-a', source: 'c', target: 'a' },
        {
          kind: 'component-consumer',
          id: 'c-d',
          source: 'c',
          target: 'd',
          access: 'read',
        },
      ],
    })

    expect(store.traverse('a', { direction: 'downstream' })).toEqual([
      'b',
      'c',
      'd',
    ])
    expect(
      store.traverse('a', {
        direction: 'downstream',
        edgeKinds: ['atom-dependency'],
      }),
    ).toEqual(['b', 'c'])
    expect(store.traverse('a', { direction: 'upstream' })).toEqual(['c', 'b'])
    expect(store.traverse('missing', { direction: 'downstream' })).toEqual([])
  })
})
