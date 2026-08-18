import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import type {
  GraphNode,
  GraphSnapshot,
  RuntimeGraph,
} from '@jotai-visualizer/core'

import { GraphCanvas } from './GraphCanvas.js'
import { filterGraphSnapshot } from './model.js'

const useChangedAtomIds = (snapshot: GraphSnapshot) => {
  const previousRevisions = useRef(new Map<string, number>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const newlyChanged: string[] = []
    const nextRevisions = new Map<string, number>()
    snapshot.nodes.forEach((node) => {
      if (node.kind !== 'atom') {
        return
      }
      const revision = node.revision ?? 0
      nextRevisions.set(node.id, revision)
      const previous = previousRevisions.current.get(node.id)
      if (previous !== undefined && previous !== revision) {
        newlyChanged.push(node.id)
      }
    })
    previousRevisions.current = nextRevisions

    if (newlyChanged.length > 0) {
      setChangedIds((current) => new Set([...current, ...newlyChanged]))
      newlyChanged.forEach((nodeId) => {
        const previousTimer = timers.current.get(nodeId)
        if (previousTimer) {
          clearTimeout(previousTimer)
        }
        const timer = setTimeout(() => {
          timers.current.delete(nodeId)
          setChangedIds((current) => {
            const next = new Set(current)
            next.delete(nodeId)
            return next
          })
        }, 900)
        timers.current.set(nodeId, timer)
      })
    }
  }, [snapshot])

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer))
      timers.current.clear()
    },
    [],
  )

  return changedIds
}

const NodeLinkList = ({
  emptyLabel,
  nodeIds,
  nodesById,
  onSelect,
}: {
  emptyLabel: string
  nodeIds: readonly string[]
  nodesById: ReadonlyMap<string, GraphNode>
  onSelect: (nodeId: string) => void
}) => {
  if (nodeIds.length === 0) {
    return <span className="jv-detail__empty">{emptyLabel}</span>
  }

  return (
    <ul className="jv-detail__links">
      {nodeIds.map((nodeId) => (
        <li key={nodeId}>
          <button type="button" onClick={() => onSelect(nodeId)}>
            {nodesById.get(nodeId)?.label ?? nodeId}
          </button>
        </li>
      ))}
    </ul>
  )
}

const NodeDetail = ({
  node,
  nodesById,
  onSelect,
  runtime,
}: {
  node: GraphNode | undefined
  nodesById: ReadonlyMap<string, GraphNode>
  onSelect: (nodeId: string) => void
  runtime: RuntimeGraph
}) => {
  if (!node) {
    return (
      <aside className="jv-detail jv-detail--empty" aria-label="Node details">
        <span className="jv-detail__kicker">Node details</span>
        <strong>Select a node</strong>
        <p>Inspect its value, source, and graph relationships.</p>
      </aside>
    )
  }

  const upstream = runtime
    .traverse(node.id, { direction: 'upstream' })
    .filter((nodeId) => nodesById.has(nodeId))
  const downstream = runtime
    .traverse(node.id, { direction: 'downstream' })
    .filter((nodeId) => nodesById.has(nodeId))

  return (
    <aside className="jv-detail" aria-label={`${node.label} details`}>
      <span className="jv-detail__kicker">Node details</span>
      <h3>{node.label}</h3>
      <span className={`jv-detail__badge jv-detail__badge--${node.kind}`}>
        {node.kind}
      </span>

      {node.kind === 'atom' && (
        <dl className="jv-detail__facts">
          <div>
            <dt>Store</dt>
            <dd>{node.storeId}</dd>
          </div>
          <div>
            <dt>Value preview</dt>
            <dd className="jv-detail__value">
              {node.valuePreview ?? 'Preview disabled'}
            </dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>{node.revision ?? 0}</dd>
          </div>
        </dl>
      )}

      {node.source && (
        <div className="jv-detail__source">
          <span>Source</span>
          <code>
            {node.source.file}
            {node.source.line ? `:${node.source.line}` : ''}
          </code>
        </div>
      )}

      <section className="jv-detail__section">
        <h4>Upstream · {upstream.length}</h4>
        <NodeLinkList
          nodeIds={upstream}
          nodesById={nodesById}
          onSelect={onSelect}
          emptyLabel="No upstream nodes"
        />
      </section>
      <section className="jv-detail__section">
        <h4>Downstream · {downstream.length}</h4>
        <NodeLinkList
          nodeIds={downstream}
          nodesById={nodesById}
          onSelect={onSelect}
          emptyLabel="No downstream nodes"
        />
      </section>
    </aside>
  )
}

