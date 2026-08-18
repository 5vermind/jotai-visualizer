import { describe, expect, it, vi } from 'vitest'

import {
  createRuntimeGraph,
  type RuntimeAtom,
} from '../src/index.js'

const createAtomIdentity = (label: string): RuntimeAtom => ({
  debugLabel: label,
  toString: () => label,
})

describe('framework-independent RuntimeGraph', () => {
  it('reference-counts duplicate consumers before removing their edge', () => {
    const runtime = createRuntimeGraph()
    const listener = vi.fn()
    const store = {}
    const atom = createAtomIdentity('countAtom')
    const component = { id: 'Counter', name: 'Counter' }
    runtime.subscribe(listener)

    const releaseFirst = runtime.registerConsumer({
      store,
      atom,
      component,
      access: 'read',
    })
    const releaseSecond = runtime.registerConsumer({
      store,
      atom,
      component,
      access: 'read',
    })

    expect(runtime.getSnapshot().edges).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)
    releaseFirst()
    expect(runtime.getSnapshot().edges).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)
    releaseSecond()
    expect(runtime.getSnapshot()).toEqual({ nodes: [], edges: [] })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('releases one Store without removing components used by another Store', () => {
    const runtime = createRuntimeGraph({ valuePreview: { enabled: true } })
    const firstStore = {}
    const secondStore = {}
    const atom = createAtomIdentity('sharedAtom')
    const component = { id: 'SharedReader', name: 'SharedReader' }
    const releaseFirstConsumer = runtime.registerConsumer({
      store: firstStore,
      atom,
      component,
      access: 'read',
    })
    const releaseSecondConsumer = runtime.registerConsumer({
      store: secondStore,
      atom,
      component,
      access: 'read',
    })
    runtime.syncAtomSnapshot(firstStore, {
      values: new Map([[atom, 1]]),
      dependents: new Map(),
    })
    runtime.syncAtomSnapshot(secondStore, {
      values: new Map([[atom, 2]]),
      dependents: new Map(),
    })
    const firstStoreId = runtime.getStoreId(firstStore)
    const secondStoreId = runtime.getStoreId(secondStore)

    runtime.releaseStore(firstStore)

    const remaining = runtime.getSnapshot()
    expect(
      remaining.nodes.some(
        (node) => node.kind === 'atom' && node.storeId === firstStoreId,
      ),
    ).toBe(false)
    expect(
      remaining.nodes.some(
        (node) => node.kind === 'atom' && node.storeId === secondStoreId,
      ),
    ).toBe(true)
    expect(
      remaining.nodes.some(
        (node) => node.kind === 'component' && node.label === 'SharedReader',
      ),
    ).toBe(true)
    expect(remaining.edges).toHaveLength(1)

    releaseFirstConsumer()
    expect(runtime.getSnapshot().edges).toHaveLength(1)
    releaseSecondConsumer()
    runtime.releaseStore(secondStore)
    expect(runtime.getSnapshot()).toEqual({ nodes: [], edges: [] })
  })

  it('keeps previews private by default and applies redaction and limits', () => {
    const store = {}
    const publicAtom = createAtomIdentity('profileAtom')
    const secretAtom = createAtomIdentity('authTokenAtom')
    const privateRuntime = createRuntimeGraph()
    privateRuntime.syncAtomSnapshot(store, {
      values: new Map([[publicAtom, { name: 'Ada' }]]),
      dependents: new Map(),
    })
    expect(
      privateRuntime.getSnapshot().nodes.find((node) => node.kind === 'atom'),
    ).not.toHaveProperty('valuePreview')

    const runtime = createRuntimeGraph({
      valuePreview: {
        enabled: true,
        maxLength: 12,
        redactedText: '[Hidden]',
        redact: (_value, { atomLabel }) => atomLabel.includes('Token'),
      },
    })
    runtime.syncAtomSnapshot(store, {
      values: new Map<RuntimeAtom, unknown>([
        [publicAtom, { biography: 'A long public profile' }],
        [secretAtom, 'do-not-display'],
      ]),
      dependents: new Map(),
    })
    const atoms = runtime
      .getSnapshot()
      .nodes.flatMap((node) => (node.kind === 'atom' ? [node] : []))
    const publicPreview = atoms.find(
      (node) => node.label === 'profileAtom',
    )?.valuePreview
    const secretPreview = atoms.find(
      (node) => node.label === 'authTokenAtom',
    )?.valuePreview

    expect(publicPreview).toHaveLength(12)
    expect(publicPreview).toMatch(/\.\.\.$/)
    expect(secretPreview).toBe('[Hidden]')
  })

  it('assigns stable object IDs and rotates a Store ID after release', () => {
    const runtime = createRuntimeGraph()
    const store = {}
    const atom = createAtomIdentity('atom')
    const firstStoreId = runtime.getStoreId(store)

    expect(runtime.getStoreId(store)).toBe(firstStoreId)
    expect(runtime.getAtomNodeId(store, atom)).toBe(
      runtime.getAtomNodeId(store, atom),
    )
    runtime.releaseStore(store)
    expect(runtime.getStoreId(store)).not.toBe(firstStoreId)
  })
})
