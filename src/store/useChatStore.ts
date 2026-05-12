import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClarificationQuestion } from '../types';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'step' | 'api_result' | 'system' | 'clarification';
  content: string;
  timestamp: number;
  // type=thinking 时
  thinking?: {
    steps: string[];       // 思维链步骤列表
    collapsed?: boolean;   // 是否折叠
  };
  // type=step 时
  step?: {
    index: number;         // 当前步骤索引（从1开始）
    total: number;         // 总步骤数
    name: string;          // 步骤名称
    status: 'pending' | 'running' | 'done' | 'failed';
    progress?: number;     // 0-100 进度
  };
  // type=api_result 时
  apiResult?: {
    agentType: string;     // 如 'text-to-3d-preview', 'remesh' 等
    nodeId: string;        // DAG 节点 ID
    status: string;        // 'SUCCEEDED' | 'FAILED'
    output: Record<string, any>;  // API 返回的数据
  };
  // type=clarification 时
  clarification?: {
    roundId: string;
    questions: ClarificationQuestion[];
    progress: { answered: number; total: number; currentIndex: number };
    timeoutAt: number | null;
    status: 'active' | 'answered' | 'timeout' | 'disabled';
  };
}

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;

  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;  // 返回 message id
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  appendThinkingStep: (id: string, step: string) => void;  // 追加思维链步骤
  updateClarificationMessage: (msgId: string, patch: Partial<NonNullable<ChatMessage['clarification']>>) => void;
  setThinking: (thinking: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isThinking: false,

      addMessage: (msg) => {
        const id = crypto.randomUUID();
        const message: ChatMessage = {
          ...msg,
          id,
          timestamp: Date.now(),
        };
        set((state) => ({ messages: [...state.messages, message] }));
        return id;
      },

      updateMessage: (id, partial) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...partial } : m
          ),
        }));
      },

      appendThinkingStep: (id, step) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id && m.thinking
              ? { ...m, thinking: { ...m.thinking, steps: [...m.thinking.steps, step] } }
              : m
          ),
        }));
      },

      updateClarificationMessage: (msgId, patch) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === msgId && m.clarification
              ? { ...m, clarification: { ...m.clarification, ...patch } }
              : m
          ),
        }));
      },

      setThinking: (thinking) => {
        set({ isThinking: thinking });
      },

      clearMessages: () => {
        set({ messages: [], isThinking: false });
      },
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        messages: state.messages,
      }),
    }
  )
);
