import { describe, expect, it } from 'vitest'

import {
  isAtomDependencyEdge,
  isAtomNode,
  isComponentConsumerEdge,
  isComponentNode,
  type GraphEdge,
  type GraphNode,
} from '../src/index.js'

describe('graph type guards', () => {
  const atomNode: GraphNode = {
    kind: 'atom',
    id: 'store:1/atom:count',
    storeId: 'store:1',
    label: 'countAtom',
  }

  const componentNode: GraphNode = {
    kind: 'component',
    id: 'src/Counter.tsx#Counter',
    label: 'Counter',
  }

  const dependencyEdge: GraphEdge = {
    kind: 'atom-dependency',
    id: 'count-to-doubled',
    source: 'store:1/atom:count',
    target: 'store:1/atom:doubled',
  }

  const consumerEdge: GraphEdge = {
    kind: 'component-consumer',
    id: 'count-to-counter',
    source: 'store:1/atom:count',
    target: 'src/Counter.tsx#Counter',
    access: 'read-write',
  }

  it('distinguishes atom and component nodes', () => {
    expect(isAtomNode(atomNode)).toBe(true)
    expect(isComponentNode(atomNode)).toBe(false)
    expect(isComponentNode(componentNode)).toBe(true)
    expect(isAtomNode(componentNode)).toBe(false)
  })

  it('distinguishes dependency and consumer edges', () => {
    expect(isAtomDependencyEdge(dependencyEdge)).toBe(true)
    expect(isComponentConsumerEdge(dependencyEdge)).toBe(false)
    expect(isComponentConsumerEdge(consumerEdge)).toBe(true)
    expect(isAtomDependencyEdge(consumerEdge)).toBe(false)
  })
})
