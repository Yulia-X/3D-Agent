import { glmClient } from './glmClient.js'
import { IntentParseResult, ChangeScope } from '../types.js'

const SYSTEM_PROMPT = `你是一个3D模型生成助手的意图理解模块。你的任务是分析用户输入，提取结构化的意图信息。

请分析用户的输入，返回以下 JSON 格式（严格遵循，不要添加多余内容）：

{
  "isNewGeneration": true/false,
  "prompt": "原始描述",
  "style": "realistic|cartoon|low-poly|anime|voxel|null",
  "styleConfidence": 0.0-1.0,
  "topology": "quad|triangle|null",
  "topologyConfidence": 0.0-1.0,
  "polyBudget": number|null,
  "polyBudgetConfidence": 0.0-1.0,
  "outputFormat": "glb|fbx|obj|usdz|null",
  "outputFormatConfidence": 0.0-1.0,
  "changeScope": {
    "geometry": false,
    "texture": false,
    "skeleton": false,
    "animation": false,
    "print": false
  },
  "summary": "一句话总结用户意图"
}

规则：
1. 如果用户在输入中明确提到了某个字段的具体值（如"卡通风格"、"5000面"、"FBX格式"），置信度设为 0.9-1.0
2. 如果用户没有提到该字段，即使你认为可以推断出合理默认值，也应将该字段设为 null，置信度设为 0.1-0.3
3. 注意：仅凭"常识推断"不算用户明确指定。例如用户说"生成一只猫"，style 应为 null（置信度 0.1-0.3），而非 "realistic"（置信度 0.8）
4. isNewGeneration: 如果用户说"生成"、"创建"、"做一个"等→true；如果说"改"、"换"、"调整"等→false
5. changeScope 仅在 isNewGeneration=false 时有意义
6. polyBudget 常见范围：低面 500-2000，中等 3000-5000，高精度 8000-50000`

export async function analyzeIntent(
  userInput: string,
  hasExistingModel: boolean = false,
  onReasoning?: (step: string, detail: string) => void
): Promise<IntentParseResult> {
  const userMessage = hasExistingModel
    ? `用户当前有一个3D模型。用户说：${userInput}`
    : `用户说：${userInput}`

  try {
    onReasoning?.('LLM分析', '正在调用 GLM-4 分析用户意图...')

    const response = await glmClient.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ], { temperature: 0.1 })

    // 提取 JSON（处理可能的 markdown code block 包裹）
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)

    onReasoning?.('LLM分析', `分析完成: ${parsed.summary || '已提取结构化意图'}`)

    // 构建 IntentParseResult
    const intent: Record<string, any> = {
      prompt: parsed.prompt || userInput,
    }
    const confidence: Record<string, number> = {
      prompt: 1.0,
    }

    // style — 用户未明确指定时给低置信度
    if (parsed.style) {
      intent.style = parsed.style
      confidence.style = parsed.styleConfidence ?? 0.3
    } else {
      intent.style = 'realistic'
      confidence.style = parsed.styleConfidence ?? 0.2
    }

    // topology — 用户未明确指定时给低置信度
    if (parsed.topology) {
      intent.topology = parsed.topology
      confidence.topology = parsed.topologyConfidence ?? 0.3
    } else {
      intent.topology = 'auto'
      confidence.topology = parsed.topologyConfidence ?? 0.2
    }

    // polyBudget — 用户未明确指定时给低置信度
    if (parsed.polyBudget) {
      intent.polyBudget = parsed.polyBudget
      confidence.polyBudget = parsed.polyBudgetConfidence ?? 0.3
    } else {
      intent.polyBudget = 5000
      confidence.polyBudget = parsed.polyBudgetConfidence ?? 0.2
    }

    // outputFormat — 用户未明确指定时给低置信度
    if (parsed.outputFormat) {
      intent.outputFormat = parsed.outputFormat
      confidence.outputFormat = parsed.outputFormatConfidence ?? 0.3
    } else {
      intent.outputFormat = 'GLB'
      confidence.outputFormat = parsed.outputFormatConfidence ?? 0.2
    }

    // ── 安全网：用户输入中未出现相关关键词的字段，强制置信度 ≤ 0.5 ──
    const inputLower = userInput.toLowerCase()
    const fieldKeywordMap: Record<string, string[]> = {
      style: ['写实', '真实', 'realistic', '卡通', 'cartoon', '低面', 'low-poly', 'lowpoly', '动漫', 'anime', '像素', 'voxel', '手绘', 'hand-painted', '风格'],
      topology: ['四边面', 'quad', '三角面', '三角', 'triangle', '拓扑', 'topology'],
      polyBudget: ['面数', 'poly', '高精', '高面', '高模', '低面', '低模', '万面', 'k面'],
      outputFormat: ['glb', 'fbx', 'obj', 'usdz', '格式', 'format'],
    }
    for (const [field, keywords] of Object.entries(fieldKeywordMap)) {
      if (!keywords.some(kw => inputLower.includes(kw))) {
        confidence[field] = Math.min(confidence[field], 0.5)
      }
    }

    // 检查是否需要澄清（任何字段置信度 < 0.7）
    const lowConfidenceFields = Object.entries(confidence)
      .filter(([key, val]) => key !== 'prompt' && val < 0.7)
    const needsClarification = lowConfidenceFields.length > 0

    console.log('[IntentAnalyzer] GLM confidence result:', JSON.stringify(confidence), '| needsClarification:', needsClarification)

    return {
      intent,
      confidence,
      needsClarification,
      clarificationQuestions: [],
      isNew: parsed.isNewGeneration !== false,
      changeScope: parsed.changeScope || null,
      summary: parsed.summary || '',
    }
  } catch (error) {
    console.error('[GLM IntentAnalyzer] Error:', error)
    // 出错时返回低置信度结果，触发澄清
    // 关键：必须包含所有字段的 confidence 键，否则 shouldClarify 检测不到低置信度
    return {
      intent: {
        prompt: userInput,
        style: 'realistic',
        topology: 'auto',
        polyBudget: 5000,
        outputFormat: 'GLB',
      },
      confidence: {
        prompt: 1.0,
        style: 0.1,
        topology: 0.1,
        polyBudget: 0.1,
        outputFormat: 0.1,
      },
      needsClarification: true,
      clarificationQuestions: [],
      isNew: !hasExistingModel,
      changeScope: null,
      summary: '',
    }
  }
}
