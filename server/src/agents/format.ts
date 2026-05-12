import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class FormatAgent extends BaseAgent {
  readonly type = 'format'
  readonly name = '格式转换Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交格式转换任务')

    const targetFormat = inputs.targetFormat || 'glb'
    const taskId = await meshyClient.remesh({
      input_task_id: inputs.inputTaskId,
      model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
      target_formats: [targetFormat],
      convert_format_only: true,
    })

    onProgress?.(20, '等待格式转换')

    try {
      const result = await taskPoller.pollUntilDone(taskId, 'remesh', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '格式转换完成')
      return this.successResult(
        {
          modelUrl: result.model_urls?.[targetFormat] || '',
          format: targetFormat,
        },
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '格式转换失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    }
  }
}

export const formatAgent = new FormatAgent()
