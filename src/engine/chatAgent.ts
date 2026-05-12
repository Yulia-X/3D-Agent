import type { ChatIntent, ChatIntentType, UserProfile, PanelMode, ChatMessage } from '../types';
import type { AgentResponse } from './chatService';

// ============ 意图关键词映射 ============

const INTENT_KEYWORDS: Record<ChatIntentType, string[]> = {
  generate: ['生成', '创建', '做一个', '帮我做', '来一个', '制作', '设计', 'generate', 'create', 'make'],
  'edit-material': ['材质', '颜色', '贴图', '纹理', 'material', 'texture', 'color'],
  'edit-transform': ['旋转', '缩放', '移动', '变换', '大小', 'rotate', 'scale', 'move', 'transform'],
  'edit-lighting': ['光照', '灯光', '亮度', '阴影', 'lighting', 'light', 'shadow'],
  export: ['导出', '下载', '保存', 'export', 'download', 'save'],
  pipeline: ['流程', '管线', '批量', 'pipeline', 'batch'],
  query: ['查看', '状态', '进度', '怎么样', 'status', 'progress'],
  greeting: ['你好', '嗨', '在吗', 'hello', 'hi', 'hey'],
  unknown: [],
};

// ============ 意图分类 ============

export function classifyIntent(text: string, _userProfile: UserProfile): ChatIntent {
  const lowerText = text.toLowerCase();
  let bestMatch: ChatIntentType = 'unknown';
  let bestConfidence = 0;

  for (const [intentType, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intentType === 'unknown') continue;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        const confidence = keyword.length >= 3 ? 0.85 : 0.65;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = intentType as ChatIntentType;
        }
      }
    }
  }

  // 默认置信度
  if (bestMatch === 'unknown') {
    bestConfidence = 0.3;
  }

  return {
    type: bestMatch,
    confidence: bestConfidence,
    extractedParams: {},
    originalMessage: text,
  };
}

// ============ 回复生成 ============

const PANEL_MODE_MAP: Record<ChatIntentType, PanelMode> = {
  generate: 'preview',
  'edit-material': 'edit-material',
  'edit-transform': 'edit-transform',
  'edit-lighting': 'edit-lighting',
  export: 'preview',
  pipeline: 'pipeline-detail',
  query: 'preview',
  greeting: 'preview',
  unknown: 'preview',
};

const REPLY_TEMPLATES: Record<ChatIntentType, string> = {
  generate: '好的，我来帮你生成模型。让我先解析你的需求...',
  'edit-material': '收到，我来调整材质设置。',
  'edit-transform': '好的，正在调整模型变换参数。',
  'edit-lighting': '明白，正在调整光照效果。',
  export: '好的，正在准备导出文件。',
  pipeline: '正在查看流程详情。',
  query: '让我查看一下当前状态。',
  greeting: '你好！我是3D模型生成助手，告诉我你想创建什么样的模型吧！',
  unknown: '我理解你的意思了。你可以告诉我想要生成什么样的3D模型，或者对现有模型进行调整。',
};

export function generateAgentReply(intent: ChatIntent, _userProfile: UserProfile): AgentResponse {
  const replyContent = REPLY_TEMPLATES[intent.type] || REPLY_TEMPLATES.unknown;
  const panelMode = PANEL_MODE_MAP[intent.type] || 'preview';

  const messages: Omit<ChatMessage, 'id' | 'timestamp'>[] = [
    {
      role: 'assistant',
      content: replyContent,
      contentType: 'text',
    },
  ];

  return {
    messages,
    panelMode,
  };
}
