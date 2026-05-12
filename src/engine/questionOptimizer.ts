/**
 * 澄清问题A/B优化器
 * 为同一字段维护多种问法变体，基于Thompson Sampling选择最优措辞
 * 跟踪回答率/耗时/跳过率，低效措辞自动下线
 */
import { QuestionVariant, VariantStats, ClarificationOption } from '../types'

const VARIANTS_STORAGE_KEY = '3d-agent-question-variants'
const RETIREMENT_THRESHOLD = 0.5  // 回答率低于50%自动下线
const MIN_SAMPLES = 10  // 至少展示10次才评估

// 默认变体库
const DEFAULT_VARIANTS: Omit<QuestionVariant, 'stats' | 'retired' | 'createdAt'>[] = [
  // objectType 变体
  { id: 'obj-v1', field: 'objectType', question: '你想生成什么类型的3D模型？', options: [
    { label: '角色/人物', value: 'character' },
    { label: '道具/物品', value: 'prop' },
    { label: '场景/环境', value: 'environment' },
    { label: '载具/机械', value: 'vehicle' }
  ]},
  { id: 'obj-v2', field: 'objectType', question: '这个模型属于哪个类别？', options: [
    { label: '人物角色', value: 'character' },
    { label: '静态物体', value: 'prop' },
    { label: '环境场景', value: 'environment' },
    { label: '交通工具', value: 'vehicle' }
  ]},
  { id: 'obj-v3', field: 'objectType', question: '帮我确认一下，你需要生成的是？', options: [
    { label: '👤 角色', value: 'character' },
    { label: '📦 物品', value: 'prop' },
    { label: '🏔️ 场景', value: 'environment' },
    { label: '🚗 载具', value: 'vehicle' }
  ]},

  // style 变体
  { id: 'style-v1', field: 'style', question: '你偏好什么视觉风格？', options: [
    { label: '写实', value: 'realistic' },
    { label: '卡通', value: 'cartoon' },
    { label: '低面数', value: 'lowpoly' },
    { label: '风格化', value: 'stylized' }
  ]},
  { id: 'style-v2', field: 'style', question: '这个模型的艺术风格是？', options: [
    { label: '照片级写实', value: 'realistic' },
    { label: '卡通渲染', value: 'cartoon' },
    { label: 'Low-Poly', value: 'lowpoly' },
    { label: '手绘风', value: 'stylized' }
  ]},
  { id: 'style-v3', field: 'style', question: '想要什么样的视觉效果？', options: [
    { label: '🎯 真实感', value: 'realistic' },
    { label: '🎨 卡通', value: 'cartoon' },
    { label: '💎 低多边形', value: 'lowpoly' },
    { label: '✨ 艺术风格', value: 'stylized' }
  ]},

  // useCase 变体
  { id: 'use-v1', field: 'useCase', question: '这个模型打算用在什么场景？', options: [
    { label: '游戏资产', value: 'game_asset' },
    { label: '产品展示', value: 'product_display' },
    { label: '3D打印', value: '3d_print' },
    { label: '影视动画', value: 'film_animation' }
  ]},
  { id: 'use-v2', field: 'useCase', question: '模型的最终用途是什么？', options: [
    { label: '游戏引擎', value: 'game_asset' },
    { label: '电商/展示', value: 'product_display' },
    { label: '实体打印', value: '3d_print' },
    { label: 'CG/动画', value: 'film_animation' }
  ]},
  { id: 'use-v3', field: 'useCase', question: '你会在哪里使用这个模型？', options: [
    { label: '🎮 游戏', value: 'game_asset' },
    { label: '🛍️ 展示', value: 'product_display' },
    { label: '🖨️ 打印', value: '3d_print' },
    { label: '🎬 影视', value: 'film_animation' }
  ]},

  // topology 变体
  { id: 'topo-v1', field: 'topology', question: '对拓扑结构有要求吗？', options: [
    { label: '四边面（动画用）', value: 'quad' },
    { label: '三角面（游戏用）', value: 'tri' },
    { label: '自动选择', value: 'auto' }
  ]},
  { id: 'topo-v2', field: 'topology', question: '网格拓扑偏好？', options: [
    { label: 'Quad Mesh', value: 'quad' },
    { label: 'Triangle Mesh', value: 'tri' },
    { label: '不限制', value: 'auto' }
  ]},
]

