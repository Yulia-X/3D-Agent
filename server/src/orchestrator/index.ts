import { WebSocketServer } from '../ws/server.js'
import { IntentParser } from './intentParser.js'
import { Pipeline } from './pipeline.js'
import { DAGBuilder } from '../dag/builder.js'
import { DAGExecutor } from '../dag/executor.js'
import { ExperienceStore } from '../experience/store.js'
import { VersionManager } from '../version/manager.js'
import { CreditManager } from '../credit/manager.js'
import { ClarificationEngine } from '../clarification/engine.js'
import {
  OrchestratorContext,
  WSEvent,
  VersionNode,
  VersionAssets,
  UserProfile,
  ChangeScope,
  ExecutionDAG,
  SubTaskResult,
} from '../types.js'

// ============================================================
// Orchestrator — 核心编排引擎
// ============================================================

export class Orchestrator {
  private pipelines: Map<string, Pipeline> = new Map() // sessionId → Pipeline
  private intentParser: IntentParser
  private dagBuilder: DAGBuilder
  private experienceStore: ExperienceStore
  private versionManager: VersionManager
  private creditManager: CreditManager
  private clarificationEngine: ClarificationEngine

  constructor(private wsServer: WebSocketServer) {
    this.intentParser = new IntentParser()
    this.dagBuilder = new DAGBuilder()
    this.experienceStore = new ExperienceStore()
    this.versionManager = new VersionManager()
    this.creditManager = new CreditManager()
    this.clarificationEngine = new ClarificationEngine()
  }

  // ----------------------------------------------------------
  // 公开命令入口
  // ----------------------------------------------------------

  /**
   * 处理generate命令
   */
  async handleGenerate(sessionId: string, prompt: string, images?: string[], fromVersion?: string): Promise<void> {
    const session = this.wsServer.getSession(sessionId)
    if (!session) return

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    // 确定当前版本
    let currentVersion: VersionNode | null = null
    if (fromVersion) {
      currentVersion = this.versionManager.getVersion(fromVersion) || null
    }

    // 创建管线上下文
    const context: OrchestratorContext = {
      taskId,
      userId: session.userId,
      userProfile: session.userProfile,
      currentVersion,
      resolvedIntent: {},
      executionPlan: null,
      experienceHits: [],
      state: 'intent_parsing',
      changeScope: null,
    }

    const pipeline = new Pipeline(context)
    this.pipelines.set(sessionId, pipeline)

    // 创建版本树（如果是全新任务）
    if (!fromVersion) {
      this.versionManager.createTree(taskId)
    }

    // 启动管线（不await，让它异步运行）
    this.runPipeline(sessionId, pipeline, prompt, images).catch(err => {
      this.handlePipelineError(sessionId, pipeline, err)
    })
  }

  /**
   * 处理edit命令
   */
  async handleEdit(sessionId: string, prompt: string, targetVersion: string, sourceModelUrl?: string, sourceTaskId?: string): Promise<void> {
    const session = this.wsServer.getSession(sessionId)
    if (!session) return

    // targetVersion from frontend is a card/task ID (e.g., "task-1778266314090-tjxu")
    // Find the current version through the version tree
    let currentVersion: VersionNode | null = null

    // 1. Try direct version lookup (in case it's already a version ID)
    currentVersion = this.versionManager.getVersion(targetVersion)

    // 2. Try with :V1 suffix (card ID → first version ID)
    if (!currentVersion) {
      currentVersion = this.versionManager.getVersion(targetVersion + ':V1')
    }

    // 3. Look up through the version tree (card ID = task ID)
    if (!currentVersion) {
      const tree = this.versionManager.getTree(targetVersion)
      if (tree?.currentHead) {
        currentVersion = this.versionManager.getVersion(tree.currentHead)
      }
    }

    // 4. If version lookup still failed but frontend provided source info directly,
    //    construct a minimal VersionNode so the DAG builder can use it
    if (!currentVersion && (sourceModelUrl || sourceTaskId)) {
      currentVersion = {
        id: targetVersion,
        parentId: null,
        children: [],
        assets: {
          modelUrl: sourceModelUrl || '',
          textureUrls: [],
          thumbnailUrl: '',
          meshyTaskId: sourceTaskId,
          metadata: { polyCount: 5000, format: 'GLB', dimensions: { x: 1, y: 1, z: 1 }, hasAnimation: false, hasSkeleton: false },
        },
        createdAt: Date.now(),
        trigger: { type: 'initial_generation', userInput: '', resolvedIntent: {} },
        changeScope: { geometry: true, texture: true, skeleton: false, animation: false, print: false, metadata: false },
        dagExecuted: null,
      }
    }

    if (!currentVersion) {
      this.emit(sessionId, {
        type: 'error:fatal',
        message: `找不到目标模型版本: ${targetVersion}`,
      })
      return
    }

    // Use a new taskId for the pipeline (so frontend creates a new card)
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const context: OrchestratorContext = {
      taskId,
      // versionTreeTaskId: the original task ID whose version tree should receive the new version
      versionTreeTaskId: targetVersion,
      userId: session.userId,
      userProfile: session.userProfile,
      currentVersion,
      resolvedIntent: {},
      executionPlan: null,
      experienceHits: [],
      state: 'intent_parsing',
      changeScope: null,
    }

    const pipeline = new Pipeline(context)
    this.pipelines.set(sessionId, pipeline)

    this.runPipeline(sessionId, pipeline, prompt).catch(err => {
      this.handlePipelineError(sessionId, pipeline, err)
    })
  }

