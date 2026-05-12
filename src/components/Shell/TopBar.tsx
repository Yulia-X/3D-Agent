import React from 'react'
import { Coins } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export const TopBar: React.FC = () => {
  const credits = useAppStore((s) => s.credits)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-space-900/70 backdrop-blur-md border-b border-white/5 shadow-glass">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
          3D Agent
        </span>
        <span className="text-[10px] text-white/30 font-mono mt-1">v1.0</span>
      </div>

      {/* Right: Credits */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Credits */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
          <Coins className="w-3.5 h-3.5 text-neon-green" />
          <span className="text-xs text-white/80 font-mono">{credits.balance}</span>
        </div>
      </div>
    </header>
  )
}
