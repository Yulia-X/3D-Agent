import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAppStore } from '../store/useAppStore';
import { useTaskStore } from '../store/useTaskStore';
import { wsService } from './useWebSocket';

/**
 * useChatSync
 * 订阅 WebSocket 事件，自动转换为 ChatMessage 写入 ChatStore
 * 在对话面板顶层组件中调用一次即可
 */
export function useChatSync() {
  const thinkingIdRef = useRef<string | null>(null);
  const stepMsgIds = useRef<Map<string, string>>(new Map()); // nodeId -> msgId

  useEffect(() => {
    const store = useChatStore.getState();
    const unsubs: Array<() => void> = [];

    // 1. 订阅 reasoning:step → thinking 消息
    unsubs.push(wsService.subscribe('reasoning:step', (event: any) => {
      store.setThinking(true);

      if (!thinkingIdRef.current) {
        // 首次：创建 thinking 消息
        const id = store.addMessage({
          type: 'thinking',
          content: '思考中...',
          thinking: { steps: [`${event.step}: ${event.detail}`], collapsed: false },
        });
        thinkingIdRef.current = id;
      } else {
        // 追加步骤
        store.appendThinkingStep(thinkingIdRef.current, `${event.step}: ${event.detail}`);
      }
    }));

    // 2. 订阅 task:progress → 整体进度状态（不再创建 step 消息）
    unsubs.push(wsService.subscribe('task:progress', (event: any) => {
      const { progress } = event;

      // 进度达到100%，标记完成并重置 thinking
      if (progress >= 100) {
        store.setThinking(false);
        thinkingIdRef.current = null;
        stepMsgIds.current.clear();
      }
    }));

    // 3. 订阅 node:progress → 每个节点的独立进度（创建/更新 step 消息）
    unsubs.push(wsService.subscribe('node:progress', (event: any) => {
      const { taskId, nodeId, nodeName, stepIndex, totalSteps, progress } = event;

      const existingId = stepMsgIds.current.get(nodeId);

      if (existingId) {
        // 更新已有步骤消息
        const msg = useChatStore.getState().messages.find(m => m.id === existingId);
        store.updateMessage(existingId, {
          step: {
            ...(msg?.step || { index: stepIndex, total: totalSteps, name: nodeName, status: 'running' }),
            total: totalSteps,
            progress,
            status: progress >= 100 ? 'done' : 'running',
          },
        });
      } else {
        // 创建新步骤消息（使用后端传来的 stepIndex 和 totalSteps）
        const id = store.addMessage({
          type: 'step',
          content: nodeName || nodeId,
          step: { index: stepIndex, total: totalSteps, name: nodeName || nodeId, status: 'running', progress },
        });
        stepMsgIds.current.set(nodeId, id);
      }

      // 所有步骤完成后，重置 thinking
      if (progress >= 100 && stepMsgIds.current.size >= totalSteps) {
        store.setThinking(false);
        thinkingIdRef.current = null;
      }
    }));

    // 4. 订阅 dag:node_done → api_result 消息
    unsubs.push(wsService.subscribe('dag:node_done', (event: any) => {
      const { nodeId, output } = event;

      // 将该节点对应的 step 消息标记为完成
      const stepId = stepMsgIds.current.get(nodeId);
      if (stepId) {
        const msg = useChatStore.getState().messages.find(m => m.id === stepId);
        if (msg?.step) {
          store.updateMessage(stepId, { step: { ...msg.step, status: 'done', progress: 100 } });
        }
      }

      store.addMessage({
        type: 'api_result',
        content: `${output?.agentType || nodeId} 完成`,
        apiResult: {
          agentType: output?.agentType || nodeId,
          nodeId,
          status: output?.status || 'SUCCEEDED',
          output: output || {},
        },
      });
    }));

    // 5. 订阅 preview:complete → system 消息
    unsubs.push(wsService.subscribe('preview:complete', (event: any) => {
      store.setThinking(false);
      thinkingIdRef.current = null;
      stepMsgIds.current.clear();

      store.addMessage({
        type: 'system',
        content: '✓ 生成完成! 模型已添加到画布',
      });
    }));

    // 6. 订阅 error:recoverable → system 警告
    unsubs.push(wsService.subscribe('error:recoverable', (event: any) => {
      store.addMessage({
        type: 'system',
        content: `⚠ ${event.message || '遇到可恢复错误'}`,
      });
    }));

    // 7. 订阅 error:fatal → system 错误
    unsubs.push(wsService.subscribe('error:fatal', (event: any) => {
      store.setThinking(false);
      thinkingIdRef.current = null;
      store.addMessage({
        type: 'system',
        content: `✕ 生成失败: ${event.message || '未知错误'}`,
      });
    }));

    // 8. 订阅 balance:update → 同步余额到 useAppStore
    unsubs.push(wsService.subscribe('balance:update', (event: any) => {
      const { balance } = event;
      useAppStore.getState().syncBalance(balance);
    }));

    // 9. 订阅 clarification:needed → 澄清消息
    unsubs.push(wsService.subscribe('clarification:needed', (event: any) => {
      const { payload } = event;
      const questions = payload.questions || payload.checkpoint?.questions || [];
      // 后端传入秒，转换为毫秒；无值时不设超时
      const rawTimeout = payload.checkpoint?.timeout?.default;
      const timeout = rawTimeout && rawTimeout > 0 ? rawTimeout * 1000 : 0;

      // 1. 设置 useTaskStore.clarificationPending
      const taskStore = useTaskStore.getState();
      taskStore.setClarificationPending(payload);

      // 2. 轮次管理：将上一轮活跃的 round 标记为 disabled
      const rounds = taskStore.clarificationRounds;
      if (rounds.length > 0) {
        const lastRound = rounds[rounds.length - 1];
        if (lastRound.status === 'active') {
          store.updateClarificationMessage(lastRound.messageId, { status: 'disabled' });
          taskStore.updateClarificationRound(lastRound.roundId, { status: 'answered' });
        }
      }

      // 3. 向 chatStore 添加澄清消息
      store.setThinking(false);
      thinkingIdRef.current = null;

      const roundId = `round-${Date.now()}`;
      const newMsgId = store.addMessage({
        type: 'clarification',
        content: '需要确认一些信息',
        clarification: {
          roundId,
          questions,
          progress: { answered: 0, total: questions.length, currentIndex: 0 },
          timeoutAt: timeout > 0 ? Date.now() + timeout : null,
          status: 'active',
        },
      });

      // 4. 添加新 round 到列表
      taskStore.addClarificationRound({
        roundId,
        roundIndex: rounds.length + 1,
        messageId: newMsgId,
        status: 'active',
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, []);
}
