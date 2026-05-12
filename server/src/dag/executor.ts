import { ExecutionDAG, DAGNode, SubTaskResult, ExperienceEntry, TaskConstraints } from '../types.js'
import { BaseAgent, ProgressCallback } from '../agents/base.js'
import { GenerationAgent } from '../agents/generation.js'
import { TextureAgent } from '../agents/texture.js'
import { MeshAgent } from '../agents/mesh.js'
import { RiggingAgent } from '../agents/rigging.js'
import { AnimationAgent } from '../agents/animation.js'
import { PrintAgent } from '../agents/print.js'
import { FormatAgent } from '../agents/format.js'
import { QualityAgent } from '../agents/quality.js'
import { DAGScheduler } from './scheduler.js'

// ============================================================
// 回调类型
// ============================================================

export type NodeProgressCallback = (nodeId: string, progress: number, step: string) => void
export type NodeStartCallback = (nodeId: string) => void
export type NodeCompleteCallback = (nodeId: string, result: SubTaskResult) => void
export type DAGCompleteCallback = (results: Map<string, SubTaskResult>) => void

// ============================================================
// Agent注册表
// ============================================================

function createAgentRegistry(): Map<string, BaseAgent> {
  return new Map<string, BaseAgent>([
    ['generation', new GenerationAgent()],
    ['texture', new TextureAgent()],
    ['mesh', new MeshAgent()],
    ['rigging', new RiggingAgent()],
    ['animation', new AnimationAgent()],
    ['print', new PrintAgent()],
    ['format', new FormatAgent()],
    ['quality', new QualityAgent()],
  ])
}

// ============================================================
// DAG执行器
// ============================================================

export class DAGExecutor {
  private agents: Map<string, BaseAgent>
  private results: Map<string, SubTaskResult> = new Map()
  private cancelled: boolean = false
  private scheduler: DAGScheduler

  constructor(agents?: Map<string, BaseAgent>) {
    this.agents = agents || createAgentRegistry()
    this.scheduler = new DAGScheduler()
  }

  /**
   * 执行整个DAG
   * 按拓扑排序执行，支持并行节点
   */
  async execute(
    dag: ExecutionDAG,
    inputs: Record<string, any>,
    options: {
      onNodeProgress?: NodeProgressCallback
      onNodeStart?: NodeStartCallback
      onNodeComplete?: NodeCompleteCallback
      onComplete?: DAGCompleteCallback
      experienceHints?: ExperienceEntry[]
    } = {}
  ): Promise<Map<string, SubTaskResult>> {
    this.results = new Map()
    this.cancelled = false

    const { onNodeProgress, onNodeStart, onNodeComplete, onComplete, experienceHints = [] } = options

    // 获取分层拓扑排序
    const levels = this.topologicalSort(dag)

    // 逐层执行
    for (const level of levels) {
      if (this.cancelled) break

      // 同层节点并行执行
      const promises = level.map(async (nodeId) => {
        if (this.cancelled) return

        const node = dag.nodes.find(n => n.id === nodeId)
        if (!node) return

        // 更新节点状态为running
        node.status = 'running'

        // 通知节点开始执行
        onNodeStart?.(nodeId)

        // 构建进度回调
        const progressCb: ProgressCallback | undefined = onNodeProgress
          ? (progress, step) => onNodeProgress(nodeId, progress, step)
          : undefined

        try {
          // 获取节点输入
          const nodeInputs = this.getNodeInputs(node, dag, inputs)

          // 执行节点
          const result = await this.executeNode(node, nodeInputs, experienceHints, progressCb)

          if (this.cancelled) return

          // 更新节点状态和结果
          node.status = result.status === 'failed' ? 'failed' : 'done'
          node.result = result.outputs
          this.results.set(nodeId, result)

          // 回调通知
          onNodeComplete?.(nodeId, result)
        } catch (err) {
          node.status = 'failed'
          const failResult: SubTaskResult = {
            status: 'failed',
            outputs: { error: err instanceof Error ? err.message : 'Unknown error' },
            metadata: { duration: 0, creditsCost: 0, meshyTaskId: '' },
          }
          this.results.set(nodeId, failResult)
          onNodeComplete?.(nodeId, failResult)
        }
      })

      await Promise.all(promises)
    }

    // DAG完成回调
    onComplete?.(this.results)

    return this.results
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.cancelled = true
  }

  /**
   * 获取拓扑排序（分层分组）
   * 返回 [['node-0'], ['node-1', 'node-2'], ['node-3']]
   * 同一层的节点可以并行，层间串行
   */
  private topologicalSort(dag: ExecutionDAG): string[][] {
    return this.scheduler.getExecutionLevels(dag)
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: DAGNode,
    inputs: Record<string, any>,
    experienceHints: ExperienceEntry[],
    onProgress?: ProgressCallback
  ): Promise<SubTaskResult> {
    const agent = this.agents.get(node.agentType)
    if (!agent) {
      throw new Error(`No agent registered for type: ${node.agentType}`)
    }

    // 合并节点参数到输入
    const mergedInputs = { ...inputs, ...node.params }

    console.log(`[DAGExecutor] executeNode ${node.id} (${node.agentType}/${node.action}):`, {
      modelUrl: mergedInputs.modelUrl?.slice(0, 80),
      inputTaskId: mergedInputs.inputTaskId,
      prompt: mergedInputs.prompt?.slice(0, 40),
    })

    // 构建约束
    const constraints: TaskConstraints = {
      maxCredits: node.estimatedCost * 2,
      maxDuration: node.estimatedDuration * 3,
      qualityThreshold: 0.7,
    }

    return agent.execute(mergedInputs, constraints, experienceHints, onProgress)
  }

  /**
   * 获取节点的输入（从前置节点的输出中提取）
   */
  private getNodeInputs(node: DAGNode, dag: ExecutionDAG, baseInputs: Record<string, any>): Record<string, any> {
    const mergedInputs = { ...baseInputs }

    // 查找所有指向当前节点的边
    const incomingEdges = dag.edges.filter(edge => edge.to === node.id)

    for (const edge of incomingEdges) {
      const predecessorResult = this.results.get(edge.from)
      if (predecessorResult && predecessorResult.outputs) {
        // 从前置节点的输出中提取 dataKey 对应的值
        const value = predecessorResult.outputs[edge.dataKey]
        if (value !== undefined) {
          // 将值映射到标准输入字段
          // 例如 dataKey='model_url' → inputs.modelUrl
          const inputKey = this.dataKeyToInputKey(edge.dataKey)
          mergedInputs[inputKey] = value
        }
      }
    }

    return mergedInputs
  }

  /**
   * 将edge的dataKey映射为agent输入字段名
   */
  private dataKeyToInputKey(dataKey: string): string {
    const mapping: Record<string, string> = {
      modelUrl: 'modelUrl',
      textureUrls: 'textureUrls',
      thumbnailUrl: 'thumbnailUrl',
      previewTaskId: 'previewTaskId',
      rigTaskId: 'rigTaskId',
      needsRepair: 'needsRepair',
    }
    return mapping[dataKey] || dataKey
  }
}

export const dagExecutor = new DAGExecutor()
