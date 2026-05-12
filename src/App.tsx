// Shell
import { TopBar } from './components/Shell'

// Canvas
import { InfiniteCanvas } from './components/Canvas/InfiniteCanvas'
import { ModelViewerModal } from './components/Canvas/ModelViewerModal'

// Clarification
import { ClarificationRouter } from './components/Clarification'

// Background
import ParticleBackground from './components/Background/ParticleBackground'

// Hooks
import { useWebSocket } from './hooks/useWebSocket'
import { useExposureSignals } from './hooks/useExposureSignals'
import { useCanvasSync } from './hooks/useCanvasSync'

export default function App() {
  // Initialize WebSocket connection & exposure signal detection
  useWebSocket()
  useExposureSignals()

  // Sync WebSocket events → canvas cards
  useCanvasSync()

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-space-900">
      {/* ─── Background particles (z-0) ─── */}
      <ParticleBackground />

      {/* ─── TopBar (fixed top, h-14) ─── */}
      <TopBar />

      {/* ─── Main area (below TopBar) ─── */}
      <main className="flex-1 flex flex-row overflow-hidden pt-14">
        {/* 左侧对话面板 */}
        <div className="w-[360px] shrink-0 border-r border-white/5 h-full overflow-hidden">
          <ClarificationRouter />
        </div>

        {/* 右侧无限画布 - 替代原来的 ModelViewer + PanelShell */}
        <div className="flex-1 relative overflow-hidden bg-space-900">
          <InfiniteCanvas />
        </div>
      </main>

      {/* 全屏查看 Modal (Portal, 渲染在 body) */}
      <ModelViewerModal />
    </div>
  )
}
