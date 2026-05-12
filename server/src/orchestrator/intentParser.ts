import { IntentParseResult, ChangeScope, ClarificationQuestion, UserProfile } from '../types.js'
import { analyzeIntent } from '../llm/intentAnalyzer.js'
import { config } from '../config.js'

// ============================================================
// 关键词映射表
// ============================================================

const STYLE_KEYWORDS: Record<string, string> = {
  '写实': 'realistic',
  '真实': 'realistic',
  'realistic': 'realistic',
  '卡通': 'cartoon',
  'cartoon': 'cartoon',
  '低面': 'low-poly',
  'low-poly': 'low-poly',
  'lowpoly': 'low-poly',
  '动漫': 'anime',
  'anime': 'anime',
  '像素': 'voxel',
  'voxel': 'voxel',
  '手绘': 'hand-painted',
}

const TOPOLOGY_KEYWORDS: Record<string, string> = {
  '四边面': 'quad',
  'quad': 'quad',
  '三角面': 'triangle',
  '三角': 'triangle',
  'triangle': 'triangle',
  'tri': 'triangle',
}

const FORMAT_KEYWORDS: Record<string, string> = {
  'glb': 'GLB',
  'GLB': 'GLB',
  'fbx': 'FBX',
  'FBX': 'FBX',
  'obj': 'OBJ',
  'OBJ': 'OBJ',
  'usdz': 'USDZ',
  'USDZ': 'USDZ',
}

const EDIT_KEYWORDS = ['改', '换', '调', '修', '变', '不对', '不好', '太', '重新', '更']

// ============================================================
// IntentParser 类
// ============================================================

export class IntentParser {
  /**
   * 解析用户输入，提取意图
   * 返回各字段的置信度（0-1）
   * 优先使用 GLM 模型解析，fallback 到关键词匹配
   */
  async parse(input: string, images?: string[], hasExistingModel: boolean = false, onReasoning?: (step: string, detail: string) => void, userProfile?: UserProfile): Promise<IntentParseResult> {
    // 如果配置了 GLM API Key，使用 LLM 解析
    if (config.GLM_API_KEY) {
      try {
        const result = await analyzeIntent(input, hasExistingModel, onReasoning)
        // 如果有图片，补充 referenceImages
        if (images && images.length > 0) {
          result.intent.referenceImages = images
        }
        // 注意：不在此处生成澄清问题，由 orchestrator 的 checkPrePlanning 统一处理
        // 避免重复 GLM 调用导致延迟增加
        return result
      } catch (error) {
        console.warn('[IntentParser] GLM failed, falling back to keyword matching:', error)
        // fallback 到关键词匹配
      }
    }

    // 关键词匹配 fallback
    const intent: Record<string, any> = {}
    const confidence: Record<string, number> = {}
    const clarificationQuestions: ClarificationQuestion[] = []

    // prompt — 原始输入，confidence=1.0
    intent.prompt = input
    confidence.prompt = 1.0

    // style 检测
    const detectedStyle = this.detectKeyword(input, STYLE_KEYWORDS)
    if (detectedStyle) {
      intent.style = detectedStyle
      confidence.style = 0.9
    } else {
      intent.style = 'realistic' // 默认
      confidence.style = 0.3
    }

    // topology 检测
    const detectedTopology = this.detectKeyword(input, TOPOLOGY_KEYWORDS)
    if (detectedTopology) {
      intent.topology = detectedTopology
      confidence.topology = 0.9
    } else {
      intent.topology = 'auto'
      confidence.topology = 0.4
    }

    // polyBudget 检测
    const polyResult = this.detectPolyBudget(input)
    if (polyResult) {
      intent.polyBudget = polyResult
      confidence.polyBudget = 0.8
    } else {
      intent.polyBudget = 5000
      confidence.polyBudget = 0.3
    }

    // outputFormat 检测
    const detectedFormat = this.detectKeyword(input, FORMAT_KEYWORDS)
    if (detectedFormat) {
      intent.outputFormat = detectedFormat
      confidence.outputFormat = 1.0
    } else {
      intent.outputFormat = 'GLB'
      confidence.outputFormat = 0.2
    }

    // 如果有图片，提升置信度（图片本身就是参考）
    if (images && images.length > 0) {
      intent.referenceImages = images
      confidence.style = Math.min(confidence.style + 0.2, 1.0)
    }

    // needsClarification = 任何字段 confidence < 0.7
    const needsClarification = Object.values(confidence).some(c => c < 0.7)

    const result: IntentParseResult = {
      intent,
      confidence,
      needsClarification,
      clarificationQuestions,
    }

    // 注意：不在此处生成澄清问题，由 orchestrator 的 checkPrePlanning 统一处理
    // 避免重复 GLM 调用导致延迟增加

    return result
  }

  /**
   * 判定变更范围
   */
  determineChangeScope(input: string): ChangeScope {
    const scope: ChangeScope = {
      geometry: false,
      texture: false,
      skeleton: false,
      animation: false,
      print: false,
      metadata: false,
    }

    // 颜色/材质 → texture
    if (/颜色|材质|贴图|纹理|色彩|配色|texture|material|color/i.test(input)) {
      scope.texture = true
    }

    // 形状/尺寸 → geometry
    if (/形状|尺寸|大小|比例|变形|拉伸|缩放|mesh|shape|size|geometry/i.test(input)) {
      scope.geometry = true
    }

    // 骨骼 → skeleton
    if (/骨骼|绑定|骨架|rig|skeleton|bind/i.test(input)) {
      scope.skeleton = true
    }

    // 动画 → animation
    if (/动画|动作|运动|走路|跑步|animation|animate|motion/i.test(input)) {
      scope.animation = true
    }

    // 打印 → print
    if (/打印|3d打印|print|3d print|printab|修复|repair/i.test(input)) {
      scope.print = true
    }

    // 如果没检测到任何变更，默认标记texture（最常见的编辑需求）
    if (!scope.geometry && !scope.texture && !scope.skeleton && !scope.animation && !scope.print) {
      scope.texture = true
    }

    return scope
  }

  /**
   * 判断是新建还是编辑
   */
  isNewGeneration(input: string, hasExistingModel: boolean): boolean {
    // 无现有模型 → 一定是新建
    if (!hasExistingModel) return true

    // 有编辑关键词 → 编辑
    for (const keyword of EDIT_KEYWORDS) {
      if (input.includes(keyword)) return false
    }

    // 默认为新建
    return true
  }

  // ----------------------------------------------------------
  // 私有辅助方法
  // ----------------------------------------------------------

  private detectKeyword(input: string, keywords: Record<string, string>): string | null {
    for (const [key, value] of Object.entries(keywords)) {
      if (input.toLowerCase().includes(key.toLowerCase())) {
        return value
      }
    }
    return null
  }

  private detectPolyBudget(input: string): number | null {
    // 检测数字+面数相关词
    const polyMatch = input.match(/(\d+)\s*[面k]/)
    if (polyMatch) {
      const num = parseInt(polyMatch[1], 10)
      // 如果匹配到k，乘以1000
      if (input.includes('k') || input.includes('K')) {
        return num * 1000
      }
      return num
    }

    // 检测描述性词汇
    if (/低面|low.?poly/i.test(input)) return 500
    if (/高精|高面|高模/i.test(input)) return 10000
    if (/标准|中等/i.test(input)) return 5000

    return null
  }
}