  /**
   * 处理澄清回复
   */
  async handleClarificationResponse(sessionId: string, responses: any[]): Promise<void> {
    const pipeline = this.pipelines.get(sessionId)
    if (!pipeline || !pipeline.isPaused()) return

    // 用 ClarificationEngine 处理回复，更新intent
    const context = pipeline.getContext()
    const updatedIntent = this.clarificationEngine.processResponse(responses, context.resolvedIntent)
    pipeline.updateContext({ resolvedIntent: updatedIntent })

    // 恢复管线
    pipeline.resume({ type: 'clarification', responses })
  }

  /**
   * 处理确认回复
   */
  async handleConfirmResponse(sessionId: string, accepted: boolean, choice?: string): Promise<void> {
    const pipeline = this.pipelines.get(sessionId)
    if (!pipeline || !pipeline.isPaused()) return

    pipeline.resume({ type: 'confirm', accepted, choice })
  }

  /**
   * 取消任务
   */
  async handleCancel(sessionId: string, taskId: string): Promise<void> {
    const pipeline = this.pipelines.get(sessionId)
    if (!pipeline) return

    const context = pipeline.getContext()
    pipeline.transition('error_recovery')

    // 如果暂停中，恢复以解除阻塞
    if (pipeline.isPaused()) {
      pipeline.resume({ type: 'cancel' })
    }

    this.pipelines.delete(sessionId)

    this.emit(sessionId, {
      type: 'task:progress',
      taskId: context.taskId,
      step: '任务已取消',
      progress: 100,
      estimatedRemaining: 0,
    })
  }

