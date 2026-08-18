import { useEffect } from 'react'

import { useRuntimeGraph } from './runtime-context.js'
import { useInspectorSnapshot } from './jotai-inspector.js'
import type { JotaiStore } from './jotai-types.js'

export function JotaiGraphCollector({
  shouldShowPrivateAtoms = true,
  store,
}: {
  shouldShowPrivateAtoms?: boolean
  store?: JotaiStore
}) {
  const runtime = useRuntimeGraph()
  const { resolvedStore, snapshot } = useInspectorSnapshot(
    store,
    shouldShowPrivateAtoms,
  )

  useEffect(() => {
    runtime.syncAtomSnapshot(resolvedStore, snapshot)
  }, [resolvedStore, runtime, snapshot])

  useEffect(
    () => () => runtime.clearAtomSnapshot(resolvedStore),
    [resolvedStore, runtime],
  )

  return null
}
