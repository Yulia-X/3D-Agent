import React, { useRef, useCallback } from 'react';
import { useGesture } from '@use-gesture/react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { ModelCard } from './ModelCard';

export function InfiniteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewport, setViewport, cards, selectedCardId, selectCard, updateCard, isAnimating } = useCanvasStore();
  const { x, y, scale } = viewport;

  // ─── RAF 节流：拖拽卡片时使用 requestAnimationFrame ───
  const rafId = useRef<number | null>(null);

  // ─── 卡片拖拽逻辑 ───
  const dragState = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const handleCardPointerDown = useCallback((e: React.PointerEvent, cardId: string, pos: { x: number; y: number }) => {
    // 忽略来自交互元素（按钮、3D Canvas）的事件
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('canvas') || target.tagName === 'CANVAS') return;

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragState.current = {
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  }, []);

  const handleCardPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      if (!dragState.current) return;
      const dx = clientX - dragState.current.startX;
      const dy = clientY - dragState.current.startY;

      // 超过 5px 阈值才视为拖拽
      if (!dragState.current.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      dragState.current.moved = true;

      const newX = dragState.current.originX + dx / scale;
      const newY = dragState.current.originY + dy / scale;
      updateCard(dragState.current.cardId, { position: { x: newX, y: newY } });
    });
  }, [scale, updateCard]);

  const handleCardPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState.current) return;
    const wasDrag = dragState.current.moved;
    const cardId = dragState.current.cardId;
    dragState.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    // 如果没有实际拖拽，则视为点击选中
    if (!wasDrag) {
      selectCard(selectedCardId === cardId ? null : cardId);
    }
  }, [selectCard, selectedCardId]);

  // 使用 useGesture 处理拖拽和滚轮
  const bind = useGesture({
    onDrag: ({ delta: [dx, dy], event }) => {
      // 仅在拖拽空白区域时平移（不是拖拽卡片）
      if ((event.target as HTMLElement).closest('[data-card]')) return;
      setViewport({ x: x + dx, y: y + dy, scale });
    },
    onWheel: ({ event, delta: [, dy] }) => {
      event.preventDefault();
      // 以光标位置为中心缩放
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (event as WheelEvent).clientX - rect.left;
      const mouseY = (event as WheelEvent).clientY - rect.top;

      const zoomFactor = dy > 0 ? 0.95 : 1.05;
      const newScale = Math.min(3, Math.max(0.2, scale * zoomFactor));

      // 调整偏移使缩放以光标为中心
      const scaleRatio = newScale / scale;
      const newX = mouseX - (mouseX - x) * scaleRatio;
      const newY = mouseY - (mouseY - y) * scaleRatio;

      setViewport({ x: newX, y: newY, scale: newScale });
    },
  }, {
    drag: { filterTaps: true },
    wheel: { eventOptions: { passive: false } },
  });

  const handleReset = () => setViewport({ x: 0, y: 0, scale: 1 });

  return (
    <div
      ref={containerRef}
      {...bind()}
      className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        // 点击空白区域取消选中
        if (!(e.target as HTMLElement).closest('[data-card]')) {
          selectCard(null);
        }
      }}
    >
      {/* 网格背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${x % (24 * scale)}px ${y % (24 * scale)}px`,
        }}
      />

      {/* 可变换的画布内容层 */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transition: isAnimating ? 'transform 0.5s ease-out' : 'none',
          willChange: 'transform',
        }}
      >
        {/* 模型卡片 */}
        {cards.map((card) => (
          <div
            key={card.id}
            data-card
            className={`absolute transition-shadow duration-150 ${
              dragState.current?.cardId === card.id && dragState.current?.moved
                ? 'opacity-90 shadow-2xl z-50'
                : ''
            }`}
            style={{ left: card.position.x, top: card.position.y, cursor: 'grab' }}
            onPointerDown={(e) => handleCardPointerDown(e, card.id, card.position)}
            onPointerMove={handleCardPointerMove}
            onPointerUp={handleCardPointerUp}
          >
            <ModelCard card={card} />
          </div>
        ))}
      </div>

      {/* 右下角控制栏 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
        <div className="px-3 py-1.5 rounded-lg bg-space-800/80 backdrop-blur-sm border border-white/10 text-white/60 text-xs font-mono">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 rounded-lg bg-space-800/80 backdrop-blur-sm border border-white/10 text-white/60 text-xs hover:text-white hover:border-white/20 transition-colors"
        >
          重置
        </button>
      </div>
    </div>
  );
}
