/**
 * 预览策略Hook
 * 根据变更范围决定预览更新方式
 */
import { useCallback } from 'react'
import { ChangeScope, PreviewUpdate } from '../types'
import { usePreviewStore } from '../store/usePreviewStore'

export function usePreviewStrategy() {
  const { startIncrementalUpdate, startFullReplace, setLoading } = usePreviewStore()

  /**
   * 根据变更范围获取预览策略
   */
  const getStrategy = useCallback((changeScope: ChangeScope): PreviewUpdate => {
    if (!changeScope.geometry && changeScope.texture) {
      return { type: 'incremental' }
    }
    if (!changeScope.geometry && !changeScope.texture && !changeScope.skeleton && !changeScope.animation) {
      return { type: 'instant' }
    }
    return { type: 'full_replace' }
  }, [])

  /**
   * 应用预览更新
   */
  const applyUpdate = useCallback((strategy: PreviewUpdate, payload: { modelUrl?: string; textureUrl?: string }) => {
    switch (strategy.type) {
      case 'instant':
        // 即时更新（shader参数等），不需要加载
        break
      case 'incremental':
        if (payload.textureUrl) {
          startIncrementalUpdate(payload.textureUrl)
        }
        break
      case 'full_replace':
        if (payload.modelUrl) {
          setLoading(true)
          startFullReplace(payload.modelUrl)
        }
        break
    }
  }, [startIncrementalUpdate, startFullReplace, setLoading])

  /**
   * 预估更新耗时（ms）
   */
  const estimateDuration = useCallback((changeScope: ChangeScope): number => {
    if (!changeScope.geometry && changeScope.texture) return 2000
    if (!changeScope.geometry && !changeScope.texture) return 0
    if (changeScope.skeleton || changeScope.animation) return 15000
    return 10000
  }, [])

  return {
    getStrategy,
    applyUpdate,
    estimateDuration,
  }
}
