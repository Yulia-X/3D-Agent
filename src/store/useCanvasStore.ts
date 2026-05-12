import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CanvasCard {
  id: string;
  modelUrl: string;
  thumbnailUrl?: string;
  title: string;              // e.g. "V1.0 - a robot warrior"
  version: string;            // e.g. "V1.0"
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  progress: number;           // 0-100
  position: { x: number; y: number };  // 画布坐标
  createdAt: number;          // timestamp ms
  meshyTaskId?: string;
  formats?: Record<string, string>;    // {glb: url, fbx: url, obj: url, ...}
}

interface CanvasState {
  // --- State ---
  cards: CanvasCard[];
  selectedCardId: string | null;
  viewport: { x: number; y: number; scale: number };
  isAnimating: boolean;

  // --- Actions ---
  addCard: (card: Omit<CanvasCard, 'position'> & { position?: { x: number; y: number } }) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, partial: Partial<CanvasCard>) => void;
  selectCard: (id: string | null) => void;
  setViewport: (viewport: { x: number; y: number; scale: number }) => void;
  getNextPosition: () => { x: number; y: number };
  centerOnCard: (cardId: string) => void;
}

// 卡片尺寸常量
const CARD_WIDTH = 280;
const CARD_HEIGHT = 260;
const CARD_GAP = 40;
const CARDS_PER_ROW = 4;

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      cards: [],
      selectedCardId: null,
      viewport: { x: 0, y: 0, scale: 1 },
      isAnimating: false,

      addCard: (cardData) => {
        // 去重保护：已存在同 id 卡片则更新而非重复添加
        const existing = get().cards.find((c) => c.id === cardData.id);
        if (existing) {
          set((state) => ({
            cards: state.cards.map((c) =>
              c.id === cardData.id ? { ...c, ...cardData, position: c.position } : c
            ),
          }));
          return;
        }
        const position = cardData.position || get().getNextPosition();
        const card: CanvasCard = {
          ...cardData,
          position,
        };
        set((state) => ({ cards: [...state.cards, card] }));
      },

      removeCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== id),
          selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
        }));
      },

      updateCard: (id, partial) => {
        set((state) => ({
          cards: state.cards.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        }));
      },

      selectCard: (id) => {
        set({ selectedCardId: id });
      },

      setViewport: (viewport) => {
        set({ viewport });
      },

      getNextPosition: () => {
        const { cards, viewport } = get();
        // 计算当前视口中心对应的画布坐标
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const centerX = (screenW / 2 - viewport.x) / viewport.scale;
        const centerY = (screenH / 2 - viewport.y) / viewport.scale;

        // 如果没有卡片，放在视口中心偏左上
        if (cards.length === 0) {
          return {
            x: centerX - CARD_WIDTH / 2,
            y: centerY - CARD_HEIGHT / 2,
          };
        }

        // 多卡片时以视口中心为基准，网格排列并加随机偏移
        const count = cards.length;
        const col = count % CARDS_PER_ROW;
        const row = Math.floor(count / CARDS_PER_ROW);
        const gridStartX = centerX - ((CARDS_PER_ROW - 1) * (CARD_WIDTH + CARD_GAP)) / 2;
        const gridStartY = centerY - CARD_HEIGHT / 2;
        const jitterX = (Math.random() - 0.5) * 20;
        const jitterY = (Math.random() - 0.5) * 20;
        return {
          x: gridStartX + col * (CARD_WIDTH + CARD_GAP) + jitterX,
          y: gridStartY + row * (CARD_HEIGHT + CARD_GAP) + jitterY,
        };
      },

      centerOnCard: (cardId: string) => {
        const { cards, viewport } = get();
        const card = cards.find((c) => c.id === cardId);
        if (!card) return;

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const { scale } = viewport;

        // 计算使卡片中心对齐视口中心的 pan 值
        const panX = screenW / 2 - (card.position.x + CARD_WIDTH / 2) * scale;
        const panY = screenH / 2 - (card.position.y + CARD_HEIGHT / 2) * scale;

        // 开启动画标志
        set({ isAnimating: true });
        set({ viewport: { x: panX, y: panY, scale } });

        // 动画结束后关闭标志（与 CSS transition 时长匹配）
        setTimeout(() => {
          set({ isAnimating: false });
        }, 500);
      },
    }),
    {
      name: 'canvas-store', // localStorage key
      partialize: (state) => ({
        cards: state.cards.map((card) =>
          // 恢复时将遗留的 IN_PROGRESS 状态标记为 FAILED，避免卡片卡在加载中
          card.status === 'IN_PROGRESS' ? { ...card, status: 'FAILED' as const } : card
        ),
      }),
    }
  )
);
