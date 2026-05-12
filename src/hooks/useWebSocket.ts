/**
 * WebSocket Hook
 * 支持真实WebSocket连接和Mock模拟两种模式
 * 通过环境变量 VITE_WS_MODE 控制（'real' | 'mock'，默认 'mock'）
 * 提供 send(command) / subscribe(eventType, handler) 接口
 */
import { useCallback, useEffect, useRef } from 'react'
import { WSEvent, WSCommand } from '../types'

type EventHandler = (event: WSEvent) => void
type UnsubscribeFn = () => void

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting'

interface WebSocketServiceInterface {
  subscribe(eventType: string, handler: EventHandler): UnsubscribeFn
  subscribeAll(handler: EventHandler): UnsubscribeFn
  send(command: WSCommand): void
}

// ============================================================
// RealWebSocketService - 真实WebSocket连接
// ============================================================
class RealWebSocketService implements WebSocketServiceInterface {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _connectionState: ConnectionState = 'disconnected'
  private stateListeners: Set<(state: ConnectionState) => void> = new Set()

  constructor(url: string) {
    this.url = url
    this.connect()
  }

  get connectionState(): ConnectionState {
    return this._connectionState
  }

  onStateChange(listener: (state: ConnectionState) => void): UnsubscribeFn {
    this.stateListeners.add(listener)
    return () => { this.stateListeners.delete(listener) }
  }

  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state
    this.stateListeners.forEach(listener => listener(state))
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setConnectionState('connected')
        // 连接建立后自动查询余额
        this.send({ type: 'balance:query' })
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as WSEvent
          this.dispatch(parsed)
        } catch (e) {
          console.error('[RealWebSocketService] Failed to parse message:', e)
        }
      }

      this.ws.onclose = () => {
        this.setConnectionState('disconnected')
        this.attemptReconnect()
      }

      this.ws.onerror = () => {
        // onclose will be called after onerror
      }
    } catch (e) {
      console.error('[RealWebSocketService] Connection error:', e)
      this.attemptReconnect()
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[RealWebSocketService] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    this.setConnectionState('reconnecting')

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectTimer = setTimeout(() => {
      console.log(`[RealWebSocketService] Reconnecting... attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      this.connect()
    }, this.reconnectDelay)
  }

  private dispatch(event: WSEvent): void {
    // 通知特定类型的订阅者
    const typeHandlers = this.handlers.get(event.type)
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(event))
    }
    // 通知全局订阅者
    const allHandlers = this.handlers.get('*')
    if (allHandlers) {
      allHandlers.forEach(handler => handler(event))
    }
  }

  subscribe(eventType: string, handler: EventHandler): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)

    return () => {
      this.handlers.get(eventType)?.delete(handler)
    }
  }

  subscribeAll(handler: EventHandler): UnsubscribeFn {
    return this.subscribe('*', handler)
  }

  send(command: WSCommand): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command))
    } else {
      console.warn('[RealWebSocketService] Cannot send, WebSocket not connected')
    }
  }
}

// ============================================================
// MockWebSocketService - 模拟WebSocket（保留原有逻辑）
// ============================================================
const MOCK_MODEL_URL = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'

class MockWebSocketService implements WebSocketServiceInterface {
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private eventQueue: WSEvent[] = []
  private processing = false

  /**
   * 订阅特定类型事件
   */
  subscribe(eventType: string, handler: EventHandler): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
    
    return () => {
      this.handlers.get(eventType)?.delete(handler)
    }
  }

  /**
   * 订阅所有事件
   */
  subscribeAll(handler: EventHandler): UnsubscribeFn {
    return this.subscribe('*', handler)
  }

  /**
   * 发送命令（模拟 → 触发对应的事件序列）
   */
  send(command: WSCommand): void {
    switch (command.type) {
      case 'generate':
        this.simulateGeneration(command.prompt, command.fromVersion)
        break
      case 'edit':
        this.simulateEdit(command.prompt, command.targetVersion, command.sourceModelUrl)
        break
      case 'cancel':
        this.emit({ type: 'error:recoverable', message: '任务已取消', suggestedAction: '重新开始' })
        break
      case 'balance:query':
        this.emit({ type: 'balance:update', balance: 100 })
        break
      default:
        break
    }
  }

  /**
   * 直接推送事件（供 orchestrator 使用）
   */
  emit(event: WSEvent): void {
    this.eventQueue.push(event)
    if (!this.processing) {
      this.processQueue()
    }
  }

  /**
   * 延迟推送事件
   */
  emitDelayed(event: WSEvent, delayMs: number): void {
    setTimeout(() => this.emit(event), delayMs)
  }

  private processQueue(): void {
    this.processing = true
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!
      this.dispatch(event)
    }
    this.processing = false
  }

  private dispatch(event: WSEvent): void {
    // 通知特定类型的订阅者
    const typeHandlers = this.handlers.get(event.type)
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(event))
    }
    // 通知全局订阅者
    const allHandlers = this.handlers.get('*')
    if (allHandlers) {
      allHandlers.forEach(handler => handler(event))
    }
  }

  /**
   * 模拟生成流程（node:progress → preview:complete）
   */
  private simulateGeneration(prompt: string, fromVersion?: string): void {
    const taskId = `task-${Date.now()}`
    const totalSteps = 3
    const steps = [
      { nodeId: 'node-0', nodeName: '生成预览模型', progress: 50, delay: 3000 },
      { nodeId: 'node-1', nodeName: '精炼细节', progress: 70, delay: 4000 },
      { nodeId: 'node-2', nodeName: '质量检测', progress: 90, delay: 1500 },
    ]

    // 前置阶段：task:progress
    this.emitDelayed(
      { type: 'task:progress', taskId, step: '正在解析意图...', progress: 5, estimatedRemaining: 10000 },
      500
    )
    this.emitDelayed(
      { type: 'task:progress', taskId, step: '正在规划执行方案...', progress: 25, estimatedRemaining: 8000 },
      1000
    )

    // DAG 节点执行：node:progress
    let accumulated = 1500
    steps.forEach(({ nodeId, nodeName, progress }, idx) => {
      // 节点开始
      accumulated += 300
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress: 0 },
        accumulated
      )
      // 节点进度
      accumulated += 1500
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress },
        accumulated
      )
      // 节点完成
      accumulated += 500
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress: 100 },
        accumulated
      )
      this.emitDelayed(
        { type: 'dag:node_done', taskId, nodeId, output: { agentType: nodeName, status: 'SUCCEEDED' } },
        accumulated
      )
    })

    // 完成事件
    accumulated += 500
    this.emitDelayed(
      {
        type: 'preview:complete',
        taskId,
        modelUrl: MOCK_MODEL_URL,
        version: {
          id: fromVersion ? `${fromVersion}.1` : 'v1',
          parentId: fromVersion || null,
          children: [],
          assets: {
            modelUrl: MOCK_MODEL_URL,
            textureUrls: [],
            thumbnailUrl: '',
            metadata: { polyCount: 5000, format: 'glb', dimensions: { x: 1, y: 1, z: 1 }, hasAnimation: false, hasSkeleton: false }
          },
          createdAt: Date.now() + accumulated,
          trigger: { type: 'initial_generation', userInput: prompt, resolvedIntent: {} },
          changeScope: { geometry: true, texture: true, skeleton: false, animation: false, print: false, metadata: false },
          dagExecuted: null,
        }
      },
      accumulated
    )
    accumulated += 100
    this.emitDelayed(
      { type: 'task:progress', taskId, step: '生成完成', progress: 100, estimatedRemaining: 0 },
      accumulated
    )
  }

  /**
   * 模拟编辑流程（可能是增量或全量）
   */
  private simulateEdit(prompt: string, targetVersion: string, sourceModelUrl?: string): void {
    const taskId = `task-${Date.now()}`
    
    // 判断是否为纹理编辑（简单关键词检测）
    const textureKeywords = ['颜色', '材质', '纹理', '贴图', '色彩', '粉色', '红色', '蓝色', '绿色', '金属', '木纹']
    const isTextureOnly = textureKeywords.some(k => prompt.includes(k))

    if (isTextureOnly) {
      // 增量更新 — 快速，单节点
      const totalSteps = 1
      this.emitDelayed(
        { type: 'task:progress', taskId, step: '正在规划执行方案...', progress: 25, estimatedRemaining: 3000 },
        500
      )
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId: 'node-0', nodeName: '更新纹理', stepIndex: 1, totalSteps, progress: 0 },
        800
      )
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId: 'node-0', nodeName: '更新纹理', stepIndex: 1, totalSteps, progress: 80 },
        2000
      )
      this.emitDelayed(
        { type: 'preview:incremental', textureUrl: '/textures/updated-texture.png' },
        2500
      )
      this.emitDelayed(
        { type: 'node:progress', taskId, nodeId: 'node-0', nodeName: '更新纹理', stepIndex: 1, totalSteps, progress: 100 },
        2800
      )
      this.emitDelayed(
        { type: 'dag:node_done', taskId, nodeId: 'node-0', output: { agentType: 'retexture', status: 'SUCCEEDED' } },
        2800
      )
      this.emitDelayed(
        { type: 'task:progress', taskId, step: '完成', progress: 100, estimatedRemaining: 0 },
        3000
      )
    } else {
      // 全量替换 — 较慢，多节点
      const totalSteps = 3
      const steps = [
        { nodeId: 'node-0', nodeName: '重建网格', progress: 80 },
        { nodeId: 'node-1', nodeName: '应用纹理', progress: 70 },
        { nodeId: 'node-2', nodeName: '质量检测', progress: 90 },
      ]

      this.emitDelayed(
        { type: 'task:progress', taskId, step: '正在规划执行方案...', progress: 25, estimatedRemaining: 12000 },
        500
      )

      let accumulated = 800
      steps.forEach(({ nodeId, nodeName, progress }, idx) => {
        accumulated += 300
        this.emitDelayed(
          { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress: 0 },
          accumulated
        )
        accumulated += 2000
        this.emitDelayed(
          { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress },
          accumulated
        )
        accumulated += 500
        this.emitDelayed(
          { type: 'node:progress', taskId, nodeId, nodeName, stepIndex: idx + 1, totalSteps, progress: 100 },
          accumulated
        )
        this.emitDelayed(
          { type: 'dag:node_done', taskId, nodeId, output: { agentType: nodeName, status: 'SUCCEEDED' } },
          accumulated
        )
      })

      accumulated += 500
      this.emitDelayed(
        { type: 'task:progress', taskId, step: '完成', progress: 100, estimatedRemaining: 0 },
        accumulated
      )
      this.emitDelayed(
        {
          type: 'preview:complete',
          taskId,
          modelUrl: MOCK_MODEL_URL,
          version: {
            id: `${targetVersion}.1`,
            parentId: targetVersion,
            children: [],
            assets: {
              modelUrl: MOCK_MODEL_URL,
              textureUrls: [],
              thumbnailUrl: '',
              metadata: { polyCount: 5000, format: 'glb', dimensions: { x: 1, y: 1, z: 1 }, hasAnimation: false, hasSkeleton: false }
            },
            createdAt: Date.now() + accumulated,
            trigger: { type: 'edit_request', userInput: prompt, resolvedIntent: {} },
            changeScope: { geometry: true, texture: true, skeleton: false, animation: false, print: false, metadata: false },
            dagExecuted: null,
          }
        },
        accumulated
      )
    }
  }
}

// 根据环境变量选择实现
const wsService: WebSocketServiceInterface = import.meta.env.VITE_WS_MODE === 'real'
  ? new RealWebSocketService('ws://localhost:3001/ws?userId=default-user')
  : new MockWebSocketService()

/**
 * useWebSocket hook
 * 组件中使用，自动管理订阅生命周期
 */
export function useWebSocket() {
  const handlersRef = useRef<UnsubscribeFn[]>([])

  useEffect(() => {
    return () => {
      // 组件卸载时取消所有订阅
      handlersRef.current.forEach(unsub => unsub())
      handlersRef.current = []
    }
  }, [])

  const subscribe = useCallback((eventType: string, handler: EventHandler) => {
    const unsub = wsService.subscribe(eventType, handler)
    handlersRef.current.push(unsub)
    return unsub
  }, [])

  const subscribeAll = useCallback((handler: EventHandler) => {
    const unsub = wsService.subscribeAll(handler)
    handlersRef.current.push(unsub)
    return unsub
  }, [])

  const send = useCallback((command: WSCommand) => {
    wsService.send(command)
  }, [])

  return { subscribe, subscribeAll, send }
}

// 导出service供orchestrator直接调用
export { wsService }
