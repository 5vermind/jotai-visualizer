// @vitest-environment jsdom

import { Suspense } from 'react'

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { Provider, atom, createStore, type Atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { afterEach, describe, expect, it } from 'vitest'

import {
  JotaiGraphCollector,
  RuntimeGraphProvider,
  createRuntimeGraph,
  useTrackedAtomValue,
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

describe('Jotai compatibility patterns', () => {
  it('tracks an async atom from Suspense pending state through resolution', async () => {
    let resolveGate: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve
    })
    const sourceAtom = labelAtom(atom('source'), 'asyncSourceAtom')
    const asyncAtom = labelAtom(
      atom(async (get) => {
        const source = get(sourceAtom)
        await gate
        return `${source}:resolved`
      }),
      'asyncResultAtom',
    )
    const store = createStore()
    const runtime = createRuntimeGraph({ valuePreview: { enabled: true } })
    const unsubscribe = store.sub(asyncAtom, () => undefined)

    function AsyncReader() {
      const value = useTrackedAtomValue(asyncAtom, {
        id: 'test/async#AsyncReader',
        name: 'AsyncReader',
        file: 'test/async.tsx',
      })
      return <span>{value}</span>
    }

    const collector = (
      <RuntimeGraphProvider runtime={runtime}>
        <Provider store={store}>
          <JotaiGraphCollector store={store} />
        </Provider>
      </RuntimeGraphProvider>
    )
    const view = render(collector)

    await waitFor(() => {
      const pending = runtime
        .getSnapshot()
        .nodes.find(
          (node) => node.kind === 'atom' && node.label === 'asyncResultAtom',
        )
      expect(pending?.kind === 'atom' ? pending.valuePreview : undefined).toBe(
        '[Promise]',
      )
      expect(hasDependency(runtime, 'asyncSourceAtom', 'asyncResultAtom')).toBe(
        true,
      )
    })

    await act(async () => {
      view.rerender(
        <RuntimeGraphProvider runtime={runtime}>
          <Provider store={store}>
            <JotaiGraphCollector store={store} />
            <Suspense fallback={<span>Loading async atom</span>}>
              <AsyncReader />
            </Suspense>
          </Provider>
        </RuntimeGraphProvider>,
      )
    })
    expect(await screen.findByText('Loading async atom')).toBeTruthy()

    await act(async () => {
      resolveGate?.()
      await gate
    })

    expect(await screen.findByText('source:resolved')).toBeTruthy()
    await waitFor(() => {
      const resolved = runtime
        .getSnapshot()
        .nodes.find(
          (node) => node.kind === 'atom' && node.label === 'asyncResultAtom',
        )
      expect(resolved?.kind === 'atom' ? resolved.valuePreview : undefined).toBe(
        '"source:resolved"',
      )
    })
    unsubscribe()
  })

  it('tracks and independently removes dynamic atomFamily members', async () => {
    const family = atomFamily((id: number) => {
      const member = atom(id)
      member.debugLabel = `itemAtom(${id})`
      return member
    })
    const firstAtom = family(1)
    const secondAtom = family(2)
    const store = createStore()
    const runtime = createRuntimeGraph({ valuePreview: { enabled: true } })

    function MemberReader({ id, target }: { id: number; target: Atom<number> }) {
      useTrackedAtomValue(target, {
        id: `test/family#Member${id}`,
        name: `Member${id}`,
        file: 'test/family.tsx',
      })
      return null
    }

    const tree = (showFirst: boolean) => (
      <RuntimeGraphProvider runtime={runtime}>
        <Provider store={store}>
          <JotaiGraphCollector store={store} />
          {showFirst && <MemberReader id={1} target={firstAtom} />}
          <MemberReader id={2} target={secondAtom} />
        </Provider>
      </RuntimeGraphProvider>
    )
    const view = render(tree(true))

    await waitFor(() => {
      const labels = runtime.getSnapshot().nodes.map((node) => node.label)
      expect(labels).toContain('itemAtom(1)')
      expect(labels).toContain('itemAtom(2)')
    })

    view.rerender(tree(false))

    await waitFor(() => {
      const labels = runtime.getSnapshot().nodes.map((node) => node.label)
      expect(labels).not.toContain('itemAtom(1)')
      expect(labels).toContain('itemAtom(2)')
    })
  })

  it('isolates the same atom across nested Providers and releases the inner Store', async () => {
    const sharedAtom = labelAtom(atom(0), 'nestedSharedAtom')
    const outerStore = createStore()
    const innerStore = createStore()
    outerStore.set(sharedAtom, 1)
    innerStore.set(sharedAtom, 2)
    const runtime = createRuntimeGraph({ valuePreview: { enabled: true } })

    function Reader({ name }: { name: 'InnerReader' | 'OuterReader' }) {
      useTrackedAtomValue(sharedAtom, {
        id: `test/nested#${name}`,
        name,
        file: 'test/nested.tsx',
      })
      return null
    }

    const tree = (showInner: boolean) => (
      <RuntimeGraphProvider runtime={runtime}>
        <Provider store={outerStore}>
          <JotaiGraphCollector store={outerStore} />
          <Reader name="OuterReader" />
          {showInner && (
            <Provider store={innerStore}>
              <JotaiGraphCollector store={innerStore} />
              <Reader name="InnerReader" />
            </Provider>
          )}
        </Provider>
      </RuntimeGraphProvider>
    )
    const view = render(tree(true))

    await waitFor(() => {
      const atoms = runtime
        .getSnapshot()
        .nodes.flatMap((node) =>
          node.kind === 'atom' && node.label === 'nestedSharedAtom'
            ? [node]
            : [],
        )
      expect(atoms.map((node) => node.valuePreview).sort()).toEqual(['1', '2'])
      expect(new Set(atoms.map((node) => node.storeId)).size).toBe(2)
    })

    view.rerender(tree(false))

    await waitFor(() => {
      const atoms = runtime
        .getSnapshot()
        .nodes.flatMap((node) =>
          node.kind === 'atom' && node.label === 'nestedSharedAtom'
            ? [node]
            : [],
        )
      expect(atoms).toHaveLength(1)
      expect(atoms[0]?.valuePreview).toBe('1')
      expect(runtime.getSnapshot().nodes.map((node) => node.label)).not.toContain(
        'InnerReader',
      )
    })
  })
})
