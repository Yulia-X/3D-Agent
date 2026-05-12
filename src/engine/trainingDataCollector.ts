/**
 * 澄清数据反哺意图解析模型
 * 收集每次澄清产生的标注数据，用于持续优化意图解析
 * 
 * 数据格式: { prompt, missing_field, correct_value, user_level, timestamp }
 * 存储: localStorage，上限500条
 * 反哺逻辑: 相同 prompt→field→value 出现3次以上则自动提升置信度
 */
import { TrainingSample, UserProfile } from '../types'

const TRAINING_DATA_KEY = '3d-agent-training-data'
const MAX_SAMPLES = 500
const PATTERN_THRESHOLD = 3  // 同一模式出现3次以上才反哺
const CONFIDENCE_BOOST = 0.7  // 反哺后的置信度提升目标

/**
 * 加载所有训练数据
 */
function loadSamples(): TrainingSample[] {
  try {
    const stored = localStorage.getItem(TRAINING_DATA_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * 保存训练数据
 */
function saveSamples(samples: TrainingSample[]): void {
  try {
    localStorage.setItem(TRAINING_DATA_KEY, JSON.stringify(samples))
  } catch {
    // Storage full, trim oldest 20%
    const trimmed = samples.slice(Math.floor(samples.length * 0.2))
    try {
      localStorage.setItem(TRAINING_DATA_KEY, JSON.stringify(trimmed))
    } catch {
      // Give up
    }
  }
}

/**
 * 生成样本ID
 */
function generateSampleId(): string {
  return `sample-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 收集一条标注样本
 * 每次用户回答澄清问题时调用
 */
export function collectSample(
  prompt: string,
  missingField: string,
  correctValue: string,
  userProfile: UserProfile,
  variantId?: string
): TrainingSample {
  const samples = loadSamples()
  
  const sample: TrainingSample = {
    id: generateSampleId(),
    prompt: normalizePrompt(prompt),
    missingField,
    correctValue,
    userLevel: userProfile.level,
    timestamp: Date.now(),
    variantId
  }
  
  samples.push(sample)
  
  // 超过上限时移除最旧的
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES)
  }
  
  saveSamples(samples)
  return sample
}

/**
 * 标准化prompt（去除首尾空格、转小写、去除多余空格）
 * 用于模式匹配时的一致性
 */
function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * 提取prompt中的关键实体（简单分词）
 * 用于模糊匹配类似的prompt
 */
function extractKeyTerms(prompt: string): string[] {
  const normalized = normalizePrompt(prompt)
  // 移除常见停用词
  const stopWords = ['做', '一个', '生成', '创建', '我想', '帮我', '给我', '要', '的', '了', '吗', '请']
  return normalized.split(' ').filter(word => 
    word.length > 0 && !stopWords.includes(word)
  )
}

/**
 * 计算两个prompt的相似度（基于关键词重叠）
 */
function promptSimilarity(prompt1: string, prompt2: string): number {
  const terms1 = extractKeyTerms(prompt1)
  const terms2 = extractKeyTerms(prompt2)
  
  if (terms1.length === 0 || terms2.length === 0) return 0
  
  const set1 = new Set(terms1)
  const set2 = new Set(terms2)
  const intersection = [...set1].filter(t => set2.has(t))
  const union = new Set([...set1, ...set2])
  
  return intersection.length / union.size  // Jaccard similarity
}

/**
 * 核心反哺函数：基于历史数据增强意图解析
 * 返回可以自动填充的字段及其置信度
 * 
 * 逻辑：
 * 1. 找到与当前prompt相似（相似度>0.6）的历史样本
 * 2. 对每个missing_field，统计correct_value的分布
 * 3. 如果某个value出现次数 >= PATTERN_THRESHOLD，则推荐该值
 */
export function applyLearnedPatterns(
  prompt: string
): Record<string, { value: string; confidence: number; sampleCount: number }> {
  const samples = loadSamples()
  if (samples.length === 0) return {}

  const result: Record<string, { value: string; confidence: number; sampleCount: number }> = {}
  
  // 找相似样本
  const similarSamples = samples.filter(s => promptSimilarity(prompt, s.prompt) > 0.6)
  
  if (similarSamples.length === 0) return {}
  
  // 按字段分组统计
  const fieldValues: Record<string, Record<string, number>> = {}
  for (const sample of similarSamples) {
    if (!fieldValues[sample.missingField]) {
      fieldValues[sample.missingField] = {}
    }
    const values = fieldValues[sample.missingField]
    values[sample.correctValue] = (values[sample.correctValue] || 0) + 1
  }
  
  // 对每个字段找最高频值
  for (const [field, values] of Object.entries(fieldValues)) {
    let maxValue = ''
    let maxCount = 0
    
    for (const [value, count] of Object.entries(values)) {
      if (count > maxCount) {
        maxCount = count
        maxValue = value
      }
    }
    
    // 达到阈值才推荐
    if (maxCount >= PATTERN_THRESHOLD) {
      // 置信度基于出现次数和一致性
      const consistency = maxCount / Object.values(values).reduce((a, b) => a + b, 0)
      const confidence = Math.min(
        CONFIDENCE_BOOST + (maxCount - PATTERN_THRESHOLD) * 0.05,
        0.9
      ) * consistency
      
      result[field] = {
        value: maxValue,
        confidence: Math.round(confidence * 100) / 100,
        sampleCount: maxCount
      }
    }
  }
  
  return result
}

/**
 * 导出训练数据为JSON字符串（用于外部微调）
 */
export function exportTrainingData(): string {
  const samples = loadSamples()
  return JSON.stringify(samples, null, 2)
}

/**
 * 获取数据统计
 */
export function getDataStats(): {
  total: number
  byField: Record<string, number>
  recentRate: number  // 最近7天每天平均采集数
  oldestSample: number | null
  newestSample: number | null
} {
  const samples = loadSamples()
  
  const byField: Record<string, number> = {}
  for (const sample of samples) {
    byField[sample.missingField] = (byField[sample.missingField] || 0) + 1
  }
  
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentSamples = samples.filter(s => s.timestamp > sevenDaysAgo)
  const recentRate = recentSamples.length / 7
  
  return {
    total: samples.length,
    byField,
    recentRate: Math.round(recentRate * 10) / 10,
    oldestSample: samples.length > 0 ? samples[0].timestamp : null,
    newestSample: samples.length > 0 ? samples[samples.length - 1].timestamp : null
  }
}

/**
 * 清除所有训练数据（调试用）
 */
export function clearTrainingData(): void {
  localStorage.removeItem(TRAINING_DATA_KEY)
}
