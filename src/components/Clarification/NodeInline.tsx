/**
 * NodeInline - 节点内嵌式澄清组件
 * 调试面板时使用，最紧凑形态，一行式选择
 */
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { ClarificationQuestion } from '../../types'

interface NodeInlineProps {
  questions: ClarificationQuestion[]
  onAnswer: (responses: Array<{ field: string; value: string }>) => void
  onSkip: () => void
}

export const NodeInline: React.FC<NodeInlineProps> = ({
  questions,
  onAnswer,
  onSkip,
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const handleChange = useCallback((field: string, value: string) => {
    setResponses((prev) => ({ ...prev, [field]: value }))
    setOpenDropdown(null)
  }, [])

  const handleSubmit = () => {
    const result = Object.entries(responses).map(([field, value]) => ({ field, value }))
    if (result.length > 0) onAnswer(result)
  }

  const allAnswered = questions.every((q) => !!responses[q.field])

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full"
    >
      <div className="rounded bg-space-900/80 border border-white/6 p-2 space-y-1.5">
        {questions.map((q) => (
          <div key={q.field} className="flex items-center gap-2">
            {/* 字段名 */}
            <span className="text-[10px] text-white/50 min-w-[60px] truncate font-mono">
              {q.field}
            </span>

            {/* 交互区域 */}
            {(q.type === 'single_choice' || q.type === 'image_select') && q.options ? (
              <div className="relative flex-1">
                <button
                  onClick={() => setOpenDropdown(openDropdown === q.field ? null : q.field)}
                  className="w-full flex items-center justify-between px-2 py-0.5 rounded bg-white/5 border border-white/8 text-[10px] text-white/70 hover:bg-white/8 transition-all"
                >
                  <span className="truncate">
                    {responses[q.field]
                      ? q.options.find((o) => o.value === responses[q.field])?.label || responses[q.field]
                      : '选择...'}
                  </span>
                  <ChevronDown size={10} className={`ml-1 transition-transform ${openDropdown === q.field ? 'rotate-180' : ''}`} />
                </button>

                {openDropdown === q.field && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-10 top-full left-0 right-0 mt-0.5 rounded bg-space-800 border border-white/10 shadow-glass overflow-hidden"
                  >
                    {q.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleChange(q.field, opt.value)}
                        className={`w-full text-left px-2 py-1 text-[10px] transition-colors ${
                          responses[q.field] === opt.value
                            ? 'bg-neon-blue/15 text-neon-blue'
                            : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            ) : q.type === 'multi_choice' && q.options ? (
              <div className="flex-1 flex flex-wrap gap-0.5">
                {q.options.map((opt) => {
                  const currentVals = responses[q.field]?.split(',').filter(Boolean) || []
                  const selected = currentVals.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const updated = selected
                          ? currentVals.filter((v) => v !== opt.value)
                          : [...currentVals, opt.value]
                        handleChange(q.field, updated.join(','))
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                        selected
                          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                          : 'bg-white/5 text-white/50 border border-white/6 hover:bg-white/8'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <input
                type="text"
                value={responses[q.field] || ''}
                onChange={(e) => handleChange(q.field, e.target.value)}
                placeholder={q.recommendedDefault || '...'}
                className="flex-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/6 text-[10px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-neon-blue/30 font-mono transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && allAnswered) handleSubmit()
                }}
              />
            )}
          </div>
        ))}

        {/* 底部操作 */}
        <div className="flex justify-end gap-1 pt-1 border-t border-white/5">
          <button
            onClick={onSkip}
            className="px-1.5 py-0.5 text-[9px] text-white/30 hover:text-white/50 transition-colors"
          >
            跳过
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="px-2 py-0.5 rounded text-[9px] font-medium bg-neon-green/15 text-neon-green border border-neon-green/25 hover:bg-neon-green/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            应用
          </button>
        </div>
      </div>
    </motion.div>
  )
}
