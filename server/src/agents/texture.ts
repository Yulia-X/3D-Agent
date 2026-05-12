import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class TextureAgent extends BaseAgent {
  readonly type = 'texture'
  readonly name = '材质Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交材质任务')

    const taskId = await meshyClient.retexture({
      input_task_id: inputs.inputTaskId,
      model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
      text_style_prompt: inputs.prompt || inputs.textStylePrompt,
      image_style_url: inputs.imageStyleUrl,
      ai_model: inputs.aiModel || 'latest',
      enable_pbr: inputs.enablePbr || false,
      enable_original_uv: inputs.enableOriginalUv !== false,
      target_formats: ['glb'],
    })

    onProgress?.(20, '等待材质处理')

    try {
      const result = await taskPoller.pollUntilDone(taskId, 'retexture', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '材质完成')
      return this.successResult(
        {
          modelUrl: result.model_urls?.glb || '',
          formats: result.model_urls || {},
          textureUrls: result.texture_urls,
          thumbnailUrl: result.thumbnail_url || '',
        },
        { duration: Date.now() - startTime, creditsCost: 2, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '材质处理失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
      )
    }
  }
}

export const textureAgent = new TextureAgent()
