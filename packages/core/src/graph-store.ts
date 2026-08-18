import type {
  ApplyGraphPatchResult,
  GraphEdge,
  GraphNode,
  GraphPatch,
  GraphSnapshot,
  GraphTraversalOptions,
  GraphValidationIssue,
} from './graph.js'

export type GraphStore = {
  applyPatch(patch: GraphPatch): ApplyGraphPatchResult
  getEdge(edgeId: string): GraphEdge | undefined
  getNode(nodeId: string): GraphNode | undefined
  getSnapshot(): GraphSnapshot
  subscribe(listener: () => void): () => void
  traverse(startNodeId: string, options: GraphTraversalOptions): readonly string[]
}

const sourceLocationsEqual = (
  left: GraphNode['source'],
  right: GraphNode['source'],
) =>
  left === right ||
  (left?.file === right?.file &&
    left?.line === right?.line &&
    left?.column === right?.column)

const nodesEqual = (left: GraphNode, right: GraphNode) =>
  left.kind === right.kind &&
  left.id === right.id &&
  left.label === right.label &&
  sourceLocationsEqual(left.source, right.source) &&
  (left.kind !== 'atom' ||
    (right.kind === 'atom' &&
      left.storeId === right.storeId &&
      left.valuePreview === right.valuePreview))

const edgesEqual = (left: GraphEdge, right: GraphEdge) =>
  left.kind === right.kind &&
  left.id === right.id &&
  left.source === right.source &&
  left.target === right.target &&
  (left.kind !== 'component-consumer' ||
    (right.kind === 'component-consumer' && left.access === right.access))

const findRepeatedIds = (ids: readonly string[]) => {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  ids.forEach((id) => {
    if (seen.has(id)) {
      repeated.add(id)
    }
    seen.add(id)
  })
  return repeated
}

const validatePatch = (
  patch: GraphPatch,
  nodes: ReadonlyMap<string, GraphNode>,
  edges: ReadonlyMap<string, GraphEdge>,
): GraphValidationIssue[] => {
  const issues: GraphValidationIssue[] = []
  const upsertNodes = patch.upsertNodes ?? []
  const removeNodeIds = patch.removeNodeIds ?? []
  const upsertEdges = patch.upsertEdges ?? []
  const removeEdgeIds = patch.removeEdgeIds ?? []

  const addIssue = (
    code: GraphValidationIssue['code'],
    path: string,
    message: string,
  ) => issues.push({ code, path, message })

  findRepeatedIds(upsertNodes.map((node) => node.id)).forEach((id) =>
    addIssue('duplicate-id', 'upsertNodes', `Duplicate node ID: ${id}`),
  )
  findRepeatedIds(removeNodeIds).forEach((id) =>
    addIssue('duplicate-id', 'removeNodeIds', `Duplicate node ID: ${id}`),
  )
  findRepeatedIds(upsertEdges.map((edge) => edge.id)).forEach((id) =>
    addIssue('duplicate-id', 'upsertEdges', `Duplicate edge ID: ${id}`),
  )
  findRepeatedIds(removeEdgeIds).forEach((id) =>
    addIssue('duplicate-id', 'removeEdgeIds', `Duplicate edge ID: ${id}`),
  )

  const removedNodes = new Set(removeNodeIds)
  const removedEdges = new Set(removeEdgeIds)
  upsertNodes.forEach((node, index) => {
    const path = `upsertNodes[${index}]`
    if (!node.id.trim()) {
      addIssue('empty-id', `${path}.id`, 'Node ID must not be empty')
    }
    if (!node.label.trim()) {
      addIssue('empty-label', `${path}.label`, 'Node label must not be empty')
    }
    if (node.kind === 'atom' && !node.storeId.trim()) {
      addIssue(
        'missing-store-id',
        `${path}.storeId`,
        'Atom nodes require a Store ID',
      )
    }
    if (removedNodes.has(node.id)) {
      addIssue(
        'conflicting-operation',
        path,
        `Node ${node.id} cannot be upserted and removed in one patch`,
      )
    }
    const previous = nodes.get(node.id)
    if (previous && previous.kind !== node.kind) {
      addIssue(
        'kind-change',
        `${path}.kind`,
        `Node ${node.id} cannot change kind`,
      )
    }
  })

  const projectedNodes = new Map(nodes)
  removeNodeIds.forEach((id) => projectedNodes.delete(id))
  upsertNodes.forEach((node) => projectedNodes.set(node.id, node))

  upsertEdges.forEach((edge, index) => {
    const path = `upsertEdges[${index}]`
    if (!edge.id.trim()) {
      addIssue('empty-id', `${path}.id`, 'Edge ID must not be empty')
    }
    if (removedEdges.has(edge.id)) {
      addIssue(
        'conflicting-operation',
        path,
        `Edge ${edge.id} cannot be upserted and removed in one patch`,
      )
    }
    const sourceNode = projectedNodes.get(edge.source)
    const targetNode = projectedNodes.get(edge.target)
    if (!sourceNode) {
      addIssue(
        'missing-endpoint',
        `${path}.source`,
        `Missing source node: ${edge.source}`,
      )
    }
    if (!targetNode) {
      addIssue(
        'missing-endpoint',
        `${path}.target`,
        `Missing target node: ${edge.target}`,
      )
    }
    if (
      sourceNode &&
      targetNode &&
      (edge.kind === 'atom-dependency'
        ? sourceNode.kind !== 'atom' || targetNode.kind !== 'atom'
        : sourceNode.kind !== 'atom' || targetNode.kind !== 'component')
    ) {
      addIssue(
        'invalid-endpoint-kind',
        path,
        `${edge.kind} has incompatible endpoint node kinds`,
      )
    }
    if (
      edge.kind === 'component-consumer' &&
      !['read', 'write', 'read-write'].includes(edge.access)
    ) {
      addIssue(
        'invalid-access',
        `${path}.access`,
        `Invalid component access mode: ${String(edge.access)}`,
      )
    }
    const previous = edges.get(edge.id)
    if (previous && previous.kind !== edge.kind) {
      addIssue(
        'kind-change',
        `${path}.kind`,
        `Edge ${edge.id} cannot change kind`,
      )
    }
  })

  return issues
}

