import { DAGNode, ExecutionDAG } from '../types.js'

export class DAGScheduler {
  /**
   * 分析DAG，返回可并行执行的节点组（分层拓扑排序）
   * 每组内的节点可以同时执行
   */
  getExecutionLevels(dag: ExecutionDAG): string[][] {
    if (dag.nodes.length === 0) return []

    // 构建入度表和邻接表
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    for (const node of dag.nodes) {
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    for (const edge of dag.edges) {
      adjList.get(edge.from)!.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    }

    // 分层BFS（Kahn算法）
    const levels: string[][] = []
    let currentLevel: string[] = []

    for (const node of dag.nodes) {
      if (inDegree.get(node.id) === 0) {
        currentLevel.push(node.id)
      }
    }

    while (currentLevel.length > 0) {
      levels.push(currentLevel)
      const nextLevel: string[] = []

      for (const nodeId of currentLevel) {
        for (const successor of adjList.get(nodeId) || []) {
          const newDeg = (inDegree.get(successor) || 0) - 1
          inDegree.set(successor, newDeg)
          if (newDeg === 0) {
            nextLevel.push(successor)
          }
        }
      }

      currentLevel = nextLevel
    }

    return levels
  }

  /**
   * 获取指定节点的所有前置节点ID
   */
  getPredecessors(dag: ExecutionDAG, nodeId: string): string[] {
    return dag.edges
      .filter(edge => edge.to === nodeId)
      .map(edge => edge.from)
  }

  /**
   * 获取指定节点的所有后继节点ID
   */
  getSuccessors(dag: ExecutionDAG, nodeId: string): string[] {
    return dag.edges
      .filter(edge => edge.from === nodeId)
      .map(edge => edge.to)
  }

  /**
   * 判断节点是否可以开始（所有前置已完成）
   */
  canStart(dag: ExecutionDAG, nodeId: string, completedNodes: Set<string>): boolean {
    const predecessors = this.getPredecessors(dag, nodeId)
    return predecessors.every(pred => completedNodes.has(pred))
  }

  /**
   * 获取当前可执行的节点（所有前置已完成且未在运行中）
   */
  getReadyNodes(dag: ExecutionDAG, completedNodes: Set<string>, runningNodes: Set<string>): string[] {
    const ready: string[] = []

    for (const node of dag.nodes) {
      // 跳过已完成、运行中、失败或已跳过的节点
      if (completedNodes.has(node.id) || runningNodes.has(node.id)) continue
      if (node.status === 'done' || node.status === 'failed' || node.status === 'skipped') continue

      // 检查所有前置是否已完成
      if (this.canStart(dag, node.id, completedNodes)) {
        ready.push(node.id)
      }
    }

    return ready
  }

  /**
   * 估算关键路径时长
   */
  getCriticalPathDuration(dag: ExecutionDAG): number {
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

    // DP计算最长路径
    const dist = new Map<string, number>()
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

    let maxDuration = 0
    for (const d of dist.values()) {
      if (d > maxDuration) maxDuration = d
    }

    return maxDuration
  }
}

export const dagScheduler = new DAGScheduler()
