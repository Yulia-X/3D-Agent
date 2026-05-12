/**
 * ForkConfirm - 分叉确认弹窗
 * 提示用户修改将基于某版本创建新版本
 */
import { motion } from 'framer-motion'
import { GitBranch, X } from 'lucide-react'

interface ForkConfirmProps {
  baseVersion: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export const ForkConfirm: React.FC<ForkConfirmProps> = ({
  baseVersion,
  description,
  onConfirm,
  onCancel,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* 背景遮罩 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 弹窗内容 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-xs rounded-2xl bg-space-800/95 backdrop-blur-xl border border-white/10 shadow-glass overflow-hidden"
      >
        {/* 顶部装饰 */}
        <div className="h-1 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-blue" />

        <div className="p-5">
          {/* 关闭按钮 */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>

          {/* 图标 */}
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
              <GitBranch size={24} className="text-neon-purple" />
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-center text-sm font-medium text-white/90 mb-2">
            创建新版本分支
          </h3>

          {/* 提示文字 */}
          <p className="text-center text-xs text-white/50 mb-4">
            修改将基于 <span className="text-neon-purple font-mono">{baseVersion}</span> 创建新版本
          </p>

          {/* 描述 */}
          {description && (
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 mb-4">
              <p className="text-[11px] text-white/60">{description}</p>
            </div>
          )}

          {/* 版本信息 */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-purple/5 border border-neon-purple/15 mb-4">
            <GitBranch size={12} className="text-neon-purple/60" />
            <span className="text-[11px] text-white/60">
              基于版本：<span className="font-mono text-neon-purple/80">{baseVersion}</span>
            </span>
          </div>

          {/* 按钮 */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg text-xs text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-neon-purple/20 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
            >
              继续
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
