import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class MeshAgent extends BaseAgent {
  readonly type = 'mesh'
  readonly name = '网格Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交网格优化任务')

    const taskId = await meshyClient.remesh({
      input_task_id: inputs.inputTaskId,
      model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
      topology: inputs.topology || 'triangle',
      target_polycount: inputs.targetPolycount || 30000,
      target_formats: inputs.targetFormats || ['glb'],
    })

    onProgress?.(20, '等待网格处理')

    try {
      const result = await taskPoller.pollUntilDone(taskId, 'remesh', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '网格优化完成')
      return this.successResult(
        {
          modelUrl: result.model_urls?.glb || '',
        },
        { duration: Date.now() - startTime, creditsCost: 2, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '网格处理失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    }
  }
}

export const meshAgent = new MeshAgent()
