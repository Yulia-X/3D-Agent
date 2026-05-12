import React, { useState } from 'react'
import { Download, FileBox } from 'lucide-react'

const FORMATS = ['GLB', 'FBX', 'OBJ', 'USDZ'] as const
const RESOLUTIONS = [512, 1024, 2048, 4096] as const

type ExportFormat = typeof FORMATS[number]
type Resolution = typeof RESOLUTIONS[number]

export function ExportPanel() {
  const [format, setFormat] = useState<ExportFormat>('GLB')
  const [resolution, setResolution] = useState<Resolution>(1024)

  const handleExport = () => {
    // TODO: 实际导出逻辑
    console.log('Export:', { format, resolution })
  }

  return (
    <div className="p-4 space-y-3">
      <h4 className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-2">
        <FileBox size={12} />
        导出选项
      </h4>

      {/* 格式选择 */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-white/40">格式</span>
        <div className="grid grid-cols-4 gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                format === f
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                  : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 分辨率选择 */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-white/40">贴图分辨率</span>
        <div className="grid grid-cols-4 gap-1.5">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setResolution(r)}
              className={`py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                resolution === r
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30'
                  : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all
          bg-neon-purple/10 text-neon-purple border border-neon-purple/20
          hover:bg-neon-purple/20 hover:shadow-neon-purple"
      >
        <Download size={13} />
        <span>导出 {format}</span>
      </button>
    </div>
  )
}
