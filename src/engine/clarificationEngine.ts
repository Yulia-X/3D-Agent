import { IntentParseResult, ClarificationDecision, ClarificationQuestion, UserProfile, ClarificationHistory, GenerationQuality, TeamConfig } from '../types';
import { shouldClarifyByCost } from './costModel';
import { resolveClarificationTarget } from './teamRouter';

// 模式策略配置
export const MODE_STRATEGY = {
  explore: {
    maxQuestions: 1,
    allowedPriorities: ['critical'] as const,
    timeout: 30000,
    timeoutBehavior: 'use_defaults_and_continue' as const,
  },
  edit: {
    maxQuestions: 2,
    allowedPriorities: ['critical', 'important'] as const,
    timeout: 120000,
    timeoutBehavior: 'use_defaults_and_mark' as const,
  },
  pipeline: {
    maxQuestions: 3,
    allowedPriorities: ['critical', 'important', 'nice_to_have'] as const,
    timeout: 0, // 不超时
    timeoutBehavior: 'block' as const,
  },
};

// 字段影响度配置
const FIELD_CONFIG: Record<string, { impact: 'high' | 'medium' | 'low'; threshold: number }> = {
  objectType: { impact: 'high', threshold: 0.6 },
  useCase: { impact: 'high', threshold: 0.4 },
  style: { impact: 'medium', threshold: 0.3 },
  topology: { impact: 'medium', threshold: 0.5 },
  textureSpec: { impact: 'low', threshold: 0.2 },
  outputFormat: { impact: 'low', threshold: 0.2 },
  polyBudget: { impact: 'low', threshold: 0.2 },
};

/**
 * 获取统一的策略（不再区分用户等级）
 */
function getStrategyForMode(_userProfile: UserProfile) {
  return MODE_STRATEGY.edit;
}

/**
 * 多层澄清决策引擎
 * 第一层：硬性规则过滤
 * 第二层：模式适配（基于用户等级选择策略）
 * 第三层：耐心度适配
 * 第四层：置信度阈值过滤
 * 第五层：成本过滤（新增）
 * 团队路由预处理（新增）
 * 多轮收敛控制（新增）
 */
