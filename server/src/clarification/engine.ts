import {
  ClarificationQuestion,
  ClarificationDecision,
  ClarificationCheckpoint,
  PipelineSnapshot,
  UserProfile,
  IntentParseResult,
  OrchestratorContext,
  UserClarificationResponse,
  ModeStrategy,
} from '../types.js'
import { glmClient } from '../llm/glmClient.js'

// ============================================================
// 字段问题模板映射
// ============================================================

interface FieldTemplate {
  question: string
  type: ClarificationQuestion['type']
  options: Array<{ label: string; value: string; description?: string }>
  priority: ClarificationQuestion['priority']
  impact: ClarificationQuestion['impact']
  /** 仅中高级用户才展示 */
  minLevel?: 'intermediate' | 'expert'
}

const FIELD_TEMPLATES: Record<string, FieldTemplate> = {
  style: {
    question: '你想要什么风格？',
    type: 'single_choice',
    options: [
      { label: '写实', value: 'realistic', description: '真实光影与材质' },
      { label: '卡通', value: 'cartoon', description: '柔和明亮的卡通风格' },
      { label: 'Low-Poly', value: 'low-poly', description: '低面数几何风格' },
      { label: '动漫', value: 'anime', description: '日式动漫渲染风格' },
    ],
    priority: 'important',
    impact: 'medium',
  },
  topology: {
    question: '网格拓扑偏好？',
    type: 'single_choice',
    options: [
      { label: '四边面', value: 'quad', description: '适合动画和细分' },
      { label: '三角面', value: 'triangle', description: '适合实时渲染' },
      { label: '自动', value: 'auto', description: '由系统根据用途决定' },
    ],
    priority: 'nice_to_have',
    impact: 'medium',
  },
  polyBudget: {
    question: '目标面数？',
    type: 'single_choice',
    options: [
      { label: '低面 (500)', value: '500', description: '适合移动端/图标' },
      { label: '标准 (5000)', value: '5000', description: '适合Web展示' },
      { label: '高精 (10000)', value: '10000', description: '适合高质量渲染' },
    ],
    priority: 'important',
    impact: 'medium',
  },
  outputFormat: {
    question: '导出格式？',
    type: 'single_choice',
    options: [
      { label: 'GLB', value: 'GLB', description: '通用Web 3D格式' },
      { label: 'FBX', value: 'FBX', description: '游戏引擎通用' },
      { label: 'OBJ', value: 'OBJ', description: '传统3D格式' },
      { label: 'USDZ', value: 'USDZ', description: 'Apple AR专用' },
    ],
    priority: 'nice_to_have',
    impact: 'low',
  },
  artStyle: {
    question: '艺术风格偏好？',
    type: 'single_choice',
    options: [
      { label: '写实', value: 'realistic' },
      { label: '风格化', value: 'stylized' },
      { label: '像素', value: 'voxel' },
      { label: '手绘', value: 'hand-painted' },
    ],
    priority: 'important',
    impact: 'medium',
    minLevel: 'intermediate',
  },
  textureResolution: {
    question: '纹理分辨率？',
    type: 'single_choice',
    options: [
      { label: '512px', value: '512', description: '低分辨率，文件小' },
      { label: '1024px', value: '1024', description: '标准分辨率' },
      { label: '2048px', value: '2048', description: '高分辨率' },
      { label: '4096px', value: '4096', description: '超高清' },
    ],
    priority: 'nice_to_have',
    impact: 'low',
    minLevel: 'intermediate',
  },
}

// ============================================================
// 统一策略配置（不再区分用户等级）
// ============================================================

const UNIFIED_STRATEGY: ModeStrategy = {
  maxQuestions: 2,
  allowedPriorities: ['critical', 'important'],
  timeout: 30,
  timeoutBehavior: 'use_defaults',
}

// ============================================================
// ClarificationEngine 类
// ============================================================

export class ClarificationEngine {
  private maxRounds: number = 2

  // ----------------------------------------------------------
  // 检查点判定
  // ----------------------------------------------------------

