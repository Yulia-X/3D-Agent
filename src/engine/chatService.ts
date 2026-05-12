import type { ChatMessage, UserProfile, GenerationTask, PanelMode } from '../types';
import { classifyIntent, generateAgentReply } from './chatAgent';

// ============ 类型定义 ============

export interface ChatContext {
  userProfile: UserProfile;
  history: ChatMessage[];
  currentTask: GenerationTask | null;
  messageCount: number;
}

export interface AgentResponse {
  messages: Omit<ChatMessage, 'id' | 'timestamp'>[];
  panelMode: PanelMode;
  storeActions?: { type: string; payload: any }[];
}

export interface ChatService {
  processMessage(text: string, context: ChatContext): Promise<AgentResponse>;
}

// ============ 配置 ============

const USE_LLM = import.meta.env.VITE_USE_LLM === 'true';
const LLM_API_URL = import.meta.env.VITE_LLM_API_URL || '';
const LLM_API_KEY = import.meta.env.VITE_LLM_API_KEY || '';

// ============ 规则引擎服务 ============

export class RuleBasedChatService implements ChatService {
  async processMessage(text: string, context: ChatContext): Promise<AgentResponse> {
    const intent = classifyIntent(text, context.userProfile);
    const reply = generateAgentReply(intent, context.userProfile);

    // 基于上下文丰富回复
    const enrichedMessages = this.enrichMessages(reply.messages, context, intent.type);

    return {
      ...reply,
      messages: enrichedMessages,
    };
  }

  private enrichMessages(
    messages: Omit<ChatMessage, 'id' | 'timestamp'>[],
    context: ChatContext,
    intentType: string
  ): Omit<ChatMessage, 'id' | 'timestamp'>[] {
    return messages.map((msg) => {
      if (msg.role !== 'assistant' || msg.contentType !== 'text') {
        return msg;
      }
      return {
        ...msg,
        content: this.addContextualFlavor(msg.content, context, intentType),
      };
    });
  }

  private addContextualFlavor(content: string, context: ChatContext, intentType: string): string {
    const { currentTask } = context;

    // 已有生成结果时，追加上下文提示
    if (currentTask?.result && intentType === 'unknown') {
      return content + ' 当前已有生成完成的模型，你可以让我调整材质、光照或导出。';
    }

    return content;
  }
}

// ============ LLM 服务（预留接口） ============

export class LLMChatService implements ChatService {
  async processMessage(text: string, context: ChatContext): Promise<AgentResponse> {
    // 如果未配置LLM，回退到规则引擎
    if (!LLM_API_URL) {
      console.warn('[LLMChatService] LLM_API_URL not configured, falling back to rule engine');
      const fallback = new RuleBasedChatService();
      return fallback.processMessage(text, context);
    }

    try {
      const response = await fetch(LLM_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
        },
        body: JSON.stringify(this.buildLLMPayload(text, context)),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return this.parseLLMResponse(data, context);
    } catch (error) {
      console.error('[LLMChatService] Error:', error);
      // LLM 调用失败时回退到规则引擎
      const fallback = new RuleBasedChatService();
      return fallback.processMessage(text, context);
    }
  }

  private buildLLMPayload(text: string, context: ChatContext): Record<string, any> {
    const systemPrompt = `你是3D模型生成助手，帮助用户通过自然语言创建和编辑3D模型。
当前任务状态：${context.currentTask ? context.currentTask.status : 'idle'}。
请用中文回复，语气友好专业。如果需要执行操作，请在回复末尾以 JSON 格式输出动作指令：{"actions":[{"type":"startGeneration|updateEditSettings","payload":{}}],"panelMode":"preview|edit-material|edit-transform|edit-lighting"}`;

    const recentMessages = context.history.slice(-10).map((msg) => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    }));

    return {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        ...recentMessages,
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      max_tokens: 800,
    };
  }

  private parseLLMResponse(data: any, _context: ChatContext): AgentResponse {
    const content = data.choices?.[0]?.message?.content || '';

    // 尝试从回复中提取 JSON 动作指令
    const jsonMatch = content.match(/\{[\s\S]*"actions"[\s\S]*\}/);
    let actions: any[] | undefined;
    let panelMode: PanelMode = 'preview';

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        actions = parsed.actions;
        panelMode = parsed.panelMode || 'preview';
      } catch {
        // JSON 解析失败，忽略动作指令
      }
    }

    const cleanContent = content.replace(/\{[\s\S]*"actions"[\s\S]*\}/, '').trim();

    return {
      messages: [
        {
          role: 'assistant',
          content: cleanContent || content,
          contentType: 'text',
        },
      ],
      panelMode,
      storeActions: actions,
    };
  }
}

// ============ 服务工厂 ============

export function createChatService(): ChatService {
  if (USE_LLM) {
    return new LLMChatService();
  }
  return new RuleBasedChatService();
}

// 全局单例
export const chatService = createChatService();
