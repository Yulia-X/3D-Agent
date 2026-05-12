/**
 * InlineCard - 内嵌卡片式澄清组件
 * 编辑面板展开时使用，紧凑布局嵌入右侧Panel内
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Check } from 'lucide-react'
import { ClarificationQuestion } from '../../types'
import { useChatStore } from '../../store/useChatStore'
import { RangeSlider } from './RangeSlider'
import { SummaryConfirm } from './SummaryConfirm'

interface InlineCardProps {
  questions: ClarificationQuestion[]
  timeout?: number
  onAnswer: (responses: Array<{ field: string; value: string }>) => void
  onSkip: () => void
}

export const InlineCard: React.FC<InlineCardProps> = ({
  questions,
  timeout,
  onAnswer,
  onSkip,
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>({})
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [rangeValues, setRangeValues] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState(timeout || 0)
  const timeoutFiredRef = useRef(false)

  // 查找推荐选项值
  const getRecommendedValue = useCallback((q: ClarificationQuestion): string | null => {
    const rec = q.options?.find((o) => o.isRecommended)
    if (rec) return rec.value
    if (q.recommendedDefault) return q.recommendedDefault
    if (q.defaultValue) return q.defaultValue
    return q.options?.[0]?.value ?? null
  }, [])

  useEffect(() => {
    // 安全守卫：timeout 无效或过小（< 5秒）时不启动倒计时，完全等待用户手动操作
    if (!timeout || timeout < 5000) return
    timeoutFiredRef.current = false
    setRemaining(timeout)
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval)
          if (!timeoutFiredRef.current) {
            timeoutFiredRef.current = true
            // 超时：收集推荐值
            const autoResponses: Array<{ field: string; value: string }> = []
            const recommendedLabels: string[] = []
            questions.forEach((q) => {
              const val = getRecommendedValue(q)
              if (val) {
                autoResponses.push({ field: q.field, value: val })
                const label = q.options?.find((o) => o.value === val)?.label ?? val
                recommendedLabels.push(label)
              }
            })
            // 插入系统消息
            const labelText = recommendedLabels.join('、')
            useChatStore.getState().addMessage({
              type: 'system',
              content: `⏱ 已使用推荐选项「${labelText}」继续`,
            })
            // 自动提交
            if (autoResponses.length > 0) {
              onAnswer(autoResponses)
            } else {
              onSkip()
            }
          }
          return 0
        }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [timeout, onSkip, onAnswer, questions, getRecommendedValue])

  const handleSingleChoice = useCallback((field: string, value: string) => {
    setResponses((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleMultiChoice = useCallback((field: string, value: string) => {
    setMultiChoices((prev) => {
      const current = prev[field] || []
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [field]: updated }
    })
  }, [])

  const handleTextInput = useCallback((field: string, value: string) => {
    setTextInputs((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleRangeChange = useCallback((field: string, value: number) => {
    setRangeValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = () => {
    const result: Array<{ field: string; value: string }> = []
    questions.forEach((q) => {
      if (q.type === 'single_choice' || q.type === 'image_select') {
        if (responses[q.field]) result.push({ field: q.field, value: responses[q.field] })
      } else if (q.type === 'multi_choice') {
        const vals = multiChoices[q.field]
        if (vals?.length) result.push({ field: q.field, value: vals.join(',') })
      } else if (q.type === 'text') {
        if (textInputs[q.field]) result.push({ field: q.field, value: textInputs[q.field] })
      } else if (q.type === 'range') {
        const val = rangeValues[q.field]
        if (val !== undefined) result.push({ field: q.field, value: String(val) })
      }
    })
    onAnswer(result)
  }

  const timeoutPercent = timeout ? (remaining / timeout) * 100 : 0
  const remainingSec = Math.ceil(remaining / 1000)
  const isUrgent = remainingSec <= 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div className="rounded-lg bg-space-800/60 border border-white/8 overflow-hidden">
        <div className="p-3">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-neon-blue/80 uppercase tracking-wider">
                需要确认
              </span>
              {timeout && remaining > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white/30">
                  <Clock size={9} />
                  {remainingSec}s
                </span>
              )}
            </div>
            <button
              onClick={onSkip}
              className="p-0.5 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* 问题列表 - 紧凑展示所有问题 */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.field}>
                <p className="text-xs text-white/80 mb-1.5">{q.question}</p>

                {q.type === 'single_choice' && (
                  <div className="flex flex-wrap gap-1">
                    {q.options?.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSingleChoice(q.field, opt.value)}
                        className={`relative px-2 py-1 rounded text-[11px] transition-all hover:-translate-y-0.5 ${
                          responses[q.field] === opt.value
                            ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                            : 'bg-gray-800 text-white/60 border border-gray-600 hover:border-indigo-400'
                        }`}
                      >
                        {opt.isRecommended && (
                          <span className="absolute -top-1 -right-1 text-[9px] bg-amber-500 text-white px-0.5 rounded leading-tight">荐</span>
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'multi_choice' && (
                  <div className="flex flex-wrap gap-1">
                    {q.options?.map((opt) => {
                      const selected = multiChoices[q.field]?.includes(opt.value)
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleMultiChoice(q.field, opt.value)}
                          className={`relative px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-all hover:-translate-y-0.5 ${
                            selected
                              ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                              : 'bg-gray-800 text-white/60 border border-gray-600 hover:border-indigo-400'
                          }`}
                        >
                          {opt.isRecommended && (
                            <span className="absolute -top-1 -right-1 text-[9px] bg-amber-500 text-white px-0.5 rounded leading-tight">荐</span>
                          )}
                          <span className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center ${
                            selected ? 'border-white bg-white/20' : 'border-white/30'
                          }`}>
                            {selected && <Check size={7} />}
                          </span>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {q.type === 'text' && (
                  <input
                    type="text"
                    value={textInputs[q.field] || ''}
                    onChange={(e) => handleTextInput(q.field, e.target.value)}
                    placeholder="输入..."
                    className="w-full px-2 py-1 rounded bg-white/5 border border-white/8 text-[11px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-neon-blue/40 transition-all"
                  />
                )}

                {q.type === 'image_select' && (
                  <div className="grid grid-cols-3 gap-1">
                    {q.options?.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleSingleChoice(q.field, opt.value)}
                        className={`rounded overflow-hidden border transition-all ${
                          responses[q.field] === opt.value
                            ? 'border-neon-blue shadow-neon-blue'
                            : 'border-white/8 hover:border-white/20'
                        }`}
                      >
                        {opt.thumbnail && (
                          <img src={opt.thumbnail} alt={opt.label} className="w-full h-12 object-cover" />
                        )}
                        <span className="block text-[10px] text-white/60 p-1 truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {q.type === 'range' && (
                  <RangeSlider
                    question={q}
                    value={rangeValues[q.field] ?? Number(q.recommendedDefault || q.options?.[0]?.value || 0)}
                    onChange={(val) => handleRangeChange(q.field, val)}
                  />
                )}

                {q.type === 'confirm' && (
                  <SummaryConfirm
                    questions={questions.filter((item) => item.type !== 'confirm')}
                    answers={Object.fromEntries([
                      ...Object.entries(responses),
                      ...Object.entries(multiChoices),
                      ...Object.entries(textInputs),
                      ...Object.entries(rangeValues).map(([k, v]) => [k, String(v)]),
                    ])}
                    onModify={() => {}}
                    onConfirm={handleSubmit}
                    onBack={() => {}}
                  />
                )}

                {idx < questions.length - 1 && <div className="border-t border-white/5 mt-3" />}
              </div>
            ))}
          </div>

          {/* 底部操作 */}
          <div className="flex justify-end mt-3 gap-1.5">
            <button
              onClick={onSkip}
              className="px-2 py-1 rounded text-[10px] text-white/40 hover:text-white/60 transition-colors"
            >
              跳过
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1 rounded text-[11px] font-medium bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 transition-all"
            >
              确认
            </button>
          </div>
        </div>

        {/* 底部倒计时进度条 */}
        {timeout && remaining > 0 && (
          <div className="relative">
            <div className="h-[2px] bg-white/5 w-full">
              <motion.div
                className={`h-full ${
                  isUrgent
                    ? 'bg-gradient-to-r from-amber-500 to-red-500'
                    : 'bg-gradient-to-r from-indigo-500 to-amber-500'
                }`}
                style={{ width: `${timeoutPercent}%` }}
              />
            </div>
            <p className="text-[9px] text-white/30 text-center mt-0.5 pb-1">
              {remainingSec} 秒后自动使用推荐选项
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