/**
 * 初始化变体并加载存储
 */
function loadVariants(): QuestionVariant[] {
  try {
    const stored = localStorage.getItem(VARIANTS_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // fallthrough
  }
  
  // 初始化默认变体
  const variants: QuestionVariant[] = DEFAULT_VARIANTS.map(v => ({
    ...v,
    stats: { shown: 0, answered: 0, skipped: 0, avgTime: 0 },
    retired: false,
    createdAt: Date.now()
  }))
  
  saveVariants(variants)
  return variants
}

function saveVariants(variants: QuestionVariant[]): void {
  try {
    localStorage.setItem(VARIANTS_STORAGE_KEY, JSON.stringify(variants))
  } catch {
    // Storage unavailable
  }
}

/**
 * Thompson Sampling: 使用Beta分布采样选择变体
 * 成功=answered, 失败=skipped
 */
function thompsonSample(variant: QuestionVariant): number {
  const alpha = variant.stats.answered + 1
  const beta = variant.stats.skipped + 1
  // 简化的Beta分布采样（使用Jitter近似）
  return betaSample(alpha, beta)
}

function betaSample(alpha: number, beta: number): number {
  // 使用Box-Muller近似Beta分布
  // 对于简单场景，使用mean + noise即可
  const mean = alpha / (alpha + beta)
  const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1))
  const noise = (Math.random() - 0.5) * Math.sqrt(variance) * 2
  return Math.max(0, Math.min(1, mean + noise))
}

/**
 * 为指定字段选择最优问法变体
 */
export function selectVariant(field: string, userLevel?: string): QuestionVariant | null {
  const variants = loadVariants()
  const eligible = variants.filter(v => v.field === field && !v.retired)
  
  if (eligible.length === 0) return null
  if (eligible.length === 1) return eligible[0]
  
  // Thompson Sampling选择
  let bestVariant = eligible[0]
  let bestScore = -1
  
  for (const variant of eligible) {
    const score = thompsonSample(variant)
    if (score > bestScore) {
      bestScore = score
      bestVariant = variant
    }
  }
  
  // 记录展示
  bestVariant.stats.shown++
  saveVariants(variants)
  
  return bestVariant
}

/**
 * 记录变体结果
 */
export function recordOutcome(
  variantId: string,
  outcome: { answered: boolean; responseTime?: number; skipped: boolean }
): void {
  const variants = loadVariants()
  const variant = variants.find(v => v.id === variantId)
  
  if (!variant) return
  
  if (outcome.answered) {
    variant.stats.answered++
    if (outcome.responseTime) {
      // 增量平均
      const total = variant.stats.answered
      variant.stats.avgTime = variant.stats.avgTime + (outcome.responseTime - variant.stats.avgTime) / total
    }
  }
  
  if (outcome.skipped) {
    variant.stats.skipped++
  }
  
  saveVariants(variants)
  
  // 每次记录后检查是否需要淘汰
  retireUnderperformers()
}

/**
 * 淘汰低效变体
 * 回答率 < 50% 且已展示超过MIN_SAMPLES次的变体自动下线
 */
export function retireUnderperformers(): void {
  const variants = loadVariants()
  let changed = false
  
  for (const variant of variants) {
    if (variant.retired) continue
    if (variant.stats.shown < MIN_SAMPLES) continue
    
    const answerRate = variant.stats.answered / variant.stats.shown
    if (answerRate < RETIREMENT_THRESHOLD) {
      // 确保同field还有其他活跃变体
      const activeCount = variants.filter(v => v.field === variant.field && !v.retired && v.id !== variant.id).length
      if (activeCount >= 1) {
        variant.retired = true
        changed = true
      }
    }
  }
  
  if (changed) {
    saveVariants(variants)
  }
}

/**
 * 获取所有变体统计
 */
export function getVariantStats(): Record<string, QuestionVariant[]> {
  const variants = loadVariants()
  const grouped: Record<string, QuestionVariant[]> = {}
  
  for (const variant of variants) {
    if (!grouped[variant.field]) {
      grouped[variant.field] = []
    }
    grouped[variant.field].push(variant)
  }
  
  return grouped
}

/**
 * 获取指定字段的活跃变体数量
 */
export function getActiveVariantCount(field: string): number {
  const variants = loadVariants()
  return variants.filter(v => v.field === field && !v.retired).length
}