  /**
   * pre_planning 检查点：检测意图解析中的低置信度字段
   */
  async checkPrePlanning(
    context: OrchestratorContext,
    parseResult: IntentParseResult
  ): Promise<ClarificationCheckpoint> {
    const decision = await this.shouldClarify(
      parseResult,
      context.userProfile,
      0 // pre_planning 默认第0轮
    )

    const questions = decision.shouldClarify
      ? decision.questions
      : []

    const snapshot: PipelineSnapshot = {
      taskId: context.taskId,
      dagState: context.executionPlan,
      completedNodes: [],
      pendingNodes: [],
      resolvedParams: context.resolvedIntent,
    }

    const timeout = this.getTimeout(context.userProfile)

    return {
      triggerPoint: 'pre_planning',
      shouldTrigger: questions.length > 0,
      questions,
      snapshot,
      timeout: {
        default: timeout,
        expanded: timeout * 2,
        debug: timeout * 4,
      },
    }
  }

  /**
   * mid_execution 检查点：检测执行快照中的歧义节点（概念选择、多方案）
   */
  checkMidExecution(
    context: OrchestratorContext,
    snapshot: PipelineSnapshot
  ): ClarificationCheckpoint {
    const questions: ClarificationQuestion[] = []

    // 检测快照中的待决节点
    if (snapshot.dagState) {
      for (const node of snapshot.dagState.nodes) {
        // 需要用户确认的待定节点（如概念选择、多方案）
        if (
          node.status === 'pending' &&
          node.condition?.type === 'user_confirm'
        ) {
          questions.push({
            id: `mid_${node.id}`,
            field: node.action,
            question: `执行步骤"${node.action}"有多种方案，请选择偏好方向`,
            type: 'single_choice',
            options: [
              { label: '质量优先', value: 'quality' },
              { label: '速度优先', value: 'speed' },
              { label: '系统推荐', value: 'auto' },
            ],
            priority: 'important',
            impact: 'medium',
          })
        }
      }
    }

    const timeout = this.getTimeout(context.userProfile)

    return {
      triggerPoint: 'mid_execution',
      shouldTrigger: questions.length > 0,
      questions,
      snapshot,
      timeout: {
        default: timeout,
        expanded: timeout * 2,
        debug: timeout * 4,
      },
    }
  }

  /**
   * post_result 检查点：检测质量问题，生成"是否接受/重试/调整"问题
   */
  checkPostResult(
    context: OrchestratorContext,
    qualityIssues: string[]
  ): ClarificationCheckpoint {
    const questions: ClarificationQuestion[] = []

    if (qualityIssues.length > 0) {
      const issueDescription = qualityIssues.join('、')

      questions.push({
        id: 'post_result_action',
        field: 'postResultAction',
        question: `生成结果存在以下问题：${issueDescription}。你希望如何处理？`,
        type: 'single_choice',
        options: [
          { label: '接受当前结果', value: 'accept', description: '尽管有问题，仍使用当前结果' },
          { label: '重新生成', value: 'retry', description: '使用相同参数重新生成' },
          { label: '调整参数后重试', value: 'adjust', description: '修改参数后重新生成' },
        ],
        priority: 'critical',
        impact: 'high',
      })

      // 如果有面数过低的问题，追加面数选择
      if (qualityIssues.some(i => i.includes('面数'))) {
        questions.push({
          id: 'post_result_poly',
          field: 'polyBudget',
          question: '请选择新的目标面数',
          type: 'single_choice',
          options: FIELD_TEMPLATES.polyBudget.options.map(o => ({
            label: o.label,
            value: o.value,
            description: o.description,
          })),
          priority: 'important',
          impact: 'medium',
        })
      }

      // 如果有纹理模糊的问题，追加纹理分辨率选择
      if (qualityIssues.some(i => i.includes('纹理') || i.includes('模糊'))) {
        questions.push({
          id: 'post_result_texture',
          field: 'textureResolution',
          question: '请选择纹理分辨率',
          type: 'single_choice',
          options: FIELD_TEMPLATES.textureResolution.options.map(o => ({
            label: o.label,
            value: o.value,
            description: o.description,
          })),
          priority: 'important',
          impact: 'medium',
        })
      }
    }

    const snapshot: PipelineSnapshot = {
      taskId: context.taskId,
      dagState: context.executionPlan,
      completedNodes: context.executionPlan?.nodes
        .filter(n => n.status === 'done')
        .map(n => n.id) ?? [],
      pendingNodes: [],
      resolvedParams: context.resolvedIntent,
    }

    const timeout = this.getTimeout(context.userProfile)

    return {
      triggerPoint: 'post_result',
      shouldTrigger: questions.length > 0,
      questions,
      snapshot,
      timeout: {
        default: timeout,
        expanded: timeout * 2,
        debug: timeout * 4,
      },
    }
  }

