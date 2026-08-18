export type SourceLocation = {
  file: string
  line?: number
  column?: number
}

type GraphNodeBase = {
  id: string
  label: string
  source?: SourceLocation
}

export type AtomNode = GraphNodeBase & {
  kind: 'atom'
  storeId: string
  private?: boolean
  revision?: number
  valuePreview?: string
}

export type ComponentNode = GraphNodeBase & {
  kind: 'component'
}

export type GraphNode = AtomNode | ComponentNode

type GraphEdgeBase = {
  id: string
  source: string
  target: string
}

export type AtomDependencyEdge = GraphEdgeBase & {
  kind: 'atom-dependency'
}

export type ComponentConsumerEdge = GraphEdgeBase & {
  kind: 'component-consumer'
  access: 'read' | 'write' | 'read-write'
}

export type GraphEdge = AtomDependencyEdge | ComponentConsumerEdge

export type GraphSnapshot = {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
}

export type GraphPatch = {
  upsertNodes?: readonly GraphNode[]
  removeNodeIds?: readonly string[]
  upsertEdges?: readonly GraphEdge[]
  removeEdgeIds?: readonly string[]
}

export type GraphValidationIssueCode =
  | 'conflicting-operation'
  | 'duplicate-id'
  | 'empty-id'
  | 'empty-label'
  | 'invalid-access'
  | 'invalid-endpoint-kind'
  | 'kind-change'
  | 'missing-endpoint'
  | 'missing-store-id'

export type GraphValidationIssue = {
  code: GraphValidationIssueCode
  message: string
  path: string
}

export type ApplyGraphPatchResult =
  | {
      applied: true
      changed: boolean
      issues: readonly []
    }
  | {
      applied: false
      changed: false
      issues: readonly GraphValidationIssue[]
    }

export type GraphTraversalOptions = {
  direction: 'upstream' | 'downstream'
  edgeKinds?: readonly GraphEdge['kind'][]
}

export const isAtomNode = (node: GraphNode): node is AtomNode =>
  node.kind === 'atom'

export const isComponentNode = (node: GraphNode): node is ComponentNode =>
  node.kind === 'component'

export const isAtomDependencyEdge = (
  edge: GraphEdge,
): edge is AtomDependencyEdge => edge.kind === 'atom-dependency'

export const isComponentConsumerEdge = (
  edge: GraphEdge,
): edge is ComponentConsumerEdge => edge.kind === 'component-consumer'
