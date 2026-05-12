import 'dotenv/config'

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  MESHY_API_KEY: process.env.MESHY_API_KEY || '',
  MESHY_API_BASE: process.env.MESHY_API_BASE || 'https://api.meshy.ai',
  MESHY_MOCK: process.env.MESHY_MOCK === 'true' || !process.env.MESHY_API_KEY,
  DB_PATH: process.env.DB_PATH || './data/agent.db',
  WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  GLM_API_KEY: process.env.GLM_API_KEY || '',
  GLM_MODEL: process.env.GLM_MODEL || 'glm-4.7',
  GLM_API_BASE: process.env.GLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4',
} as const
