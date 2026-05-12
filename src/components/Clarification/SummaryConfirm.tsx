/**
 * SummaryConfirm - 汇总确认组件
 * 展示所有已回答字段，支持修改和确认
 */
import { motion } from 'framer-motion'
import { Check, ArrowLeft, Sparkles, Pencil } from 'lucide-react'
import { ClarificationQuestion } from '../../types'

interface SummaryConfirmProps {
  questions: ClarificationQuestion[]
  answers: Record<string, string | string[]>
  onModify: (questionIndex: number) => void
  onConfirm: () => void
  onBack: () => void
}

export const SummaryConfirm: React.FC<SummaryConfirmProps> = ({
  questions,
  answers,
  onModify,
  onConfirm,
  onBack,
}) => {
  // 获取显示值
  const getDisplayValue = (q: ClarificationQuestion): string => {
    const answer = answers[q.field]
    if (!answer) return q.recommendedDefault || q.defaultValue || '未填写'

    if (Array.isArray(answer)) {
      // multi_choice: 用 label 展示
      return answer
        .map((v) => {
          const opt = q.options?.find((o) => o.value === v)
          return opt?.label || v
        })
        .join('、')
    }

    // 查找 option label
    const opt = q.options?.find((o) => o.value === answer)
    return opt?.label || String(answer)
  }

  // 预估消耗（可从 metadata 获取或硬编码）
  const estimatedCredits = questions.reduce((sum, q) => {
    return sum + (q.metadata?.creditsCost || 0)
  }, 0) || 3
  const estimatedTime = questions.reduce((sum, q) => {
    return sum + (q.metadata?.estimatedSeconds || 0)
  }, 0) || 45

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full"
    >
      <div className="rounded-xl bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] overflow-hidden">
        {/* 标题 */}
        <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-400" />
            <span className="text-xs font-medium text-white/80">确认生成参数</span>
          </div>
        </div>

        {/* 字段列表 */}
        <div className="px-4 py-2 space-y-1">
          {questions.map((q, idx) => (
            <div
              key={q.field}
              className="flex items-center justify-between py-2 group"
            >
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-white/40 block">{q.question}</span>
                <span className="text-xs text-white/80 font-medium truncate block mt-0.5">
                  {getDisplayValue(q)}
                </span>
              </div>
              <button
                onClick={() => onModify(idx)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/30 hover:text-indigo-300 hover:bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0"
              >
                <Pencil size={10} />
                修改
              </button>
            </div>
          ))}
        </div>

        {/* 预估消耗 */}
        <div className="mx-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] text-white/40">预计消耗</span>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-amber-300/80">
              {estimatedCredits} 积分
            </span>
            <span className="text-[11px] text-white/30">|</span>
            <span className="text-[11px] text-white/50">
              约 {estimatedTime}s
            </span>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="px-4 py-3 flex items-center justify-between gap-2 mt-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={12} />
            返回修改
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Check size={12} />
            确认并开始
          </button>
        </div>
      </div>
    </motion.div>
  )
}
