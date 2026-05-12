import { OrchestratorState, OrchestratorContext } from '../types.js'

// ============================================================
// Pipeline — 任务管线管理
// ============================================================

export class Pipeline {
  private state: OrchestratorState = 'intent_parsing'
  private context: OrchestratorContext
  private pauseResolver: ((value: any) => void) | null = null
  private paused: boolean = false

  constructor(context: OrchestratorContext) {
    this.context = context
  }

  getState(): OrchestratorState {
    return this.state
  }

  getContext(): OrchestratorContext {
    return this.context
  }

  /**
   * 状态流转
   */
  transition(newState: OrchestratorState): void {
    this.state = newState
    this.context.state = newState
  }

  /**
   * 暂停管线（等待用户澄清/确认）
   */
  async pause(): Promise<any> {
    this.paused = true
    return new Promise((resolve) => {
      this.pauseResolver = resolve
    })
  }

  /**
   * 恢复管线（用户回复后调用）
   */
  resume(data: any): void {
    if (this.pauseResolver) {
      this.paused = false
      const resolver = this.pauseResolver
      this.pauseResolver = null
      resolver(data)
    }
  }

  /**
   * 更新context
   */
  updateContext(partial: Partial<OrchestratorContext>): void {
    Object.assign(this.context, partial)
  }

  /**
   * 是否处于等待状态
   */
  isPaused(): boolean {
    return this.paused
  }
}
