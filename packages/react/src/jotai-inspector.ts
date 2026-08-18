import { useCallback, useSyncExternalStore } from 'react'

import { useStore, type Atom } from 'jotai'
import { INTERNAL_overrideCreateStore } from 'jotai/vanilla'
import {
  INTERNAL_buildStoreRev3 as INTERNAL_buildStore,
  INTERNAL_getBuildingBlocksRev3 as INTERNAL_getBuildingBlocks,
  INTERNAL_initializeStoreHooksRev3 as INTERNAL_initializeStoreHooks,
  type INTERNAL_AtomStateMap,
  type INTERNAL_MountedMap,
} from 'jotai/vanilla/internals'

import type { JotaiStore } from './jotai-types.js'

type AnyAtom = Atom<unknown>

export type InspectorSnapshot = {
  dependents: ReadonlyMap<AnyAtom, ReadonlySet<AnyAtom>>
  values: ReadonlyMap<AnyAtom, unknown>
}

type Inspector = {
  getSnapshot(showPrivateAtoms: boolean): InspectorSnapshot
  subscribe(listener: () => void): () => void
}

type MutableInspector = Inspector & {
  notify(): void
}

const inspectorSymbol: unique symbol = Symbol.for(
  'jotai-visualizer.inspector',
) as never

type InspectorStore = JotaiStore & {
  [inspectorSymbol]?: Inspector
}

const emptySnapshot: InspectorSnapshot = Object.freeze({
  dependents: new Map(),
  values: new Map(),
})

const createInspector = (
  atomStateMap: INTERNAL_AtomStateMap,
  mountedMap: INTERNAL_MountedMap,
  mountedAtoms: Set<AnyAtom>,
): MutableInspector => {
  const listeners = new Set<() => void>()
  const cache = new Map<
    boolean,
    { revision: number; snapshot: InspectorSnapshot }
  >()
  let revision = 0
  let notifyScheduled = false

  const notify = () => {
    if (notifyScheduled) {
      return
    }
    notifyScheduled = true
    queueMicrotask(() => {
      notifyScheduled = false
      revision += 1
      cache.clear()
      listeners.forEach((listener) => listener())
    })
  }

  return {
    notify,
    getSnapshot: (showPrivateAtoms) => {
      const previous = cache.get(showPrivateAtoms)
      if (previous?.revision === revision) {
        return previous.snapshot
      }
      const values = new Map<AnyAtom, unknown>()
      const dependents = new Map<AnyAtom, ReadonlySet<AnyAtom>>()
      mountedAtoms.forEach((target) => {
        if (!showPrivateAtoms && target.debugPrivate) {
          return
        }
        const state = atomStateMap.get(target)
        if (state && 'v' in state) {
          values.set(target, state.v)
        }
        const mounted = mountedMap.get(target)
        if (mounted) {
          dependents.set(
            target,
            new Set(
              [...mounted.t].filter(
                (dependent) => showPrivateAtoms || !dependent.debugPrivate,
              ),
            ),
          )
        }
      })
      const snapshot = Object.freeze({ values, dependents })
      cache.set(showPrivateAtoms, { revision, snapshot })
      return snapshot
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const inspectStore = (store: JotaiStore): JotaiStore => {
  const inspected = store as InspectorStore
  if (inspected[inspectorSymbol]) {
    return store
  }

  const buildingBlocks = INTERNAL_getBuildingBlocks(store)
  const atomStateMap = buildingBlocks[0]
  const mountedMap = buildingBlocks[1]
  const storeHooks = INTERNAL_initializeStoreHooks(buildingBlocks[6])
  const mountedAtoms = new Set<AnyAtom>()
  const inspector = createInspector(atomStateMap, mountedMap, mountedAtoms)

  storeHooks.m.add(undefined, (target) => {
    mountedAtoms.add(target)
    inspector.notify()
  })
  storeHooks.u.add(undefined, (target) => {
    mountedAtoms.delete(target)
    inspector.notify()
  })
  storeHooks.c.add(undefined, inspector.notify)

  Object.defineProperty(inspected, inspectorSymbol, {
    configurable: false,
    enumerable: false,
    value: inspector,
    writable: false,
  })
  return store
}

INTERNAL_overrideCreateStore((previous) => () =>
  inspectStore(previous?.() ?? INTERNAL_buildStore()),
)

export const useInspectorSnapshot = (
  store: JotaiStore | undefined,
  showPrivateAtoms: boolean,
) => {
  const resolvedStore = useStore({ store }) as InspectorStore
  const inspector = resolvedStore[inspectorSymbol]
  const subscribe = useCallback(
    (listener: () => void) => inspector?.subscribe(listener) ?? (() => undefined),
    [inspector],
  )
  const getSnapshot = useCallback(
    () => inspector?.getSnapshot(showPrivateAtoms) ?? emptySnapshot,
    [inspector, showPrivateAtoms],
  )
  return {
    resolvedStore,
    snapshot: useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
  }
}
