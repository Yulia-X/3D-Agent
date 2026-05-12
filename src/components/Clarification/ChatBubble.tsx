/**
 * ChatBubble - 对话气泡式澄清组件
 * 默认面板状态时使用，类似聊天气泡的卡片从下方弹入
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Check } from 'lucide-react'
import { ClarificationQuestion } from '../../types'
import { useChatStore } from '../../store/useChatStore'
import { RangeSlider } from './RangeSlider'
import { SummaryConfirm } from './SummaryConfirm'

interface ChatBubbleProps {
  questions: ClarificationQuestion[]
  timeout?: number
  onAnswer: (responses: Array<{ field: string; value: string }>) => void
  onSkip: () => void
  isRoundLocked?: boolean
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  questions,
  timeout,
  onAnswer,
  onSkip,
  isRoundLocked = false,
}) => {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>({})
  const [textInputs, setTextInputs] = useState<Record<string, string>>({})
  const [rangeValues, setRangeValues] = useState<Record<string, number>>({})
  const [remaining, setRemaining] = useState(timeout || 0)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const timeoutFiredRef = useRef(false)

  // 查找推荐选项值
  const getRecommendedValue = useCallback((q: ClarificationQuestion): string | null => {
    const rec = q.options?.find((o) => o.isRecommended)
    if (rec) return rec.value
    if (q.recommendedDefault) return q.recommendedDefault
    if (q.defaultValue) return q.defaultValue
    return q.options?.[0]?.value ?? null
  }, [])

  // 倒计时 + 超时自动选择推荐选项
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

  // 回退到上一步
  const handleBack = useCallback(() => {
    if (isRoundLocked || currentIdx <= 0) return
    const targetIdx = currentIdx - 1
    const targetQ = questions[targetIdx]
    // 解锁目标题
    setAnsweredQuestions((prev) => {
      const next = new Set(prev)
      next.delete(targetIdx)
      return next
    })
    // 清空暂存回答
    if (targetQ) {
      const f = targetQ.field
      setResponses((prev) => { const n = { ...prev }; delete n[f]; return n })
      setMultiChoices((prev) => { const n = { ...prev }; delete n[f]; return n })
      setTextInputs((prev) => { const n = { ...prev }; delete n[f]; return n })
      setRangeValues((prev) => { const n = { ...prev }; delete n[f]; return n })
    }
    setCurrentIdx(targetIdx)
  }, [isRoundLocked, currentIdx, questions])

  const currentQuestion = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1
  const timeoutPercent = timeout ? (remaining / timeout) * 100 : 0
  const remainingSec = Math.ceil(remaining / 1000)
  const isUrgent = remainingSec <= 10

  const canProceed = () => {
    if (isRoundLocked) return false
    if (!currentQuestion) return false
    const { field, type } = currentQuestion
    if (type === 'single_choice' || type === 'image_select') return !!responses[field]
    if (type === 'multi_choice') return (multiChoices[field]?.length || 0) > 0
    if (type === 'text') return !!textInputs[field]?.trim()
    if (type === 'range') return rangeValues[field] !== undefined
    if (type === 'confirm') return true
    return false
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="w-full"
    >
      {/* 卡片 */}
      <div className="relative rounded-2xl bg-space-800/80 backdrop-blur-xl border border-white/10 shadow-glass overflow-hidden">
        <div className="p-4">
          {/* 头部：倒计时 & 跳过 */}
          <div className="flex items-center justify-between mb-3">
            {timeout && remaining > 0 ? (
              <span className="flex items-center gap-1 text-xs text-white/40">
                <Clock size={12} />
                {remainingSec}s
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={onSkip}
              disabled={isRoundLocked}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X size={12} />
              跳过
            </button>
          </div>

          {/* 问题进度指示 */}
          {questions.length > 1 && (
            <div className="flex gap-1 mb-3">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    idx <= currentIdx ? 'bg-neon-blue' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          )}

          {/* 问题文本 */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-sm text-white/90 mb-4 font-medium">
                {currentQuestion?.question}
              </p>

              {/* 根据type渲染不同交互 */}
              {currentQuestion?.type === 'single_choice' && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSingleChoice(currentQuestion.field, opt.value)}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                        responses[currentQuestion.field] === opt.value
                          ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                          : 'bg-gray-800 text-white/70 border border-gray-600 hover:border-indigo-400 hover:text-white/90'
                      }`}
                    >
                      {opt.isRecommended && (
                        <span className="absolute -top-1 -right-1 text-[10px] bg-amber-500 text-white px-1 rounded leading-tight">推荐</span>
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion?.type === 'multi_choice' && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options?.map((opt) => {
                    const selected = multiChoices[currentQuestion.field]?.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleMultiChoice(currentQuestion.field, opt.value)}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 ${
                          selected
                            ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                            : 'bg-gray-800 text-white/70 border border-gray-600 hover:border-indigo-400 hover:text-white/90'
                        }`}
                      >
                        {opt.isRecommended && (
                          <span className="absolute -top-1 -right-1 text-[10px] bg-amber-500 text-white px-1 rounded leading-tight">推荐</span>
                        )}
                        <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                          selected ? 'border-white bg-white/20' : 'border-white/30'
                        }`}>
                          {selected && <Check size={8} />}
                        </span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {currentQuestion?.type === 'text' && (
                <input
                  type="text"
                  value={textInputs[currentQuestion.field] || ''}
                  onChange={(e) => handleTextInput(currentQuestion.field, e.target.value)}
                  placeholder="输入你的回答..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canProceed()) {
                      if (isLastQuestion) handleSubmit()
                      else setCurrentIdx((prev) => prev + 1)
                    }
                  }}
                />
              )}

              {currentQuestion?.type === 'image_select' && (
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSingleChoice(currentQuestion.field, opt.value)}
                      className={`rounded-lg overflow-hidden border-2 transition-all ${
                        responses[currentQuestion.field] === opt.value
                          ? 'border-neon-blue shadow-neon-blue'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {opt.thumbnail && (
                        <img src={opt.thumbnail} alt={opt.label} className="w-full h-20 object-cover" />
                      )}
                      <span className="block text-xs text-white/70 p-1.5">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion?.type === 'range' && (
                <RangeSlider
                  question={currentQuestion}
                  value={rangeValues[currentQuestion.field] ?? Number(currentQuestion.recommendedDefault || currentQuestion.options?.[0]?.value || 0)}
                  onChange={(val) => handleRangeChange(currentQuestion.field, val)}
                />
              )}

              {currentQuestion?.type === 'confirm' && (
                <SummaryConfirm
                  questions={questions.filter((q) => q.type !== 'confirm')}
                  answers={Object.fromEntries([
                    ...Object.entries(responses),
                    ...Object.entries(multiChoices),
                    ...Object.entries(textInputs),
                    ...Object.entries(rangeValues).map(([k, v]) => [k, String(v)]),
                  ])}
                  onModify={(idx) => setCurrentIdx(idx)}
                  onConfirm={handleSubmit}
                  onBack={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* 底部操作 */}
          <div className="flex justify-end mt-4 gap-2">
            {questions.length > 1 && currentIdx > 0 && (
              <button
                onClick={handleBack}
                disabled={isRoundLocked}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                上一步
              </button>
            )}
            <button
              onClick={() => {
                if (isRoundLocked) return
                // 标记当前题为已回答
                setAnsweredQuestions((prev) => new Set(prev).add(currentIdx))
                if (isLastQuestion) handleSubmit()
                else setCurrentIdx((prev) => prev + 1)
              }}
              disabled={!canProceed() || isRoundLocked}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-neon-blue/20 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {isLastQuestion ? '确认' : '下一步'}
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
                initial={{ width: '100%' }}
                animate={{ width: `${timeoutPercent}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
            <p className="text-[10px] text-white/30 text-center mt-0.5 pb-1">
              {remainingSec} 秒后自动使用推荐选项
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
