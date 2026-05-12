# 3D Model Agent

一个面向设计师与终端用户的对话式 3D 模型生成 Agent，支持 AI 生成探索、3D 模型编辑和工作流编排三大模式。通过意图澄清系统与渐进式暴露设计，让不同水平的用户都能高效完成 3D 内容创作。

---

## 功能特性

### 三档模式架构

| 模式 | 适用场景 | 核心能力 |
|------|---------|---------|
| **探索模式** | 快速生成概念模型 | 提示词输入、风格选择、AI 生成进度追踪、结果展示卡片 |
| **编辑模式** | 精细调整 3D 模型 | 实时预览画布、材质面板、光照调节、空间变换、导出控制 |
| **管线模式** | 高级定制与自动化 | 节点编辑器、参数面板、流程执行控制 |

### 核心能力

- **对话式 AI 生成**：基于 GLM-4.7 的意图理解与澄清系统，通过自然语言交互生成 3D 模型
- **无限画布**：支持缩放、平移的无限画布，模型以卡片形式组织呈现
- **3D 实时预览**：基于 React Three Fiber 的声明式 3D 场景渲染，支持轨道控制、环境光照
- **版本树管理**：分支式版本历史，支持分叉、回溯与对比
- **工作流编排**：可视化节点编辑器，自定义生成与处理管线
- **渐进式暴露**：根据用户熟练度动态切换界面复杂度

---

## 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| React 18 + Vite + TypeScript | UI 框架与构建工具 |
| Tailwind CSS | 样式系统 |
| @react-three/fiber + @react-three/drei | 3D 场景渲染 |
| Zustand | 全局状态管理 |
| React Flow | 节点编辑器（管线模式） |
| Framer Motion | 动画与过渡 |
| Lucide React | 图标系统 |

### 后端

| 技术 | 用途 |
|------|------|
| Fastify + TypeScript | Web 服务框架 |
| WebSocket (@fastify/websocket) | 实时通信 |
| Better SQLite3 | 本地数据持久化 |
| Zod | 数据校验 |
| tsx | TypeScript 运行时 |

### 外部服务

- **Meshy API**：文生 3D / 图生 3D 模型生成
- **智谱 GLM-4.7**：意图理解、对话生成、策略路由

---

## 项目结构

```
.
├── src/                          # 前端源码
│   ├── components/               # React 组件
│   │   ├── Shell/                # 顶部栏、状态指示器、统一输入
│   │   ├── Canvas/               # 无限画布、模型卡片
│   │   ├── Preview/              # 3D 模型预览、增量加载
│   │   ├── Panel/                # 编辑面板、导出面板
│   │   ├── Chat/                 # 对话消息、进度展示
│   │   ├── Clarification/        # 澄清交互组件
│   │   └── VersionTree/          # 版本时间线、分支图
│   ├── engine/                   # 前端业务引擎
│   ├── store/                    # Zustand 状态仓库
│   ├── hooks/                    # 自定义 Hooks
│   └── types/                    # TypeScript 类型定义
├── server/                       # 后端服务
│   └── src/
│       ├── agents/               # 3D Agent 能力模块
│       ├── orchestrator/         # 工作流编排与意图解析
│       ├── meshy/                # Meshy API 客户端
│       ├── llm/                  # GLM 模型接入
│       ├── ws/                   # WebSocket 处理器
│       ├── dag/                  # DAG 执行引擎
│       └── db/                   # SQLite 数据库与 Schema
└── .qoder/                       # Qoder Agent 知识库
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server && npm install
```

### 环境变量

复制并配置环境变量：

```bash
# 后端
cp server/.env.example server/.env

# 前端（可选）
# .env 已内置，VITE_WS_MODE=real 表示连接真实后端
```

编辑 `server/.env`，填入你的 API 密钥：

```env
# Meshy API（留空则使用 Mock 模式）
MESHY_API_KEY=your_meshy_api_key
MESHY_MOCK=false

# 智谱 GLM API
GLM_API_KEY=your_glm_api_key
```

### 启动开发服务器

```bash
# 同时启动前端 + 后端
npm run dev:all

# 或分别启动
npm run dev          # 前端（Vite 开发服务器）
npm run dev:server   # 后端（Fastify + WebSocket）
```

前端默认运行在 `http://localhost:5173`，后端默认在 `http://localhost:3001`。

---

## 开发

### 前端构建

```bash
npm run build    # TypeScript 编译 + Vite 打包
npm run preview  # 预览生产构建
```

### 后端构建

```bash
cd server
npm run build    # tsc 编译
npm run start    # 运行生产版本
```

### 数据库

后端使用 SQLite 存储对话历史、生成任务与版本信息。数据文件位于 `server/data/agent.db`。

---

## 许可证

MIT
