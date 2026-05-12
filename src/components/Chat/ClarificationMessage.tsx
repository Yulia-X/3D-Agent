/**
 * ClarificationMessage - 统一澄清卡片组件
 * 合并了展示与选择功能，active 状态下直接在卡片内完成交互
 * 每个问题拥有独立的倒计时
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Check, X } from 'lucide-react';
import { ChatMessage, useChatStore } from '../../store/useChatStore';
import { ClarificationQuestion, ClarificationOption, UserClarificationResponse } from '../../types';
import { useTaskStore } from '../../store/useTaskStore';
import { useAppStore } from '../../store/useAppStore';
import { useExposureStore } from '../../store/useExposureStore';
import { wsService } from '../../hooks/useWebSocket';
import { RangeSlider } from '../Clarification/RangeSlider';
import { SummaryConfirm } from '../Clarification/SummaryConfirm';

interface Props {
  message: ChatMessage;
}

// 默认每题超时时间（毫秒）
const DEFAULT_PER_QUESTION_TIMEOUT = 30000;

export const ClarificationMessage: React.FC<Props> = ({ message }) => {
  const { clarification } = message;
  if (!clarification) return null;

  switch (clarification.status) {
    case 'active':
      return <ActiveClarification clarification={clarification} messageId={message.id} />;
    case 'answered':
      return <AnsweredClarification clarification={clarification} />;
    case 'timeout':
      return <TimeoutClarification clarification={clarification} />;
    case 'disabled':
      return <DisabledClarification clarification={clarification} />;
    default:
      return null;
  }
};

// ─── 类型定义 ─────────────────────────────────────────────────────
type ClarificationData = NonNullable<ChatMessage['clarification']>;

// ─── 获取per-question超时时间 ─────────────────────────────────────
function getPerQuestionTimeout(question: ClarificationQuestion): number {
  // 优先用每题自定义 timeout（秒→毫秒）
  if (question.timeout && question.timeout > 0) {
    return question.timeout * 1000;
  }
  // 从 exposure 级别决定默认超时
  const exposure = useExposureStore.getState().exposure;
  const pending = useTaskStore.getState().clarificationPending;
  if (pending?.checkpoint?.timeout) {
    let seconds: number | undefined;
    if (exposure.debugPanel) {
      seconds = pending.checkpoint.timeout.debug || undefined;
    } else if (exposure.editPanel) {
      seconds = pending.checkpoint.timeout.expanded;
    } else {
      seconds = pending.checkpoint.timeout.default;
    }
    if (seconds && seconds > 0) return seconds * 1000;
  }
  return DEFAULT_PER_QUESTION_TIMEOUT;
}

// ─── ActiveClarification（统一交互卡片） ─────────────────────────
const ActiveClarification: React.FC<{ clarification: ClarificationData; messageId: string }> = ({
  clarification,
  messageId,
}) => {
  const { questions, progress } = clarification;
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const setClarificationPending = useTaskStore((s) => s.setClarificationPending);

  // 状态
  const [currentIdx, setCurrentIdx] = useState(progress.currentIndex);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [rangeValues, setRangeValues] = useState<Record<string, number>>({});
  const [isRoundLocked, setIsRoundLocked] = useState(false);

  // Per-question 倒计时
  const currentQuestion = questions[currentIdx];
  const perQuestionMs = currentQuestion ? getPerQuestionTimeout(currentQuestion) : DEFAULT_PER_QUESTION_TIMEOUT;
  const [remaining, setRemaining] = useState(perQuestionMs);
  const timeoutFiredRef = useRef(false);
  const pendingResponses = useRef<UserClarificationResponse[]>([]);

  // 查找推荐选项值
  const getRecommendedValue = useCallback((q: ClarificationQuestion): string | null => {
    const rec = q.options?.find((o) => o.isRecommended);
    if (rec) return rec.value;
    if (q.recommendedDefault) return q.recommendedDefault;
    if (q.defaultValue) return q.defaultValue;
    return q.options?.[0]?.value ?? null;
  }, []);

  // 当 currentIdx 变化时，重置倒计时
  useEffect(() => {
    const q = questions[currentIdx];
    if (!q) return;
    const timeout = getPerQuestionTimeout(q);
    // 安全守卫：timeout 无效或过小（< 5秒）时不启动倒计时
    if (timeout < 5000) {
      setRemaining(0);
      return;
    }
    timeoutFiredRef.current = false;
    setRemaining(timeout);

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          if (!timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            // 单题超时：自动选择推荐项
            handleQuestionTimeout(currentIdx);
          }
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  // 单题超时处理
  const handleQuestionTimeout = useCallback(
    (idx: number) => {
      const q = questions[idx];
      if (!q) return;
      const val = getRecommendedValue(q);
      if (val) {
        // 自动填入推荐值
        if (q.type === 'single_choice' || q.type === 'image_select') {
          setResponses((prev) => ({ ...prev, [q.field]: val }));
        } else if (q.type === 'multi_choice') {
          setMultiChoices((prev) => ({ ...prev, [q.field]: [val] }));
        } else if (q.type === 'text') {
          setTextInputs((prev) => ({ ...prev, [q.field]: val }));
        } else if (q.type === 'range') {
          setRangeValues((prev) => ({ ...prev, [q.field]: Number(val) }));
        }
        // 显示单题超时提示
        const label = q.options?.find((o) => o.value === val)?.label ?? val;
        useChatStore.getState().addMessage({
          type: 'system',
          content: `⏱ 问题「${q.question}」已自动选择推荐项「${label}」`,
        });
      }

      // 如果是最后一题，提交所有回答
      if (idx >= questions.length - 1) {
        setTimeout(() => submitAll(idx, val), 100);
      } else {
        // 进入下一题
        setCurrentIdx(idx + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, getRecommendedValue]
  );

  // 提交所有回答
  const submitAll = useCallback(
    (lastIdx?: number, lastAutoVal?: string | null) => {
      setIsRoundLocked(true);
      const result: Array<{ field: string; value: string }> = [];
      questions.forEach((q, idx) => {
        if (q.type === 'single_choice' || q.type === 'image_select') {
          const val = responses[q.field] || (idx === lastIdx && lastAutoVal ? lastAutoVal : undefined);
          if (val) result.push({ field: q.field, value: val });
        } else if (q.type === 'multi_choice') {
          const vals = multiChoices[q.field] || (idx === lastIdx && lastAutoVal ? [lastAutoVal] : undefined);
          if (vals?.length) result.push({ field: q.field, value: vals.join(',') });
        } else if (q.type === 'text') {
          const val = textInputs[q.field] || (idx === lastIdx && lastAutoVal ? lastAutoVal : undefined);
          if (val) result.push({ field: q.field, value: val });
        } else if (q.type === 'range') {
          const val = rangeValues[q.field] ?? (idx === lastIdx && lastAutoVal ? Number(lastAutoVal) : undefined);
          if (val !== undefined) result.push({ field: q.field, value: String(val) });
        }
      });

      // 记录偏好
      result.forEach(({ field, value }) => {
        recordAnswer(field, value);
      });

      // 发送到后端
      const allResponses: UserClarificationResponse[] = result.map(({ field, value }) => ({
        questionId: field,
        field,
        value,
        timestamp: Date.now(),
      }));
      wsService.send({ type: 'clarification:response', payload: allResponses });

      // 更新消息状态
      useChatStore.getState().updateClarificationMessage(messageId, { status: 'answered' });

      // 清除 pending
      setClarificationPending(null);

      // 设置思考状态
      useChatStore.getState().setThinking(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, responses, multiChoices, textInputs, rangeValues, messageId, recordAnswer, setClarificationPending]
  );

  // 跳过整轮
  const handleSkip = useCallback(() => {
    wsService.send({ type: 'clarification:response', payload: [] });
    useChatStore.getState().updateClarificationMessage(messageId, { status: 'timeout' });
    setClarificationPending(null);
    useChatStore.getState().setThinking(true);
  }, [messageId, setClarificationPending]);

  // 选择处理
  const handleSingleChoice = useCallback((field: string, value: string) => {
    setResponses((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleMultiChoice = useCallback((field: string, value: string) => {
    setMultiChoices((prev) => {
      const current = prev[field] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
  }, []);

  const handleTextInput = useCallback((field: string, value: string) => {
    setTextInputs((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleRangeChange = useCallback((field: string, value: number) => {
    setRangeValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  // 回退
  const handleBack = useCallback(() => {
    if (isRoundLocked || currentIdx <= 0) return;
    const targetIdx = currentIdx - 1;
    const targetQ = questions[targetIdx];
    if (targetQ) {
      const f = targetQ.field;
      setResponses((prev) => { const n = { ...prev }; delete n[f]; return n; });
      setMultiChoices((prev) => { const n = { ...prev }; delete n[f]; return n; });
      setTextInputs((prev) => { const n = { ...prev }; delete n[f]; return n; });
      setRangeValues((prev) => { const n = { ...prev }; delete n[f]; return n; });
    }
    setCurrentIdx(targetIdx);
  }, [isRoundLocked, currentIdx, questions]);

  // 下一题 / 提交
  const handleNext = useCallback(() => {
    if (isRoundLocked) return;
    if (currentIdx >= questions.length - 1) {
      submitAll();
    } else {
      setCurrentIdx((prev) => prev + 1);
    }
  }, [isRoundLocked, currentIdx, questions.length, submitAll]);

  const isLastQuestion = currentIdx === questions.length - 1;
  const remainingSec = Math.ceil(remaining / 1000);
  const timeoutPercent = perQuestionMs > 0 ? (remaining / perQuestionMs) * 100 : 0;
  const isUrgent = remainingSec <= 10;

  const canProceed = () => {
    if (isRoundLocked || !currentQuestion) return false;
    const { field, type } = currentQuestion;
    if (type === 'single_choice' || type === 'image_select') return !!responses[field];
    if (type === 'multi_choice') return (multiChoices[field]?.length || 0) > 0;
    if (type === 'text') return !!textInputs[field]?.trim();
    if (type === 'range') return rangeValues[field] !== undefined;
    if (type === 'confirm') return true;
    return false;
  };

  return (
    <div className="w-[90%] mx-auto">
      <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-xl overflow-hidden border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
        {/* 渐变顶部装饰条 */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse" />

        <div className="p-4">
          {/* 头部：标题 + 进度 + 跳过 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-xs font-medium text-indigo-300">需要你的确认</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">
                {currentIdx + 1}/{questions.length}
              </span>
              <button
                onClick={handleSkip}
                disabled={isRoundLocked}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
              >
                <X size={12} />
                跳过
              </button>
            </div>
          </div>

          {/* 问题进度指示条 */}
          {questions.length > 1 && (
            <div className="flex gap-1 mb-3">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    idx < currentIdx
                      ? 'bg-indigo-500'
                      : idx === currentIdx
                      ? 'bg-indigo-400/60'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          )}

          {/* 当前问题内容 + 交互 */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* 问题文本 */}
              <p className="text-sm text-white/90 mb-3 font-medium">
                {currentQuestion?.question}
              </p>

              {/* 选项区域 */}
              {currentQuestion?.type === 'single_choice' && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSingleChoice(currentQuestion.field, opt.value)}
                      disabled={isRoundLocked}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 ${
                        responses[currentQuestion.field] === opt.value
                          ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                          : 'bg-gray-800 text-white/70 border border-gray-600 hover:border-indigo-400 hover:text-white/90'
                      }`}
                    >
                      {opt.isRecommended && (
                        <span className="absolute -top-1 -right-1 text-[10px] bg-amber-500 text-white px-1 rounded leading-tight">推荐</span>
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion?.type === 'multi_choice' && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options?.map((opt) => {
                    const selected = multiChoices[currentQuestion.field]?.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleMultiChoice(currentQuestion.field, opt.value)}
                        disabled={isRoundLocked}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 ${
                          selected
                            ? 'bg-indigo-600 text-white border border-indigo-400 shadow-lg shadow-indigo-500/20'
                            : 'bg-gray-800 text-white/70 border border-gray-600 hover:border-indigo-400 hover:text-white/90'
                        }`}
                      >
                        {opt.isRecommended && (
                          <span className="absolute -top-1 -right-1 text-[10px] bg-amber-500 text-white px-1 rounded leading-tight">推荐</span>
                        )}
                        <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                          selected ? 'border-white bg-white/20' : 'border-white/30'
                        }`}>
                          {selected && <Check size={8} />}
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion?.type === 'text' && (
                <input
                  type="text"
                  value={textInputs[currentQuestion.field] || ''}
                  onChange={(e) => handleTextInput(currentQuestion.field, e.target.value)}
                  placeholder="输入你的回答..."
                  disabled={isRoundLocked}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canProceed()) handleNext();
                  }}
                />
              )}

              {currentQuestion?.type === 'image_select' && (
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options?.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleSingleChoice(currentQuestion.field, opt.value)}
                      disabled={isRoundLocked}
                      className={`rounded-lg overflow-hidden border-2 transition-all ${
                        responses[currentQuestion.field] === opt.value
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {opt.thumbnail && (
                        <img src={opt.thumbnail} alt={opt.label} className="w-full h-20 object-cover" />
                      )}
                      <span className="block text-xs text-white/70 p-1.5">{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion?.type === 'range' && (
                <RangeSlider
                  question={currentQuestion}
                  value={rangeValues[currentQuestion.field] ?? Number(currentQuestion.recommendedDefault || currentQuestion.options?.[0]?.value || 0)}
                  onChange={(val) => handleRangeChange(currentQuestion.field, val)}
                />
              )}

              {currentQuestion?.type === 'confirm' && (
                <SummaryConfirm
                  questions={questions.filter((q) => q.type !== 'confirm')}
                  answers={Object.fromEntries([
                    ...Object.entries(responses),
                    ...Object.entries(multiChoices),
                    ...Object.entries(textInputs),
                    ...Object.entries(rangeValues).map(([k, v]) => [k, String(v)]),
                  ])}
                  onModify={(idx) => setCurrentIdx(idx)}
                  onConfirm={() => submitAll()}
                  onBack={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* 底部操作按钮 */}
          <div className="flex items-center justify-between mt-4">
            {/* 左侧：倒计时提示 */}
            <div className="flex items-center gap-1">
              {remaining > 0 && perQuestionMs >= 5000 && (
                <span className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-amber-400' : 'text-white/40'}`}>
                  <Clock size={12} />
                  {remainingSec}s
                </span>
              )}
            </div>
            {/* 右侧：操作按钮 */}
            <div className="flex gap-2">
              {questions.length > 1 && currentIdx > 0 && (
                <button
                  onClick={handleBack}
                  disabled={isRoundLocked}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed() || isRoundLocked}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isLastQuestion ? '确认' : '下一步'}
              </button>
            </div>
          </div>
        </div>

        {/* 底部 per-question 倒计时进度条 */}
        {remaining > 0 && perQuestionMs >= 5000 && (
          <div className="relative">
            <div className="h-[2px] bg-white/5 w-full">
              <motion.div
                className={`h-full ${
                  isUrgent
                    ? 'bg-gradient-to-r from-amber-500 to-red-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                initial={{ width: '100%' }}
                animate={{ width: `${timeoutPercent}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
            <p className="text-[10px] text-white/30 text-center mt-0.5 pb-1">
              该问题将在 {remainingSec} 秒后自动选择推荐项
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AnsweredClarification ───────────────────────────────────────
const AnsweredClarification: React.FC<{ clarification: ClarificationData }> = ({ clarification }) => {
  const { questions } = clarification;

  const summary = questions.map((q) => {
    const label = q.field.replace(/_/g, ' ');
    const value = q.recommendedDefault || q.defaultValue || '已回答';
    return `${label}: ${value}`;
  });

  return (
    <div className="w-[90%] mx-auto">
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500/20 text-green-400">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs text-white/50">澄清已完成</span>
        </div>
        <p className="mt-2 text-xs text-white/40 truncate">
          {summary.join(' | ')}
        </p>
      </div>
    </div>
  );
};

// ─── TimeoutClarification ────────────────────────────────────────
const TimeoutClarification: React.FC<{ clarification: ClarificationData }> = ({ clarification }) => {
  const { questions } = clarification;

  const defaults = questions
    .filter((q) => q.recommendedDefault || q.defaultValue)
    .map((q) => `${q.field.replace(/_/g, ' ')}: ${q.recommendedDefault || q.defaultValue}`);

  return (
    <div className="w-[90%] mx-auto">
      <div className="rounded-xl bg-amber-500/[0.03] border border-amber-500/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs">⏱</span>
          <span className="text-xs text-amber-300/70">已使用推荐选项继续</span>
        </div>
        {defaults.length > 0 && (
          <p className="mt-1.5 text-[11px] text-white/30">
            默认值: {defaults.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── DisabledClarification ───────────────────────────────────────
const DisabledClarification: React.FC<{ clarification: ClarificationData }> = ({ clarification }) => {
  const { questions, roundId } = clarification;

  const summary = questions.map((q) => {
    const label = q.field.replace(/_/g, ' ');
    const value = q.recommendedDefault || q.defaultValue || '已回答';
    return `${label}: ${value}`;
  });

  const rounds = useTaskStore((s) => s.clarificationRounds);
  const matchedRound = rounds.find((r) => r.roundId === roundId);
  const roundNum = matchedRound?.roundIndex || roundId?.match(/\d+/)?.[0] || '';

  return (
    <div className="w-[90%] mx-auto">
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 opacity-50">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-white/30">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs text-white/30">
            {roundNum ? `第 ${roundNum} 轮澄清` : '历史澄清'}
          </span>
        </div>
        <p className="mt-2 text-xs text-white/25 truncate">
          {summary.join(' | ')}
        </p>
      </div>
    </div>
  );
};
