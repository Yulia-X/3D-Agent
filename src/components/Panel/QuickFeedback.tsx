import React, { useState } from 'react'
import { Download, Send, Box, Ruler, FileType } from 'lucide-react'
import { useVersionStore } from '../../store/useVersionStore'

interface QuickFeedbackProps {
  onFeedback?: (text: string) => void
}

export function QuickFeedback({ onFeedback }: QuickFeedbackProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const { versionTree, allVersions } = useVersionStore()

  const currentVersion = versionTree.currentHead ? allVersions[versionTree.currentHead] : null
  const metadata = currentVersion?.assets?.metadata

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!feedbackText.trim()) return
    onFeedback?.(feedbackText.trim())
    setFeedbackText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleDownload = () => {
    if (currentVersion?.assets?.modelUrl) {
      const a = document.createElement('a')
      a.href = currentVersion.assets.modelUrl
      a.download = `model.${metadata?.format || 'glb'}`
      a.click()
    }
  }

  return (
    <div className="p-4 space-y-3">
      {/* 模型信息摘要 */}
      {metadata ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <Box size={13} className="text-neon-blue/70" />
            <span className="text-[10px] text-white/40">面数</span>
            <span className="text-xs font-medium text-white/80">
              {metadata.polyCount >= 1000
                ? `${(metadata.polyCount / 1000).toFixed(1)}K`
                : metadata.polyCount}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <FileType size={13} className="text-neon-blue/70" />
            <span className="text-[10px] text-white/40">格式</span>
            <span className="text-xs font-medium text-white/80 uppercase">{metadata.format}</span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <Ruler size={13} className="text-neon-blue/70" />
            <span className="text-[10px] text-white/40">尺寸</span>
            <span className="text-[10px] font-medium text-white/80">
              {metadata.dimensions.x.toFixed(1)}×{metadata.dimensions.y.toFixed(1)}×{metadata.dimensions.z.toFixed(1)}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <Box size={14} className="text-white/20" />
          <span className="text-xs text-white/30">等待模型生成...</span>
        </div>
      )}

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        disabled={!currentVersion?.assets?.modelUrl}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all
          bg-neon-blue/10 text-neon-blue border border-neon-blue/20
          hover:bg-neon-blue/20 hover:shadow-neon-blue
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-neon-blue/10 disabled:hover:shadow-none"
      >
        <Download size={14} />
        <span>下载模型</span>
      </button>

      {/* 自然语言反馈输入框 */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="还需要调整吗？"
          className="w-full px-3 py-2.5 pr-9 rounded-lg text-xs text-white/90 placeholder-white/30
            bg-white/[0.04] border border-white/[0.08]
            focus:outline-none focus:border-neon-blue/40 focus:bg-white/[0.06]
            transition-all"
        />
        <button
          type="submit"
          disabled={!feedbackText.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md
            text-white/30 hover:text-neon-blue transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  )
}
