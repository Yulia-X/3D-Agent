/**
 * 版本树状态管理
 * 管理模型版本历史、分支、切换
 */
import { create } from 'zustand'
import { VersionTree, VersionNode, VersionAssets, ChangeScope, ExecutionDAG, VersionTrigger } from '../types'

interface VersionStore {
  // 状态
  versionTree: VersionTree
  allVersions: Record<string, VersionNode>  // id → node 快速查找

  // Actions
  addVersion: (node: VersionNode) => void
  checkout: (versionId: string) => void
  fork: (fromVersionId: string) => string  // 返回新版本ID
  updateCurrentAssets: (assets: Partial<VersionAssets>) => void
  rateVersion: (versionId: string, rating: 'good' | 'bad') => void
  getVersionHistory: () => VersionNode[]
  getBranches: () => string[][]  // 返回所有分支路径
  hasMultipleVersions: () => boolean
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versionTree: {
    taskId: '',
    root: null,
    currentHead: '',
  },
  allVersions: {},

  addVersion: (node) => set((s) => {
    const newAll = { ...s.allVersions, [node.id]: node }
    
    // 更新父节点的children
    if (node.parentId && newAll[node.parentId]) {
      newAll[node.parentId] = {
        ...newAll[node.parentId],
        children: [...newAll[node.parentId].children, node.id]
      }
    }

    return {
      allVersions: newAll,
      versionTree: {
        ...s.versionTree,
        root: s.versionTree.root || node,
        currentHead: node.id,
      }
    }
  }),

  checkout: (versionId) => set((s) => {
    if (!s.allVersions[versionId]) return s
    return {
      versionTree: { ...s.versionTree, currentHead: versionId }
    }
  }),

  fork: (fromVersionId) => {
    const state = get()
    const parent = state.allVersions[fromVersionId]
    if (!parent) return ''
    
    // 计算新版本号
    const siblingCount = parent.children.length
    const newId = `${fromVersionId}.${siblingCount + 1}`
    return newId
  },

  updateCurrentAssets: (assets) => set((s) => {
    const head = s.versionTree.currentHead
    if (!head || !s.allVersions[head]) return s
    return {
      allVersions: {
        ...s.allVersions,
        [head]: {
          ...s.allVersions[head],
          assets: { ...s.allVersions[head].assets, ...assets }
        }
      }
    }
  }),

  rateVersion: (versionId, rating) => set((s) => {
    if (!s.allVersions[versionId]) return s
    return {
      allVersions: {
        ...s.allVersions,
        [versionId]: { ...s.allVersions[versionId], userRating: rating }
      }
    }
  }),

  getVersionHistory: () => {
    const state = get()
    return Object.values(state.allVersions).sort((a, b) => a.createdAt - b.createdAt)
  },

  getBranches: () => {
    const state = get()
    const branches: string[][] = []
    
    function traverse(nodeId: string, path: string[]) {
      const node = state.allVersions[nodeId]
      if (!node) return
      const newPath = [...path, nodeId]
      if (node.children.length === 0) {
        branches.push(newPath)
      } else {
        node.children.forEach(childId => traverse(childId, newPath))
      }
    }
    
    if (state.versionTree.root) {
      traverse(state.versionTree.root.id, [])
    }
    return branches
  },

  hasMultipleVersions: () => {
    return Object.keys(get().allVersions).length > 1
  },
}))
