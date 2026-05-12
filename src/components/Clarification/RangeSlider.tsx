/**
 * RangeSlider - 范围滑块澄清问题类型
 * 用于数值范围选择（如面数: 5000/15000/50000）
 */
import { useMemo } from 'react'
import { ClarificationQuestion } from '../../types'

interface RangeSliderProps {
  question: ClarificationQuestion
  value: number
  onChange: (value: number) => void
}

export const RangeSlider: React.FC<RangeSliderProps> = ({ question, value, onChange }) => {
  // 从 options 提取预设标记点
  const marks = useMemo(() => {
    if (!question.options?.length) return []
    return question.options.map((opt) => ({
      value: Number(opt.value),
      label: opt.label,
      description: opt.description,
    }))
  }, [question.options])

  // 计算 min/max/step
  const min = question.min ?? (marks.length > 0 ? marks[0].value : 0)
  const max = question.max ?? (marks.length > 0 ? marks[marks.length - 1].value : 100)
  const step = question.step ?? 1

  // 格式化显示值
  const formatValue = (val: number): string => {
    const formatted = val.toLocaleString('zh-CN')
    return question.unit ? `${formatted} ${question.unit}` : formatted
  }

  // 计算滑块填充百分比
  const percent = ((value - min) / (max - min)) * 100

  return (
    <div className="w-full space-y-3">
      {/* 当前值显示 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/50">{formatValue(min)}</span>
        <span className="text-sm font-medium text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
          {formatValue(value)}
        </span>
        <span className="text-xs text-white/50">{formatValue(max)}</span>
      </div>

      {/* 滑块 */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range-slider w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700/80"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #8b5cf6 ${percent}%, rgba(255,255,255,0.1) ${percent}%)`,
          }}
        />
      </div>

      {/* 标记点 */}
      {marks.length > 0 && (
        <div className="relative h-8 mt-1">
          {marks.map((mark) => {
            const markPercent = ((mark.value - min) / (max - min)) * 100
            const isActive = value === mark.value
            return (
              <button
                key={mark.value}
                onClick={() => onChange(mark.value)}
                className="absolute -translate-x-1/2 flex flex-col items-center gap-0.5 group"
                style={{ left: `${markPercent}%` }}
              >
                {/* 标记点 */}
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    isActive
                      ? 'bg-indigo-400 shadow-lg shadow-indigo-500/40 scale-125'
                      : 'bg-white/30 group-hover:bg-white/60'
                  }`}
                />
                {/* 标记文字 */}
                <span
                  className={`text-[10px] whitespace-nowrap transition-colors ${
                    isActive ? 'text-indigo-300 font-medium' : 'text-white/40 group-hover:text-white/60'
                  }`}
                >
                  {mark.description || mark.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
