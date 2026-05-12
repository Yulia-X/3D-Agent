/**
 * VersionCard - 版本卡片组件
 * 紧凑卡片：缩略图 + 版本号 + 变更描述
 * Hover展开更多信息，framer-motion动画
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, Check, Clock, Box } from 'lucide-react'
import { VersionNode, ChangeScope } from '../../types'

export interface VersionCardProps {
  version: VersionNode
  isActive: boolean
  onClick: () => void
  onFork?: () => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function changeScopeIcons(scope: ChangeScope) {
  const icons: string[] = []
  if (scope.geometry) icons.push('🔷')
  if (scope.texture) icons.push('🎨')
  if (scope.skeleton) icons.push('🦴')
  if (scope.animation) icons.push('🎬')
  return icons
}

export function VersionCard({ version, isActive, onClick, onFork }: VersionCardProps) {
  const [hovered, setHovered] = useState(false)

  const versionLabel = version.id.includes('.')
    ? `V${version.id}`
    : `V${version.id}`

  const triggerText = truncate(version.trigger.userInput || '初始生成', 20)

  return (
    <motion.div
      className="relative flex-shrink-0 cursor-pointer select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      layout
    >
      {/* 主卡片 */}
      <div
        className={`
          relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl
          bg-glass-medium backdrop-blur-sm border transition-all duration-200
          ${isActive
            ? 'border-neon-blue shadow-neon-blue'
            : 'border-white/10 hover:border-neon-blue/50'
          }
        `}
      >
        {/* 缩略图 */}
        <div
          className={`
            w-10 h-10 rounded-full overflow-hidden border-2 transition-all
            ${isActive ? 'border-neon-blue shadow-neon-blue' : 'border-white/20'}
          `}
        >
          {version.assets.thumbnailUrl ? (
            <img
              src={version.assets.thumbnailUrl}
              alt={versionLabel}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-space-700 flex items-center justify-center">
              <Box size={16} className="text-white/40" />
            </div>
          )}
        </div>

        {/* 版本号 */}
        <span className={`text-xs font-medium ${isActive ? 'text-neon-blue' : 'text-white/70'}`}>
          {versionLabel}
        </span>

        {/* 触发描述 */}
        <span className="text-[10px] text-white/50 max-w-[80px] text-center leading-tight">
          {triggerText}
        </span>

        {/* 活跃指示器 */}
        {isActive && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-neon-blue rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
      </div>

      {/* Hover展开面板 */}
      {hovered && (
        <motion.div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                     bg-space-800 border border-white/10 rounded-lg p-3 min-w-[160px]
                     shadow-glass backdrop-blur-md"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
        >
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-white/60">
              <Clock size={10} />
              <span>{formatTime(version.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60">
              <Box size={10} />
              <span>{version.assets.metadata.polyCount.toLocaleString()} 面</span>
            </div>
            <div className="flex gap-0.5">
              {changeScopeIcons(version.changeScope).map((icon, i) => (
                <span key={i} className="text-[10px]">{icon}</span>
              ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-1 mt-1 pt-1 border-t border-white/10">
              {!isActive && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClick() }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                             bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 transition-colors"
                >
                  <Check size={8} /> 切换
                </button>
              )}
              {onFork && (
                <button
                  onClick={(e) => { e.stopPropagation(); onFork() }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]
                             bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 transition-colors"
                >
                  <GitBranch size={8} /> 分叉
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
