/**
 * ProgressOverlay — 生成进度覆盖层
 * 全屏覆盖在3D预览区上方，显示进度环+步骤+预计剩余时间
 */
import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useTaskStore } from '../../store/useTaskStore'

interface ProgressOverlayProps {
  /** 当前步骤名称 */
  stepName?: string
  /** 进度百分比 0-100 */
  progress?: number
  /** 预计剩余时间（毫秒） */
  estimatedRemaining?: number
  /** 取消回调 */
  onCancel?: () => void
}

export function ProgressOverlay({ stepName, progress, estimatedRemaining, onCancel }: ProgressOverlayProps) {
  const currentTask = useTaskStore((s) => s.currentTask)

  // 判断是否应该显示覆盖层
  const isActive = currentTask && currentTask.state !== 'idle' && currentTask.state !== 'completed' && currentTask.state !== 'error_recovery'

  // 格式化剩余时间
  const formattedTime = useMemo(() => {
    if (!estimatedRemaining || estimatedRemaining <= 0) return null
    const seconds = Math.ceil(estimatedRemaining / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    const remainSec = seconds % 60
    return `${minutes}分${remainSec}秒`
  }, [estimatedRemaining])

  // SVG进度环参数
  const radius = 52
  const strokeWidth = 5
  const circumference = 2 * Math.PI * radius
  const progressValue = progress ?? 0
  const strokeDashoffset = circumference - (progressValue / 100) * circumference

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* 半透明暗色遮罩 */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* 中央内容 */}
          <div className="relative z-10 flex flex-col items-center gap-4">
            {/* 圆形进度环（SVG）— neon-blue + glow */}
            <div className="relative">
              <svg
                width={radius * 2 + strokeWidth * 2}
                height={radius * 2 + strokeWidth * 2}
                className="transform -rotate-90"
              >
                {/* 背景环 */}
                <circle
                  cx={radius + strokeWidth}
                  cy={radius + strokeWidth}
                  r={radius}
                  fill="none"
                  stroke="rgba(79, 195, 247, 0.15)"
                  strokeWidth={strokeWidth}
                />
                {/* 进度环 */}
                <circle
                  cx={radius + strokeWidth}
                  cy={radius + strokeWidth}
                  r={radius}
                  fill="none"
                  stroke="#4fc3f7"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'stroke-dashoffset 0.5s ease',
                    filter: 'drop-shadow(0 0 8px rgba(79, 195, 247, 0.6))',
                  }}
                />
              </svg>

              {/* 中心百分比 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white tabular-nums">
                  {Math.round(progressValue)}%
                </span>
              </div>
            </div>

            {/* 步骤名称 */}
            {stepName && (
              <motion.div
                key={stepName}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-white/70 font-medium"
              >
                {stepName}
              </motion.div>
            )}

            {/* 预计剩余时间 */}
            {formattedTime && (
              <div className="text-xs text-white/40">
                预计剩余 {formattedTime}
              </div>
            )}

            {/* 取消按钮 */}
            {onCancel && (
              <motion.button
                onClick={onCancel}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:text-white hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <X size={14} />
                <span>取消</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ProgressOverlay
