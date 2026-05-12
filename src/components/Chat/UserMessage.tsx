import React from 'react';
import { ChatMessage } from '../../store/useChatStore';

interface Props {
  message: ChatMessage;
}

export function UserMessage({ message }: Props) {
  const timeStr = new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="bg-neon-blue/10 border border-neon-blue/20 rounded-xl rounded-tr-sm px-3.5 py-2.5">
          <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-white/20 text-[10px] mt-1 text-right">{timeStr}</p>
      </div>
    </div>
  );
}
