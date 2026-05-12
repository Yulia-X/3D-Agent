/**
 * ClarificationRouter - 路由组件
 * 根据当前 exposureLevel 决定渲染哪种澄清/确认形态
 * 嵌入左侧面板内，模态确认弹窗通过 Portal 渲染到 body
 * 集成 ChatSync 订阅 WS 事件 → ChatStore，显示 MessageList 对话历史
 */
import { useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { useTaskStore } from '../../store/useTaskStore'
import { useAppStore } from '../../store/useAppStore'
import { useChatStore } from '../../store/useChatStore'
import { useCanvasStore } from '../../store/useCanvasStore'
import { ConceptSelectPayload, CostPayload, ForkPayload } from '../../types'
import { ConceptSelector } from './ConceptSelector'
import { CostConfirm } from './CostConfirm'
import { ForkConfirm } from './ForkConfirm'
import { MessageList } from '../Chat/MessageList'
import { UnifiedInput } from '../Shell/UnifiedInput'
import { useChatSync } from '../../hooks/useChatSync'
import { wsService } from '../../hooks/useWebSocket'

export const ClarificationRouter: React.FC = () => {
  // 启动 WS 事件 → ChatStore 同步
  useChatSync();

  const confirmation = useTaskStore((s) => s.confirmationPending)
  const setConfirmationPending = useTaskStore((s) => s.setConfirmationPending)
  const startTask = useTaskStore((s) => s.startTask)
  const credits = useAppStore((s) => s.credits)

  // 获取选中卡片信息用于动态 placeholder
  const selectedCardId = useCanvasStore((s) => s.selectedCardId)
  const selectedCard = useCanvasStore((s) =>
    s.selectedCardId ? s.cards.find((c) => c.id === s.selectedCardId) : null
  )
  const isEditMode = !!(selectedCard && selectedCard.status === 'SUCCEEDED')

  // 处理确认操作
  const handleConfirm = useCallback(() => {
    wsService.send({
      type: 'confirm:response',
      accepted: true,
    });
    setConfirmationPending(null)
  }, [setConfirmationPending])

  // 处理取消操作
  const handleCancel = useCallback(() => {
    wsService.send({
      type: 'confirm:response',
      accepted: false,
    });
    setConfirmationPending(null)
  }, [setConfirmationPending])

  // 处理概念选择
  const handleConceptSelect = useCallback(
    (conceptId: string) => {
      wsService.send({
        type: 'confirm:response',
        accepted: true,
        choice: conceptId,
      });
      setConfirmationPending(null)
    },
    [setConfirmationPending]
  )

  // 处理输入框提交
  const handleInputSubmit = useCallback(
    (text: string, options?: { images?: string[]; files?: File[] }) => {
      // 1. 添加用户消息到对话记录
      const chatStore = useChatStore.getState();
      chatStore.addMessage({ type: 'user', content: text });

      // 2. 设置思考状态
      chatStore.setThinking(true);

      // 3. 判断是否有选中的已完成模型 → 发送 edit 命令
      const canvasStore = useCanvasStore.getState();
      const currentSelectedId = canvasStore.selectedCardId;
      const currentSelectedCard = currentSelectedId
        ? canvasStore.cards.find((c) => c.id === currentSelectedId)
        : null;

      if (currentSelectedCard && currentSelectedCard.status === 'SUCCEEDED') {
        wsService.send({
          type: 'edit',
          prompt: text,
          targetVersion: currentSelectedCard.id,
          sourceModelUrl: currentSelectedCard.modelUrl,
          sourceTaskId: currentSelectedCard.meshyTaskId,
        });
      } else {
        wsService.send({ type: 'generate', prompt: text, images: options?.images });
      }

      // 4. 保留原有 startTask 逻辑（前端任务状态管理）
      startTask(text, { images: options?.images });
    },
    [startTask]
  )

  // 渲染确认组件
  const renderConfirmation = () => {
    if (!confirmation) return null

    switch (confirmation.type) {
      case 'concept_select': {
        const payload = confirmation.payload as ConceptSelectPayload
        return (
          <ConceptSelector
            concepts={payload.concepts}
            onSelect={handleConceptSelect}
            onCancel={handleCancel}
          />
        )
      }
      case 'cost': {
        const payload = confirmation.payload as CostPayload
        return (
          <CostConfirm
            operation={payload.operation}
            creditsCost={payload.creditsCost}
            currentBalance={credits.balance}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )
      }
      case 'fork': {
        const payload = confirmation.payload as ForkPayload
        return (
          <ForkConfirm
            baseVersion={payload.baseVersion}
            description={payload.description}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )
      }
      case 'quality':
        // quality确认暂时使用简单的confirm逻辑
        handleConfirm()
        return null
      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 面板标题 */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h2 className="text-xs font-medium text-white/50 uppercase tracking-wider">对话</h2>
      </div>

      {/* 消息列表 — 对话历史（澄清交互已整合到 ClarificationMessage 中） */}
      <MessageList />

      {/* 底部输入框 */}
      <div className="shrink-0 px-3 py-3 border-t border-white/5">
        <UnifiedInput
          onSubmit={handleInputSubmit}
          placeholder={isEditMode ? '描述你想对该模型做的调整...' : '描述你想要的3D模型...'}
        />
      </div>

      {/* 模态确认弹窗 — Portal 渲染到 body */}
      {confirmation && createPortal(
        <AnimatePresence mode="wait">
          {renderConfirmation()}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