  /**
   * 处理版本检出
   */
  async handleVersionCheckout(sessionId: string, versionId: string): Promise<void> {
    const pipeline = this.pipelines.get(sessionId)
    const taskId = pipeline?.getContext().taskId || `task-${Date.now()}`

    this.versionManager.checkout(taskId, versionId)

    const tree = this.versionManager.getTree(taskId)
    if (tree) {
      this.emit(sessionId, { type: 'version:updated', tree })
    }

    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: `已切换到版本 ${versionId}`,
      progress: 100,
      estimatedRemaining: 0,
    })
  }

  /**
   * 处理版本分叉
   */
  async handleVersionFork(sessionId: string, fromVersionId: string): Promise<void> {
    const pipeline = this.pipelines.get(sessionId)
    const taskId = pipeline?.getContext().taskId || `task-${Date.now()}`

    const newVersion = this.versionManager.fork(taskId, fromVersionId)

    const tree = this.versionManager.getTree(taskId)
    if (tree) {
      this.emit(sessionId, { type: 'version:updated', tree })
    }

    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: `从 ${fromVersionId} 创建分支 ${newVersion.id}`,
      progress: 100,
      estimatedRemaining: 0,
    })
  }

  /**
   * 处理余额查询
   */
  async handleBalanceQuery(sessionId: string): Promise<void> {
    const session = this.wsServer.getSession(sessionId)
    if (!session) return

    const balance = await this.creditManager.getBalance(session.userId)
    this.emit(sessionId, { type: 'balance:update', balance })
  }

  // ----------------------------------------------------------
  // 核心流程
  // ----------------------------------------------------------

  /**
   * 核心管线流程（generate和edit共用主逻辑）
   */
  private async runPipeline(sessionId: string, pipeline: Pipeline, prompt: string, images?: string[]): Promise<void> {
    const context = pipeline.getContext()
    const taskId = context.taskId

    // ========== Step 1: 意图解析 ==========
    pipeline.transition('intent_parsing')
    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: '正在解析意图...',
      progress: 5,
      estimatedRemaining: 30000,
    })

    const parseResult = await this.intentParser.parse(prompt, images, !!context.currentVersion, (step, detail) => {
      this.emit(sessionId, { type: 'reasoning:step', taskId, step, detail })
    }, context.userProfile)
    const changeScope = this.intentParser.determineChangeScope(prompt)
    const isNew = this.intentParser.isNewGeneration(prompt, !!context.currentVersion)

    this.emit(sessionId, {
      type: 'reasoning:step',
      taskId,
      step: '意图解析',
      detail: `识别到: "${parseResult.intent.prompt}", 风格: ${parseResult.intent.style || '未指定'}, 置信度: ${JSON.stringify(parseResult.confidence)}`,
    })

    pipeline.updateContext({
      resolvedIntent: parseResult.intent,
      changeScope,
    })

    // ========== Step 2: 经验库查询 ==========
    const experienceHits = this.experienceStore.query({
      inputPattern: prompt,
      meshyEndpoint: isNew ? 'text-to-3d' : undefined,
    })
    pipeline.updateContext({ experienceHits })

    if (experienceHits.length > 0) {
      this.emit(sessionId, {
        type: 'reasoning:step',
        taskId,
        step: '经验匹配',
        detail: `找到 ${experienceHits.length} 条相关经验`,
      })
    }

    // ========== Step 3: 澄清决策 ==========
    console.log('[CLARIFICATION] parseResult.confidence:', JSON.stringify(parseResult.confidence))

    const checkpoint = await this.clarificationEngine.checkPrePlanning(context, parseResult)

    console.log('[CLARIFICATION] checkResult:', JSON.stringify({
      shouldTrigger: checkpoint.shouldTrigger,
      questionCount: checkpoint.questions.length,
      questionFields: checkpoint.questions.map(q => q.field),
    }))

    this.emit(sessionId, {
      type: 'reasoning:step',
      taskId,
      step: '澄清决策',
      detail: checkpoint.shouldTrigger ? `需要补充 ${checkpoint.questions.length} 个信息` : '信息充分，直接执行',
    })

    if (checkpoint.shouldTrigger) {
      pipeline.transition('clarification_needed')
      this.emit(sessionId, {
        type: 'clarification:needed',
        payload: {
          checkpoint,
          questions: checkpoint.questions,
        },
      })

      this.emit(sessionId, {
        type: 'task:progress',
        taskId,
        step: '等待用户补充信息...',
        progress: 15,
        estimatedRemaining: 25000,
      })

      // ⚠️ 关键：必须在此阻塞等待用户回答，后续步骤（DAG构建+执行）不能提前运行
      const response = await pipeline.pause()

      // 检查是否被取消
      if (response?.type === 'cancel') return

      // 澄清完成后，发送reasoning step表明流程继续
      this.emit(sessionId, {
        type: 'reasoning:step',
        taskId,
        step: '意图澄清完成',
        detail: `用户已补充信息，继续执行流程`,
      })
    }

    // ========== Step 4: 构建DAG（必须在澄清完成后才执行）==========
    pipeline.transition('planning')
    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: '正在规划执行方案...',
      progress: 25,
      estimatedRemaining: 20000,
    })

    const resolvedIntent = pipeline.getContext().resolvedIntent
    const resolvedScope = pipeline.getContext().changeScope || changeScope

    const dag = this.dagBuilder.build(resolvedIntent, resolvedScope, isNew, {
      sourceModelUrl: context.currentVersion?.assets?.modelUrl,
      sourceTaskId: context.currentVersion?.assets?.meshyTaskId,
    })
    pipeline.updateContext({ executionPlan: dag })

    this.emit(sessionId, {
      type: 'reasoning:step',
      taskId,
      step: '执行规划',
      detail: `构建了 ${dag.nodes.length} 步执行计划: ${dag.nodes.map(n => n.agentType || n.action).join(' → ')}`,
    })

    // ========== Step 5: 积分检查 ==========
    const totalCost = this.dagBuilder.calculateCost(dag)
    const balance = await this.creditManager.getBalance(context.userId)

    if (balance < totalCost) {
      pipeline.transition('waiting_user_confirm')

      this.emit(sessionId, {
        type: 'confirm:needed',
        confirmType: 'cost',
        payload: {
          operation: isNew ? '新建3D模型' : '编辑3D模型',
          creditsCost: totalCost,
          currentBalance: balance,
        },
      })

      const confirmResponse = await pipeline.pause()

      if (confirmResponse?.type === 'cancel' || !confirmResponse?.accepted) {
        this.emit(sessionId, {
          type: 'task:progress',
          taskId,
          step: '用户取消操作（积分不足）',
          progress: 100,
          estimatedRemaining: 0,
        })
        this.pipelines.delete(sessionId)
        return
      }
    }

    // ========== Step 6: 执行DAG ==========
    pipeline.transition('executing')
    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: '正在执行生成任务...',
      progress: 30,
      estimatedRemaining: this.dagBuilder.calculateDuration(dag),
    })

    const executor = new DAGExecutor()
    const inputs: Record<string, any> = {
      prompt: resolvedIntent.prompt || prompt,
      art_style: resolvedIntent.style || 'realistic',
    }

    // 如果有当前模型URL（编辑场景）
    if (context.currentVersion?.assets?.modelUrl) {
      inputs.modelUrl = context.currentVersion.assets.modelUrl
    }

    const results = await executor.execute(dag, inputs, {
      onNodeProgress: (nodeId, progress, step) => {
        const node = dag.nodes.find(n => n.id === nodeId)
        const idx = dag.nodes.findIndex(n => n.id === nodeId)
        // 发送节点级进度事件（per-node 0-100）
        this.emit(sessionId, {
          type: 'node:progress',
          taskId,
          nodeId,
          nodeName: node?.agentType || node?.action || nodeId,
          stepIndex: idx + 1,
          totalSteps: dag.nodes.length,
          progress,
        })
      },
      onNodeStart: (nodeId) => {
        const node = dag.nodes.find(n => n.id === nodeId)
        const idx = dag.nodes.findIndex(n => n.id === nodeId)
        if (node) {
          this.emit(sessionId, {
            type: 'node:progress',
            taskId,
            nodeId,
            nodeName: node.agentType || node.action,
            stepIndex: idx + 1,
            totalSteps: dag.nodes.length,
            progress: 0,
          })
          this.emit(sessionId, {
            type: 'reasoning:step',
            taskId,
            step: `执行: ${node.agentType || node.action}`,
            detail: '正在调用 Meshy API...',
          })
        }
      },
      onNodeComplete: (nodeId, result) => {
        const idx = dag.nodes.findIndex(n => n.id === nodeId)
        this.emit(sessionId, {
          type: 'node:progress',
          taskId,
          nodeId,
          nodeName: '',
          stepIndex: idx + 1,
          totalSteps: dag.nodes.length,
          progress: 100,
        })
        this.emit(sessionId, {
          type: 'dag:node_done',
          taskId,
          nodeId,
          output: result.outputs,
        })
      },
      experienceHints: experienceHits,
    })

    // ========== Step 7: 收集结果，创建版本 ==========
    // 从产出模型的节点获取输出
    const lastResult = this.getFinalModelResult(dag, results)
    const modelUrl = lastResult?.outputs?.modelUrl || ''
    const textureUrls = lastResult?.outputs?.textureUrls || []
    const thumbnailUrl = lastResult?.outputs?.thumbnailUrl || ''
    const meshyTaskId = lastResult?.metadata?.meshyTaskId || ''
    const formats = lastResult?.outputs?.formats || {}

    const assets: VersionAssets = {
      modelUrl,
      textureUrls: Array.isArray(textureUrls) ? textureUrls : [],
      thumbnailUrl,
      meshyTaskId: meshyTaskId || undefined,
      formats: Object.keys(formats).length > 0 ? formats : undefined,
      metadata: {
        polyCount: resolvedIntent.polyBudget || 5000,
        format: resolvedIntent.outputFormat || 'GLB',
        dimensions: { x: 1, y: 1, z: 1 },
        hasAnimation: resolvedScope.animation,
        hasSkeleton: resolvedScope.skeleton,
      },
    }

    const parentId = context.currentVersion?.id || null
    // Use versionTreeTaskId for edit operations to add versions to the correct tree
    const versionTaskId = context.versionTreeTaskId || taskId
    const newVersion = this.versionManager.addVersion(versionTaskId, {
      parentId,
      assets,
      trigger: {
        type: isNew ? 'initial_generation' : 'edit_request',
        userInput: prompt,
        resolvedIntent: resolvedIntent,
      },
      changeScope: resolvedScope,
      dagExecuted: dag,
    })

    // ========== Step 7.5: 扣费 ==========
    for (const node of dag.nodes) {
      const nodeResult = results.get(node.id)
      if (nodeResult && nodeResult.status === 'success' && node.estimatedCost > 0) {
        try {
          await this.creditManager.deduct(context.userId, node.action, context.taskId)
        } catch (e) {
          console.warn(`[credit] Failed to deduct for node ${node.id}:`, e)
        }
      }
    }

    // ========== Step 8: 完成 ==========
    pipeline.transition('completed')

    this.emit(sessionId, {
      type: 'preview:complete',
      taskId,
      modelUrl,
      version: newVersion,
    })

    const tree = this.versionManager.getTree(versionTaskId)
    if (tree) {
      this.emit(sessionId, { type: 'version:updated', tree })
    }

    this.emit(sessionId, {
      type: 'task:progress',
      taskId,
      step: '生成完成',
      progress: 100,
      estimatedRemaining: 0,
    })

    // 清理pipeline引用
    this.pipelines.delete(sessionId)
  }

  // ----------------------------------------------------------
  // 错误处理
  // ----------------------------------------------------------

  private handlePipelineError(sessionId: string, pipeline: Pipeline, err: unknown): void {
    const context = pipeline.getContext()
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    pipeline.transition('error_recovery')

    // 判断是否可恢复
    const isRecoverable = this.isRecoverableError(err)

    if (isRecoverable) {
      this.emit(sessionId, {
        type: 'error:recoverable',
        message: errorMessage,
        suggestedAction: '请修改参数后重试',
      })
    } else {
      this.emit(sessionId, {
        type: 'error:fatal',
        message: errorMessage,
      })
    }

    // 记录失败经验
    try {
      this.experienceStore.create({
        conditions: {
          inputPattern: context.resolvedIntent.prompt || '',
          meshyEndpoint: 'text-to-3d',
          errorType: errorMessage.slice(0, 50),
        },
        resolution: {
          strategy: 'user_guidance',
          userMessage: `执行失败: ${errorMessage}`,
        },
        successRate: 0,
        scope: 'global',
      })
    } catch {
      // 经验库记录失败不影响主流程
    }

    this.pipelines.delete(sessionId)
  }

  private isRecoverableError(err: unknown): boolean {
    if (err instanceof Error) {
      // 积分不足、参数无效等是可恢复的
      if (err.message.includes('Insufficient credits')) return true
      if (err.message.includes('Invalid')) return true
      if (err.message.includes('timeout')) return true
    }
    return false
  }

  // ----------------------------------------------------------
  // 辅助方法
  // ----------------------------------------------------------

  private getLastSuccessfulResult(results: Map<string, any>): any | null {
    let lastResult: any = null
    for (const [, result] of results) {
      if (result.status === 'success' || result.status === 'partial') {
        lastResult = result
      }
    }
    return lastResult
  }

  /**
   * 从DAG执行结果中获取最终模型输出
   * 优先从生成/材质/网格等产出模型的节点中选取
   */
  private getFinalModelResult(dag: ExecutionDAG, results: Map<string, SubTaskResult>): SubTaskResult | null {
    const modelProducingTypes = new Set(['generation', 'texture', 'mesh', 'format', 'print'])
    let candidate: SubTaskResult | null = null

    // 按DAG节点顺序遍历，取最后一个产出模型的成功节点
    for (const node of dag.nodes) {
      if (!modelProducingTypes.has(node.agentType)) continue
      const r = results.get(node.id)
      if (r && (r.status === 'success' || r.status === 'partial') && r.outputs.modelUrl) {
        candidate = r
      }
    }
    return candidate
  }

  private emit(sessionId: string, event: WSEvent): void {
    this.wsServer.sendToSession(sessionId, event)
  }
}
