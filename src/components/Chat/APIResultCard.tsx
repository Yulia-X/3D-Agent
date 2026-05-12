import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '../../store/useChatStore';

interface Props {
  message: ChatMessage;
}

export function APIResultCard({ message }: Props) {
  const [expanded, setExpanded] = useState(false);
  const api = message.apiResult;
  if (!api) return null;

  const isSuccess = api.status === 'SUCCEEDED';

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[90%]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 hover:border-white/10 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-white/60 text-xs font-mono">{api.agentType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${isSuccess ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                {api.status}
              </span>
              <svg
                className={`w-3 h-3 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="mt-1 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                <pre className="text-[10px] text-white/40 font-mono whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
                  {JSON.stringify(api.output, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
