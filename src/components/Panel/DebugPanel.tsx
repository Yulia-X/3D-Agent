import React, { useMemo, useState, useCallback } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  Node,
  Edge,
  Background,
  BackgroundVariant,
  NodeProps,
  Handle,
  Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useTaskStore } from '../../store/useTaskStore'
import { useVersionStore } from '../../store/useVersionStore'
import { DAGNode as DAGNodeType } from '../../types'
import { Clock, CheckCircle, Loader, AlertCircle, SkipForward, List, Database } from 'lucide-react'

/* ---- 状态颜色映射 ---- */
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: 'bg-white/[0.04]', border: 'border-white/20', text: 'text-white/50' },
  running: { bg: 'bg-neon-blue/10', border: 'border-neon-blue/40', text: 'text-neon-blue' },
  done: { bg: 'bg-neon-green/10', border: 'border-neon-green/40', text: 'text-neon-green' },
  failed: { bg: 'bg-red-500/10', border: 'border-red-400/40', text: 'text-red-400' },
  skipped: { bg: 'bg-white/[0.02]', border: 'border-white/10', text: 'text-white/30' },
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle size={12} className="text-neon-green" />
    case 'running': return <Loader size={12} className="text-neon-blue animate-spin" />
    case 'failed': return <AlertCircle size={12} className="text-red-400" />
    case 'skipped': return <SkipForward size={12} className="text-white/30" />
    default: return <Clock size={12} className="text-white/30" />
  }
}

/* ---- 自定义节点 ---- */
function DagNodeComponent({ data }: NodeProps) {
  const node = data as DAGNodeType & { onClick: (n: DAGNodeType) => void }
  const colors = STATUS_COLORS[node.status] || STATUS_COLORS.pending

  return (
    <div
      onClick={() => node.onClick?.(node)}
      className={`px-3 py-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${colors.bg} ${colors.border}`}
      style={{ minWidth: 120 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white/20 !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2">
        <StatusIcon status={node.status} />
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-medium truncate ${colors.text}`}>{node.action}</div>
          <div className="text-[9px] text-white/30 mt-0.5">{node.agentType}</div>
        </div>
      </div>
      {node.estimatedDuration > 0 && (
        <div className="text-[9px] text-white/25 mt-1 font-mono">
          ~{(node.estimatedDuration / 1000).toFixed(1)}s
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-white/20 !w-2 !h-2 !border-0" />
    </div>
  )
}

const nodeTypes = { dagNode: DagNodeComponent }

/* ---- DAG Flow 可视化 ---- */
function DAGFlow({ onNodeClick }: { onNodeClick: (n: DAGNodeType) => void }) {
  const executionDAG = useTaskStore((s) => s.executionDAG)

  const { nodes, edges } = useMemo(() => {
    if (!executionDAG) return { nodes: [], edges: [] }

    const rfNodes: Node[] = executionDAG.nodes.map((n, idx) => ({
      id: n.id,
      type: 'dagNode',
      position: { x: idx * 180, y: Math.floor(idx / 3) * 100 },
      data: { ...n, onClick: onNodeClick },
    }))

    const rfEdges: Edge[] = executionDAG.edges.map((e) => ({
      id: `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      animated: executionDAG.nodes.find((n) => n.id === e.from)?.status === 'running',
      style: { stroke: 'rgba(79, 195, 247, 0.3)', strokeWidth: 1.5 },
    }))

    return { nodes: rfNodes, edges: rfEdges }
  }, [executionDAG, onNodeClick])

  if (!executionDAG || executionDAG.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <List size={16} className="text-white/20 mb-2" />
        <span className="text-xs text-white/30">暂无执行DAG</span>
      </div>
    )
  }

  return (
    <div className="h-[200px] w-full rounded-lg overflow-hidden border border-white/[0.06]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll={false}
        className="bg-space-900/60"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={0.5} color="rgba(255,255,255,0.03)" />
      </ReactFlow>
    </div>
  )
}

