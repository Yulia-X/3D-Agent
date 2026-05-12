/**
 * 错误经验库（前端mock）
 * 预置常见经验条目，支持查询和记录
 */
import { ExperienceEntry, ExperienceQuery } from '../types'

const EXPERIENCE_STORAGE_KEY = '3d-agent-experience-store'

// 预置经验条目
const DEFAULT_EXPERIENCES: ExperienceEntry[] = [
  {
    id: 'exp-001',
    conditions: {
      inputPattern: '.*透明.*玻璃.*',
      meshyEndpoint: 'text-to-3d',
      qualityIssue: 'texture_artifacts_on_transparent',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { negative_prompt: 'opaque, solid color', art_style: 'realistic' },
      preventionRule: '透明材质时自动添加negative_prompt约束',
    },
    frequency: 47,
    successRate: 0.82,
    scope: 'global',
    createdAt: Date.now() - 30 * 24 * 3600000,
    lastHitAt: Date.now() - 2 * 24 * 3600000,
  },
  {
    id: 'exp-002',
    conditions: {
      inputPattern: '.*人形.*角色.*',
      meshyEndpoint: 'rigging',
      errorType: 'non_manifold_mesh',
    },
    resolution: {
      strategy: 'fallback_endpoint',
      fallbackAction: '先Remesh修复非流形面，再重试Rigging',
      preventionRule: '人形角色在Rigging前强制插入Remesh步骤',
    },
    frequency: 23,
    successRate: 0.91,
    scope: 'global',
    createdAt: Date.now() - 20 * 24 * 3600000,
    lastHitAt: Date.now() - 1 * 24 * 3600000,
  },
  {
    id: 'exp-003',
    conditions: {
      inputPattern: '.*写实.*人脸.*',
      meshyEndpoint: 'text-to-3d',
      qualityIssue: 'uncanny_valley_face',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { negative_prompt: 'deformed face, asymmetric eyes', topology: 'quad', target_polycount: 10000 },
      userMessage: '写实人脸建议使用较高面数以获得更好效果',
    },
    frequency: 35,
    successRate: 0.75,
    scope: 'global',
    createdAt: Date.now() - 25 * 24 * 3600000,
    lastHitAt: Date.now() - 3 * 24 * 3600000,
  },
  {
    id: 'exp-004',
    conditions: {
      inputPattern: '.*小.*可爱.*',
      objectType: 'character',
      meshyEndpoint: 'text-to-3d',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { art_style: 'cartoon', negative_prompt: 'realistic, photorealistic' },
      preventionRule: '可爱风格自动切换为卡通艺术风格',
    },
    frequency: 62,
    successRate: 0.88,
    scope: 'global',
    createdAt: Date.now() - 15 * 24 * 3600000,
    lastHitAt: Date.now() - 1 * 3600000,
  },
  {
    id: 'exp-005',
    conditions: {
      inputPattern: '.*3D打印.*',
      meshyEndpoint: 'analyze-printability',
      errorType: 'thin_walls',
    },
    resolution: {
      strategy: 'retry_with_params',
      adjustedParams: { min_wall_thickness: 2.0 },
      fallbackAction: '自动修复薄壁问题后重新导出',
    },
    frequency: 18,
    successRate: 0.85,
    scope: 'global',
    createdAt: Date.now() - 10 * 24 * 3600000,
    lastHitAt: Date.now() - 5 * 24 * 3600000,
  },
  {
    id: 'exp-006',
    conditions: {
      inputPattern: '.*椅子.*',
      meshyEndpoint: 'text-to-3d',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { negative_prompt: 'floating parts, disconnected legs' },
      preventionRule: '家具类模型添加结构完整性约束',
    },
    frequency: 41,
    successRate: 0.79,
    scope: 'global',
    createdAt: Date.now() - 12 * 24 * 3600000,
    lastHitAt: Date.now() - 4 * 3600000,
  },
  {
    id: 'exp-007',
    conditions: {
      inputPattern: '.*低面数.*',
      meshyEndpoint: 'text-to-3d',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { art_style: 'low-poly', target_polycount: 500 },
      preventionRule: '低面数请求自动设置low-poly风格和500面上限',
    },
    frequency: 55,
    successRate: 0.92,
    scope: 'global',
    createdAt: Date.now() - 8 * 24 * 3600000,
    lastHitAt: Date.now() - 2 * 3600000,
  },
  {
    id: 'exp-008',
    conditions: {
      inputPattern: '.*机甲.*赛博朋克.*',
      meshyEndpoint: 'text-to-3d',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { art_style: 'realistic', negative_prompt: 'organic, soft', topology: 'quad' },
      preventionRule: '机甲类模型建议使用硬表面建模参数',
    },
    frequency: 28,
    successRate: 0.83,
    scope: 'global',
    createdAt: Date.now() - 6 * 24 * 3600000,
    lastHitAt: Date.now() - 12 * 3600000,
  },
  {
    id: 'exp-009',
    conditions: {
      inputPattern: '.*动物.*毛发.*',
      meshyEndpoint: 'retexture',
      qualityIssue: 'fur_texture_flat',
    },
    resolution: {
      strategy: 'add_constraint',
      adjustedParams: { resolution: 2048, art_style: 'realistic' },
      userMessage: '毛发纹理建议使用2048分辨率以获得更好细节',
    },
    frequency: 19,
    successRate: 0.77,
    scope: 'global',
    createdAt: Date.now() - 5 * 24 * 3600000,
    lastHitAt: Date.now() - 8 * 3600000,
  },
  {
    id: 'exp-010',
    conditions: {
      inputPattern: '.*导出.*FBX.*',
      meshyEndpoint: 'format-convert',
      errorType: 'animation_lost',
    },
    resolution: {
      strategy: 'user_guidance',
      userMessage: 'FBX导出时动画数据可能丢失，建议使用GLB格式保留完整动画',
      preventionRule: '有动画的模型导出时提醒用户使用GLB',
    },
    frequency: 12,
    successRate: 0.95,
    scope: 'global',
    createdAt: Date.now() - 3 * 24 * 3600000,
    lastHitAt: Date.now() - 6 * 3600000,
  },
]

