import { getDb } from '../db/connection.js'
import { CreditTransaction, CREDIT_COSTS } from '../types.js'
import { meshyClient } from '../meshy/client.js'
import { config } from '../config.js'

export class CreditManager {
  /**
   * 获取余额（真实模式调用 Meshy API，Mock 模式用本地）
   */
  async getBalance(userId: string): Promise<number> {
    // 真实模式：从 Meshy API 获取真实余额
    if (!config.MESHY_MOCK) {
      try {
        const realBalance = await meshyClient.getBalance()
        // 同步到本地（用于离线查看历史）
        this.syncBalance(userId, realBalance)
        return realBalance
      } catch (error) {
        // API 调用失败时 fallback 到本地余额
        console.warn('Failed to fetch Meshy balance, using local:', error)
        return this.getLocalBalance(userId)
      }
    }
    // Mock 模式：使用本地余额
    return this.getLocalBalance(userId)
  }

  /**
   * 获取本地余额（从 SQLite 查询）
   */
  private getLocalBalance(userId: string): number {
    const db = getDb()
    const row = db.prepare('SELECT balance FROM credits WHERE user_id = ?').get(userId) as any
    if (!row) {
      this.initUser(userId)
      return 100
    }
    return row.balance
  }

  /**
   * 同步远程余额到本地（用于离线容错）
   */
  private syncBalance(userId: string, balance: number): void {
    const db = getDb()
    const existing = db.prepare('SELECT user_id FROM credits WHERE user_id = ?').get(userId)
    if (existing) {
      db.prepare('UPDATE credits SET balance = ? WHERE user_id = ?').run(balance, userId)
    } else {
      db.prepare('INSERT INTO credits (user_id, balance) VALUES (?, ?)').run(userId, balance)
    }
  }

  /**
   * 检查是否够扣（不实际扣）
   */
  async canAfford(userId: string, operation: string): Promise<boolean> {
    const balance = await this.getBalance(userId)
    const cost = this.getCost(operation)
    return balance >= cost
  }

  /**
   * 扣减积分（返回新余额，不够则抛错）
   */
  async deduct(userId: string, operation: string, taskId: string): Promise<number> {
    const db = getDb()
    const cost = this.getCost(operation)

    if (cost === 0) return await this.getBalance(userId)

    const balance = await this.getBalance(userId)
    if (balance < cost) {
      throw new Error(`Insufficient credits: need ${cost}, have ${balance}`)
    }

    const newBalance = balance - cost
    db.prepare('UPDATE credits SET balance = ? WHERE user_id = ?').run(newBalance, userId)

    // 记录交易
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, operation, amount, timestamp, task_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(txId, userId, operation, -cost, Date.now(), taskId)

    return newBalance
  }

  /**
   * 充值
   */
  async addCredits(userId: string, amount: number): Promise<number> {
    const db = getDb()
    const balance = await this.getBalance(userId)
    const newBalance = balance + amount
    db.prepare('UPDATE credits SET balance = ? WHERE user_id = ?').run(newBalance, userId)

    // 记录交易
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, operation, amount, timestamp, task_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(txId, userId, 'recharge', amount, Date.now(), null)

    return newBalance
  }

  /**
   * 初始化用户积分（新用户100分）
   */
  initUser(userId: string): void {
    const db = getDb()
    const existing = db.prepare('SELECT user_id FROM credits WHERE user_id = ?').get(userId)
    if (existing) return

    db.prepare('INSERT INTO credits (user_id, balance) VALUES (?, ?)').run(userId, 100)
  }

  /**
   * 获取交易历史
   */
  getHistory(userId: string, limit?: number): CreditTransaction[] {
    const db = getDb()
    const sql = limit
      ? 'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY timestamp DESC'

    const params: any[] = limit ? [userId, limit] : [userId]
    const rows = db.prepare(sql).all(...params) as any[]

    return rows.map(row => ({
      id: row.id,
      operation: row.operation,
      amount: row.amount,
      timestamp: row.timestamp,
      taskId: row.task_id || '',
    }))
  }

  /**
   * 获取操作成本
   */
  getCost(operation: string): number {
    return CREDIT_COSTS[operation] ?? 0
  }

  /**
   * 计算DAG总成本
   */
  calculateDAGCost(operations: string[]): number {
    return operations.reduce((total, op) => total + this.getCost(op), 0)
  }
}
