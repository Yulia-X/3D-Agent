/**
 * CostConfirm - 成本确认弹窗
 * 居中模态弹窗，显示操作消耗积分信息
 * 如果 autoConfirmLowCost 且 积分<10，自动确认不弹窗
 */
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Coins, AlertTriangle, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface CostConfirmProps {
  operation: string
  creditsCost: number
  currentBalance: number
  onConfirm: () => void
  onCancel: () => void
}

export const CostConfirm: React.FC<CostConfirmProps> = ({
  operation,
  creditsCost,
  currentBalance,
  onConfirm,
  onCancel,
}) => {
  const preferences = useAppStore((s) => s.preferences)
  const balanceSufficient = currentBalance >= creditsCost

  // 自动确认：低成本且用户偏好开启
  useEffect(() => {
    if (preferences.autoConfirmLowCost && creditsCost < 10) {
      onConfirm()
    }
  }, [preferences.autoConfirmLowCost, creditsCost, onConfirm])

  // 如果自动确认，不渲染弹窗
  if (preferences.autoConfirmLowCost && creditsCost < 10) {
    return null
  }

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
        className="relative w-full max-w-sm rounded-2xl bg-space-800/95 backdrop-blur-xl border border-white/10 shadow-glass overflow-hidden"
      >
        {/* 顶部装饰 */}
        <div className="h-1 bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple" />

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
            <div className="w-12 h-12 rounded-full bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center">
              <Coins size={24} className="text-neon-blue" />
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-center text-sm font-medium text-white/90 mb-4">
            确认消耗积分
          </h3>

          {/* 信息区域 */}
          <div className="space-y-2.5 mb-5">
            <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/5">
              <span className="text-xs text-white/50">操作</span>
              <span className="text-xs text-white/80 font-medium">{operation}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/5">
              <span className="text-xs text-white/50">消耗积分</span>
              <span className="text-xs text-neon-blue font-medium">-{creditsCost}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-white/5">
              <span className="text-xs text-white/50">当前余额</span>
              <span className={`text-xs font-medium ${balanceSufficient ? 'text-neon-green' : 'text-neon-pink'}`}>
                {currentBalance}
              </span>
            </div>
            {!balanceSufficient && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-pink/5 border border-neon-pink/20">
                <AlertTriangle size={12} className="text-neon-pink" />
                <span className="text-[11px] text-neon-pink">余额不足，无法执行此操作</span>
              </div>
            )}
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
              disabled={!balanceSufficient}
              className="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              确认消耗
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
