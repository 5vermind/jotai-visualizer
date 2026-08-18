import type {
  AtomNode,
  ComponentConsumerEdge,
  ComponentNode,
  GraphEdge,
  GraphPatch,
  GraphSnapshot,
  GraphTraversalOptions,
} from './graph.js'
import { createGraphStore } from './graph-store.js'
import { createObjectIdRegistry } from './object-id-registry.js'
import {
  createValuePreview,
  type ValuePreviewPolicy,
} from './value-preview.js'

export type ComponentMetadata = {
  id: string
  name: string
  file?: string
  line?: number
  column?: number
}

export type ConsumerAccess = ComponentConsumerEdge['access']

export type RuntimeStore = object

export type RuntimeAtom = object & {
  debugLabel?: string
  toString(): string
}

export type RuntimeAtomSnapshot = {
  values: ReadonlyMap<RuntimeAtom, unknown>
  dependents: ReadonlyMap<RuntimeAtom, ReadonlySet<RuntimeAtom>>
}

type StoreCollection = {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

export type RuntimeGraphOptions = {
  valuePreview?: ValuePreviewPolicy
}

export type RuntimeGraph = {
  clearAtomSnapshot(store: RuntimeStore): void
  getAtomNodeId(store: RuntimeStore, atom: RuntimeAtom): string
  getJsonSnapshot(space?: number): string
  getSnapshot(): GraphSnapshot
  getStoreId(store: RuntimeStore): string
  registerConsumer(input: {
    store: RuntimeStore
    atom: RuntimeAtom
    component: ComponentMetadata
    access: ConsumerAccess
  }): () => void
  releaseStore(store: RuntimeStore): void
  subscribe(listener: () => void): () => void
  syncAtomSnapshot(store: RuntimeStore, snapshot: RuntimeAtomSnapshot): void
  traverse(
    startNodeId: string,
    options: GraphTraversalOptions,
  ): readonly string[]
}

export const createRuntimeGraph = (
  options: RuntimeGraphOptions = {},
): RuntimeGraph => {
  const graphStore = createGraphStore()
  const storeIds = createObjectIdRegistry('store')
  const atomIds = createObjectIdRegistry('atom')
  const storeCollections = new WeakMap<RuntimeStore, StoreCollection>()
  const consumerCounts = new Map<string, number>()
  const consumerStoreIds = new Map<string, string>()

  const applyInternalPatch = (patch: GraphPatch) => {
    const result = graphStore.applyPatch(patch)
    if (!result.applied) {
      const details = result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')
      throw new Error(`Jotai Visualizer generated an invalid graph patch: ${details}`)
    }
    return result.changed
  }

  const getStoreId = (store: RuntimeStore) => storeIds.get(store)
  const getAtomNodeId = (store: RuntimeStore, atom: RuntimeAtom) =>
    `${getStoreId(store)}/${atomIds.get(atom)}`
  const getAtomLabel = (atom: RuntimeAtom) => atom.debugLabel || atom.toString()

  const createAtomNode = (
    store: RuntimeStore,
    atom: RuntimeAtom,
    value: { present: false } | { present: true; value: unknown },
  ): AtomNode => {
    const id = getAtomNodeId(store, atom)
    const storeId = getStoreId(store)
    const label = getAtomLabel(atom)
    const previous = graphStore.getNode(id)
    const valuePreview = value.present
      ? createValuePreview(
          value.value,
          { atomLabel: label, nodeId: id, storeId },
          options.valuePreview,
        )
      : previous?.kind === 'atom'
        ? previous.valuePreview
        : undefined

    return {
      kind: 'atom',
      id,
      storeId,
      label,
      ...(valuePreview === undefined ? {} : { valuePreview }),
    }
  }

  const atomHasConsumer = (nodeId: string) =>
    graphStore
      .getSnapshot()
      .edges.some(
        (edge) => edge.kind === 'component-consumer' && edge.source === nodeId,
      )

  const orphanComponentIds = () => {
    const snapshot = graphStore.getSnapshot()
    return snapshot.nodes.flatMap((node) => {
      if (node.kind !== 'component') {
        return []
      }
      const remainsConnected = snapshot.edges.some(
        (edge) =>
          edge.source === node.id || edge.target === node.id,
      )
      return remainsConnected ? [] : [node.id]
    })
  }

  const clearAtomSnapshot = (store: RuntimeStore) => {
    const previous = storeCollections.get(store)
    if (!previous) {
      return
    }
    applyInternalPatch({
      removeEdgeIds: [...previous.edgeIds],
      removeNodeIds: [...previous.nodeIds].filter(
        (nodeId) => !atomHasConsumer(nodeId),
      ),
    })
    storeCollections.delete(store)
  }

  return {
    clearAtomSnapshot,
    getAtomNodeId,
    getJsonSnapshot: (space = 2) =>
      JSON.stringify(graphStore.getSnapshot(), null, space),
    getSnapshot: graphStore.getSnapshot,
    getStoreId,
    registerConsumer: ({ store, atom, component, access }) => {
      const atomNode = createAtomNode(store, atom, { present: false })
      const componentNodeId = `component:${component.id}`
      const edgeId = `consumer:${atomNode.id}->${componentNodeId}:${access}`
      const componentNode: ComponentNode = {
        kind: 'component',
        id: componentNodeId,
        label: component.name,
        ...(component.file
          ? {
              source: {
                file: component.file,
                ...(component.line === undefined ? {} : { line: component.line }),
                ...(component.column === undefined
                  ? {}
                  : { column: component.column }),
              },
            }
          : {}),
      }
      const edge: ComponentConsumerEdge = {
        kind: 'component-consumer',
        id: edgeId,
        source: atomNode.id,
        target: componentNodeId,
        access,
      }

      applyInternalPatch({
        upsertNodes: [atomNode, componentNode],
        upsertEdges: [edge],
      })
      consumerCounts.set(edgeId, (consumerCounts.get(edgeId) ?? 0) + 1)
      consumerStoreIds.set(edgeId, atomNode.storeId)

      let active = true
      return () => {
        if (!active) {
          return
        }
        active = false
        const currentCount = consumerCounts.get(edgeId)
        if (currentCount === undefined) {
          return
        }
        if (currentCount > 1) {
          consumerCounts.set(edgeId, currentCount - 1)
          return
        }

        consumerCounts.delete(edgeId)
        consumerStoreIds.delete(edgeId)
        const atomIsCollected = storeCollections
          .get(store)
          ?.nodeIds.has(atomNode.id)
        const otherComponentEdgeExists = graphStore
          .getSnapshot()
          .edges.some(
            (candidate) =>
              candidate.kind === 'component-consumer' &&
              candidate.id !== edgeId &&
              candidate.target === componentNodeId,
          )
        applyInternalPatch({
          removeEdgeIds: [edgeId],
          removeNodeIds: [
            ...(atomIsCollected ? [] : [atomNode.id]),
            ...(otherComponentEdgeExists ? [] : [componentNodeId]),
          ],
        })
      }
    },
    releaseStore: (store) => {
      const storeId = storeIds.peek(store)
      if (!storeId) {
        return
      }
      const snapshot = graphStore.getSnapshot()
      const atomNodeIds = snapshot.nodes.flatMap((node) =>
        node.kind === 'atom' && node.storeId === storeId ? [node.id] : [],
      )
      const removedConsumerEdges = new Set(
        snapshot.edges.flatMap((edge) =>
          edge.kind === 'component-consumer' &&
          consumerStoreIds.get(edge.id) === storeId
            ? [edge.id]
            : [],
        ),
      )
      removedConsumerEdges.forEach((edgeId) => {
        consumerCounts.delete(edgeId)
        consumerStoreIds.delete(edgeId)
      })

      applyInternalPatch({ removeNodeIds: atomNodeIds })
      const componentsToRemove = orphanComponentIds()
      if (componentsToRemove.length > 0) {
        applyInternalPatch({ removeNodeIds: componentsToRemove })
      }
      storeCollections.delete(store)
      storeIds.release(store)
    },
    subscribe: graphStore.subscribe,
    syncAtomSnapshot: (store, snapshot) => {
      const previous = storeCollections.get(store)
      const nextNodeIds = new Set<string>()
      const nextEdgeIds = new Set<string>()
      const atoms = new Set<RuntimeAtom>()
      const upsertNodes: AtomNode[] = []
      const upsertEdges: GraphEdge[] = []

      snapshot.values.forEach((_value, atom) => atoms.add(atom))
      snapshot.dependents.forEach((dependents, atom) => {
        atoms.add(atom)
        dependents.forEach((dependent) => atoms.add(dependent))
      })

      atoms.forEach((atom) => {
        const value = snapshot.values.has(atom)
          ? { present: true as const, value: snapshot.values.get(atom) }
          : { present: false as const }
        const node = createAtomNode(store, atom, value)
        nextNodeIds.add(node.id)
        upsertNodes.push(node)
      })

      snapshot.dependents.forEach((dependents, dependency) => {
        const source = getAtomNodeId(store, dependency)
        dependents.forEach((dependent) => {
          const target = getAtomNodeId(store, dependent)
          const id = `dependency:${source}->${target}`
          nextEdgeIds.add(id)
          upsertEdges.push({
            kind: 'atom-dependency',
            id,
            source,
            target,
          })
        })
      })

      const removeEdgeIds = [...(previous?.edgeIds ?? [])].filter(
        (edgeId) => !nextEdgeIds.has(edgeId),
      )
      const removeNodeIds = [...(previous?.nodeIds ?? [])].filter(
        (nodeId) => !nextNodeIds.has(nodeId) && !atomHasConsumer(nodeId),
      )

      applyInternalPatch({
        upsertNodes,
        removeNodeIds,
        upsertEdges,
        removeEdgeIds,
      })
      storeCollections.set(store, {
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds,
      })
    },
    traverse: graphStore.traverse,
  }
}
