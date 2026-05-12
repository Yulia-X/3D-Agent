import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class AnimationAgent extends BaseAgent {
  readonly type = 'animation'
  readonly name = '动画Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交动画任务')

    const taskId = await meshyClient.animation({
      rig_task_id: inputs.rigTaskId,
      action_id: inputs.actionId || 92,
      post_process: inputs.postProcess,
    })

    onProgress?.(20, '等待动画生成')

    try {
      const result = await taskPoller.pollUntilDone(taskId, 'animation', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '动画生成完成')
      return this.successResult(
        {
          modelUrl: result.result?.animation_glb_url || '',
          animationFbxUrl: result.result?.animation_fbx_url || '',
        },
        { duration: Date.now() - startTime, creditsCost: 4, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '动画生成失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    }
  }
}

export const animationAgent = new AnimationAgent()
