import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class RiggingAgent extends BaseAgent {
  readonly type = 'rigging'
  readonly name = '骨骼绑定Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交骨骼绑定任务')

    const taskId = await meshyClient.rigging({
      input_task_id: inputs.inputTaskId,
      model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
      height_meters: inputs.heightMeters || 1.7,
    })

    onProgress?.(20, '等待骨骼绑定')

    try {
      const result = await taskPoller.pollUntilDone(taskId, 'rigging', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '骨骼绑定完成')
      return this.successResult(
        {
          modelUrl: result.result?.rigged_character_glb_url || '',
          rigTaskId: taskId,
          basicAnimations: result.result?.basic_animations || null,
        },
        { duration: Date.now() - startTime, creditsCost: 3, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '骨骼绑定失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    }
  }
}

export const riggingAgent = new RiggingAgent()
