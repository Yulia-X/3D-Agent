import { ChatMessage } from '../types';

// 创建唯一消息ID
export function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 创建Agent消息
export function createAssistantMessage(
  content: string,
  contentType: ChatMessage['contentType'],
  metadata?: ChatMessage['metadata']
): ChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content,
    contentType,
    timestamp: Date.now(),
    metadata,
  };
}

// 创建进度消息（用于生成过程中动态更新）
export function createProgressMessage(progress: number, stepName: string, taskId: string): ChatMessage {
  return {
    id: `msg-progress-${taskId}`,  // 固定ID便于更新
    role: 'assistant',
    content: `正在${stepName}...`,
    contentType: 'progress',
    timestamp: Date.now(),
    metadata: {
      progress,
      agentStep: stepName,
      taskId,
    },
  };
}

// 创建结果消息
export function createResultMessage(taskId: string): ChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content: '模型生成完成！你可以在右侧预览中查看效果。需要我帮你调整什么吗？',
    contentType: 'model-preview',
    timestamp: Date.now(),
    metadata: {
      taskId,
      suggestedActions: ['调整材质', '更换光照', '导出模型', '重新生成'],
    },
  };
}

// 进度步骤名称映射
export const STEP_NAMES: Record<string, string> = {
  'step-1': '解析你的需求',
  'step-2': '构思概念方案',
  'step-3': '生成3D结构',
  'step-4': '优化拓扑',
  'step-5': '展开UV',
  'step-6': '精修细节',
  'step-7': '生成材质贴图',
  'step-8': '质量检查',
  'step-9': '格式转换',
};
