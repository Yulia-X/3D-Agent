/**
 * 成本感知触发模型
 * 计算"预期浪费成本 vs 澄清成本"，决定是否值得澄清
 */
import { GenerationQuality, CostConfig, UserProfile } from '../types'

// 默认成本配置
const DEFAULT_COST_CONFIG: CostConfig = {
  creditCosts: { preview: 1, standard: 4, high: 8 },
  timeCostFactor: 0.1,  // 每秒用户时间折算为0.1积分
  satisfactionWeights: {
    objectType: 0.35,
    style: 0.25,
    useCase: 0.20,
    topology: 0.08,
    polyBudget: 0.05,
    textureSpec: 0.04,
    format: 0.03
  }
}

/**
 * 估算生成成本（积分）
 */
export function estimateGenerationCost(
  quality: GenerationQuality,
  config: CostConfig = DEFAULT_COST_CONFIG
): number {
  return config.creditCosts[quality]
}

/**
 * 基于各字段置信度估算用户满意概率
 * 所有字段置信度加权平均，映射到0-1
 */
export function estimateSatisfactionProbability(
  confidence: Record<string, number>,
  config: CostConfig = DEFAULT_COST_CONFIG
): number {
  let weightedSum = 0
  let totalWeight = 0
  
  for (const [field, weight] of Object.entries(config.satisfactionWeights)) {
    const fieldConfidence = confidence[field] ?? 0.5  // 未解析字段默认0.5
    weightedSum += fieldConfidence * weight
    totalWeight += weight
  }
  
  if (totalWeight === 0) return 0.5
  
  // 非线性映射：低置信度区间惩罚更大
  const rawProb = weightedSum / totalWeight
  return Math.pow(rawProb, 1.5)  // 幂次让低值更低，高值相对保持
}

/**
 * 估算澄清成本（等待用户回答的时间折算为积分）
 */
export function estimateClarificationCost(
  userProfile: UserProfile,
  config: CostConfig = DEFAULT_COST_CONFIG
): number {
  const avgResponseTime = userProfile.clarificationHistory?.avgResponseTime || 15000 // ms
  const avgSeconds = avgResponseTime / 1000
  return avgSeconds * config.timeCostFactor
}

/**
 * 核心决策：是否值得澄清
 * expectedWaste = generationCost × (1 - satisfactionProbability)
 * clarificationCost = avgResponseTime × timeCostFactor
 * 只有 expectedWaste > clarificationCost 时才值得问
 */
export function shouldClarifyByCost(
  generationQuality: GenerationQuality,
  confidence: Record<string, number>,
  userProfile: UserProfile,
  config: CostConfig = DEFAULT_COST_CONFIG
): { shouldAsk: boolean; expectedWaste: number; clarificationCost: number; ratio: number } {
  const generationCost = estimateGenerationCost(generationQuality, config)
  const satisfactionProb = estimateSatisfactionProbability(confidence, config)
  const expectedWaste = generationCost * (1 - satisfactionProb)
  const clarificationCost = estimateClarificationCost(userProfile, config)
  
  return {
    shouldAsk: expectedWaste > clarificationCost,
    expectedWaste,
    clarificationCost,
    ratio: clarificationCost > 0 ? expectedWaste / clarificationCost : Infinity
  }
}

export { DEFAULT_COST_CONFIG }
