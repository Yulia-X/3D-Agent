import React, { useState, useRef, useEffect, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import { motion } from 'framer-motion';
import { CanvasCard, useCanvasStore } from '../../store/useCanvasStore';
import { wsService } from '../../hooks/useWebSocket';
import { useChatStore } from '../../store/useChatStore';

interface ModelCardProps {
  card: CanvasCard;
}

// URL 验证：仅允许远程 http/https URL 加载模型
function isValidModelUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

// 远程资源 URL 通过后端代理（解决 CORS 问题）
function getProxiedUrl(url: string): string {
  // 已经是代理 URL 或本地 blob URL，不再代理
  if (url.startsWith('http://localhost:3001/api/proxy-model') || url.startsWith('blob:')) {
    return url;
  }
  // 代理所有远程 http/https URL（不仅限于 meshy.ai，兼容各类 CDN）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `http://localhost:3001/api/proxy-model?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// ErrorBoundary：防止 Canvas 加载失败导致整个组件树崩溃
interface CanvasErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps & { resetKey?: string }, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: CanvasErrorBoundaryProps & { resetKey?: string }) {
    // resetKey 变化时自动重置 error boundary
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ModelCard] Canvas render error:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-red-400/60 text-sm">预览加载失败</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// 3D 模型预览组件
function ModelPreview({ url }: { url: string }) {
  const proxiedUrl = getProxiedUrl(url);
  const { scene } = useGLTF(proxiedUrl);
  return <primitive object={scene.clone()} />;
}

// 状态标签颜色
function StatusBadge({ status }: { status: CanvasCard['status'] }) {
  const styles: Record<string, string> = {
    SUCCEEDED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse',
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = {
    SUCCEEDED: '完成',
    IN_PROGRESS: '生成中',
    PENDING: '等待中',
    FAILED: '失败',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// 视口可见性 Hook：仅当卡片进入视口时加载 3D 预览
function useIsVisible(ref: React.RefObject<HTMLElement | null>) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return isVisible;
}

export const ModelCard = React.memo(function ModelCard({ card }: ModelCardProps) {
  // 细粒度订阅：仅订阅自身所需状态
  const selectedCardId = useCanvasStore((s) => s.selectedCardId);
  const selectCard = useCanvasStore((s) => s.selectCard);
  const removeCard = useCanvasStore((s) => s.removeCard);
  const [showDebug, setShowDebug] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isSelected = selectedCardId === card.id;
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(cardRef);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = card.formats?.glb || card.modelUrl;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.title || 'model'}.glb`;
      a.click();
    }
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-model-viewer', { detail: card }));
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectCard(isSelected ? null : card.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const confirmDeleteAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeCard(card.id);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  return (
    <motion.div
      ref={cardRef}
      data-card
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`w-[280px] rounded-xl overflow-hidden backdrop-blur-xl transition-all duration-200 cursor-pointer relative group
        ${isSelected
          ? 'bg-space-800/90 border-2 border-neon-blue/60 shadow-[0_0_20px_rgba(79,195,247,0.2)]'
          : 'bg-space-800/80 border border-white/10 hover:border-white/20 hover:shadow-lg'
        }`}
      onClick={handleSelect}
    >
      {/* 删除按钮 */}
      {!confirmDelete ? (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/40 hover:text-red-300 transition-all duration-150 text-xs font-bold"
          title="删除卡片"
        >
          ×
        </button>
      ) : (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-space-900/95 border border-white/10 rounded-lg px-2 py-1 backdrop-blur-sm">
          <span className="text-[10px] text-white/60 mr-1">删除?</span>
          <button
            onClick={confirmDeleteAction}
            className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/30 text-red-400 hover:bg-red-500/50 transition-colors"
          >
            确认
          </button>
          <button
            onClick={cancelDelete}
            className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
          >
            取消
          </button>
        </div>
      )}
      {/* 3D 预览区域 */}
      <div className="w-full h-[180px] relative bg-space-900/50" style={{ touchAction: 'none' }}>
        {card.status === 'SUCCEEDED' && isValidModelUrl(card.modelUrl) ? (
          isVisible ? (
            <CanvasErrorBoundary resetKey={card.modelUrl}>
              <Canvas
                key={card.modelUrl}
                camera={{ position: [0, 0, 3], fov: 45 }}
                style={{ touchAction: 'none' }}
                gl={{ antialias: true }}
              >
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <Suspense fallback={null}>
                  <ModelPreview url={card.modelUrl} />
                  <Environment preset="city" />
                </Suspense>
                <OrbitControls
                  enableZoom={false}
                  enablePan={false}
                  autoRotate
                  autoRotateSpeed={2}
                />
              </Canvas>
            </CanvasErrorBoundary>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white/30 text-sm">加载中...</span>
            </div>
          )
        ) : card.status === 'SUCCEEDED' ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30 text-sm">模型预览不可用</span>
          </div>
        ) : card.status === 'IN_PROGRESS' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-white/40 text-xs">{card.progress}%</span>
          </div>
        ) : card.status === 'FAILED' ? (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-red-400/60 text-sm">生成失败</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30 text-sm">等待中...</span>
          </div>
        )}

        {/* 进度条（生成中时显示） */}
        {card.status === 'IN_PROGRESS' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-space-900/50">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${card.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* 信息区域 */}
      <div className="px-3 py-2.5 border-t border-white/5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-white/90 text-sm font-medium truncate flex-1">
            {card.title}
          </h4>
          <StatusBadge status={card.status} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-white/40 text-[11px]">{card.version}</span>
          <span className="text-white/20 text-[11px]">·</span>
          <span className="text-white/40 text-[11px]">{timeAgo(card.createdAt)}</span>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="px-3 py-2 border-t border-white/5 flex items-center gap-1">
        <button
          onClick={handleDownload}
          disabled={card.status !== 'SUCCEEDED'}
          className="px-2 py-1 rounded text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          下载
        </button>
        <button
          onClick={handleExpand}
          disabled={card.status !== 'SUCCEEDED'}
          className="px-2 py-1 rounded text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          放大
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowDebug(!showDebug); }}
          disabled={card.status !== 'SUCCEEDED'}
          className={`px-2 py-1 rounded text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            showDebug ? 'bg-purple-500/20 text-purple-400' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          }`}
        >
          调试
        </button>
      </div>

      {/* 调试面板（展开时） */}
      {showDebug && card.status === 'SUCCEEDED' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-3 py-2 border-t border-white/5 bg-space-900/30"
        >
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between text-white/40">
              <span>Task ID</span>
              <span className="text-white/60 font-mono">{card.meshyTaskId || card.id}</span>
            </div>
            {card.formats && (
              <div className="flex justify-between text-white/40">
                <span>格式</span>
                <span className="text-white/60">{Object.keys(card.formats).join(', ')}</span>
              </div>
            )}
            <div className="flex gap-1 mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectCard(card.id);
                  useChatStore.getState().addMessage({
                    type: 'user',
                    content: `重新贴图 - ${card.title}`,
                  });
                  wsService.send({
                    type: 'edit',
                    prompt: '重新贴图',
                    targetVersion: card.id,
                    sourceModelUrl: card.modelUrl,
                    sourceTaskId: card.meshyTaskId,
                  });
                }}
                className="flex-1 px-2 py-1 rounded bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 text-[10px] transition-colors"
              >
                重新贴图
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectCard(card.id);
                  useChatStore.getState().addMessage({
                    type: 'user',
                    content: `重塑网格 - ${card.title}`,
                  });
                  wsService.send({
                    type: 'edit',
                    prompt: '重塑网格',
                    targetVersion: card.id,
                    sourceModelUrl: card.modelUrl,
                    sourceTaskId: card.meshyTaskId,
                  });
                }}
                className="flex-1 px-2 py-1 rounded bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 text-[10px] transition-colors"
              >
                重塑网格
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
});