/* ---- 参数检查器 ---- */
function ParamInspector() {
  const { versionTree, allVersions } = useVersionStore()
  const currentVersion = versionTree.currentHead ? allVersions[versionTree.currentHead] : null

  if (!currentVersion) {
    return <span className="text-xs text-white/30">无版本数据</span>
  }

  const params = currentVersion.trigger?.resolvedIntent || {}
  const entries = Object.entries(params)

  if (entries.length === 0) {
    return <span className="text-xs text-white/30">无生成参数</span>
  }

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02]">
          <span className="text-[10px] text-white/50 font-mono">{key}</span>
          <span className="text-[10px] text-white/70 font-mono max-w-[140px] truncate">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ---- 节点详情弹窗 ---- */
function NodeDetail({ node, onClose }: { node: DAGNodeType; onClose: () => void }) {
  const colors = STATUS_COLORS[node.status] || STATUS_COLORS.pending
  return (
    <div className="p-3 rounded-lg border border-white/[0.08] bg-space-800/80 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={node.status} />
          <span className={`text-xs font-medium ${colors.text}`}>{node.action}</span>
        </div>
        <button onClick={onClose} className="text-[10px] text-white/40 hover:text-white/70">✕</button>
      </div>
      <div className="text-[10px] text-white/40 space-y-1">
        <div>Agent: <span className="text-white/60">{node.agentType}</span></div>
        <div>估时: <span className="text-white/60">{(node.estimatedDuration / 1000).toFixed(1)}s</span></div>
        <div>估费: <span className="text-white/60">{node.estimatedCost} credits</span></div>
        {node.canParallel && <div className="text-neon-blue/60">可并行</div>}
      </div>
      {node.params && Object.keys(node.params).length > 0 && (
        <div className="pt-1 border-t border-white/[0.06]">
          <span className="text-[9px] text-white/30 uppercase">参数</span>
          <pre className="text-[9px] text-white/50 mt-1 overflow-x-auto whitespace-pre-wrap max-h-20">
            {JSON.stringify(node.params, null, 2)}
          </pre>
        </div>
      )}
      {node.result && (
        <div className="pt-1 border-t border-white/[0.06]">
          <span className="text-[9px] text-white/30 uppercase">输出</span>
          <pre className="text-[9px] text-white/50 mt-1 overflow-x-auto whitespace-pre-wrap max-h-20">
            {JSON.stringify(node.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ---- 主组件 ---- */
export function DebugPanel() {
  const [selectedNode, setSelectedNode] = useState<DAGNodeType | null>(null)

  const handleNodeClick = useCallback((node: DAGNodeType) => {
    setSelectedNode(node)
  }, [])

  return (
    <ReactFlowProvider>
      <div className="p-4 space-y-4">
        {/* DAG 可视化 */}
        <div>
          <h4 className="text-[11px] text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
            <List size={12} />
            执行 DAG
          </h4>
          <DAGFlow onNodeClick={handleNodeClick} />
        </div>

        {/* 节点详情 */}
        {selectedNode && (
          <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}

        {/* 参数检查器 */}
        <div>
          <h4 className="text-[11px] text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Database size={12} />
            生成参数
          </h4>
          <ParamInspector />
        </div>

        {/* 经验库命中日志 */}
        <ExperienceLog />
      </div>
    </ReactFlowProvider>
  )
}

function ExperienceLog() {
  // 经验命中数据暂时从 mock 获取，实际可从 OrchestratorContext 获取
  const mockHits: Array<{ id: string; pattern: string; strategy: string }> = []

  return (
    <div>
      <h4 className="text-[11px] text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Database size={12} />
        经验库命中
      </h4>
      {mockHits.length === 0 ? (
        <span className="text-[10px] text-white/25">本次任务暂无经验命中</span>
      ) : (
        <div className="space-y-1">
          {mockHits.map((hit) => (
            <div key={hit.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-white/50">{hit.pattern}</span>
              <span className="text-[9px] text-neon-green/60">{hit.strategy}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
