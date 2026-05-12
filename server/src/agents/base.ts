import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'

export type ProgressCallback = (progress: number, step: string) => void

export abstract class BaseAgent {
  abstract readonly type: string
  abstract readonly name: string

  /**
   * 执行子任务
   * @param inputs - 任务输入参数（modelUrl, prompt等）
   * @param constraints - 约束（最大积分、最大时长、质量阈值）
   * @param experienceHints - 经验库匹配的提示
   * @param onProgress - 进度回调
   */
  abstract execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult>

  /**
   * 应用经验提示：根据经验条目调整参数
   */
  protected applyExperienceHints(
    params: Record<string, any>,
    hints: ExperienceEntry[]
  ): Record<string, any> {
    let adjusted = { ...params }
    for (const hint of hints) {
      if (hint.resolution.adjustedParams) {
        adjusted = { ...adjusted, ...hint.resolution.adjustedParams }
      }
    }
    return adjusted
  }

  /**
   * 构建成功结果
   */
  protected successResult(
    outputs: Record<string, any>,
    meta: { duration: number; creditsCost: number; meshyTaskId: string; qualityScore?: number }
  ): SubTaskResult {
    return { status: 'success', outputs, metadata: meta }
  }

  /**
   * 构建失败结果
   */
  protected failedResult(
    error: string,
    meta: { duration: number; creditsCost: number; meshyTaskId: string }
  ): SubTaskResult {
    return { status: 'failed', outputs: { error }, metadata: meta }
  }
}
