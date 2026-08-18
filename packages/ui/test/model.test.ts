import { describe, expect, it } from 'vitest'

import type {
  GraphEdge,
  GraphNode,
  GraphSnapshot,
} from '@jotai-visualizer/core'

import { layoutFlowNodes } from '../src/layout.js'
import {
  createFlowElements,
  filterGraphSnapshot,
} from '../src/model.js'

const fixture: GraphSnapshot = {
  nodes: [
    {
      kind: 'atom',
      id: 'store:1/atom:count',
      storeId: 'store:1',
      label: 'countAtom',
    },
    {
      kind: 'atom',
      id: 'store:1/atom:private',
      storeId: 'store:1',
      label: 'privateAtom',
      private: true,
    },
    {
      kind: 'atom',
      id: 'store:2/atom:count',
      storeId: 'store:2',
      label: 'countAtom',
    },
    { kind: 'component', id: 'component:Counter', label: 'Counter' },
    { kind: 'component', id: 'component:Other', label: 'Other' },
  ],
  edges: [
    {
      kind: 'component-consumer',
      id: 's1-count-counter',
      source: 'store:1/atom:count',
      target: 'component:Counter',
      access: 'read',
    },
    {
      kind: 'component-consumer',
      id: 's1-private-counter',
      source: 'store:1/atom:private',
      target: 'component:Counter',
      access: 'read',
    },
    {
      kind: 'component-consumer',
      id: 's2-count-other',
      source: 'store:2/atom:count',
      target: 'component:Other',
      access: 'read',
    },
  ],
}

describe('graph UI model', () => {
  it('filters private atoms and Stores while retaining connected components', () => {
    const firstStore = filterGraphSnapshot(fixture, {
      query: '',
      showPrivateAtoms: false,
      storeId: 'store:1',
    })

    expect(firstStore.storeIds).toEqual(['store:1', 'store:2'])
    expect(firstStore.nodes.map((node) => node.label)).toEqual([
      'countAtom',
      'Counter',
    ])
    expect(firstStore.edges.map((edge) => edge.id)).toEqual([
      's1-count-counter',
    ])

    const withPrivate = filterGraphSnapshot(fixture, {
      query: '',
      showPrivateAtoms: true,
      storeId: 'store:1',
    })
    expect(withPrivate.nodes.map((node) => node.label)).toContain('privateAtom')
  })

  it('keeps one-hop context around search results', () => {
    const result = filterGraphSnapshot(fixture, {
      query: 'Other',
      showPrivateAtoms: false,
      storeId: 'all',
    })

    expect(result.nodes.map((node) => node.label)).toEqual([
      'countAtom',
      'Other',
    ])
    expect(result.edges).toHaveLength(1)
  })

  it('marks derived, changed, related, and dimmed flow elements', () => {
    const snapshot: GraphSnapshot = {
      nodes: [
        {
          kind: 'atom',
          id: 'source',
          storeId: 'store:1',
          label: 'sourceAtom',
        },
        {
          kind: 'atom',
          id: 'derived',
          storeId: 'store:1',
          label: 'derivedAtom',
        },
        { kind: 'component', id: 'component', label: 'Component' },
      ],
      edges: [
        {
          kind: 'atom-dependency',
          id: 'source-derived',
          source: 'source',
          target: 'derived',
        },
        {
          kind: 'component-consumer',
          id: 'derived-component',
          source: 'derived',
          target: 'component',
          access: 'read',
        },
      ],
    }
    const result = createFlowElements(
      snapshot,
      'source',
      new Set(['source', 'derived']),
      new Set(['source']),
    )

    expect(result.nodes.find((node) => node.id === 'derived')?.data).toMatchObject(
      { isDerived: true, related: true },
    )
    expect(result.nodes.find((node) => node.id === 'source')?.className).toContain(
      'jv-flow-node--changed',
    )
    expect(
      result.nodes.find((node) => node.id === 'component')?.className,
    ).toContain('jv-flow-node--dimmed')
  })

  it('lays out 100 nodes and preserves only explicitly saved positions', () => {
    const graphNodes: GraphNode[] = Array.from({ length: 100 }, (_, index) => ({
      kind: 'atom',
      id: `atom:${index}`,
      storeId: 'store:1',
      label: `atom${index}`,
    }))
    const graphEdges: GraphEdge[] = Array.from({ length: 99 }, (_, index) => ({
      kind: 'atom-dependency',
      id: `edge:${index}`,
      source: `atom:${index}`,
      target: `atom:${index + 1}`,
    }))
    const flow = createFlowElements(
      { nodes: graphNodes, edges: graphEdges },
      undefined,
      new Set(),
      new Set(),
    )
    const startedAt = performance.now()
    const positioned = layoutFlowNodes(
      flow.nodes,
      flow.edges,
      new Map([['atom:0', { x: 777, y: 333 }]]),
    )
    const duration = performance.now() - startedAt

    expect(positioned).toHaveLength(100)
    expect(positioned.find((node) => node.id === 'atom:0')?.position).toEqual({
      x: 777,
      y: 333,
    })
    expect(
      positioned.every(
        (node) =>
          Number.isFinite(node.position.x) && Number.isFinite(node.position.y),
      ),
    ).toBe(true)
    expect(duration).toBeLessThan(1_000)

    const forced = layoutFlowNodes(
      flow.nodes,
      flow.edges,
      new Map([['atom:0', { x: 777, y: 333 }]]),
      true,
    )
    expect(forced.find((node) => node.id === 'atom:0')?.position).not.toEqual({
      x: 777,
      y: 333,
    })
  })
})
