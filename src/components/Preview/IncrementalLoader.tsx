/**
 * IncrementalLoader — 增量加载控制器（headless component）
 * 监听WebSocket事件，管理预览的增量/全量更新过渡
 */
import { useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import { usePreviewStore } from '../../store/usePreviewStore'
import { WSEvent } from '../../types'

export function IncrementalLoader() {
  const { subscribe } = useWebSocket()
  const {
    startIncrementalUpdate,
    startFullReplace,
    setTransitionProgress,
    setModelUrl,
    setLoading,
  } = usePreviewStore()

  const animationRef = useRef<number | null>(null)
  const transitionStartRef = useRef<number>(0)
  const TRANSITION_DURATION = 1000 // 1秒过渡

  /**
   * 过渡动画：0 → 1，1秒 duration
   */
  const startTransitionAnimation = useCallback(() => {
    // 清除之前的动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    transitionStartRef.current = performance.now()
    setTransitionProgress(0)

    const animate = (now: number) => {
      const elapsed = now - transitionStartRef.current
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1)

      // easeOutCubic 缓动
      const eased = 1 - Math.pow(1 - progress, 3)
      setTransitionProgress(eased)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
        setLoading(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [setTransitionProgress, setLoading])

  /**
   * 处理增量更新事件
   */
  const handleIncrementalUpdate = useCallback((event: WSEvent) => {
    if (event.type === 'preview:incremental') {
      startIncrementalUpdate(event.textureUrl)
    }
  }, [startIncrementalUpdate])

  /**
   * 处理全量替换事件
   */
  const handleCompleteUpdate = useCallback((event: WSEvent) => {
    if (event.type === 'preview:complete') {
      startFullReplace(event.modelUrl)
      // 启动过渡动画
      startTransitionAnimation()
    }
  }, [startFullReplace, startTransitionAnimation])

  // 订阅 WebSocket 事件
  useEffect(() => {
    const unsubIncremental = subscribe('preview:incremental', handleIncrementalUpdate)
    const unsubComplete = subscribe('preview:complete', handleCompleteUpdate)

    return () => {
      unsubIncremental()
      unsubComplete()
      // 清除动画
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [subscribe, handleIncrementalUpdate, handleCompleteUpdate])

  // headless component — 不渲染任何UI
  return null
}

export default IncrementalLoader
