import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Circle, XCircle } from 'lucide-react'
import { useTaskStore } from '../../store/useTaskStore'
import type { DAGNode } from '../../types'

function formatTime(ms: number): string {
  if (ms <= 0) return '--'
  const seconds = Math.ceil(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = seconds % 60
  return `${minutes}m ${remainingSecs}s`
}

function getNodeStatusIcon(status: DAGNode['status']) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="w-3 h-3 text-neon-green" />
    case 'running':
      return <Loader2 className="w-3 h-3 text-neon-blue animate-spin" />
    case 'failed':
      return <XCircle className="w-3 h-3 text-neon-pink" />
    case 'pending':
    case 'skipped':
    default:
      return <Circle className="w-3 h-3 text-white/30" />
  }
}

interface ProgressInfo {
  step: string
  progress: number
  estimatedRemaining: number
}

export const StatusIndicator: React.FC = () => {
  const { currentTask, executionDAG } = useTaskStore()
  const [expanded, setExpanded] = useState(false)

  // Derive progress info from DAG if available
  const progressInfo: ProgressInfo | null = (() => {
    if (!currentTask || currentTask.state === 'idle' || currentTask.state === 'completed') return null

    if (executionDAG && executionDAG.nodes.length > 0) {
      const total = executionDAG.nodes.length
      const done = executionDAG.nodes.filter((n) => n.status === 'done').length
      const running = executionDAG.nodes.find((n) => n.status === 'running')
      const progress = Math.round((done / total) * 100)
      const remaining = executionDAG.nodes
        .filter((n) => n.status === 'pending' || n.status === 'running')
        .reduce((acc, n) => acc + n.estimatedDuration, 0)

      return {
        step: running?.action || currentTask.state,
        progress,
        estimatedRemaining: remaining,
      }
    }

    // Fallback: use task state as step name
    const stateLabels: Record<string, string> = {
      parsing: '解析意图',
      clarifying: '等待澄清',
      planning: '规划执行',
      executing: '执行中',
      confirming: '等待确认',
      error_recovery: '错误恢复',
    }

    return {
      step: stateLabels[currentTask.state] || currentTask.state,
      progress: 0,
      estimatedRemaining: 0,
    }
  })()

  // Don't render if idle
  if (!progressInfo) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -4 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {/* Compact bubble */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-space-800/80 border border-neon-blue/30 backdrop-blur-sm hover:border-neon-blue/60 transition-colors"
        >
          {/* Pulsing dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-blue opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-blue" />
          </span>

          {/* Step name */}
          <span className="text-xs text-white/80 max-w-[120px] truncate">
            {progressInfo.step}
          </span>

          {/* Progress */}
          {progressInfo.progress > 0 && (
            <span className="text-xs text-neon-blue font-mono">{progressInfo.progress}%</span>
          )}

          {/* ETA */}
          {progressInfo.estimatedRemaining > 0 && (
            <span className="text-[10px] text-white/40">
              ~{formatTime(progressInfo.estimatedRemaining)}
            </span>
          )}

          {/* Expand icon */}
          {executionDAG && executionDAG.nodes.length > 0 && (
            expanded ? (
              <ChevronUp className="w-3 h-3 text-white/40" />
            ) : (
              <ChevronDown className="w-3 h-3 text-white/40" />
            )
          )}
        </button>

        {/* Expanded DAG details */}
        <AnimatePresence>
          {expanded && executionDAG && executionDAG.nodes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 right-0 min-w-[200px] rounded-lg bg-space-800/95 border border-white/10 backdrop-blur-md p-3 shadow-glass overflow-hidden z-50"
            >
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
                执行节点
              </div>
              <div className="flex flex-col gap-1.5">
                {executionDAG.nodes.map((node) => (
                  <div key={node.id} className="flex items-center gap-2">
                    {getNodeStatusIcon(node.status)}
                    <span className="text-xs text-white/70 flex-1 truncate">{node.action}</span>
                    <span className="text-[10px] text-white/30">{node.agentType}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
