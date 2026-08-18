import { GraphPanel, type GraphPanelProps } from '@jotai-visualizer/ui'

import { useRuntimeGraph } from './runtime-context.js'

export type JotaiVisualizerProps = Omit<GraphPanelProps, 'runtime'>

export function JotaiVisualizer(props: JotaiVisualizerProps) {
  const runtime = useRuntimeGraph()
  return <GraphPanel {...props} runtime={runtime} />
}