/**
 * 加载经验库
 */
function loadExperiences(): ExperienceEntry[] {
  try {
    const stored = localStorage.getItem(EXPERIENCE_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  // 首次使用预置数据
  saveExperiences(DEFAULT_EXPERIENCES)
  return DEFAULT_EXPERIENCES
}

function saveExperiences(entries: ExperienceEntry[]) {
  try {
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

/**
 * 查询经验库：给定条件返回匹配的经验条目
 */
export function queryExperience(query: ExperienceQuery): ExperienceEntry[] {
  const experiences = loadExperiences()
  
  return experiences.filter(exp => {
    // 匹配输入模式
    if (query.inputPattern && exp.conditions.inputPattern) {
      try {
        const regex = new RegExp(exp.conditions.inputPattern, 'i')
        if (!regex.test(query.inputPattern)) return false
      } catch {
        if (!query.inputPattern.includes(exp.conditions.inputPattern)) return false
      }
    }
    
    // 匹配对象类型
    if (query.objectType && exp.conditions.objectType) {
      if (exp.conditions.objectType !== query.objectType) return false
    }
    
    // 匹配API端点
    if (query.meshyEndpoint && exp.conditions.meshyEndpoint) {
      if (exp.conditions.meshyEndpoint !== query.meshyEndpoint) return false
    }
    
    // 匹配错误类型
    if (query.errorType && exp.conditions.errorType) {
      if (exp.conditions.errorType !== query.errorType) return false
    }
    
    return true
  }).sort((a, b) => b.successRate - a.successRate)  // 按成功率排序
}

/**
 * 记录新经验
 */
export function recordExperience(entry: Omit<ExperienceEntry, 'id' | 'frequency' | 'createdAt' | 'lastHitAt'>): ExperienceEntry {
  const experiences = loadExperiences()
  
  const newEntry: ExperienceEntry = {
    ...entry,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    frequency: 1,
    createdAt: Date.now(),
    lastHitAt: Date.now(),
  }
  
  experiences.push(newEntry)
  saveExperiences(experiences)
  return newEntry
}

/**
 * 更新经验命中频率
 */
export function hitExperience(id: string): void {
  const experiences = loadExperiences()
  const exp = experiences.find(e => e.id === id)
  if (exp) {
    exp.frequency++
    exp.lastHitAt = Date.now()
    saveExperiences(experiences)
  }
}

/**
 * 获取所有经验（调试用）
 */
export function getAllExperiences(): ExperienceEntry[] {
  return loadExperiences()
}
