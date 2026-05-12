/**
 * Timeline - 线性时间线视图
 * 水平滚动容器，展示版本节点+连线
 * 当前活跃版本高亮，支持切换/分叉
 */
import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVersionStore } from '../../store/useVersionStore'
import { useExposureStore } from '../../store/useExposureStore'
import { VersionCard } from './VersionCard'
import { BranchGraph } from './BranchGraph'

export interface TimelineProps {
  onVersionSelect?: (versionId: string) => void
  onFork?: (fromVersionId: string) => void
}

export function Timeline({ onVersionSelect, onFork }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { versionTree, allVersions, checkout, fork, getVersionHistory, getBranches, hasMultipleVersions } = useVersionStore()
  const isPanelVisible = useExposureStore((s) => s.isPanelVisible)

  const isVisible = isPanelVisible('versionTimeline')
  const versions = getVersionHistory()
  const branches = getBranches()
  const hasBranches = branches.length > 1

  // 自动滚到当前活跃版本
  useEffect(() => {
    if (scrollRef.current && versionTree.currentHead) {
      const activeEl = scrollRef.current.querySelector(`[data-version-id="${versionTree.currentHead}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [versionTree.currentHead])

  // 无版本或只有1个版本时不显示
  if (!hasMultipleVersions()) return null

  const handleCheckout = (versionId: string) => {
    checkout(versionId)
    onVersionSelect?.(versionId)
  }

  const handleFork = (fromVersionId: string) => {
    fork(fromVersionId)
    onFork?.(fromVersionId)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="w-full border-t border-white/10 bg-space-900/80 backdrop-blur-md"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 140, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          {hasBranches ? (
            /* 有分支时自动使用BranchGraph */
            <BranchGraph onVersionSelect={onVersionSelect} />
          ) : (
            /* 线性时间线 */
            <div
              ref={scrollRef}
              className="h-full flex items-center gap-2 px-4 overflow-x-auto
                         scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
            >
              {versions.map((version, idx) => (
                <div
                  key={version.id}
                  data-version-id={version.id}
                  className="flex items-center"
                >
                  <VersionCard
                    version={version}
                    isActive={version.id === versionTree.currentHead}
                    onClick={() => handleCheckout(version.id)}
                    onFork={() => handleFork(version.id)}
                  />
                  {/* 连接线 */}
                  {idx < versions.length - 1 && (
                    <div className="w-8 h-[2px] mx-1 flex-shrink-0 relative">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, rgba(79,195,247,0.6), rgba(179,136,255,0.6))',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