const PanelContent = ({
  onClose,
  runtime,
  title,
}: {
  onClose: () => void
  runtime: RuntimeGraph
  title: string
}) => {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  )
  const changedNodeIds = useChangedAtomIds(snapshot)
  const [query, setQuery] = useState('')
  const [storeId, setStoreId] = useState<string | 'all'>('all')
  const [showPrivateAtoms, setShowPrivateAtoms] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string>()
  const [layoutVersion, setLayoutVersion] = useState(0)
  const filtered = useMemo(
    () =>
      filterGraphSnapshot(snapshot, { query, showPrivateAtoms, storeId }),
    [query, showPrivateAtoms, snapshot, storeId],
  )
  const nodesById = useMemo(
    () => new Map(filtered.nodes.map((node) => [node.id, node])),
    [filtered.nodes],
  )

  useEffect(() => {
    if (
      selectedNodeId &&
      !filtered.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(undefined)
    }
  }, [filtered.nodes, selectedNodeId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const relatedNodeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>()
    }
    const visibleNodeIds = new Set(filtered.nodes.map((node) => node.id))
    return new Set(
      [
        selectedNodeId,
        ...runtime.traverse(selectedNodeId, { direction: 'upstream' }),
        ...runtime.traverse(selectedNodeId, { direction: 'downstream' }),
      ].filter((nodeId) => visibleNodeIds.has(nodeId)),
    )
  }, [filtered.nodes, runtime, selectedNodeId, snapshot])

  return (
    <section
      id="jotai-visualizer-panel"
      className="jv-panel"
      role="dialog"
      aria-label={title}
      aria-modal="false"
    >
      <header className="jv-panel__header">
        <div className="jv-panel__identity">
          <span className="jv-panel__mark" aria-hidden="true" />
          <h2>{title}</h2>
          <span className="jv-panel__count">
            {filtered.nodes.length} nodes · {filtered.edges.length} edges
          </span>
        </div>
        <button
          type="button"
          className="jv-icon-button"
          onClick={onClose}
          aria-label="Close Jotai Visualizer"
        >
          ×
        </button>
      </header>

      <div className="jv-toolbar" aria-label="Graph filters">
        <label className="jv-search">
          <span className="jv-visually-hidden">Search graph</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search atoms and components…"
          />
        </label>
        <label className="jv-field">
          <span className="jv-visually-hidden">Filter by Store</span>
          <select
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
          >
            <option value="all">All stores</option>
            {filtered.storeIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="jv-toggle">
          <input
            type="checkbox"
            checked={showPrivateAtoms}
            onChange={(event) => setShowPrivateAtoms(event.target.checked)}
          />
          <span className="jv-toggle__control" aria-hidden="true" />
          <span>Private atoms</span>
        </label>
        <button
          type="button"
          className="jv-toolbar__layout"
          onClick={() => setLayoutVersion((version) => version + 1)}
        >
          Re-layout
        </button>
      </div>

      <div className="jv-panel__body">
        <div className="jv-canvas">
          <GraphCanvas
            snapshot={filtered}
            selectedNodeId={selectedNodeId}
            relatedNodeIds={relatedNodeIds}
            changedNodeIds={changedNodeIds}
            layoutVersion={layoutVersion}
            onSelectNode={setSelectedNodeId}
          />
        </div>
        <NodeDetail
          node={selectedNodeId ? nodesById.get(selectedNodeId) : undefined}
          nodesById={nodesById}
          runtime={runtime}
          onSelect={setSelectedNodeId}
        />
      </div>
    </section>
  )
}

export type GraphPanelProps = {
  initialOpen?: boolean
  onOpenChange?: (open: boolean) => void
  runtime: RuntimeGraph
  title?: string
}

export function GraphPanel({
  initialOpen = false,
  onOpenChange,
  runtime,
  title = 'Jotai Visualizer',
}: GraphPanelProps) {
  const [open, setOpen] = useState(initialOpen)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const updateOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      onOpenChange?.(nextOpen)
      if (!nextOpen) {
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    },
    [onOpenChange],
  )

  return (
    <div className="jv-root" data-jotai-visualizer="">
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          className="jv-trigger"
          onClick={() => updateOpen(true)}
          aria-controls="jotai-visualizer-panel"
          aria-expanded="false"
        >
          <span className="jv-trigger__mark" aria-hidden="true">
            JV
          </span>
          <span>Open Jotai Visualizer</span>
        </button>
      )}
      {open && (
        <PanelContent
          runtime={runtime}
          title={title}
          onClose={() => updateOpen(false)}
        />
      )}
    </div>
  )
}
