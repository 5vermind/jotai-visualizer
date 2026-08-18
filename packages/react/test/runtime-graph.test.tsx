// @vitest-environment jsdom

import { StrictMode } from 'react'

import { act, cleanup, render, waitFor } from '@testing-library/react'
import {
  Provider,
  atom,
  createStore,
  getDefaultStore,
  type Atom,
} from 'jotai'
import { afterEach, describe, expect, it } from 'vitest'

import {
  JotaiGraphCollector,
  RuntimeGraphProvider,
  createRuntimeGraph,
  useTrackedAtom,
  useTrackedAtomValue,
  useTrackedSetAtom,
  type RuntimeGraph,
} from '../src/index.js'

afterEach(cleanup)

const labelAtom = <Target extends Atom<unknown>>(target: Target, label: string) => {
  target.debugLabel = label
  return target
}

const hasDependency = (
  runtime: RuntimeGraph,
  sourceLabel: string,
  targetLabel: string,
) => {
  const snapshot = runtime.getSnapshot()
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]))
  return snapshot.edges.some(
    (edge) =>
      edge.kind === 'atom-dependency' &&
      nodes.get(edge.source)?.label === sourceLabel &&
      nodes.get(edge.target)?.label === targetLabel,
  )
}

describe('Jotai runtime graph spike', () => {
  it('tracks runtime changes to conditional derived dependencies', async () => {
    const enabledAtom = labelAtom(atom(true), 'enabledAtom')
    const primaryAtom = labelAtom(atom('primary'), 'primaryAtom')
    const fallbackAtom = labelAtom(atom('fallback'), 'fallbackAtom')
    const selectedAtom = labelAtom(
      atom((get) =>
        get(enabledAtom) ? get(primaryAtom) : get(fallbackAtom),
      ),
      'selectedAtom',
    )
    const store = createStore()
    const runtime = createRuntimeGraph()

    function ConditionalReader() {
      useTrackedAtomValue(selectedAtom, {
        id: 'test#ConditionalReader',
        name: 'ConditionalReader',
      })
      return null
    }

    render(
      <RuntimeGraphProvider runtime={runtime}>
        <Provider store={store}>
          <JotaiGraphCollector store={store} />
          <ConditionalReader />
        </Provider>
      </RuntimeGraphProvider>,
    )

    await waitFor(() => {
      expect(hasDependency(runtime, 'enabledAtom', 'selectedAtom')).toBe(true)
      expect(hasDependency(runtime, 'primaryAtom', 'selectedAtom')).toBe(true)
      expect(hasDependency(runtime, 'fallbackAtom', 'selectedAtom')).toBe(false)
    })

    act(() => store.set(enabledAtom, false))

    await waitFor(() => {
      expect(hasDependency(runtime, 'enabledAtom', 'selectedAtom')).toBe(true)
      expect(hasDependency(runtime, 'primaryAtom', 'selectedAtom')).toBe(false)
      expect(hasDependency(runtime, 'fallbackAtom', 'selectedAtom')).toBe(true)
    })
  })

  it('registers every manual access mode and removes consumers on unmount', async () => {
    const countAtom = labelAtom(atom(0), 'trackedCountAtom')
    const doubledAtom = labelAtom(
      atom((get) => get(countAtom) * 2),
      'trackedDoubledAtom',
    )
    const store = createStore()
    const runtime = createRuntimeGraph()

    function Consumers() {
      useTrackedAtomValue(countAtom, {
        id: 'test#Reader',
        name: 'Reader',
      })
      useTrackedSetAtom(countAtom, {
        id: 'test#Writer',
        name: 'Writer',
      })
      useTrackedAtom(countAtom, {
        id: 'test#ReaderWriter',
        name: 'ReaderWriter',
      })
      useTrackedAtom(doubledAtom, {
        id: 'test#ReadOnlyUseAtom',
        name: 'ReadOnlyUseAtom',
      })
      return null
    }

    const tree = (visible: boolean) => (
      <StrictMode>
        <RuntimeGraphProvider runtime={runtime}>
          <Provider store={store}>
            <JotaiGraphCollector store={store} />
            {visible && <Consumers />}
          </Provider>
        </RuntimeGraphProvider>
      </StrictMode>
    )

    const view = render(tree(true))

    await waitFor(() => {
      const consumerEdges = runtime
        .getSnapshot()
        .edges.filter((edge) => edge.kind === 'component-consumer')
      expect(consumerEdges).toHaveLength(4)
      expect(consumerEdges.map((edge) => edge.access).sort()).toEqual([
        'read',
        'read',
        'read-write',
        'write',
      ])
    })

    view.rerender(tree(false))

    await waitFor(() => {
      const snapshot = runtime.getSnapshot()
      expect(
        snapshot.edges.some((edge) => edge.kind === 'component-consumer'),
      ).toBe(false)
      expect(snapshot.nodes.some((node) => node.kind === 'component')).toBe(false)
    })
  })

  it('keeps provider-less and custom stores isolated in JSON snapshots', async () => {
    const sharedAtom = labelAtom(atom(0), 'sharedAcrossStoresAtom')
    const defaultStore = getDefaultStore()
    const customStore = createStore()
    const runtime = createRuntimeGraph()
    defaultStore.set(sharedAtom, 1)
    customStore.set(sharedAtom, 7)

    function DefaultReader() {
      useTrackedAtomValue(sharedAtom, {
        id: 'test#DefaultReader',
        name: 'DefaultReader',
      })
      return null
    }

    function CustomReader() {
      useTrackedAtomValue(
        sharedAtom,
        { id: 'test#CustomReader', name: 'CustomReader' },
        { store: customStore },
      )
      return null
    }

    render(
      <RuntimeGraphProvider runtime={runtime}>
        <JotaiGraphCollector />
        <DefaultReader />
        <JotaiGraphCollector store={customStore} />
        <CustomReader />
      </RuntimeGraphProvider>,
    )

    await waitFor(() => {
      const snapshot = runtime.getSnapshot()
      const atoms = snapshot.nodes.flatMap((node) =>
          node.kind === 'atom' && node.label === 'sharedAcrossStoresAtom'
            ? [node]
            : [],
        )
      expect(atoms).toHaveLength(2)
      expect(new Set(atoms.map((node) => node.storeId)).size).toBe(2)
      expect(atoms.map((node) => node.valuePreview).sort()).toEqual(['1', '7'])

      const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]))
      const storeForComponent = (componentLabel: string) => {
        const edge = snapshot.edges.find(
          (candidate) =>
            candidate.kind === 'component-consumer' &&
            nodes.get(candidate.target)?.label === componentLabel,
        )
        const source = edge ? nodes.get(edge.source) : undefined
        return source?.kind === 'atom'
          ? { storeId: source.storeId, value: source.valuePreview }
          : undefined
      }
      expect(storeForComponent('DefaultReader')).toEqual({
        storeId: atoms.find((node) => node.valuePreview === '1')?.storeId,
        value: '1',
      })
      expect(storeForComponent('CustomReader')).toEqual({
        storeId: atoms.find((node) => node.valuePreview === '7')?.storeId,
        value: '7',
      })
    })

    const parsed = JSON.parse(runtime.getJsonSnapshot()) as {
      nodes: Array<{ kind: string; label: string }>
    }
    expect(
      parsed.nodes.filter(
        (node) =>
          node.kind === 'atom' && node.label === 'sharedAcrossStoresAtom',
      ),
    ).toHaveLength(2)
  })

  it('creates bounded previews for values that JSON cannot safely serialize', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    const circularAtom = labelAtom(atom(circular), 'circularAtom')
    const bigintAtom = labelAtom(atom(12n), 'bigintAtom')
    const promiseAtom = labelAtom(atom(Promise.resolve('done')), 'promiseAtom')
    const errorAtom = labelAtom(atom(new Error('failed')), 'errorAtom')
    const store = createStore()
    const runtime = createRuntimeGraph()

    runtime.syncAtomSnapshot(store, {
      values: new Map<Atom<unknown>, unknown>([
        [circularAtom as Atom<unknown>, circular],
        [bigintAtom as Atom<unknown>, 12n],
        [promiseAtom as Atom<unknown>, Promise.resolve('done')],
        [errorAtom as Atom<unknown>, new Error('failed')],
      ]),
      dependents: new Map(),
    })

    const previews = new Map(
      runtime
        .getSnapshot()
        .nodes.flatMap((node) =>
          node.kind === 'atom' ? [[node.label, node.valuePreview]] : [],
        ),
    )
    expect(previews.get('circularAtom')).toContain('[Circular]')
    expect(previews.get('bigintAtom')).toBe('12')
    expect(previews.get('promiseAtom')).toBe('[Promise]')
    expect(previews.get('errorAtom')).toBe('Error: failed')
  })
})
