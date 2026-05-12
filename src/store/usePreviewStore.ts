/**
 * 3D预览状态管理
 */
import { create } from 'zustand'
import { PreviewState, PreviewUpdate, ChangeScope } from '../types'

interface PreviewStore {
  // 状态
  preview: PreviewState
  
  // Actions
  setModelUrl: (url: string) => void
  setLoading: (loading: boolean) => void
  startIncrementalUpdate: (textureUrl: string) => void
  startFullReplace: (modelUrl: string) => void
  setTransitionProgress: (progress: number) => void
  clearPreview: () => void
  
  // 策略
  getPreviewStrategy: (changeScope: ChangeScope) => PreviewUpdate
}

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  preview: {
    modelUrl: null,
    isLoading: false,
    incrementalUpdate: false,
    previousModelUrl: null,
    transitionProgress: 1,
  },

  setModelUrl: (url) => set((s) => ({
    preview: { ...s.preview, modelUrl: url, isLoading: false, transitionProgress: 1 }
  })),

  setLoading: (loading) => set((s) => ({
    preview: { ...s.preview, isLoading: loading }
  })),

  startIncrementalUpdate: (textureUrl) => set((s) => ({
    preview: {
      ...s.preview,
      incrementalUpdate: true,
      // 贴图更新不改modelUrl，通过事件通知Viewer刷新贴图
    }
  })),

  startFullReplace: (modelUrl) => set((s) => ({
    preview: {
      ...s.preview,
      previousModelUrl: s.preview.modelUrl,
      modelUrl,
      isLoading: true,
      transitionProgress: 0,
    }
  })),

  setTransitionProgress: (progress) => set((s) => ({
    preview: { ...s.preview, transitionProgress: progress }
  })),

  clearPreview: () => set({
    preview: {
      modelUrl: null,
      isLoading: false,
      incrementalUpdate: false,
      previousModelUrl: null,
      transitionProgress: 1,
    }
  }),

  getPreviewStrategy: (changeScope) => {
    if (!changeScope.geometry && changeScope.texture) {
      return { type: 'incremental' }
    }
    if (!changeScope.geometry && !changeScope.texture && !changeScope.skeleton) {
      return { type: 'instant' }
    }
    return { type: 'full_replace' }
  },
}))
