import { useEffect } from 'react'

import { useStore, type Atom } from 'jotai'
import { useAtomsSnapshot } from 'jotai-devtools/utils'

import { useRuntimeGraph } from './runtime-context.js'
import type { JotaiStore } from './jotai-types.js'

type AnyAtom = Atom<unknown>

export function JotaiGraphCollector({
  shouldShowPrivateAtoms = true,
  store,
}: {
  shouldShowPrivateAtoms?: boolean
  store?: JotaiStore
}) {
  const runtime = useRuntimeGraph()
  const resolvedStore = useStore({ store })
  const snapshot = useAtomsSnapshot({
    shouldShowPrivateAtoms,
    store: resolvedStore,
  })

  useEffect(() => {
    runtime.syncAtomSnapshot(resolvedStore, {
      values: snapshot.values as ReadonlyMap<AnyAtom, unknown>,
      dependents: snapshot.dependents as ReadonlyMap<
        AnyAtom,
        ReadonlySet<AnyAtom>
      >,
    })
  }, [resolvedStore, runtime, snapshot])

  useEffect(
    () => () => runtime.clearAtomSnapshot(resolvedStore),
    [resolvedStore, runtime],
  )

  return null
}
