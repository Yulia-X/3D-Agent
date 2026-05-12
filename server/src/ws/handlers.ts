import { z } from 'zod'
import { WSCommand, WSEvent } from '../types.js'
import { WebSocketServer } from './server.js'
import { Orchestrator } from '../orchestrator/index.js'

// Zod schema for WSCommand validation
const WSCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('generate'),
    prompt: z.string().min(1),
    images: z.array(z.string()).optional(),
    fromVersion: z.string().optional(),
  }),
  z.object({
    type: z.literal('edit'),
    prompt: z.string().min(1),
    targetVersion: z.string(),
    sourceModelUrl: z.string().optional(),
    sourceTaskId: z.string().optional(),
  }),
  z.object({
    type: z.literal('clarification:response'),
    payload: z.array(z.object({
      questionId: z.string(),
      field: z.string(),
      value: z.string(),
      timestamp: z.number(),
    })),
  }),
  z.object({
    type: z.literal('confirm:response'),
    accepted: z.boolean(),
    choice: z.string().optional(),
  }),
  z.object({
    type: z.literal('cancel'),
    taskId: z.string(),
  }),
  z.object({
    type: z.literal('version:checkout'),
    versionId: z.string(),
  }),
  z.object({
    type: z.literal('version:fork'),
    fromVersionId: z.string(),
  }),
  z.object({
    type: z.literal('balance:query'),
  }),
  z.object({
    type: z.literal('profile:sync'),
    profile: z.object({
      level: z.enum(['beginner', 'intermediate', 'expert']).optional(),
      usageCount: z.number().optional(),
      stablePreferences: z.record(z.string()).optional(),
    }).passthrough(),
  }),
])

export class CommandHandler {
  constructor(private wsServer: WebSocketServer, private orchestrator: Orchestrator) {}

  /** 验证并解析原始消息 */
  parseMessage(raw: string): { ok: true; command: WSCommand } | { ok: false; error: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'Invalid JSON' }
    }

    const result = WSCommandSchema.safeParse(parsed)
    if (!result.success) {
      return { ok: false, error: result.error.issues.map(i => i.message).join(', ') }
    }

    return { ok: true, command: result.data as WSCommand }
  }

  /** 主分发入口 */
  async handleCommand(sessionId: string, command: WSCommand): Promise<void> {
    switch (command.type) {
      case 'generate':
        await this.handleGenerate(sessionId, command)
        break
      case 'edit':
        await this.handleEdit(sessionId, command)
        break
      case 'clarification:response':
        await this.handleClarificationResponse(sessionId, command)
        break
      case 'confirm:response':
        await this.handleConfirmResponse(sessionId, command)
        break
      case 'cancel':
        await this.handleCancel(sessionId, command)
        break
      case 'version:checkout':
        await this.handleVersionCheckout(sessionId, command)
        break
      case 'version:fork':
        await this.handleVersionFork(sessionId, command)
        break
      case 'balance:query':
        await this.handleBalanceQuery(sessionId)
        break
      case 'profile:sync':
        this.handleProfileSync(sessionId, command)
        break
    }
  }

  /** 生成命令 */
  private async handleGenerate(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'generate' }>
  ): Promise<void> {
    await this.orchestrator.handleGenerate(sessionId, cmd.prompt, cmd.images, cmd.fromVersion)
  }

  /** 编辑命令 */
  private async handleEdit(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'edit' }>
  ): Promise<void> {
    await this.orchestrator.handleEdit(sessionId, cmd.prompt, cmd.targetVersion, cmd.sourceModelUrl, cmd.sourceTaskId)
  }

  /** 澄清响应 */
  private async handleClarificationResponse(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'clarification:response' }>
  ): Promise<void> {
    await this.orchestrator.handleClarificationResponse(sessionId, cmd.payload)
  }

  /** 确认响应 */
  private async handleConfirmResponse(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'confirm:response' }>
  ): Promise<void> {
    await this.orchestrator.handleConfirmResponse(sessionId, cmd.accepted, cmd.choice)
  }

  /** 取消命令 */
  private async handleCancel(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'cancel' }>
  ): Promise<void> {
    await this.orchestrator.handleCancel(sessionId, cmd.taskId)
  }

  /** 版本切换 */
  private async handleVersionCheckout(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'version:checkout' }>
  ): Promise<void> {
    await this.orchestrator.handleVersionCheckout(sessionId, cmd.versionId)
  }

  /** 版本分叉 */
  private async handleVersionFork(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'version:fork' }>
  ): Promise<void> {
    await this.orchestrator.handleVersionFork(sessionId, cmd.fromVersionId)
  }

  /** 余额查询 */
  private async handleBalanceQuery(sessionId: string): Promise<void> {
    await this.orchestrator.handleBalanceQuery(sessionId)
  }

  /** 用户档案同步 */
  private handleProfileSync(
    sessionId: string,
    cmd: Extract<WSCommand, { type: 'profile:sync' }>
  ): void {
    this.wsServer.updateSessionProfile(sessionId, cmd.profile)
  }
}
