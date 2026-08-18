// @vitest-environment jsdom

import { act } from 'react'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createRuntimeGraph,
  type RuntimeAtom,
} from '@jotai-visualizer/core'

import { GraphPanel } from '../src/GraphPanel.js'

beforeAll(() => {
  class ResizeObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverStub,
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => setTimeout(callback, 0),
  })
})

afterEach(cleanup)

const createFixture = () => {
  const base = createRuntimeGraph({ valuePreview: { enabled: true } })
  const subscribe = vi.fn(base.subscribe)
  const runtime = { ...base, subscribe }
  const store = {}
  const atom: RuntimeAtom = {
    debugLabel: 'countAtom',
    toString: () => 'countAtom',
  }
  base.registerConsumer({
    store,
    atom,
    component: { id: 'Counter', name: 'Counter' },
    access: 'read-write',
  })
  base.syncAtomSnapshot(store, {
    values: new Map([[atom, 1]]),
    dependents: new Map(),
  })
  return { atom, base, runtime, store, subscribe }
}

describe('GraphPanel', () => {
  it('does not subscribe or render graph content while closed', async () => {
    const { runtime, subscribe } = createFixture()
    render(<GraphPanel runtime={runtime} />)

    expect(subscribe).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Jotai Visualizer' }),
    )
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('provides labeled controls and returns focus after Escape', async () => {
    const { runtime } = createFixture()
    render(<GraphPanel runtime={runtime} />)
    const trigger = screen.getByRole('button', {
      name: 'Open Jotai Visualizer',
    })
    fireEvent.click(trigger)

    expect(
      await screen.findByRole('searchbox', { name: 'Search graph' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('combobox', { name: 'Filter by Store' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('checkbox', { name: 'Private atoms' }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Re-layout' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      const reopenedTrigger = screen.getByRole('button', {
        name: 'Open Jotai Visualizer',
      })
      expect(document.activeElement).toBe(reopenedTrigger)
    })
  })

  it('shows an atom change class after its revision advances', async () => {
    const { atom, base, runtime, store } = createFixture()
    const view = render(<GraphPanel initialOpen runtime={runtime} />)
    await waitFor(() =>
      expect(view.container.querySelector('.jv-flow-node--atom')).toBeTruthy(),
    )

    act(() => {
      base.syncAtomSnapshot(store, {
        values: new Map([[atom, 2]]),
        dependents: new Map(),
      })
    })

    await waitFor(() => {
      expect(
        view.container
          .querySelector('.jv-flow-node--atom')
          ?.classList.contains('jv-flow-node--changed'),
      ).toBe(true)
    })
  })
})
