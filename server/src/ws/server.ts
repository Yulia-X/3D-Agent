import { WebSocket } from 'ws'
import { Session, WSEvent, UserProfile } from '../types.js'

export class WebSocketServer {
  private connections: Map<string, { ws: WebSocket; session: Session }> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(private heartbeatMs: number = 30000) {}

  /** 新连接加入 */
  handleConnection(ws: WebSocket, sessionId: string, userId: string): void {
    const session: Session = {
      id: sessionId,
      userId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      userProfile: this.createDefaultProfile(),
    }

    this.connections.set(sessionId, { ws, session })

    // 启动心跳（首次连接时）
    if (this.connections.size === 1) {
      this.startHeartbeat()
    }
  }

  /** 连接断开 */
  handleDisconnect(sessionId: string): void {
    this.connections.delete(sessionId)

    // 无连接时停止心跳
    if (this.connections.size === 0) {
      this.stopHeartbeat()
    }
  }

  /** 向指定session推送事件 */
  sendToSession(sessionId: string, event: WSEvent): void {
    const conn = this.connections.get(sessionId)
    if (!conn) return

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(event))
      conn.session.lastActivity = Date.now()
    }
  }

  /** 向所有连接广播 */
  broadcast(event: WSEvent): void {
    const message = JSON.stringify(event)
    for (const [, conn] of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(message)
      }
    }
  }

  /** 心跳检测（定时ping，超时断开） */
  startHeartbeat(): void {
    if (this.heartbeatInterval) return

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      for (const [sessionId, conn] of this.connections) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          // 如果上次活动超过2个心跳周期，断开
          if (now - conn.session.lastActivity > this.heartbeatMs * 2) {
            conn.ws.terminate()
            this.handleDisconnect(sessionId)
          } else {
            conn.ws.ping()
          }
        } else {
          this.handleDisconnect(sessionId)
        }
      }
    }, this.heartbeatMs)
  }

  /** 停止心跳 */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /** 获取session */
  getSession(sessionId: string): Session | undefined {
    return this.connections.get(sessionId)?.session
  }

  /** 获取在线session数 */
  getConnectionCount(): number {
    return this.connections.size
  }

  /** 更新session活动时间 */
  updateActivity(sessionId: string): void {
    const conn = this.connections.get(sessionId)
    if (conn) {
      conn.session.lastActivity = Date.now()
    }
  }

  /** 更新session用户档案（合并） */
  updateSessionProfile(sessionId: string, updates: Partial<import('../types.js').UserProfile>): void {
    const conn = this.connections.get(sessionId)
    if (conn) {
      conn.session.userProfile = { ...conn.session.userProfile, ...updates }
    }
  }

  /** 创建默认用户档案 */
  private createDefaultProfile(): UserProfile {
    return {
      level: 'intermediate',
      usageCount: 0,
      unlockedFeatures: [],
      preferences: {},
      firstVisit: true,
      clarificationHistory: {
        asked: 0,
        answered: 0,
        skipped: 0,
        avgResponseTime: 0,
      },
      stablePreferences: {},
    }
  }
}
