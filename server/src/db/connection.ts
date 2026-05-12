import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from '../config.js'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    // 自动创建data目录
    const dbDir = dirname(config.DB_PATH)
    mkdirSync(dbDir, { recursive: true })

    db = new Database(config.DB_PATH)

    // 开启WAL模式
    db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
