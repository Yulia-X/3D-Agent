// 3D Model Agent Server - Fastify Entry Point

import Fastify from 'fastify'
import fastifyCors from '@fastify/cors'
import fastifyWebsocket from '@fastify/websocket'
import crypto from 'node:crypto'

import { getDb, closeDb } from './db/connection.js'
import { initializeSchema } from './db/schema.js'
import { config } from './config.js'
import { WebSocketServer } from './ws/server.js'
import { CommandHandler } from './ws/handlers.js'
import { Orchestrator } from './orchestrator/index.js'
import { ExperienceStore } from './experience/store.js'
import { seedExperiences } from './experience/seeds.js'

// ============================================================
// 初始化
// ============================================================

// 初始化数据库
const db = getDb()
initializeSchema(db)
console.log(`[server] Database initialized at ${config.DB_PATH}`)

// 初始化 WebSocket 服务
const wsServer = new WebSocketServer(config.WS_HEARTBEAT_INTERVAL)
const orchestrator = new Orchestrator(wsServer)
const commandHandler = new CommandHandler(wsServer, orchestrator)

// 初始化经验库种子数据
seedExperiences(new ExperienceStore())

// ============================================================
// Fastify 实例
// ============================================================

const app = Fastify({ logger: true })

// 注册插件
await app.register(fastifyCors, { origin: config.CORS_ORIGIN })
await app.register(fastifyWebsocket)

// ============================================================
// 路由
// ============================================================

// 健康检查
app.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: Date.now(),
    connections: wsServer.getConnectionCount(),
  }
})

// 创建最小有效 GLB 文件（带索引的立方体）作为 mock 占位模型
function createMinimalGLB(): Buffer {
  // 8 个顶点的立方体 + 12 个三角形索引
  const positions = new Float32Array([
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
  ]);
  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3,  // front
    4, 5, 6,  4, 6, 7,  // back
    3, 2, 6,  3, 6, 5,  // top
    0, 7, 1,  0, 4, 7,  // bottom
    0, 3, 5,  0, 5, 4,  // left
    1, 7, 6,  1, 6, 2,  // right
  ]);

  const posBuf = Buffer.from(positions.buffer);
  const idxBuf = Buffer.from(indices.buffer);
  // Align index buffer to 4 bytes
  const idxPad = (4 - idxBuf.length % 4) % 4;
  const totalBinLength = posBuf.length + idxBuf.length + idxPad;

  const json = JSON.stringify({
    asset: { version: "2.0", generator: "3D-Agent-Mock" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "MockCube" }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0 },
        indices: 1,
        mode: 4,
      }]
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        max: [0.5, 0.5, 0.5],
        min: [-0.5, -0.5, -0.5]
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
        max: [7],
        min: [0]
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length, byteLength: idxBuf.length, target: 34963 }
    ],
    buffers: [{ byteLength: totalBinLength }]
  });

  // Pad JSON to 4-byte alignment
  const jsonPadded = json + ' '.repeat((4 - json.length % 4) % 4);
  const jsonBuffer = Buffer.from(jsonPadded, 'utf8');

  // BIN chunk: positions + indices (padded)
  const binBuffer = Buffer.concat([posBuf, idxBuf, Buffer.alloc(idxPad)]);

  // GLB structure
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);           // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, jsonBuffer, binChunkHeader, binBuffer]);
}

// 模型文件代理路由（解决 Meshy 资源 CORS 问题）
app.get('/api/proxy-model', async (request, reply) => {
  const { url } = request.query as { url?: string };
  if (!url) {
    return reply.status(400).send({ error: 'Missing url parameter' });
  }

  // Mock URL 检测：返回内置占位模型
  if (url.includes('/mock/') || url.includes('mock-')) {
    console.log(`[proxy-model] Mock URL detected, returning placeholder GLB`);
    const minimalGlb = createMinimalGLB();
    reply.header('Content-Type', 'model/gltf-binary');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(minimalGlb);
  }

  console.log(`[proxy-model] Fetching model, url length=${url.length}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': '3D-Model-Agent/1.0',
      },
    });
    if (!response.ok) {
      console.error(`[proxy-model] Upstream returned ${response.status} for url (len=${url.length})`);
      return reply.status(response.status).send({ error: 'Failed to fetch model from upstream' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[proxy-model] Success, fetched ${buffer.length} bytes`);

    // 根据后缀推断 Content-Type
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      glb: 'model/gltf-binary',
      gltf: 'model/gltf+json',
      fbx: 'application/octet-stream',
      obj: 'text/plain',
    };

    reply.header('Content-Type', contentTypes[ext || ''] || 'model/gltf-binary');
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(buffer);
  } catch (error) {
    console.error(`[proxy-model] Fetch failed:`, error);
    return reply.status(500).send({ error: 'Proxy fetch failed' });
  }
})

// WebSocket 路由
app.get('/ws', { websocket: true }, (socket, request) => {
  // 从 query 参数获取 userId
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const userId = url.searchParams.get('userId') || `anon-${crypto.randomUUID().slice(0, 8)}`
  const sessionId = crypto.randomUUID()

  console.log(`[ws] New connection: session=${sessionId}, user=${userId}`)

  // 注册连接
  wsServer.handleConnection(socket, sessionId, userId)

  // 监听消息
  socket.on('message', async (raw: Buffer | ArrayBuffer | Buffer[]) => {
    try {
      const message = raw.toString()
      const parsed = commandHandler.parseMessage(message)

      if (!parsed.ok) {
        wsServer.sendToSession(sessionId, {
          type: 'error:recoverable',
          message: `消息格式错误: ${parsed.error}`,
          suggestedAction: '请检查消息格式后重试',
        })
        return
      }

      wsServer.updateActivity(sessionId)
      await commandHandler.handleCommand(sessionId, parsed.command)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[ws] Error handling message: ${errorMessage}`)
      wsServer.sendToSession(sessionId, {
        type: 'error:recoverable',
        message: `处理命令时出错: ${errorMessage}`,
        suggestedAction: '请稍后重试',
      })
    }
  })

  // 监听pong（心跳响应）
  socket.on('pong', () => {
    wsServer.updateActivity(sessionId)
  })

  // 监听断开
  socket.on('close', () => {
    console.log(`[ws] Disconnected: session=${sessionId}`)
    wsServer.handleDisconnect(sessionId)
  })

  // 监听错误
  socket.on('error', (err: Error) => {
    console.error(`[ws] Socket error: session=${sessionId}`, err.message)
    wsServer.handleDisconnect(sessionId)
  })
})

// ============================================================
// 启动服务
// ============================================================

const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    console.log(`[server] Listening on port ${config.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()

// ============================================================
// 优雅关闭
// ============================================================

const shutdown = async () => {
  console.log('[server] Shutting down...')
  wsServer.stopHeartbeat()
  await app.close()
  closeDb()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
