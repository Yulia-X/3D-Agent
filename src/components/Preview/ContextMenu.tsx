/**
 * ContextMenu — 右键/悬停快捷操作菜单
 * 绝对定位浮层，玻璃态背景，framer-motion弹出动画
 */
import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Palette, Layers, Shapes, Trash2, Copy } from 'lucide-react'

interface ContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  onAction: (action: string) => void
  onClose: () => void
}

const menuItems = [
  { action: 'change_color', label: '改颜色', icon: Palette },
  { action: 'change_material', label: '改材质', icon: Layers },
  { action: 'change_shape', label: '改形状', icon: Shapes },
  { action: 'remove', label: '移除', icon: Trash2 },
  { action: 'duplicate', label: '复制', icon: Copy },
]

export function ContextMenu({ visible, position, onAction, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  const handleAction = (action: string) => {
    onAction(action)
    onClose()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          className="fixed z-50"
          style={{ left: position.x, top: position.y }}
          initial={{ opacity: 0, scale: 0.85, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <div className="min-w-[160px] rounded-xl overflow-hidden border border-white/10 backdrop-blur-xl bg-white/5 shadow-2xl shadow-black/40">
            <div className="py-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.action}
                    onClick={() => handleAction(item.action)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon size={16} className="text-neon-blue/70" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ContextMenu
