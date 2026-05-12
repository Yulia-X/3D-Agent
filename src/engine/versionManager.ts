/**
 * 版本树操作管理器
 * 版本号自动编号：V1, V1.1, V1.2, V2, V2.1...
 */
import { VersionNode, VersionTree, VersionAssets, ChangeScope, ExecutionDAG, ModelMetadata } from '../types'

/**
 * 生成版本号
 * 规则：
 * - 首个版本：V1
 * - 编辑产生的子版本：V1.1, V1.2...
 * - 全新生成（从root分叉）：V2, V3...
 */
export function generateVersionId(parentId: string | null, siblingIndex: number): string {
  if (!parentId) {
    return `V${siblingIndex + 1}`
  }
  return `${parentId}.${siblingIndex + 1}`
}

/**
 * 创建新版本节点
 */
export function createVersionNode(params: {
  parentId: string | null
  siblingIndex: number
  assets: VersionAssets
  trigger: { type: 'initial_generation' | 'edit_request' | 'variant_fork' | 'auto_refinement'; userInput: string; resolvedIntent: Record<string, any> }
  changeScope: ChangeScope
  dagExecuted: ExecutionDAG | null
}): VersionNode {
  const id = generateVersionId(params.parentId, params.siblingIndex)
  
  return {
    id,
    parentId: params.parentId,
    children: [],
    assets: params.assets,
    createdAt: Date.now(),
    trigger: params.trigger,
    changeScope: params.changeScope,
    dagExecuted: params.dagExecuted,
  }
}

/**
 * 创建默认Assets（模型生成完成时）
 */
export function createDefaultAssets(modelUrl: string, metadata?: Partial<ModelMetadata>): VersionAssets {
  return {
    modelUrl,
    textureUrls: [],
    thumbnailUrl: '',
    metadata: {
      polyCount: metadata?.polyCount || 5000,
      format: metadata?.format || 'glb',
      dimensions: metadata?.dimensions || { x: 1, y: 1, z: 1 },
      hasAnimation: metadata?.hasAnimation || false,
      hasSkeleton: metadata?.hasSkeleton || false,
    }
  }
}

/**
 * 初始化空版本树
 */
export function createEmptyVersionTree(taskId: string): VersionTree {
  return {
    taskId,
    root: null,
    currentHead: '',
  }
}

/**
 * 获取版本的完整路径（从root到该节点）
 */
export function getVersionPath(allVersions: Record<string, VersionNode>, targetId: string): string[] {
  const path: string[] = []
  let current = targetId
  
  while (current) {
    path.unshift(current)
    const node = allVersions[current]
    if (!node || !node.parentId) break
    current = node.parentId
  }
  
  return path
}

/**
 * 获取版本树的最大深度
 */
export function getTreeDepth(allVersions: Record<string, VersionNode>, rootId: string): number {
  const root = allVersions[rootId]
  if (!root) return 0
  if (root.children.length === 0) return 1
  
  return 1 + Math.max(...root.children.map(childId => getTreeDepth(allVersions, childId)))
}

/**
 * 判断版本树是否有分支（任何节点有多个children）
 */
export function hasBranches(allVersions: Record<string, VersionNode>): boolean {
  return Object.values(allVersions).some(node => node.children.length > 1)
}