const freezeNode = (node: GraphNode): GraphNode =>
  Object.freeze({
    ...node,
    ...(node.source ? { source: Object.freeze({ ...node.source }) } : {}),
  })

const freezeEdge = (edge: GraphEdge): GraphEdge => Object.freeze({ ...edge })

export const createGraphStore = (): GraphStore => {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge>()
  const listeners = new Set<() => void>()
  let cachedSnapshot: GraphSnapshot | undefined

  const emit = () => {
    cachedSnapshot = undefined
    listeners.forEach((listener) => listener())
  }

  const getSnapshot = (): GraphSnapshot => {
    cachedSnapshot ??= Object.freeze({
      nodes: Object.freeze(
        [...nodes.values()].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      ),
      edges: Object.freeze(
        [...edges.values()].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      ),
    })
    return cachedSnapshot
  }

  return {
    applyPatch: (patch) => {
      const issues = validatePatch(patch, nodes, edges)
      if (issues.length > 0) {
        return {
          applied: false,
          changed: false,
          issues: Object.freeze(issues),
        }
      }

      let changed = false
      const removeEdge = (edgeId: string) => {
        if (edges.delete(edgeId)) {
          changed = true
        }
      }

      ;(patch.removeEdgeIds ?? []).forEach(removeEdge)
      ;(patch.removeNodeIds ?? []).forEach((nodeId) => {
        if (nodes.delete(nodeId)) {
          changed = true
        }
        edges.forEach((edge, edgeId) => {
          if (edge.source === nodeId || edge.target === nodeId) {
            removeEdge(edgeId)
          }
        })
      })
      ;(patch.upsertNodes ?? []).forEach((node) => {
        const previous = nodes.get(node.id)
        if (!previous || !nodesEqual(previous, node)) {
          nodes.set(node.id, freezeNode(node))
          changed = true
        }
      })
      ;(patch.upsertEdges ?? []).forEach((edge) => {
        const previous = edges.get(edge.id)
        if (!previous || !edgesEqual(previous, edge)) {
          edges.set(edge.id, freezeEdge(edge))
          changed = true
        }
      })

      if (changed) {
        emit()
      }
      return { applied: true, changed, issues: [] }
    },
    getEdge: (edgeId) => edges.get(edgeId),
    getNode: (nodeId) => nodes.get(nodeId),
    getSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    traverse: (startNodeId, { direction, edgeKinds }) => {
      if (!nodes.has(startNodeId)) {
        return []
      }
      const allowedKinds = edgeKinds ? new Set(edgeKinds) : undefined
      const visited = new Set([startNodeId])
      const result: string[] = []
      const queue = [startNodeId]

      while (queue.length > 0) {
        const current = queue.shift()
        if (!current) {
          continue
        }
        const adjacent = [...edges.values()]
          .filter(
            (edge) =>
              (!allowedKinds || allowedKinds.has(edge.kind)) &&
              (direction === 'downstream'
                ? edge.source === current
                : edge.target === current),
          )
          .map((edge) =>
            direction === 'downstream' ? edge.target : edge.source,
          )
          .sort()

        adjacent.forEach((nodeId) => {
          if (!visited.has(nodeId)) {
            visited.add(nodeId)
            result.push(nodeId)
            queue.push(nodeId)
          }
        })
      }

      return Object.freeze(result)
    },
  }
}
