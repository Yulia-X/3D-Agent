import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '../../store/useChatStore';

interface Props {
  message: ChatMessage;
}

export function ThinkingBlock({ message }: Props) {
  const [collapsed, setCollapsed] = useState(message.thinking?.collapsed ?? false);
  const steps = message.thinking?.steps || [];

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] w-full">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-white/40 text-xs hover:text-white/60 transition-colors mb-1"
        >
          <svg
            className={`w-3 h-3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M6 6l4 4-4 4V6z" />
          </svg>
          <span className="font-medium">思考过程</span>
          <span className="text-white/20">({steps.length} 步)</span>
        </button>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-5 border-l border-white/10 space-y-1.5">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-white/20 text-[10px] mt-0.5 shrink-0">›</span>
                    <p className="text-white/40 text-xs leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
