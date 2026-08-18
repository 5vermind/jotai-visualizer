import dagre from '@dagrejs/dagre'
import type { Edge, Node, XYPosition } from '@xyflow/react'

const dimensions = (node: Node) =>
  node.type === 'component'
    ? { width: 184, height: 82 }
    : { width: 224, height: 112 }

export const layoutFlowNodes = <NodeType extends Node>(
  nodes: readonly NodeType[],
  edges: readonly Edge[],
  savedPositions: ReadonlyMap<string, XYPosition> = new Map(),
  force = false,
): NodeType[] => {
  const graph = new dagre.graphlib.Graph()
    .setDefaultEdgeLabel(() => ({}))
    .setGraph({
      rankdir: 'LR',
      ranksep: 96,
      nodesep: 46,
      edgesep: 24,
      marginx: 48,
      marginy: 48,
    })

  nodes.forEach((node) => graph.setNode(node.id, dimensions(node)))
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target))
  dagre.layout(graph)

  return nodes.map((node) => {
    const saved = force ? undefined : savedPositions.get(node.id)
    if (saved) {
      return { ...node, position: saved }
    }
    const position = graph.node(node.id) as
      | { x: number; y: number; width: number; height: number }
      | undefined
    const size = dimensions(node)
    return {
      ...node,
      position: position
        ? {
            x: position.x - size.width / 2,
            y: position.y - size.height / 2,
          }
        : { x: 0, y: 0 },
    }
  })
}
