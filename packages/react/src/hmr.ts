import type { RuntimeGraph } from '@jotai-visualizer/core'

type HotContext = {
  dispose(callback: () => void): void
}

const activeRuntimes = new Set<RuntimeGraph>()
const pendingFileCleanups = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

export const registerActiveRuntime = (runtime: RuntimeGraph) => {
  activeRuntimes.add(runtime)
  return () => {
    activeRuntimes.delete(runtime)
  }
}

export const registerVisualizerModule = (
  hot: HotContext | undefined,
  file: string,
) => {
  const pendingCleanup = pendingFileCleanups.get(file)
  if (pendingCleanup) {
    clearTimeout(pendingCleanup)
    pendingFileCleanups.delete(file)
  }
  hot?.dispose(() => {
    const timer = setTimeout(() => {
      pendingFileCleanups.delete(file)
      activeRuntimes.forEach((runtime) => runtime.releaseConsumersByFile(file))
    }, 250)
    pendingFileCleanups.set(file, timer)
  })
}
