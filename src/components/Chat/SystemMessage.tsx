import React from 'react';
import { ChatMessage } from '../../store/useChatStore';

interface Props {
  message: ChatMessage;
}

export function SystemMessage({ message }: Props) {
  // 根据内容判断样式
  const isError = message.content.includes('失败') || message.content.includes('错误');
  const isSuccess = message.content.includes('完成') || message.content.includes('成功');

  return (
    <div className="flex justify-center py-1">
      <div className={`px-3 py-1 rounded-full text-[11px] ${
        isError ? 'text-red-400/70 bg-red-500/5' :
        isSuccess ? 'text-emerald-400/70 bg-emerald-500/5' :
        'text-white/30 bg-white/[0.02]'
      }`}>
        {message.content}
      </div>
    </div>
  );
}