  // ----------------------------------------------------------
  // 核心判定：是否需要澄清
  // ----------------------------------------------------------

  /**
   * 根据：意图置信度 + 用户等级 + 历史跳过率 + 已澄清轮次 判定是否需要澄清
   */
  async shouldClarify(
    parseResult: IntentParseResult,
    userProfile: UserProfile,
    currentRound: number
  ): Promise<ClarificationDecision> {
    const strategy = this.getStrategy(userProfile)

    // 1. 超过最大轮次 → 直接使用默认值
    if (currentRound >= this.maxRounds) {
      return {
        shouldClarify: false,
        questions: [],
        fallbackStrategy: 'use_defaults',
        strategy,
        reason: 'max_rounds_exceeded',
      }
    }

    // 2. 计算置信度阈值（默认0.7）
    let confidenceThreshold = 0.7

    // 5. 历史跳过率 > 60% → 降低触发敏感度（阈值从0.7降到0.5）
    const history = userProfile.clarificationHistory
    const totalAsked = history.asked || 1
    const skipRate = history.skipped / totalAsked
    if (skipRate > 0.6) {
      confidenceThreshold = 0.5
    }

    // 3. 过滤低置信度字段
    const lowConfidenceFields: string[] = []
    for (const [field, confidence] of Object.entries(parseResult.confidence)) {
      if (confidence < confidenceThreshold) {
        lowConfidenceFields.push(field)
      }
    }

    // 4. 无低置信度字段 → 不需要澄清
    if (lowConfidenceFields.length === 0) {
      return {
        shouldClarify: false,
        questions: [],
        fallbackStrategy: 'use_defaults',
        strategy,
        reason: 'all_fields_confident',
      }
    }

    // 生成对应问题（动态 GLM 生成）
    const questions = await this.generateQuestions(
      parseResult,
      userProfile,
      'pre_planning'
    )

    return {
      shouldClarify: questions.length > 0,
      questions,
      fallbackStrategy: questions.some(q => q.priority === 'critical')
        ? 'block'
        : 'use_defaults',
      strategy,
    }
  }

  // ----------------------------------------------------------
  // 生成澄清问题
  // ----------------------------------------------------------

  /**
   * 按优先级排序，根据用户等级决定提问数量和复杂度
   * 优先调用 GLM 动态生成上下文相关问题，失败时 fallback 到静态模板
   */
  async generateQuestions(
    parseResult: IntentParseResult,
    userProfile: UserProfile,
    triggerPoint: 'pre_planning' | 'mid_execution' | 'post_result'
  ): Promise<ClarificationQuestion[]> {
    const strategy = this.getStrategy(userProfile)

    // 计算置信度阈值
    let confidenceThreshold = 0.7
    const history = userProfile.clarificationHistory
    const totalAsked = history.asked || 1
    const skipRate = history.skipped / totalAsked
    if (skipRate > 0.6) {
      confidenceThreshold = 0.5
    }

    // 收集低置信度字段
    const lowConfidenceFields: string[] = []
    for (const [field, confidence] of Object.entries(parseResult.confidence)) {
      if (confidence < confidenceThreshold) {
        lowConfidenceFields.push(field)
      }
    }

    // 过滤：仅保留有模板定义 + 优先级允许 + 无稳定偏好的字段
    const fieldsToAsk = lowConfidenceFields.filter(field => {
      const template = FIELD_TEMPLATES[field]
      if (!template) return false

      // 检查优先级是否在策略允许范围内
      if (!strategy.allowedPriorities.includes(template.priority)) return false

      // 如果用户有稳定偏好，跳过该字段
      if (userProfile.stablePreferences[field]) return false

      return true
    })

    if (fieldsToAsk.length === 0) return []

    // 尝试 GLM 动态生成
    const userPrompt = parseResult.intent?.prompt || ''
    if (userPrompt) {
      try {
        const dynamicQuestions = await this.generateContextualQuestions(
          userPrompt,
          fieldsToAsk,
          strategy,
          triggerPoint
        )
        if (dynamicQuestions.length > 0) {
          return dynamicQuestions.slice(0, strategy.maxQuestions)
        }
      } catch (error) {
        console.warn('[ClarificationEngine] GLM dynamic generation failed, falling back to static templates:', error)
      }
    }

    // Fallback: 静态模板生成
    return this.generateStaticQuestions(fieldsToAsk, strategy, triggerPoint)
  }

