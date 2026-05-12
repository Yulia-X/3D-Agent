import type Database from 'better-sqlite3'

const SCHEMA_SQL = `
-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  prompt TEXT NOT NULL,
  images TEXT,
  from_version TEXT,
  resolved_intent TEXT,
  execution_dag TEXT,
  change_scope TEXT,
  experience_hits TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  error TEXT
);

-- 版本表
CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  parent_id TEXT,
  children TEXT NOT NULL DEFAULT '[]',
  assets TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  trigger_data TEXT NOT NULL,
  change_scope TEXT NOT NULL,
  dag_executed TEXT,
  user_rating TEXT,
  user_comment TEXT
);

-- 版本树表
CREATE TABLE IF NOT EXISTS version_trees (
  task_id TEXT PRIMARY KEY,
  root_id TEXT,
  current_head TEXT NOT NULL DEFAULT ''
);

-- 经验库表
CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  conditions TEXT NOT NULL,
  resolution TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  success_rate REAL NOT NULL DEFAULT 0.5,
  scope TEXT NOT NULL DEFAULT 'global',
  created_at INTEGER NOT NULL,
  last_hit_at INTEGER NOT NULL
);

-- 积分表
CREATE TABLE IF NOT EXISTS credits (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 100
);

-- 积分交易表
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  amount INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  task_id TEXT
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  connected_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  user_profile TEXT NOT NULL
);
`

export function initializeSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL)
}