export function decideClarification(
  parseResult: IntentParseResult,
  userProfile: UserProfile,
  retryCount: number,
  options?: {
    round?: number;           // 当前澄清轮次（默认0）
    answeredFields?: string[]; // 已回答的字段列表
    generationQuality?: GenerationQuality;  // 生成质量等级
    teamConfig?: TeamConfig | null;         // 团队配置
  }
): ClarificationDecision {
  const round = options?.round ?? 0;
  const answeredFields = options?.answeredFields ?? [];

  // === 多轮收敛控制：超过最大轮次，直接走默认值 ===
  if (round >= 2) {
    return {
      shouldClarify: false,
      questions: [],
      strategy: getStrategyForMode(userProfile),
      fallbackStrategy: 'use_defaults',
      reason: 'max_rounds_exceeded'
    };
  }

  const candidates = parseResult.clarificationQuestions;

  // 第一层：硬性规则过滤
  let filtered = candidates.filter(q => {
    // 重试次数在1-3次之间时不再追问（避免反复骚扰）
    if (retryCount > 0 && retryCount <= 3) return false;
    // 低影响度字段不追问
    if (q.impact === 'low') return false;
    // 用户已有稳定偏好的字段不追问
    if (userProfile.stablePreferences[q.field]) return false;
    return true;
  });

  // 第二层：模式适配（根据用户等级决定策略）
  const strategy = getStrategyForMode(userProfile);

  filtered = filtered.filter(q => {
    return (strategy.allowedPriorities as readonly string[]).includes(q.priority);
  });

  // 第三层：耐心度适配
  const tolerance = getUserTolerance(userProfile);
  const maxQuestions = tolerance <= 0.3 ? 1 : tolerance <= 0.7 ? 2 : 3;

  // 按priority排序取top N
  const priorityWeight = (p: string) => p === 'critical' ? 3 : p === 'important' ? 2 : 1;
  const sorted = filtered.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));

  // round=1时忽略maxQuestions限制，一次性问完所有剩余字段
  let limited: ClarificationQuestion[];
  if (round === 1) {
    // 过滤掉已回答的字段，问完所有剩余的
    limited = sorted.filter(q => !answeredFields.includes(q.field));
  } else {
    limited = sorted.slice(0, Math.min(maxQuestions, strategy.maxQuestions));
  }

  // 第四层：置信度阈值过滤
  let final = limited.filter(q => {
    const config = FIELD_CONFIG[q.field];
    if (!config) return false;
    const conf = parseResult.confidence[q.field] ?? 0;
    return conf < config.threshold;
  });

  // === 团队路由预处理 ===
  const teamConfig = options?.teamConfig ?? null;
  if (teamConfig) {
    // 对每个待澄清字段检查是否有项目默认值
    final = final.filter(q => {
      const target = resolveClarificationTarget('current-user', teamConfig, q.field);
      if (target.type === 'project_default' && target.value) {
        // 该字段有项目默认值，直接使用，不需要问
        return false;
      }
      return true;
    });
  }

  // === 第五层：成本过滤 ===
  const generationQuality = options?.generationQuality ?? 'standard';
  const costResult = shouldClarifyByCost(
    generationQuality,
    parseResult.confidence,
    userProfile
  );

  // 如果成本不合算且不是第二轮强制问，跳过澄清
  if (!costResult.shouldAsk && round === 0) {
    return {
      shouldClarify: false,
      questions: [],
      strategy,
      fallbackStrategy: 'use_defaults',
      reason: 'cost_not_justified'
    };
  }

  return {
    shouldClarify: final.length > 0,
    questions: final,
    strategy,
    fallbackStrategy: final.some(q => q.priority === 'critical') ? 'block' : 'use_defaults',
  };
}

/**
 * 计算用户对澄清问题的耐心度 (0-1)
 * 越高表示用户越愿意回答问题
 */
export function getUserTolerance(profile: UserProfile): number {
  let tolerance = 0.5;

  const history = profile.clarificationHistory;

  // 新用户给予更高容忍度
  if (profile.usageCount < 5) tolerance = 0.6;

  // 根据历史回答率调整
  const answerRate = history.answered / Math.max(history.asked, 1);
  if (answerRate > 0.8) tolerance += 0.15;
  if (answerRate < 0.3) tolerance -= 0.2;

  // 响应速度快 → 用户乐于交互
  if (history.avgResponseTime > 0 && history.avgResponseTime < 5000) tolerance += 0.1;
  // 响应速度慢 → 用户可能不耐烦
  if (history.avgResponseTime > 30000) tolerance -= 0.15;

  // 跳过次数多 → 降低容忍度
  if (history.skipped >= 3) tolerance -= 0.3;

  return Math.max(0, Math.min(1, tolerance));
}

/**
 * 获取字段的默认值（用于超时/跳过时的兜底）
 */
export function getDefaultValues(fields: string[]): Record<string, string> {
  const defaults: Record<string, string> = {
    objectType: '通用模型',
    style: '写实',
    useCase: '通用展示',
    topology: 'auto',
    polyBudget: '10000',
    textureSpec: 'PBR',
    outputFormat: 'glb',
  };
  const result: Record<string, string> = {};
  fields.forEach(f => { if (defaults[f]) result[f] = defaults[f]; });
  return result;
}

/**
 * 根据模式获取超时配置
 */
export function getTimeoutConfig(_userLevel: UserProfile['level']): {
  timeout: number;
  behavior: string;
} {
  return {
    timeout: MODE_STRATEGY.edit.timeout,
    behavior: MODE_STRATEGY.edit.timeoutBehavior,
  };
}
