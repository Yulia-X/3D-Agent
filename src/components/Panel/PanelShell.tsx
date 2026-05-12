import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Bug, Layers } from 'lucide-react'
import { useExposureStore } from '../../store/useExposureStore'
import { QuickFeedback } from './QuickFeedback'
import { EditControls } from './EditControls'
import { DebugPanel } from './DebugPanel'
import { ExportPanel } from './ExportPanel'

const sectionVariants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' as const },
  visible: {
    opacity: 1,
    height: 'auto',
    overflow: 'visible' as const,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    overflow: 'hidden' as const,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
}

interface PanelShellProps {
  onFeedback?: (text: string) => void
  onEditChange?: (params: Record<string, any>) => void
}

export function PanelShell({ onFeedback, onEditChange }: PanelShellProps) {
  const { exposure, collapsed, toggleCollapse, handleSignal } = useExposureStore()
  const [debugOpen, setDebugOpen] = useState(false)

  const editVisible = exposure.editPanel && !collapsed.editPanel
  const debugVisible = exposure.debugPanel && !collapsed.debugPanel && debugOpen

  const handleMoreControls = () => {
    handleSignal('more_controls_clicked')
  }

  const handleDebugToggle = () => {
    if (!exposure.debugPanel) {
      handleSignal('debug_toggled')
    }
    setDebugOpen((v) => !v)
  }

  return (
    <div className="w-[320px] h-full flex flex-col bg-space-900/80 backdrop-blur-xl border-l border-white/[0.06] overflow-hidden">
      {/* 滚动区域 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {/* 层1: QuickFeedback — 始终可见 */}
        <section className="border-b border-white/[0.06]">
          <QuickFeedback onFeedback={onFeedback} />
        </section>

        {/* 导出面板 */}
        <section className="border-b border-white/[0.06]">
          <ExportPanel />
        </section>

        {/* 展开更多控制按钮 */}
        {!exposure.editPanel && (
          <button
            onClick={handleMoreControls}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs text-white/50 hover:text-neon-blue hover:bg-white/[0.02] transition-colors border-b border-white/[0.06]"
          >
            <Layers size={14} />
            <span>更多控制</span>
            <ChevronDown size={12} />
          </button>
        )}

        {/* 层2: EditControls — 点击"更多控制"后展开 */}
        <AnimatePresence>
          {editVisible && (
            <motion.section
              key="edit-controls"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="border-b border-white/[0.06]"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">编辑控件</span>
                <button
                  onClick={() => toggleCollapse('editPanel')}
                  className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
              <EditControls onChange={onEditChange} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* 收起状态的恢复按钮 */}
        {exposure.editPanel && collapsed.editPanel && (
          <button
            onClick={() => toggleCollapse('editPanel')}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-white/40 hover:text-neon-blue hover:bg-white/[0.02] transition-colors border-b border-white/[0.06]"
          >
            <Layers size={12} />
            <span>展开编辑控件</span>
            <ChevronDown size={12} />
          </button>
        )}

        {/* 层3: DebugPanel — 开关控制 */}
        <div className="border-b border-white/[0.06]">
          <button
            onClick={handleDebugToggle}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bug size={13} />
              <span>调试面板</span>
            </div>
            <div className={`w-7 h-4 rounded-full transition-colors relative ${debugOpen ? 'bg-neon-blue/40' : 'bg-white/10'}`}>
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                  debugOpen ? 'left-3.5 bg-neon-blue' : 'left-0.5 bg-white/40'
                }`}
              />
            </div>
          </button>
        </div>

        <AnimatePresence>
          {debugVisible && (
            <motion.section
              key="debug-panel"
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <DebugPanel />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
