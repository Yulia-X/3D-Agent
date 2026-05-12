import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { wsService } from './useWebSocket';
import type { WSEvent } from '../types';

/**
 * 监听后端 WebSocket 事件，自动同步模型到画布
 * - preview:complete → addCard(SUCCEEDED)
 * - task:progress → addCard/updateCard(IN_PROGRESS)
 * 同时提供 window 方法方便开发调试
 */
export function useCanvasSync() {
  useEffect(() => {
    // 跟踪进行中的任务 id，避免重复 addCard
    const inProgressTasks = new Set<string>();

    // 监听 task:progress — 首次出现时添加一张 IN_PROGRESS 卡片，后续更新进度
    const unsubProgress = wsService.subscribe('task:progress', (event: WSEvent) => {
      if (event.type !== 'task:progress') return;
      const store = useCanvasStore.getState();

      // 防止 preview:complete 结果被后续 task:progress 覆盖
      const existing = store.cards.find(
        (c) => c.id === event.taskId || c.meshyTaskId === event.taskId
      );
      if (existing && existing.status !== 'IN_PROGRESS') {
        return;
      }

      if (!inProgressTasks.has(event.taskId)) {
        // 首次看到这个 taskId → 添加卡片
        inProgressTasks.add(event.taskId);
        store.addCard({
          id: event.taskId,
          modelUrl: '',
          title: event.step || 'Generating...',
          version: 'V?.0',
          status: 'IN_PROGRESS',
          progress: event.progress,
          createdAt: Date.now(),
          meshyTaskId: event.taskId,
        });
      } else {
        // 更新进度
        store.updateCard(event.taskId, {
          progress: event.progress,
          title: event.step || 'Generating...',
        });
      }
    });

    // 监听 preview:complete — 模型生成完成
    const unsubComplete = wsService.subscribe('preview:complete', (event: WSEvent) => {
      if (event.type !== 'preview:complete') return;
      const store = useCanvasStore.getState();
      const version = event.version;
      const versionId = version?.id || 'v1';
      const modelTitle = version?.trigger?.userInput?.slice(0, 30) || 'Generated Model';

      // 优先通过 taskId 直接匹配（最可靠）
      let matchedCard: typeof store.cards[0] | undefined;
      if (event.taskId) {
        matchedCard = store.cards.find(
          (c) => c.id === event.taskId || c.meshyTaskId === event.taskId
        );
      }

      // 回退：从 inProgressTasks 中查找
      if (!matchedCard) {
        for (const tid of inProgressTasks) {
          const found = store.cards.find((c) => c.id === tid || c.meshyTaskId === tid);
          if (found) {
            matchedCard = found;
            break;
          }
        }
      }

      // 回退：查找任意 IN_PROGRESS 卡片
      if (!matchedCard) {
        matchedCard = store.cards.find((c) => c.status === 'IN_PROGRESS');
      }

      if (matchedCard) {
        // 更新已有卡片
        store.updateCard(matchedCard.id, {
          modelUrl: event.modelUrl,
          title: modelTitle,
          version: versionId,
          status: 'SUCCEEDED',
          progress: 100,
          meshyTaskId: event.version?.assets?.meshyTaskId,
          formats: event.version?.assets?.formats,
        });
        inProgressTasks.delete(matchedCard.id);
        // 画布自动居中到完成的卡片
        setTimeout(() => store.centerOnCard(matchedCard!.id), 100);
      } else {
        // 确实不存在，新增（addCard 内部有去重保护）
        const cardId = event.taskId || crypto.randomUUID();
        store.addCard({
          id: cardId,
          modelUrl: event.modelUrl,
          title: modelTitle,
          version: versionId,
          status: 'SUCCEEDED',
          progress: 100,
          createdAt: Date.now(),
          meshyTaskId: event.version?.assets?.meshyTaskId,
          formats: event.version?.assets?.formats,
        });
        // 画布自动居中到新增的卡片
        setTimeout(() => store.centerOnCard(cardId), 100);
      }
    });

    // ─── 开发调试方法 ───
    (window as any).__addDemoCard = () => {
      const store = useCanvasStore.getState();
      store.addCard({
        id: crypto.randomUUID(),
        modelUrl: '',
        title: `Demo Model ${store.cards.length + 1}`,
        version: `V${store.cards.length + 1}.0`,
        status: 'SUCCEEDED',
        progress: 100,
        createdAt: Date.now(),
      });
    };

    (window as any).__addProgressCard = () => {
      const store = useCanvasStore.getState();
      const id = crypto.randomUUID();
      store.addCard({
        id,
        modelUrl: '',
        title: `Generating Model...`,
        version: `V${store.cards.length + 1}.0`,
        status: 'IN_PROGRESS',
        progress: 30,
        createdAt: Date.now(),
      });
      // 模拟进度
      let progress = 30;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          store.updateCard(id, { status: 'SUCCEEDED', progress: 100, title: 'Generated Robot' });
        } else {
          store.updateCard(id, { progress });
        }
      }, 1000);
    };

    return () => {
      unsubProgress();
      unsubComplete();
      delete (window as any).__addDemoCard;
      delete (window as any).__addProgressCard;
    };
  }, []);
}
