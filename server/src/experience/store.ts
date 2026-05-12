import { getDb } from '../db/connection.js'
import { ExperienceEntry, ExperienceQuery } from '../types.js'

export class ExperienceStore {
  /**
   * 查询经验：给定条件返回匹配的经验条目（按成功率排序）
   */
  query(query: ExperienceQuery): ExperienceEntry[] {
    const db = getDb()
    let rows: any[]

    // 精确匹配条件构建
    const conditions: string[] = []
    const params: any[] = []

    if (query.objectType) {
      conditions.push("json_extract(conditions, '$.objectType') = ?")
      params.push(query.objectType)
    }
    if (query.meshyEndpoint) {
      conditions.push("json_extract(conditions, '$.meshyEndpoint') = ?")
      params.push(query.meshyEndpoint)
    }
    if (query.errorType) {
      conditions.push("json_extract(conditions, '$.errorType') = ?")
      params.push(query.errorType)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM experiences ${whereClause} ORDER BY success_rate DESC`

    rows = db.prepare(sql).all(...params) as any[]

    // inputPattern: SQLite不支持正则，在JS层过滤
    let entries = rows.map(row => this.rowToEntry(row))

    if (query.inputPattern) {
      entries = entries.filter(exp => {
        if (!exp.conditions.inputPattern) return true
        try {
          const regex = new RegExp(exp.conditions.inputPattern, 'i')
          return regex.test(query.inputPattern!)
        } catch {
          return query.inputPattern!.includes(exp.conditions.inputPattern)
        }
      })
    }

    return entries
  }

  /**
   * 记录新经验
   */
  create(entry: Omit<ExperienceEntry, 'id' | 'frequency' | 'createdAt' | 'lastHitAt'>): ExperienceEntry {
    const db = getDb()
    const now = Date.now()
    const id = `exp-${now}-${Math.random().toString(36).slice(2, 6)}`

    const newEntry: ExperienceEntry = {
      ...entry,
      id,
      frequency: 1,
      createdAt: now,
      lastHitAt: now,
    }

    db.prepare(`
      INSERT INTO experiences (id, conditions, resolution, frequency, success_rate, scope, created_at, last_hit_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newEntry.id,
      JSON.stringify(newEntry.conditions),
      JSON.stringify(newEntry.resolution),
      newEntry.frequency,
      newEntry.successRate,
      newEntry.scope,
      newEntry.createdAt,
      newEntry.lastHitAt,
    )

    return newEntry
  }

  /**
   * 更新命中频率
   */
  recordHit(id: string): void {
    const db = getDb()
    db.prepare(`
      UPDATE experiences SET frequency = frequency + 1, last_hit_at = ? WHERE id = ?
    `).run(Date.now(), id)
  }

  /**
   * 更新成功率
   */
  updateSuccessRate(id: string, success: boolean): void {
    const db = getDb()
    const row = db.prepare('SELECT frequency, success_rate FROM experiences WHERE id = ?').get(id) as any
    if (!row) return

    // 加权平均：新成功率 = (旧成功率 * 频率 + 新结果) / (频率 + 1)
    const currentTotal = row.success_rate * row.frequency
    const newRate = (currentTotal + (success ? 1 : 0)) / (row.frequency + 1)

    db.prepare('UPDATE experiences SET success_rate = ? WHERE id = ?').run(newRate, id)
  }

  /**
   * 获取所有经验
   */
  getAll(): ExperienceEntry[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM experiences ORDER BY success_rate DESC').all() as any[]
    return rows.map(row => this.rowToEntry(row))
  }

  /**
   * 获取单条
   */
  getById(id: string): ExperienceEntry | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM experiences WHERE id = ?').get(id) as any
    if (!row) return null
    return this.rowToEntry(row)
  }

  /**
   * 数据库行转为ExperienceEntry
   */
  private rowToEntry(row: any): ExperienceEntry {
    return {
      id: row.id,
      conditions: JSON.parse(row.conditions),
      resolution: JSON.parse(row.resolution),
      frequency: row.frequency,
      successRate: row.success_rate,
      scope: row.scope,
      createdAt: row.created_at,
      lastHitAt: row.last_hit_at,
    }
  }
}
