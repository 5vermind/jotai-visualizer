import { memo } from 'react'

import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { VisualizerFlowNode } from './model.js'

const AtomNodeComponent = ({ data }: NodeProps<VisualizerFlowNode>) => {
  const node = data.graphNode
  if (node.kind !== 'atom') {
    return null
  }

  return (
    <div className="jv-node jv-node--atom">
      <Handle type="target" position={Position.Left} />
      <div className="jv-node__meta">
        <span>{data.isDerived ? 'Derived atom' : 'Atom'}</span>
        <span>{node.storeId}</span>
      </div>
      <strong className="jv-node__label" title={node.label}>
        {node.label}
      </strong>
      <div className="jv-node__value">
        {node.valuePreview ?? 'Preview off'}
      </div>
      {node.private && <span className="jv-node__private">Private</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const ComponentNodeComponent = ({ data }: NodeProps<VisualizerFlowNode>) => {
  const node = data.graphNode
  if (node.kind !== 'component') {
    return null
  }

  return (
    <div className="jv-node jv-node--component">
      <Handle type="target" position={Position.Left} />
      <span className="jv-node__component-type">Component</span>
      <strong className="jv-node__label" title={node.label}>
        {node.label}
      </strong>
    </div>
  )
}

export const AtomNode = memo(AtomNodeComponent)
export const ComponentNode = memo(ComponentNodeComponent)

export const visualizerNodeTypes = {
  atom: AtomNode,
  component: ComponentNode,
}
