import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  applyNodeChanges,
  type NodeChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react'

import type { GraphSnapshot } from '@jotai-visualizer/core'

import { layoutFlowNodes } from './layout.js'
import {
  createFlowElements,
  type VisualizerFlowEdge,
  type VisualizerFlowNode,
} from './model.js'
import { visualizerNodeTypes } from './nodes.js'

export function GraphCanvas({
  changedNodeIds,
  layoutVersion,
  onSelectNode,
  relatedNodeIds,
  selectedNodeId,
  snapshot,
}: {
  changedNodeIds: ReadonlySet<string>
  layoutVersion: number
  onSelectNode: (nodeId: string) => void
  relatedNodeIds: ReadonlySet<string>
  selectedNodeId: string | undefined
  snapshot: GraphSnapshot
}) {
  const model = useMemo(
    () =>
      createFlowElements(
        snapshot,
        selectedNodeId,
        relatedNodeIds,
        changedNodeIds,
      ),
    [changedNodeIds, relatedNodeIds, selectedNodeId, snapshot],
  )
  const userPositions = useRef(new Map<string, XYPosition>())
  const layoutPositions = useRef(new Map<string, XYPosition>())
  const previousLayoutVersion = useRef(layoutVersion)
  const previousTopology = useRef('')
  const flowInstance = useRef<
    ReactFlowInstance<VisualizerFlowNode, VisualizerFlowEdge> | undefined
  >(undefined)
  const fitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [nodes, setNodes] = useState<VisualizerFlowNode[]>([])
  const [edges, setEdges] = useState<VisualizerFlowEdge[]>([])
  const topology = useMemo(
    () =>
      `${model.nodes.map((node) => node.id).join('|')}::${model.edges
        .map((edge) => `${edge.source}>${edge.target}`)
        .join('|')}`,
    [model.edges, model.nodes],
  )

  useEffect(() => {
    const forceLayout = previousLayoutVersion.current !== layoutVersion
    const topologyChanged = previousTopology.current !== topology
    previousLayoutVersion.current = layoutVersion
    previousTopology.current = topology
    if (forceLayout) {
      userPositions.current.clear()
    }
    const positioned =
      forceLayout || topologyChanged
        ? layoutFlowNodes(
            model.nodes,
            model.edges,
            userPositions.current,
            forceLayout,
          )
        : model.nodes.map((node) => ({
            ...node,
            position:
              userPositions.current.get(node.id) ??
              layoutPositions.current.get(node.id) ??
              node.position,
          }))
    if (forceLayout || topologyChanged) {
      layoutPositions.current = new Map(
        positioned.map((node) => [node.id, node.position]),
      )
    }
    setNodes(positioned)
    setEdges(model.edges)

    if (forceLayout || topologyChanged) {
      if (fitTimer.current) {
        clearTimeout(fitTimer.current)
      }
      fitTimer.current = setTimeout(() => {
        fitTimer.current = undefined
        void flowInstance.current?.fitView({ padding: 0.1 })
      }, 100)
    }
  }, [layoutVersion, model, topology])

  useEffect(
    () => () => {
      if (fitTimer.current) {
        clearTimeout(fitTimer.current)
      }
    },
    [],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<VisualizerFlowNode>[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          userPositions.current.set(change.id, change.position)
        }
      })
      setNodes((current) => applyNodeChanges(changes, current))
    },
    [],
  )

  if (snapshot.nodes.length === 0) {
    return (
      <div className="jv-empty" role="status">
        <strong>No matching graph nodes</strong>
        <span>Adjust the search or Store filters.</span>
      </div>
    )
  }

  return (
    <ReactFlow<VisualizerFlowNode, VisualizerFlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={visualizerNodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_event, node) => onSelectNode(node.id)}
      onInit={(instance) => {
        flowInstance.current = instance
      }}
      colorMode="dark"
      fitView
      minZoom={0.2}
      maxZoom={1.8}
      nodesConnectable={false}
      deleteKeyCode={null}
      aria-label="Jotai state dependency graph"
    >
      <Background color="#222b3a" gap={24} variant={BackgroundVariant.Lines} />
      <MiniMap
        pannable
        zoomable
        className="jv-minimap"
        nodeColor={(node) => (node.type === 'atom' ? '#8f78ee' : '#3eb7d8')}
      />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  )
}
