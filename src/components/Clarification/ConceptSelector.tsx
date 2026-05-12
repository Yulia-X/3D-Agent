/**
 * ConceptSelector - 多方案选择器
 * 2-4个方案卡片水平排列，用于概念确认点
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X } from 'lucide-react'

interface ConceptSelectorProps {
  concepts: Array<{ id: string; thumbnailUrl: string; description: string }>
  onSelect: (conceptId: string) => void
  onCancel?: () => void
}

export const ConceptSelector: React.FC<ConceptSelectorProps> = ({
  concepts,
  onSelect,
  onCancel,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleConfirm = () => {
    if (selectedId) onSelect(selectedId)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="w-full max-w-2xl"
    >
      <div className="rounded-2xl bg-space-800/80 backdrop-blur-xl border border-white/10 shadow-glass p-5">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white/90">选择方案</h3>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 方案卡片 */}
        <div className={`grid gap-3 ${
          concepts.length <= 2 ? 'grid-cols-2' : concepts.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
        }`}>
          <AnimatePresence>
            {concepts.map((concept, idx) => (
              <motion.button
                key={concept.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => setSelectedId(concept.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all duration-300 group ${
                  selectedId === concept.id
                    ? 'border-neon-blue shadow-neon-blue scale-[1.02]'
                    : 'border-white/8 hover:border-white/20 hover:scale-[1.01]'
                }`}
              >
                {/* 缩略图 */}
                <div className="aspect-square relative overflow-hidden bg-space-900">
                  <img
                    src={concept.thumbnailUrl}
                    alt={concept.description}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* 选中遮罩 */}
                  {selectedId === concept.id && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-neon-blue/10 flex items-center justify-center"
                    >
                      <div className="w-8 h-8 rounded-full bg-neon-blue/20 border border-neon-blue flex items-center justify-center">
                        <Check size={16} className="text-neon-blue" />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 描述 */}
                <div className="p-2.5">
                  <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">
                    {concept.description}
                  </p>
                </div>

                {/* 方案编号 */}
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-space-900/80 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <span className="text-[9px] text-white/60 font-medium">{idx + 1}</span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end mt-4 gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-all"
            >
              取消
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            确认选择
          </button>
        </div>
      </div>
    </motion.div>
  )
}
