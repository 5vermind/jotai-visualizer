import type {
  AtomNode,
  ComponentConsumerEdge,
  ComponentNode,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
} from '@jotai-visualizer/core'
import type { Atom, createStore } from 'jotai'

export type ComponentMetadata = {
  id: string
  name: string
  file?: string
  line?: number
  column?: number
}

export type ConsumerAccess = ComponentConsumerEdge['access']

type AnyAtom = Atom<unknown>

export type JotaiStore = ReturnType<typeof createStore>

type AtomSnapshot = {
  values: ReadonlyMap<AnyAtom, unknown>
  dependents: ReadonlyMap<AnyAtom, ReadonlySet<AnyAtom>>
}

type StoreCollection = {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

export type RuntimeGraph = {
  clearAtomSnapshot(store: JotaiStore): void
  getJsonSnapshot(space?: number): string
  getSnapshot(): GraphSnapshot
  registerConsumer(input: {
    store: JotaiStore
    atom: AnyAtom
    component: ComponentMetadata
    access: ConsumerAccess
  }): () => void
  subscribe(listener: () => void): () => void
  syncAtomSnapshot(store: JotaiStore, snapshot: AtomSnapshot): void
}

const previewValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }
  if (value instanceof Promise) {
    return '[Promise]'
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === 'bigint') {
        return `${nestedValue}n`
      }
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        if (seen.has(nestedValue)) {
          return '[Circular]'
        }
        seen.add(nestedValue)
      }
      return nestedValue
    })
    if (serialized === undefined) {
      return Object.prototype.toString.call(value)
    }
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized
  } catch {
    return Object.prototype.toString.call(value)
  }
}

export const createRuntimeGraph = (): RuntimeGraph => {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge>()
  const listeners = new Set<() => void>()
  const storeIds = new WeakMap<JotaiStore, string>()
  const atomIds = new WeakMap<AnyAtom, string>()
  const storeCollections = new WeakMap<JotaiStore, StoreCollection>()
  const consumerCounts = new Map<string, number>()

  let nextStoreId = 1
  let nextAtomId = 1
  let cachedSnapshot: GraphSnapshot | undefined

  const emit = () => {
    cachedSnapshot = undefined
    listeners.forEach((listener) => listener())
  }

  const getStoreId = (store: JotaiStore) => {
    let id = storeIds.get(store)
    if (!id) {
      id = `store:${nextStoreId++}`
      storeIds.set(store, id)
    }
    return id
  }

  const getAtomObjectId = (atom: AnyAtom) => {
    let id = atomIds.get(atom)
    if (!id) {
      id = `atom:${nextAtomId++}`
      atomIds.set(atom, id)
    }
    return id
  }

  const getAtomNodeId = (store: JotaiStore, atom: AnyAtom) =>
    `${getStoreId(store)}/${getAtomObjectId(atom)}`

  const getAtomLabel = (atom: AnyAtom) => atom.debugLabel || atom.toString()

  const upsertAtomNode = (
    store: JotaiStore,
    atom: AnyAtom,
    value: { present: false } | { present: true; value: unknown },
  ) => {
    const id = getAtomNodeId(store, atom)
    const previous = nodes.get(id)
    const node: AtomNode = {
      kind: 'atom',
      id,
      storeId: getStoreId(store),
      label: getAtomLabel(atom),
      ...(value.present
        ? { valuePreview: previewValue(value.value) }
        : previous?.kind === 'atom' && previous.valuePreview !== undefined
          ? { valuePreview: previous.valuePreview }
          : {}),
    }
    nodes.set(id, node)
    return id
  }

  const removeAtomNodeWhenUnused = (nodeId: string) => {
    const isConsumed = [...edges.values()].some(
      (edge) => edge.kind === 'component-consumer' && edge.source === nodeId,
    )
    if (!isConsumed) {
      nodes.delete(nodeId)
    }
  }

  const clearAtomSnapshot = (store: JotaiStore) => {
    const previous = storeCollections.get(store)
    if (!previous) {
      return
    }
    previous.edgeIds.forEach((edgeId) => edges.delete(edgeId))
    previous.nodeIds.forEach(removeAtomNodeWhenUnused)
    storeCollections.delete(store)
    emit()
  }

  const getSnapshot = (): GraphSnapshot => {
    cachedSnapshot ??= {
      nodes: [...nodes.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      edges: [...edges.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }
    return cachedSnapshot
  }

  return {
    clearAtomSnapshot,
    getJsonSnapshot: (space = 2) => JSON.stringify(getSnapshot(), null, space),
    getSnapshot,
    registerConsumer: ({ store, atom, component, access }) => {
      const atomNodeId = upsertAtomNode(store, atom, { present: false })
      const componentNodeId = `component:${component.id}`
      const edgeId = `consumer:${atomNodeId}->${componentNodeId}:${access}`
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
        source: atomNodeId,
        target: componentNodeId,
        access,
      }

      nodes.set(componentNodeId, componentNode)
      edges.set(edgeId, edge)
      consumerCounts.set(edgeId, (consumerCounts.get(edgeId) ?? 0) + 1)
      emit()

      let active = true
      return () => {
        if (!active) {
          return
        }
        active = false
        const nextCount = (consumerCounts.get(edgeId) ?? 1) - 1
        if (nextCount > 0) {
          consumerCounts.set(edgeId, nextCount)
          return
        }

        consumerCounts.delete(edgeId)
        edges.delete(edgeId)
        const componentIsUsed = [...edges.values()].some(
          (candidate) =>
            candidate.kind === 'component-consumer' &&
            candidate.target === componentNodeId,
        )
        if (!componentIsUsed) {
          nodes.delete(componentNodeId)
        }
        const collected = storeCollections.get(store)?.nodeIds.has(atomNodeId)
        if (!collected) {
          removeAtomNodeWhenUnused(atomNodeId)
        }
        emit()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    syncAtomSnapshot: (store, snapshot) => {
      const previous = storeCollections.get(store)
      const nextNodeIds = new Set<string>()
      const nextEdgeIds = new Set<string>()
      const atoms = new Set<AnyAtom>()

      snapshot.values.forEach((_value, atom) => atoms.add(atom))
      snapshot.dependents.forEach((dependents, atom) => {
        atoms.add(atom)
        dependents.forEach((dependent) => atoms.add(dependent))
      })

      atoms.forEach((atom) => {
        const value = snapshot.values.has(atom)
          ? { present: true as const, value: snapshot.values.get(atom) }
          : { present: false as const }
        nextNodeIds.add(upsertAtomNode(store, atom, value))
      })

      snapshot.dependents.forEach((dependents, dependency) => {
        const source = getAtomNodeId(store, dependency)
        dependents.forEach((dependent) => {
          const target = getAtomNodeId(store, dependent)
          const id = `dependency:${source}->${target}`
          nextEdgeIds.add(id)
          edges.set(id, {
            kind: 'atom-dependency',
            id,
            source,
            target,
          })
        })
      })

      previous?.edgeIds.forEach((edgeId) => {
        if (!nextEdgeIds.has(edgeId)) {
          edges.delete(edgeId)
        }
      })
      previous?.nodeIds.forEach((nodeId) => {
        if (!nextNodeIds.has(nodeId)) {
          removeAtomNodeWhenUnused(nodeId)
        }
      })

      storeCollections.set(store, {
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds,
      })
      emit()
    },
  }
}
