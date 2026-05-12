/**
 * Orchestrator模拟引擎
 * 模拟完整的：意图解析→查经验库→澄清决策→DAG构建→委派执行→结果汇总
 * 前端mock实现，通过WebSocket service推送事件
 */
import { OrchestratorContext, OrchestratorState, ExecutionDAG, DAGNode, DAGEdge, ChangeScope, SubAgentType, ExperienceEntry, UserProfile, VersionNode, CREDIT_COSTS } from '../types'
import { wsService } from '../hooks/useWebSocket'
import { queryExperience } from './experienceStore'

/**
 * 变更范围判定
 * 根据用户输入分析需要改什么
 */
export function determineChangeScope(input: string): ChangeScope {
  const lower = input.toLowerCase()
  
  const textureKeywords = ['颜色', '材质', '纹理', '贴图', '色彩', '暗', '亮', '金属', '光泽', '木纹', 'PBR', '粉色', '红色', '蓝色']
  const geometryKeywords = ['形状', '尺寸', '大小', '比例', '变形', '加粗', '变细', '拉长', '缩短', '棱角', 'remesh', '重建', '面数', '拓扑']
  const skeletonKeywords = ['骨骼', '绑定', '关节', '权重', 'rigging']
  const animationKeywords = ['动画', '动作', '走路', '跑步', '挥手', 'animation']
  const printKeywords = ['打印', '3d打印', 'print', 'printab', '修复', 'repair']
  
  return {
    geometry: geometryKeywords.some(k => lower.includes(k)),
    texture: textureKeywords.some(k => lower.includes(k)),
    skeleton: skeletonKeywords.some(k => lower.includes(k)),
    animation: animationKeywords.some(k => lower.includes(k)),
    print: printKeywords.some(k => lower.includes(k)),
    metadata: false,
  }
}

/**
 * 判断是新建还是编辑
 */
export function isNewGeneration(input: string, hasExistingModel: boolean): boolean {
  if (!hasExistingModel) return true
  const editKeywords = ['改', '换', '调', '修', '变', '不对', '不好', '重新', '太']
  const lower = input.toLowerCase()
  return !editKeywords.some(k => lower.includes(k))
}

/**
 * 构建执行DAG
 */
export function buildDAG(intent: Record<string, any>, changeScope: ChangeScope, isNew: boolean): ExecutionDAG {
  const nodes: DAGNode[] = []
  const edges: DAGEdge[] = []
  let nodeIndex = 0

  function addNode(agentType: SubAgentType, action: string, params: Record<string, any>, options?: Partial<DAGNode>): string {
    const id = `node-${nodeIndex++}`
    nodes.push({
      id,
      agentType,
      action,
      params,
      status: 'pending',
      estimatedDuration: options?.estimatedDuration || 5000,
      estimatedCost: options?.estimatedCost || CREDIT_COSTS[action] || 0,
      canParallel: options?.canParallel || false,
      condition: options?.condition,
    })
    return id
  }

  function addEdge(from: string, to: string, dataKey: string = 'model_url') {
    edges.push({ from, to, dataKey })
  }

  if (isNew) {
    // 新建场景
    const previewNode = addNode('generation', 'text-to-3d-preview', {
      prompt: intent.prompt || '',
      art_style: intent.style || 'realistic',
    }, { estimatedDuration: 15000, estimatedCost: 1 })

    const refineNode = addNode('generation', 'text-to-3d-refine', {
      prompt: intent.prompt || '',
    }, { estimatedDuration: 20000, estimatedCost: 3 })

    const qualityNode = addNode('quality', 'quality-check', {}, { estimatedDuration: 3000, estimatedCost: 0 })

    addEdge(previewNode, refineNode, 'model_url')
    addEdge(refineNode, qualityNode, 'model_url')

  } else {
    // 编辑场景 — 根据changeScope构建最小DAG
    let lastNode: string | null = null

    if (changeScope.geometry) {
      const meshNode = addNode('mesh', 'remesh', {
        topology: intent.topology || 'auto',
        target_polycount: intent.polyBudget || 5000,
      }, { estimatedDuration: 10000, estimatedCost: 2 })
      lastNode = meshNode
    }

    if (changeScope.texture) {
      const textureNode = addNode('texture', 'retexture', {
        prompt: intent.prompt || '',
        art_style: intent.style || 'realistic',
      }, { estimatedDuration: 5000, estimatedCost: 2, canParallel: !changeScope.geometry })
      
      if (lastNode && !changeScope.geometry) {
        // 纹理可以与网格并行
      } else if (lastNode) {
        addEdge(lastNode, textureNode, 'model_url')
      }
      lastNode = textureNode
    }

    if (changeScope.skeleton) {
      const rigNode = addNode('rigging', 'rigging', {
        skeleton_type: 'humanoid',
      }, { estimatedDuration: 8000, estimatedCost: 3 })
      if (lastNode) addEdge(lastNode, rigNode, 'model_url')
      lastNode = rigNode
    }

    if (changeScope.animation) {
      const animNode = addNode('animation', 'animation', {
        animation_type: intent.animationType || 'idle',
      }, { estimatedDuration: 10000, estimatedCost: 4 })
      if (lastNode) addEdge(lastNode, animNode, 'model_url')
      lastNode = animNode
    }

    // 如果没有任何变更，默认重新纹理
    if (nodes.length === 0) {
      addNode('texture', 'retexture', { prompt: intent.prompt || '' }, { estimatedDuration: 5000, estimatedCost: 2 })
    }
  }

  return { nodes, edges }
}

/**
 * 计算DAG总成本
 */
export function calculateDAGCost(dag: ExecutionDAG): number {
  return dag.nodes.reduce((sum, node) => sum + node.estimatedCost, 0)
}

/**
 * 计算DAG预估总时间（考虑并行）
 */
export function calculateDAGDuration(dag: ExecutionDAG): number {
  // 简化：串行节点时间累加，并行节点取最大值
  return dag.nodes.reduce((sum, node) => sum + node.estimatedDuration, 0)
}

/**
 * 主入口：处理用户输入
 * 返回构建好的context供UI层使用
 */
export function processUserInput(
  input: string,
  userProfile: UserProfile,
  currentVersion: VersionNode | null
): {
  context: Partial<OrchestratorContext>
  dag: ExecutionDAG
  changeScope: ChangeScope
  isNew: boolean
  totalCost: number
  experienceHits: ExperienceEntry[]
} {
  const isNew = isNewGeneration(input, !!currentVersion)
  const changeScope = isNew 
    ? { geometry: true, texture: true, skeleton: false, animation: false, print: false, metadata: false }
    : determineChangeScope(input)
  
  // 查经验库
  const experienceHits = queryExperience({
    inputPattern: input,
    objectType: undefined,
    meshyEndpoint: isNew ? 'text-to-3d' : 'retexture',
  })

  // 构建intent（简化版）
  const intent = {
    prompt: input,
    style: undefined,
    topology: undefined,
    polyBudget: undefined,
  }

  // 构建DAG
  const dag = buildDAG(intent, changeScope, isNew)
  const totalCost = calculateDAGCost(dag)

  return {
    context: {
      taskId: `task-${Date.now()}`,
      userId: 'current-user',
      userProfile,
      currentVersion,
      resolvedIntent: intent,
      executionPlan: dag,
      experienceHits,
      state: 'planning',
      changeScope,
    },
    dag,
    changeScope,
    isNew,
    totalCost,
    experienceHits,
  }
}
