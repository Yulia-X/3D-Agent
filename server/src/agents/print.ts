import { BaseAgent, ProgressCallback } from './base.js'
import { SubTaskResult, TaskConstraints, ExperienceEntry } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { taskPoller } from '../meshy/polling.js'

export class PrintAgent extends BaseAgent {
  readonly type = 'print'
  readonly name = '3D打印Agent'

  async execute(
    inputs: Record<string, any>,
    constraints: TaskConstraints,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const startTime = Date.now()
    this.applyExperienceHints(inputs, experienceHints)

    const action = inputs.action || 'analyze'

    try {
      if (action === 'analyze') {
        onProgress?.(10, '提交打印分析任务')

        const taskId = await meshyClient.analyzePrintability({
          input_task_id: inputs.inputTaskId,
          model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
        })

        onProgress?.(20, '等待打印分析')
        const result = await taskPoller.pollUntilDone(taskId, 'analyze-print', (progress, status) => {
          onProgress?.(20 + progress * 0.7, status)
        })

        onProgress?.(100, '打印分析完成')
        return this.successResult(
          {
            printability: result.printability,
            needsRepair: result.printability?.status === 'error' || result.printability?.status === 'warning',
          },
          { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: taskId }
        )
      }

      if (action === 'repair') {
        onProgress?.(10, '提交打印修复任务')

        const taskId = await meshyClient.repairPrintability({
          input_task_id: inputs.inputTaskId,
          model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
        })

        onProgress?.(20, '等待打印修复')
        const result = await taskPoller.pollUntilDone(taskId, 'repair-print', (progress, status) => {
          onProgress?.(20 + progress * 0.7, status)
        })

        onProgress?.(100, '打印修复完成')
        return this.successResult(
          {
            modelUrl: result.model_urls?.glb || result.model_urls?.stl || '',
            repaired: true,
          },
          { duration: Date.now() - startTime, creditsCost: 2, meshyTaskId: taskId }
        )
      }

      // action === 'multi-color'
      onProgress?.(10, '提交多色打印任务')

      const taskId = await meshyClient.multiColorPrint({
        input_task_id: inputs.inputTaskId,
        model_url: inputs.inputTaskId ? undefined : inputs.modelUrl,
        max_colors: inputs.maxColors || 4,
        max_depth: inputs.maxDepth || 4,
      })

      onProgress?.(20, '等待多色打印处理')
      const result = await taskPoller.pollUntilDone(taskId, 'multi-color-print', (progress, status) => {
        onProgress?.(20 + progress * 0.7, status)
      })

      onProgress?.(100, '多色打印完成')
      return this.successResult(
        {
          modelUrl: result.model_urls?.['3mf'] || '',
          format: '3mf',
        },
        { duration: Date.now() - startTime, creditsCost: 2, meshyTaskId: taskId }
      )
    } catch (err) {
      return this.failedResult(
        err instanceof Error ? err.message : '打印任务失败',
        { duration: Date.now() - startTime, creditsCost: 0, meshyTaskId: 'unknown' }
      )
    }
  }
}

export const printAgent = new PrintAgent()