  // ----------------------------------------------------------
  // GLM 动态问题生成
  // ----------------------------------------------------------

  /**
   * 调用 GLM 根据用户输入动态生成上下文相关的澄清问题
   * 不局限于固定字段，由 GLM 根据对象类别动态选择最有价值的维度
   */
  private async generateContextualQuestions(
    userPrompt: string,
    _fields: string[],
    strategy: ModeStrategy,
    triggerPoint: string
  ): Promise<ClarificationQuestion[]> {
    const systemPrompt = `你是一个专业的3D模型生成助手，负责向用户提出最有价值的澄清问题。

用户想要生成："${userPrompt}"

## 你的任务

1. **先判断对象类别**：
   - 角色/生物类（人、动物、怪物、龙等）→ 关注：风格演绎、姿态/动作、表情、色彩方案、细节程度
   - 场景/环境类（森林、房间、城市等）→ 关注：光照氛围、季节/时间、视角、比例尺度
   - 物品/家具类（椅子、杯子、武器等）→ 关注：材质质感、尺寸比例、使用场景、设计流派
   - 载具/机械类（车、飞船、机器人等）→ 关注：年代感、科幻程度、磨损/损坏度、功能细节

2. **选择最相关的 2 个维度提问**（严格最多2个问题）

3. **要求**：
   - 绝对不要每次都问"风格"或"面数"——只在它对该对象真正重要时才问
   - 选项必须有创意和差异化，针对具体对象设计（例如"猫"不要给"写实/卡通"，而是"赛博朋克机械猫/毛绒玩具猫/水墨国风猫/像素游戏猫"）
   - 每个选项的 label 要生动具象，让用户一看就能想象出效果
   - 每个问题最多4个选项
   - 问题文本要简洁、口语化、针对该对象

## 输出格式

返回严格的 JSON 数组（不要包含任何其他文本或 markdown 标记）：
[{
  "field": "自定义维度名称(英文，如 pose、mood、material、era、damage_level 等)",
  "text": "针对该对象的具体问题",
  "options": [
    { "label": "生动的选项名", "value": "英文标识值", "description": "一句话描述效果" }
  ],
  "recommendedDefault": "推荐默认的选项value"
}]`

    // 调用 GLM，temperature 调高增加多样性，设置 5 秒超时
    const responseText = await Promise.race([
      glmClient.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请为"${userPrompt}"生成最多2个最有价值的澄清问题。` },
        ],
        { temperature: 0.85, max_tokens: 1024 }
      ),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('GLM timeout (5s)')), 5000)
      ),
    ])

    // 解析 GLM 返回的 JSON（不再限制 field 必须在预定义列表中）
    const questions = this.parseDynamicGLMResponse(responseText, strategy, triggerPoint)
    return questions
  }

  /**
   * 解析动态 GLM 返回文本（field 不再限制为预定义列表）
   */
  private parseDynamicGLMResponse(
    responseText: string,
    strategy: ModeStrategy,
    triggerPoint: string
  ): ClarificationQuestion[] {
    // 尝试提取 JSON
    let jsonStr = responseText.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    const arrayStart = jsonStr.indexOf('[')
    const arrayEnd = jsonStr.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd !== -1) {
      jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1)
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      field: string
      text: string
      options: Array<{ label: string; value: string; description?: string }>
      recommendedDefault?: string
    }>

    if (!Array.isArray(parsed)) {
      throw new Error('GLM response is not an array')
    }

    const questions: ClarificationQuestion[] = []

    for (const item of parsed) {
      if (!item.text || !Array.isArray(item.options) || item.options.length === 0) continue

      // 限制选项数量（最多4个）
      const options = item.options.slice(0, 4).map(opt => ({
        label: opt.label || '',
        value: opt.value || opt.label || '',
        description: opt.description,
      }))

      questions.push({
        id: `${triggerPoint}_${item.field || 'dynamic'}_${Date.now()}`,
        field: item.field || 'dynamic',
        question: item.text,
        type: 'single_choice',
        options,
        priority: 'important',
        impact: 'medium',
        timeout: strategy.timeout,
        defaultValue: item.recommendedDefault || options[0]?.value,
        recommendedDefault: item.recommendedDefault,
      })
    }

    // 严格限制最多2个问题
    return questions.slice(0, 2)
  }

  /**
   * 解析 GLM 返回文本为 ClarificationQuestion 数组
   */
  private parseGLMResponse(
    responseText: string,
    fields: string[],
    strategy: ModeStrategy,
    triggerPoint: string
  ): ClarificationQuestion[] {
    // 尝试提取 JSON（GLM 可能返回包裹在 ```json ``` 中的内容）
    let jsonStr = responseText.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }
    // 也可能直接以 [ 开头
    const arrayStart = jsonStr.indexOf('[')
    const arrayEnd = jsonStr.lastIndexOf(']')
    if (arrayStart !== -1 && arrayEnd !== -1) {
      jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1)
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      field: string
      text: string
      options: Array<{ label: string; value: string; description?: string }>
      recommendedDefault?: string
    }>

    if (!Array.isArray(parsed)) {
      throw new Error('GLM response is not an array')
    }

    const questions: ClarificationQuestion[] = []

    for (const item of parsed) {
      // 验证字段是否在请求列表中
      if (!fields.includes(item.field)) continue
      // 验证必要字段
      if (!item.text || !Array.isArray(item.options) || item.options.length === 0) continue

      const template = FIELD_TEMPLATES[item.field]
      const priority = template?.priority || 'important'
      const impact = template?.impact || 'medium'

      // 限制选项数量（最多5个）
      const options = item.options.slice(0, 5).map(opt => ({
        label: opt.label || '',
        value: opt.value || opt.label || '',
        description: opt.description,
      }))

      questions.push({
        id: `${triggerPoint}_${item.field}_${Date.now()}`,
        field: item.field,
        question: item.text,
        type: 'single_choice',
        options,
        priority,
        impact,
        timeout: strategy.timeout,
        defaultValue: item.recommendedDefault || options[0]?.value,
        recommendedDefault: item.recommendedDefault,
      })
    }

    // 按优先级排序
    const priorityWeight = (p: string) =>
      p === 'critical' ? 3 : p === 'important' ? 2 : 1
    questions.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))

    return questions
  }

  // ----------------------------------------------------------
  // 静态模板生成（Fallback）
  // ----------------------------------------------------------

  /**
   * 使用静态模板生成问题（当 GLM 不可用时的 fallback）
   */
  private generateStaticQuestions(
    fieldsToAsk: string[],
    strategy: ModeStrategy,
    triggerPoint: string
  ): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = []

    for (const field of fieldsToAsk) {
      const template = FIELD_TEMPLATES[field]
      if (!template) continue

      questions.push({
        id: `${triggerPoint}_${field}_${Date.now()}`,
        field,
        question: template.question,
        type: template.type,
        options: template.options.map(o => ({ ...o })),
        priority: template.priority,
        impact: template.impact,
        timeout: strategy.timeout,
        defaultValue: template.options[0]?.value,
      })
    }

    // 按优先级排序
    const priorityWeight = (p: string) =>
      p === 'critical' ? 3 : p === 'important' ? 2 : 1
    questions.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))

    // 截断到策略允许的最大问题数
    return questions.slice(0, strategy.maxQuestions)
  }

  // ----------------------------------------------------------
  // 策略获取
  // ----------------------------------------------------------

  /**
   * 获取统一策略（不再区分用户等级）
   */
  private getStrategy(_userProfile: UserProfile): ModeStrategy {
    return UNIFIED_STRATEGY
  }

  // ----------------------------------------------------------
  // 处理用户回复
  // ----------------------------------------------------------

  /**
   * 处理用户回复，更新intent
   */
  processResponse(
    responses: UserClarificationResponse[],
    currentIntent: Record<string, any>
  ): Record<string, any> {
    const updated = { ...currentIntent }

    for (const response of responses) {
      updated[response.field] = response.value
    }

    return updated
  }

  // ----------------------------------------------------------
  // 超时配置
  // ----------------------------------------------------------

  /**
   * 获取超时配置（秒）
   */
  private getTimeout(userProfile: UserProfile): number {
    const strategy = this.getStrategy(userProfile)
    return strategy.timeout
  }
}
