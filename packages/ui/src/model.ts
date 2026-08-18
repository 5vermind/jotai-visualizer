import type { Edge, Node } from '@xyflow/react'

import type {
  GraphEdge,
  GraphNode,
  GraphSnapshot,
} from '@jotai-visualizer/core'

export type GraphFilters = {
  query: string
  showPrivateAtoms: boolean
  storeId: string | 'all'
}

export type FilteredGraph = GraphSnapshot & {
  storeIds: readonly string[]
}

export type VisualizerNodeData = Record<string, unknown> & {
  changed: boolean
  dimmed: boolean
  graphNode: GraphNode
  isDerived: boolean
  related: boolean
}

export type VisualizerFlowNode = Node<VisualizerNodeData>
export type VisualizerFlowEdge = Edge

const includesQuery = (node: GraphNode, query: string) => {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return (
    !normalizedQuery ||
    node.label.toLocaleLowerCase().includes(normalizedQuery) ||
    node.id.toLocaleLowerCase().includes(normalizedQuery)
  )
}

export const filterGraphSnapshot = (
  snapshot: GraphSnapshot,
  filters: GraphFilters,
): FilteredGraph => {
  const storeIds = [
    ...new Set(
      snapshot.nodes.flatMap((node) =>
        node.kind === 'atom' ? [node.storeId] : [],
      ),
    ),
  ].sort()
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]))
  const allowedAtomIds = new Set(
    snapshot.nodes.flatMap((node) => {
      if (node.kind !== 'atom') {
        return []
      }
      if (filters.storeId !== 'all' && node.storeId !== filters.storeId) {
        return []
      }
      if (!filters.showPrivateAtoms && node.private) {
        return []
      }
      return [node.id]
    }),
  )

  const candidateEdges = snapshot.edges.filter((edge) => {
    if (edge.kind === 'atom-dependency') {
      return allowedAtomIds.has(edge.source) && allowedAtomIds.has(edge.target)
    }
    return (
      allowedAtomIds.has(edge.source) &&
      nodesById.get(edge.target)?.kind === 'component'
    )
  })
  const connectedComponentIds = new Set(
    candidateEdges.flatMap((edge) => {
      const target = nodesById.get(edge.target)
      return target?.kind === 'component' ? [target.id] : []
    }),
  )
  const candidateNodeIds = new Set([
    ...allowedAtomIds,
    ...connectedComponentIds,
  ])
  const candidateNodes = snapshot.nodes.filter((node) =>
    candidateNodeIds.has(node.id),
  )

  if (!filters.query.trim()) {
    return {
      nodes: candidateNodes,
      edges: candidateEdges,
      storeIds,
    }
  }

  const matchingIds = new Set(
    candidateNodes
      .filter((node) => includesQuery(node, filters.query))
      .map((node) => node.id),
  )
  const contextualIds = new Set(matchingIds)
  candidateEdges.forEach((edge) => {
    if (matchingIds.has(edge.source) || matchingIds.has(edge.target)) {
      contextualIds.add(edge.source)
      contextualIds.add(edge.target)
    }
  })

  return {
    nodes: candidateNodes.filter((node) => contextualIds.has(node.id)),
    edges: candidateEdges.filter(
      (edge) => contextualIds.has(edge.source) && contextualIds.has(edge.target),
    ),
    storeIds,
  }
}

export const createFlowElements = (
  snapshot: GraphSnapshot,
  selectedNodeId: string | undefined,
  relatedNodeIds: ReadonlySet<string>,
  changedNodeIds: ReadonlySet<string>,
): { nodes: VisualizerFlowNode[]; edges: VisualizerFlowEdge[] } => {
  const derivedAtomIds = new Set(
    snapshot.edges.flatMap((edge) =>
      edge.kind === 'atom-dependency' ? [edge.target] : [],
    ),
  )
  const hasSelection = Boolean(selectedNodeId)
  const nodes: VisualizerFlowNode[] = snapshot.nodes.map((graphNode) => {
    const related = relatedNodeIds.has(graphNode.id)
    const dimmed = hasSelection && !related
    return {
      id: graphNode.id,
      type: graphNode.kind,
      position: { x: 0, y: 0 },
      selected: graphNode.id === selectedNodeId,
      className: [
        'jv-flow-node',
        `jv-flow-node--${graphNode.kind}`,
        related ? 'jv-flow-node--related' : '',
        dimmed ? 'jv-flow-node--dimmed' : '',
        changedNodeIds.has(graphNode.id) ? 'jv-flow-node--changed' : '',
      ]
        .filter(Boolean)
        .join(' '),
      ariaLabel: `${graphNode.kind} ${graphNode.label}`,
      data: {
        graphNode,
        isDerived:
          graphNode.kind === 'atom' && derivedAtomIds.has(graphNode.id),
        related,
        dimmed,
        changed: changedNodeIds.has(graphNode.id),
      },
    }
  })
  const edges: VisualizerFlowEdge[] = snapshot.edges.map((graphEdge) => {
    const related =
      !hasSelection ||
      (relatedNodeIds.has(graphEdge.source) &&
        relatedNodeIds.has(graphEdge.target))
    return {
      id: graphEdge.id,
      source: graphEdge.source,
      target: graphEdge.target,
      type: 'smoothstep',
      label:
        graphEdge.kind === 'component-consumer' ? graphEdge.access : undefined,
      className: [
        'jv-flow-edge',
        `jv-flow-edge--${graphEdge.kind}`,
        related ? 'jv-flow-edge--related' : 'jv-flow-edge--dimmed',
      ].join(' '),
      animated:
        graphEdge.kind === 'component-consumer' &&
        changedNodeIds.has(graphEdge.source),
    }
  })

  return { nodes, edges }
}

export const getConnectedNodeIds = (
  edges: readonly GraphEdge[],
  nodeId: string,
) =>
  edges.flatMap((edge) => {
    if (edge.source === nodeId) {
      return [edge.target]
    }
    if (edge.target === nodeId) {
      return [edge.source]
    }
    return []
  })
