import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'

export class QualityAgent extends BaseAgent {
  readonly type = 'quality'
  readonly name = '质量检测Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints({}, experienceHints)

    onProgress?.(10, '开始质量检测')

    const issues: string[] = []
    let qualityScore = 1.0

    // 检查面数是否在预期范围
    onProgress?.(30, '检查面数')
    const polyCount = inputs.polyCount as number | undefined
    const expectedMin = inputs.expectedPolyMin || 1000
    const expectedMax = inputs.expectedPolyMax || 500000
    if (polyCount !== undefined) {
      if (polyCount < expectedMin) {
        issues.push(`面数过低: ${polyCount} (期望最少 ${expectedMin})`)
        qualityScore -= 0.2
      } else if (polyCount > expectedMax) {
        issues.push(`面数过高: ${polyCount} (期望最多 ${expectedMax})`)
        qualityScore -= 0.15
      }
    }

    // 检查是否有非流形面（模拟检测）
    onProgress?.(50, '检查非流形面')
    const hasNonManifold = inputs.hasNonManifold as boolean | undefined
    if (hasNonManifold) {
      issues.push('检测到非流形面，可能导致3D打印或渲染问题')
      qualityScore -= 0.25
    }

    // 检查UV展开完整性（模拟检测）
    onProgress?.(70, '检查UV展开')
    const uvCoverage = inputs.uvCoverage as number | undefined
    if (uvCoverage !== undefined && uvCoverage < 0.9) {
      issues.push(`UV展开覆盖率不足: ${(uvCoverage * 100).toFixed(1)}% (期望 ≥90%)`)
      qualityScore -= 0.2
    }

    // 检查模型尺寸合理性
    onProgress?.(85, '检查模型尺寸')
    const dimensions = inputs.dimensions as { x: number; y: number; z: number } | undefined
    if (dimensions) {
      const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z)
      const minDim = Math.min(dimensions.x, dimensions.y, dimensions.z)
      if (maxDim / minDim > 100) {
        issues.push('模型比例异常，可能存在极端拉伸')
        qualityScore -= 0.15
      }
    }

    // 确保分数在 0-1 范围内
    qualityScore = Math.max(0, Math.min(1, qualityScore))

    const passed = qualityScore >= constraints.qualityThreshold

    onProgress?.(100, passed ? '质量检测通过' : '质量检测未通过')

    return this.successResult(
      {
        qualityScore,
        passed,
        issues,
        details: {
          polyCount: polyCount ?? 'unknown',
          hasNonManifold: hasNonManifold ?? false,
          uvCoverage: uvCoverage ?? 'unknown',
          dimensions: dimensions ?? 'unknown',
        },
      },
      {
        duration: Date.now() - startTime,
        creditsCost: 0,
        meshyTaskId: 'local-quality-check',
        qualityScore,
      }
    )
  }
}

export const qualityAgent = new QualityAgent()
