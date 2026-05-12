import React, { useRef, useEffect } from 'react';
import { useChatStore, ChatMessage } from '../../store/useChatStore';
import { UserMessage } from './UserMessage';
import { ThinkingBlock } from './ThinkingBlock';
import { StepProgress } from './StepProgress';
import { APIResultCard } from './APIResultCard';
import { SystemMessage } from './SystemMessage';
import { ClarificationMessage } from './ClarificationMessage';

export function MessageList() {
  const { messages, isThinking } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const renderMessage = (msg: ChatMessage) => {
    switch (msg.type) {
      case 'user': return <UserMessage key={msg.id} message={msg} />;
      case 'thinking': return <ThinkingBlock key={msg.id} message={msg} />;
      case 'step': return <StepProgress key={msg.id} message={msg} />;
      case 'api_result': return <APIResultCard key={msg.id} message={msg} />;
      case 'system': return <SystemMessage key={msg.id} message={msg} />;
      case 'assistant': return <SystemMessage key={msg.id} message={msg} />;
      case 'clarification': return <ClarificationMessage key={msg.id} message={msg} />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
      {messages.length === 0 && !isThinking && (
        <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm">
          <p>描述你想要的 3D 模型</p>
          <p className="text-xs mt-1">AI 将为你生成并展示在画布上</p>
        </div>
      )}
      {messages.map(renderMessage)}
      {isThinking && messages[messages.length - 1]?.type !== 'thinking' && (
        <div className="flex items-center gap-2 text-white/40 text-sm px-3 py-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>AI 正在思考...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
