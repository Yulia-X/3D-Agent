/**
 * 澄清队列管理
 * 处理多任务同时需要澄清的竞态场景
 * 每次只展示队头任务的卡片，回答后弹出展示下一个
 */
import { ClarificationQueueItem, ClarificationQuestion } from '../types'

const QUEUE_STORAGE_KEY = '3d-agent-clarification-queue'

export class ClarificationQueue {
  private queue: ClarificationQueueItem[] = []

  constructor() {
    this.loadFromStorage()
  }

  /**
   * 从localStorage恢复队列状态
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch {
      this.queue = []
    }
  }

  /**
   * 持久化到localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue))
    } catch {
      // Storage full or unavailable, continue without persistence
    }
  }

  /**
   * 入队：新增一个待澄清任务
   */
  enqueue(taskId: string, questions: ClarificationQuestion[], originalPrompt: string, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const item: ClarificationQueueItem = {
      taskId,
      questions,
      createdAt: Date.now(),
      priority,
      originalPrompt
    }
    
    // 按优先级插入（high在前）
    if (priority === 'high') {
      const firstNonHigh = this.queue.findIndex(i => i.priority !== 'high')
      if (firstNonHigh === -1) {
        this.queue.push(item)
      } else {
        this.queue.splice(firstNonHigh, 0, item)
      }
    } else {
      this.queue.push(item)
    }
    
    this.saveToStorage()
  }

  /**
   * 出队：完成当前任务的澄清
   */
  dequeue(): ClarificationQueueItem | undefined {
    const item = this.queue.shift()
    this.saveToStorage()
    return item
  }

  /**
   * 查看队头（不弹出）
   */
  peek(): ClarificationQueueItem | undefined {
    return this.queue[0]
  }

  /**
   * 队列长度
   */
  size(): number {
    return this.queue.length
  }

  /**
   * 队列是否为空
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * 移除指定任务（如任务被取消）
   */
  removeByTaskId(taskId: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter(item => item.taskId !== taskId)
    if (this.queue.length !== initialLength) {
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * 检查是否有指定任务的待澄清
   */
  hasTask(taskId: string): boolean {
    return this.queue.some(item => item.taskId === taskId)
  }

  /**
   * 获取剩余任务数（不含当前正在处理的）
   */
  remainingCount(): number {
    return Math.max(0, this.queue.length - 1)
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
  }

  /**
   * 获取完整队列快照（只读）
   */
  getAll(): readonly ClarificationQueueItem[] {
    return [...this.queue]
  }
}

// 单例
export const clarificationQueue = new ClarificationQueue()
