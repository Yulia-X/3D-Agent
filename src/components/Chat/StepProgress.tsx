import React from 'react';
import { ChatMessage } from '../../store/useChatStore';

interface Props {
  message: ChatMessage;
}

export function StepProgress({ message }: Props) {
  const step = message.step;
  if (!step) return null;

  const statusIcon = () => {
    switch (step.status) {
      case 'done': return <span className="text-emerald-400">✓</span>;
      case 'running': return <span className="text-blue-400 animate-pulse">●</span>;
      case 'failed': return <span className="text-red-400">✕</span>;
      default: return <span className="text-white/20">○</span>;
    }
  };

  const statusColor = () => {
    switch (step.status) {
      case 'done': return 'text-emerald-400/80';
      case 'running': return 'text-blue-400';
      case 'failed': return 'text-red-400/80';
      default: return 'text-white/30';
    }
  };

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[90%] bg-white/[0.02] rounded-lg px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-sm w-4 text-center">{statusIcon()}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-medium truncate ${statusColor()}`}>
                步骤 {step.index}/{step.total}: {step.name}
              </span>
              {step.status === 'running' && step.progress != null && (
                <span className="text-[10px] text-blue-400/80 shrink-0">{step.progress}%</span>
              )}
            </div>
            {/* 进度条 (仅 running 时显示) */}
            {step.status === 'running' && step.progress != null && (
              <div className="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500/60 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
