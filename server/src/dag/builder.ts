import { ExecutionDAG, DAGNode, DAGEdge, ChangeScope, SubAgentType, CREDIT_COSTS } from '../types.js'

export class DAGBuilder {
  /**
   * 构建执行DAG
   * @param intent - 已解析的意图（prompt, style, topology等）
   * @param changeScope - 变更范围
   * @param isNew - 是否全新生成
   * @param options - 可选参数，编辑场景下传入源模型信息
   */
  build(intent: Record<string, any>, changeScope: ChangeScope, isNew: boolean, options?: {
    sourceModelUrl?: string
    sourceTaskId?: string
  }): ExecutionDAG {
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
        estimatedCost: options?.estimatedCost ?? CREDIT_COSTS[action] ?? 0,
        canParallel: options?.canParallel || false,
        condition: options?.condition,
      })
      return id
    }

    function addEdge(from: string, to: string, dataKey: string = 'modelUrl') {
      edges.push({ from, to, dataKey })
    }

    if (isNew) {
      // 新建场景
      if (intent.imageUrls && intent.imageUrls.length > 1) {
        // Multi-Image-to-3D 场景
        const genNode = addNode('generation', 'multi-image-to-3d', {
          imageUrls: intent.imageUrls,
          mode: 'multi-image',
          prompt: intent.prompt || '',
          art_style: intent.style || 'realistic',
        }, { estimatedDuration: 30000, estimatedCost: 5 })

        const qualityNode = addNode('quality', 'quality-check', {}, { estimatedDuration: 3000, estimatedCost: 0 })
        addEdge(genNode, qualityNode, 'modelUrl')
      } else if (intent.imageUrl) {
        // Image-to-3D 场景（单图）
        const genNode = addNode('generation', 'image-to-3d', {
          imageUrl: intent.imageUrl,
          mode: 'image',
          prompt: intent.prompt || '',
          art_style: intent.style || 'realistic',
        }, { estimatedDuration: 25000, estimatedCost: 3 })

        const qualityNode = addNode('quality', 'quality-check', {}, { estimatedDuration: 3000, estimatedCost: 0 })
        addEdge(genNode, qualityNode, 'modelUrl')
      } else {
        // Text-to-3D 场景：preview → refine → quality-check
        const previewNode = addNode('generation', 'text-to-3d-preview', {
          prompt: intent.prompt || '',
          art_style: intent.style || 'realistic',
          mode: 'preview',
        }, { estimatedDuration: 15000, estimatedCost: 1 })

        const refineNode = addNode('generation', 'text-to-3d-refine', {
          prompt: intent.prompt || '',
          mode: 'refine',
        }, { estimatedDuration: 20000, estimatedCost: 3 })

        const qualityNode = addNode('quality', 'quality-check', {}, { estimatedDuration: 3000, estimatedCost: 0 })

        addEdge(previewNode, refineNode, 'previewTaskId')
        addEdge(refineNode, qualityNode, 'modelUrl')
      }
    } else {
      // 编辑场景 — 根据changeScope构建最小DAG
      let lastNode: string | null = null

      if (changeScope.geometry) {
        const meshNode = addNode('mesh', 'remesh', {
          topology: intent.topology || 'auto',
          target_polycount: intent.polyBudget || 5000,
          modelUrl: options?.sourceModelUrl,
          inputTaskId: options?.sourceTaskId,
        }, { estimatedDuration: 10000, estimatedCost: 2 })
        lastNode = meshNode
      }

      if (changeScope.texture) {
        const textureNode = addNode('texture', 'retexture', {
          prompt: intent.prompt || '',
          art_style: intent.style || 'realistic',
          modelUrl: options?.sourceModelUrl,
          inputTaskId: options?.sourceTaskId,
        }, { estimatedDuration: 5000, estimatedCost: 2, canParallel: !changeScope.geometry })

        // geometry和texture可以并行（如果两者都有，texture的canParallel=true设为false，串行连接）
        if (lastNode && changeScope.geometry) {
          addEdge(lastNode, textureNode, 'modelUrl')
        }
        lastNode = textureNode
      }

      if (changeScope.skeleton) {
        const rigNode = addNode('rigging', 'rigging', {
          skeleton_type: 'humanoid',
        }, { estimatedDuration: 8000, estimatedCost: 3 })
        if (lastNode) addEdge(lastNode, rigNode, 'modelUrl')
        lastNode = rigNode

        // 动画只在骨骼变更时可用
        if (changeScope.animation) {
          const animNode = addNode('animation', 'animation', {
            animation_type: intent.animationType || 'idle',
          }, { estimatedDuration: 10000, estimatedCost: 4 })
          // AnimationAgent 需要 rigTaskId
          addEdge(lastNode, animNode, 'rigTaskId')
          lastNode = animNode
        }
      } else if (changeScope.animation) {
        // 动画需要骨骼绑定，自动启用骨骼
        const rigNode = addNode('rigging', 'rigging', {
          skeleton_type: 'humanoid',
        }, { estimatedDuration: 8000, estimatedCost: 3 })
        if (lastNode) addEdge(lastNode, rigNode, 'modelUrl')
        lastNode = rigNode

        const animNode = addNode('animation', 'animation', {
          animation_type: intent.animationType || 'idle',
        }, { estimatedDuration: 10000, estimatedCost: 4 })
        addEdge(lastNode, animNode, 'rigTaskId')
        lastNode = animNode
      }

      if (changeScope.print) {
        // 分析节点
        const analyzeNode = addNode('print', 'analyze-printability', {
          action: 'analyze',
          modelUrl: undefined,  // modelUrl 从上游传入
        }, { estimatedDuration: 5000, estimatedCost: 0 })
        if (lastNode) addEdge(lastNode, analyzeNode, 'modelUrl')

        // 修复节点（条件执行 — 仅当需要修复时）
        const repairNode = addNode('print', 'repair-printability', {
          action: 'repair',
          modelUrl: undefined,
        }, {
          estimatedDuration: 15000,
          estimatedCost: 2,
          condition: { type: 'threshold', params: { field: 'needsRepair', value: true } },
        })
        addEdge(analyzeNode, repairNode, 'modelUrl')

        // 多色打印节点
        const printNode = addNode('print', 'multi-color-print', {
          action: 'multi-color',
          maxColors: intent.maxColors || 4,
          maxDepth: intent.maxDepth || 4,
        }, { estimatedDuration: 10000, estimatedCost: 2 })
        addEdge(repairNode, printNode, 'modelUrl')

        lastNode = printNode
      }

      // 如果没有任何变更，默认retexture
      if (nodes.length === 0) {
        addNode('texture', 'retexture', {
          prompt: intent.prompt || '',
          modelUrl: options?.sourceModelUrl,
          inputTaskId: options?.sourceTaskId,
        }, { estimatedDuration: 5000, estimatedCost: 2 })
      }
    }

    return { nodes, edges }
  }

  /**
   * 计算DAG总积分成本
   */
  calculateCost(dag: ExecutionDAG): number {
    return dag.nodes.reduce((sum, node) => sum + node.estimatedCost, 0)
  }

  /**
   * 计算DAG预估总时长（考虑并行 — 关键路径）
   */
  calculateDuration(dag: ExecutionDAG): number {
    if (dag.nodes.length === 0) return 0

    // 构建邻接表和入度表
    const adjList = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const nodeDuration = new Map<string, number>()

    for (const node of dag.nodes) {
      adjList.set(node.id, [])
      inDegree.set(node.id, 0)
      nodeDuration.set(node.id, node.estimatedDuration)
    }

    for (const edge of dag.edges) {
      adjList.get(edge.from)!.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    }

    // 使用动态规划计算最长路径（关键路径）
    // dist[node] = 到达该节点完成时的最大累计时间
    const dist = new Map<string, number>()

    // 拓扑排序 + DP
    const queue: string[] = []
    for (const node of dag.nodes) {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id)
        dist.set(node.id, nodeDuration.get(node.id) || 0)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentDist = dist.get(current) || 0

      for (const next of adjList.get(current) || []) {
        const nextDuration = nodeDuration.get(next) || 0
        const newDist = currentDist + nextDuration
        if ((dist.get(next) || 0) < newDist) {
          dist.set(next, newDist)
        }
        inDegree.set(next, (inDegree.get(next) || 0) - 1)
        if (inDegree.get(next) === 0) {
          queue.push(next)
        }
      }
    }

    // 关键路径 = 所有节点中最大dist值
    let maxDuration = 0
    for (const d of dist.values()) {
      if (d > maxDuration) maxDuration = d
    }

    return maxDuration
  }
}

export const dagBuilder = new DAGBuilder()
