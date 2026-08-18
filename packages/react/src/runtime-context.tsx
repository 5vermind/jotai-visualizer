import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

import type { GraphSnapshot } from '@jotai-visualizer/core'
import type { RuntimeGraph } from '@jotai-visualizer/core'

import { registerActiveRuntime } from './hmr.js'

const RuntimeGraphContext = createContext<RuntimeGraph | undefined>(undefined)

export function RuntimeGraphProvider({
  children,
  runtime,
}: {
  children: ReactNode
  runtime: RuntimeGraph
}) {
  useEffect(() => registerActiveRuntime(runtime), [runtime])

  return (
    <RuntimeGraphContext.Provider value={runtime}>
      {children}
    </RuntimeGraphContext.Provider>
  )
}

export const useRuntimeGraph = () => {
  const runtime = useContext(RuntimeGraphContext)
  if (!runtime) {
    throw new Error('Tracked Jotai hooks require a RuntimeGraphProvider')
  }
  return runtime
}

export const useRuntimeGraphSnapshot = (
  explicitRuntime?: RuntimeGraph,
): GraphSnapshot => {
  const contextRuntime = useContext(RuntimeGraphContext)
  const runtime = explicitRuntime ?? contextRuntime
  if (!runtime) {
    throw new Error('A RuntimeGraph instance is required to read a snapshot')
  }
  return useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
}

export function GraphSnapshotLogger({
  onSnapshot,
  runtime,
}: {
  onSnapshot?: (json: string, snapshot: GraphSnapshot) => void
  runtime?: RuntimeGraph
}) {
  const snapshot = useRuntimeGraphSnapshot(runtime)

  useEffect(() => {
    const json = JSON.stringify(snapshot, null, 2)
    if (onSnapshot) {
      onSnapshot(json, snapshot)
    } else {
      console.info('[jotai-visualizer]', json)
    }
  }, [onSnapshot, snapshot])

  return null
}
