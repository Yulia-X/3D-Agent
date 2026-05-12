import { ExperienceStore } from './store.js'
import { getDb } from '../db/connection.js'

const DEFAULT_EXPERIENCES = [
  {
    id: 'exp-001',
    conditions: {
      inputPattern: '.*透明.*玻璃.*',
      meshyEndpoint: 'text-to-3d',
      qualityIssue: 'texture_artifacts_on_transparent',
    },
    resolution: {
      strategy: 'add_constraint' as const,
      adjustedParams: { negative_prompt: 'opaque, solid color', art_style: 'realistic' },
      preventionRule: '透明材质时自动添加negative_prompt约束',
    },
    frequency: 47,
    successRate: 0.82,
    scope: 'global' as const,
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
      strategy: 'fallback_endpoint' as const,
      fallbackAction: '先Remesh修复非流形面，再重试Rigging',
      preventionRule: '人形角色在Rigging前强制插入Remesh步骤',
    },
    frequency: 23,
    successRate: 0.91,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { negative_prompt: 'deformed face, asymmetric eyes', topology: 'quad', target_polycount: 10000 },
      userMessage: '写实人脸建议使用较高面数以获得更好效果',
    },
    frequency: 35,
    successRate: 0.75,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { art_style: 'cartoon', negative_prompt: 'realistic, photorealistic' },
      preventionRule: '可爱风格自动切换为卡通艺术风格',
    },
    frequency: 62,
    successRate: 0.88,
    scope: 'global' as const,
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
      strategy: 'retry_with_params' as const,
      adjustedParams: { min_wall_thickness: 2.0 },
      fallbackAction: '自动修复薄壁问题后重新导出',
    },
    frequency: 18,
    successRate: 0.85,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { negative_prompt: 'floating parts, disconnected legs' },
      preventionRule: '家具类模型添加结构完整性约束',
    },
    frequency: 41,
    successRate: 0.79,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { art_style: 'low-poly', target_polycount: 500 },
      preventionRule: '低面数请求自动设置low-poly风格和500面上限',
    },
    frequency: 55,
    successRate: 0.92,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { art_style: 'realistic', negative_prompt: 'organic, soft', topology: 'quad' },
      preventionRule: '机甲类模型建议使用硬表面建模参数',
    },
    frequency: 28,
    successRate: 0.83,
    scope: 'global' as const,
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
      strategy: 'add_constraint' as const,
      adjustedParams: { resolution: 2048, art_style: 'realistic' },
      userMessage: '毛发纹理建议使用2048分辨率以获得更好细节',
    },
    frequency: 19,
    successRate: 0.77,
    scope: 'global' as const,
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
      strategy: 'user_guidance' as const,
      userMessage: 'FBX导出时动画数据可能丢失，建议使用GLB格式保留完整动画',
      preventionRule: '有动画的模型导出时提醒用户使用GLB',
    },
    frequency: 12,
    successRate: 0.95,
    scope: 'global' as const,
    createdAt: Date.now() - 3 * 24 * 3600000,
    lastHitAt: Date.now() - 6 * 3600000,
  },
]

/**
 * 插入预置经验数据
 * 检查DB是否为空，空则插入预置数据
 */
export function seedExperiences(store: ExperienceStore): void {
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) as cnt FROM experiences').get() as { cnt: number }

  if (count.cnt > 0) return

  const insertStmt = db.prepare(`
    INSERT INTO experiences (id, conditions, resolution, frequency, success_rate, scope, created_at, last_hit_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    for (const exp of DEFAULT_EXPERIENCES) {
      insertStmt.run(
        exp.id,
        JSON.stringify(exp.conditions),
        JSON.stringify(exp.resolution),
        exp.frequency,
        exp.successRate,
        exp.scope,
        exp.createdAt,
        exp.lastHitAt,
      )
    }
  })

  insertAll()
}
