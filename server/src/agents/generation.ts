import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class GenerationAgent extends BaseAgent {
  readonly type = 'generation'
  readonly name = '3D生成Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    onProgress?.(10, '提交生成任务')

    const mode = inputs.mode || 'preview'

    try {
      let taskId: string
      let result: any

      if (mode === 'refine' && inputs.previewTaskId) {
        // Refine 模式
        taskId = await meshyClient.textTo3DRefine({
          mode: 'refine',
          preview_task_id: inputs.previewTaskId,
          enable_pbr: inputs.enablePbr || false,
          texture_prompt: inputs.texturePrompt,
          ai_model: inputs.aiModel || 'latest',
          target_formats: ['glb'],
        })

        onProgress?.(20, '等待精细化生成')
        result = await taskPoller.pollUntilDone(taskId, 'text-to-3d', (progress, status) => {
          onProgress?.(20 + progress * 0.7, status)
        })

        onProgress?.(100, '精细化生成完成')
        return this.successResult(
          {
            modelUrl: result.model_urls?.glb || '',
            formats: result.model_urls || {},
            thumbnailUrl: result.thumbnail_url || '',
            textureUrls: result.texture_urls,
            previewTaskId: inputs.previewTaskId,
          },
          { duration: Date.now() - startTime, creditsCost: 3, meshyTaskId: taskId }
        )
      } else if (inputs.imageUrl) {
        // Image-to-3D 模式
        taskId = await meshyClient.imageTo3D({
          image_url: inputs.imageUrl,
          ai_model: inputs.aiModel || 'latest',
          should_texture: true,
          enable_pbr: inputs.enablePbr || false,
          target_formats: ['glb'],
        })

        onProgress?.(20, '等待图片生成3D')
        result = await taskPoller.pollUntilDone(taskId, 'image-to-3d', (progress, status) => {
          onProgress?.(20 + progress * 0.7, status)
        })

        onProgress?.(100, '图片生成3D完成')
        return this.successResult(
          {
            modelUrl: result.model_urls?.glb || '',
            formats: result.model_urls || {},
            thumbnailUrl: result.thumbnail_url || '',
            textureUrls: result.texture_urls,
            previewTaskId: taskId,
          },
          { duration: Date.now() - startTime, creditsCost: 3, meshyTaskId: taskId }
        )
      } else {
        // Text-to-3D Preview 模式
        taskId = await meshyClient.textTo3DPreview({
          mode: 'preview',
          prompt: inputs.prompt,
          ai_model: inputs.aiModel || 'latest',
          topology: inputs.topology,
          target_polycount: inputs.targetPolycount,
          target_formats: ['glb'],
        })

        onProgress?.(20, '等待生成')
        result = await taskPoller.pollUntilDone(taskId, 'text-to-3d', (progress, status) => {
          onProgress?.(20 + progress * 0.7, status)
        })

        onProgress?.(100, '生成完成')
        return this.successResult(
          {
            modelUrl: result.model_urls?.glb || '',
            formats: result.model_urls || {},
            thumbnailUrl: result.thumbnail_url || '',
            previewTaskId: taskId,
          },
          { duration: Date.now() - startTime, creditsCost: 1, meshyTaskId: taskId }
        )
      }
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '生成失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: 'unknown' }
      )
    }
  }
}

export const generationAgent = new GenerationAgent()
