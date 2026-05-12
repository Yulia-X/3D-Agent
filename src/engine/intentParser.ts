import { IntentParseResult, ClarificationQuestion, ClarificationOption, UserProfile, PredictiveField } from '../types';

// 对象类型关键词库
const OBJECT_TYPE_MAP: Record<string, string[]> = {
  '椅子': ['椅子', '座椅', 'chair', '凳子'],
  '桌子': ['桌子', '桌', 'table', 'desk'],
  '角色': ['角色', '人物', '人', 'character', '人形'],
  '头像': ['头像', '胸像', 'avatar', 'bust', '半身'],
  '动物': ['动物', '猫', '狗', '兔', '鸟', '龙', '恐龙', 'animal'],
  '车辆': ['车', '汽车', '飞机', '坦克', '船', 'vehicle', 'car'],
  '武器': ['武器', '剑', '枪', '弓', '盾', 'weapon', 'sword'],
  '建筑': ['建筑', '房子', '城堡', '塔', 'building', 'house'],
  '道具': ['道具', '宝箱', '药水', '钥匙', 'prop', 'item'],
  '植物': ['植物', '树', '花', '草', 'plant', 'tree'],
  '食物': ['食物', '蛋糕', '水果', 'food'],
  '手办': ['手办', '模型', '玩具', 'figure', 'figurine'],
};

// 风格关键词
const STYLE_MAP: Record<string, string[]> = {
  '写实': ['写实', '真实', '逼真', 'realistic', 'photorealistic'],
  '卡通': ['卡通', '可爱', 'Q版', 'cute', 'cartoon', 'toon', '萌'],
  '低面数': ['低面数', 'low poly', 'lowpoly', '像素', '简约几何'],
  '赛博朋克': ['赛博朋克', 'cyberpunk', '科幻', '未来', 'sci-fi'],
  '古风': ['古风', '中国风', '国潮', '仙侠'],
  '暗黑': ['暗黑', '哥特', 'gothic', 'dark', '恐怖'],
  '手绘': ['手绘', '水彩', '插画风', 'hand-painted', 'stylized'],
};

// 用途关键词
const USE_CASE_MAP: Record<string, string[]> = {
  '游戏资产': ['游戏', 'game', '游戏资产', '游戏角色', '游戏道具', 'Unity', 'Unreal'],
  '产品展示': ['产品', '展示', '电商', '商品', '产品展示', 'product'],
  '影视制作': ['影视', '电影', '动画', '渲染', 'CG', '影视级', 'film'],
  '3D打印': ['3D打印', '打印', 'print', '实体'],
  '社交分享': ['社交', '头像', '表情包', '分享', 'avatar', 'social'],
  'AR/VR': ['AR', 'VR', '增强现实', '虚拟现实', 'XR', 'metaverse'],
};

// 上下文推断映射：某些对象类型暗示风格
const CONTEXT_STYLE_HINTS: Record<string, { style: string; boost: number }> = {
  '可爱': { style: '卡通', boost: 0.15 },
  '萌': { style: '卡通', boost: 0.15 },
  'Q版': { style: '卡通', boost: 0.2 },
  '逼真': { style: '写实', boost: 0.15 },
  '科幻': { style: '赛博朋克', boost: 0.1 },
  '古代': { style: '古风', boost: 0.1 },
  '恐怖': { style: '暗黑', boost: 0.1 },
};

// ----------- 提取函数 -----------

function extractObjectType(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  const matches: { type: string; keyword: string; exactness: number }[] = [];

  for (const [type, keywords] of Object.entries(OBJECT_TYPE_MAP)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        // 精确度：关键词越长越精确
        matches.push({ type, keyword, exactness: keyword.length });
      }
    }
  }

  if (matches.length > 0) {
    // 返回最精确匹配（最长关键词）
    matches.sort((a, b) => b.exactness - a.exactness);
    return matches[0].type;
  }

  // 无匹配时，尝试提取原文中的名词作为对象类型
  // 简单策略：取前几个非停用词字符
  const cleaned = prompt.replace(/[帮我做|我想要|生成一个|做一个|来一个|给我|请]/g, '').trim();
  const firstNoun = cleaned.split(/[，。、！？\s,.\n]/)[0]?.trim();
  return firstNoun || '未知对象';
}

function extractStyle(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  for (const [style, keywords] of Object.entries(STYLE_MAP)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        return style;
      }
    }
  }

  return null;
}

function extractUseCase(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  for (const [useCase, keywords] of Object.entries(USE_CASE_MAP)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        return useCase;
      }
    }
  }

  return null;
}

function extractTopology(prompt: string): string | null {
  if (/四边面|quad/i.test(prompt)) return 'quad';
  if (/三角面|tri(?:angle)?/i.test(prompt)) return 'tri';
  if (/自动拓扑|auto\s*topo/i.test(prompt)) return 'auto';
  return null;
}

function extractPolyBudget(prompt: string): number | null {
  // 匹配 "Nk面" / "N千面" / "N万面" / "N poly"
  const kMatch = prompt.match(/(\d+(?:\.\d+)?)\s*[kK千]\s*(?:面|poly|polygons?|个面)/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  const wanMatch = prompt.match(/(\d+(?:\.\d+)?)\s*万\s*(?:面|poly|polygons?|个面)/);
  if (wanMatch) return Math.round(parseFloat(wanMatch[1]) * 10000);

  const directMatch = prompt.match(/(\d{3,})\s*(?:面|poly|polygons?|个面)/);
  if (directMatch) return parseInt(directMatch[1]);

  return null;
}

function extractTextureSpec(prompt: string): string | null {
  if (/PBR/i.test(prompt)) return 'PBR';
  if (/手绘贴图|hand[\s-]?painted\s*texture/i.test(prompt)) return '手绘贴图';
  if (/无贴图|unlit|vertex\s*color/i.test(prompt)) return '无贴图';
  if (/matcap/i.test(prompt)) return 'matcap';
  return null;
}

function extractOutputFormat(prompt: string): string | null {
  if (/\bFBX\b/i.test(prompt)) return 'fbx';
  if (/\bGLB\b|\bglTF\b/i.test(prompt)) return 'glb';
  if (/\bOBJ\b/i.test(prompt)) return 'obj';
  if (/\bUSDZ\b/i.test(prompt)) return 'usdz';
  if (/\bUSD\b/i.test(prompt)) return 'usdz';
  return null;
}

// ----------- 置信度计算 -----------

function calculateObjectTypeConfidence(prompt: string, objectType: string): number {
  const lowerPrompt = prompt.toLowerCase();

  // 检查是否是通过精确关键词匹配到的
  for (const [type, keywords] of Object.entries(OBJECT_TYPE_MAP)) {
    if (type !== objectType) continue;
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        // 精确匹配关键词长度 >= 2 → 高置信
        return keyword.length >= 3 ? 0.9 : 0.75;
      }
    }
  }

  // 未通过关键词库匹配（使用原文提取），给予中低置信度
  if (objectType && objectType !== '未知对象') {
    return 0.5; // 上下文推断
  }

  return 0.3; // objectType 永远至少 0.3
}

function calculateFieldConfidence(
  prompt: string,
  map: Record<string, string[]>,
  extractedValue: string | null
): number {
  if (!extractedValue) return 0.0;

  const lowerPrompt = prompt.toLowerCase();
  const keywords = map[extractedValue];
  if (!keywords) return 0.4;

  for (const keyword of keywords) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      // 精确匹配
      return keyword.length >= 3 ? 0.9 : 0.7;
    }
  }

  // 通过上下文推断得到的
  return 0.55;
}

function calculateStyleConfidenceWithContext(prompt: string, style: string | null): number {
  if (!style) {
    // 检查是否有上下文暗示
    const lowerPrompt = prompt.toLowerCase();
    for (const [hint, { boost }] of Object.entries(CONTEXT_STYLE_HINTS)) {
      if (lowerPrompt.includes(hint.toLowerCase())) {
        return 0.2 + boost; // 有暗示但未直接匹配
      }
    }
    return 0.0;
  }

  return calculateFieldConfidence(prompt, STYLE_MAP, style);
}

// ----------- 澄清问题生成 -----------

export function generateClarificationQuestions(
  intent: IntentParseResult['intent'],
  confidence: Record<string, number>
): ClarificationQuestion[] {
  const questions: ClarificationQuestion[] = [];

  // objectType confidence < 0.6 → critical
  if (confidence.objectType < 0.6) {
    const guesses = guessTopObjectTypes(intent.objectType);
    questions.push({
      id: `cq_objectType_${Date.now()}`,
      field: 'objectType',
      question: '你想生成什么类型的模型？',
      type: 'single_choice',
      options: [
        ...guesses.map(g => ({ value: g, label: g })),
        { value: 'other', label: '其他', description: '请在输入框中补充说明' },
      ],
      defaultValue: intent.objectType !== '未知对象' ? intent.objectType : undefined,
      priority: 'critical',
      impact: 'high',
      reason: '模型类型是生成的核心要素，需要明确才能开始',
    });
  }

  // useCase confidence < 0.4 → critical
  if (confidence.useCase < 0.4) {
    questions.push({
      id: `cq_useCase_${Date.now()}`,
      field: 'useCase',
      question: '这个模型打算用在什么场景？',
      type: 'single_choice',
      options: [
        { value: '游戏资产', label: '游戏资产', description: '用于游戏引擎中的实时渲染' },
        { value: '产品展示', label: '产品展示', description: '电商或官网的3D产品展示' },
        { value: '3D打印', label: '3D打印', description: '用于实体打印输出' },
        { value: '社交分享', label: '社交分享', description: '头像、表情包等社交用途' },
      ],
      priority: 'critical',
      impact: 'high',
      reason: '使用场景决定了面数、格式等技术参数的选择',
    });
  }

  // style confidence < 0.3 → important
  if (confidence.style < 0.3) {
    questions.push({
      id: `cq_style_${Date.now()}`,
      field: 'style',
      question: '你偏好什么风格？',
      type: 'single_choice',
      options: [
        { value: '写实', label: '写实', description: '接近真实世界的质感' },
        { value: '卡通', label: '卡通', description: '可爱、夸张的卡通风' },
        { value: '低面数', label: '低面数', description: '简约几何体风格' },
        { value: '概念艺术', label: '概念艺术', description: '自由艺术化表达' },
      ],
      priority: 'important',
      impact: 'medium',
      reason: '风格影响整体视觉效果和建模方式',
    });
  }

  // topology confidence < 0.5 → nice_to_have（仅pipeline模式参考）
  if (confidence.topology < 0.5) {
    questions.push({
      id: `cq_topology_${Date.now()}`,
      field: 'topology',
      question: '你对网格拓扑有偏好吗？',
      type: 'single_choice',
      options: [
        { value: 'quad', label: '四边面', description: '适合后续细分和动画' },
        { value: 'tri', label: '三角面', description: '适合实时渲染引擎' },
        { value: 'auto', label: '自动选择', description: '由系统根据用途自动决定' },
      ],
      defaultValue: 'auto',
      priority: 'nice_to_have',
      impact: 'medium',
      reason: '拓扑类型影响模型的后续编辑和使用兼容性',
    });
  }

  return questions;
}

// 猜测可能的对象类型（用于模糊情况下提供选项）
function guessTopObjectTypes(partialHint: string): string[] {
  if (!partialHint || partialHint === '未知对象') {
    return ['角色', '道具', '动物'];
  }

  const candidates: { type: string; score: number }[] = [];
  const lowerHint = partialHint.toLowerCase();

  for (const [type, keywords] of Object.entries(OBJECT_TYPE_MAP)) {
    let score = 0;
    for (const keyword of keywords) {
      if (keyword.toLowerCase().includes(lowerHint) || lowerHint.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    if (score > 0) {
      candidates.push({ type, score });
    }
  }

  if (candidates.length === 0) {
    return ['角色', '道具', '动物'];
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3).map(c => c.type);
}

// ----------- 主解析函数 -----------

export function parseIntent(prompt: string, userProfile: UserProfile): IntentParseResult {
  const intent = {
    objectType: extractObjectType(prompt),
    style: extractStyle(prompt),
    useCase: extractUseCase(prompt),
    topology: extractTopology(prompt),
    polyBudget: extractPolyBudget(prompt),
    textureSpec: extractTextureSpec(prompt),
    outputFormat: extractOutputFormat(prompt),
    referenceImages: [] as string[],
  };

  // 计算各字段置信度
  const confidence: Record<string, number> = {
    objectType: calculateObjectTypeConfidence(prompt, intent.objectType),
    style: calculateStyleConfidenceWithContext(prompt, intent.style),
    useCase: calculateFieldConfidence(prompt, USE_CASE_MAP, intent.useCase),
    topology: intent.topology ? 0.9 : 0.0,
    polyBudget: intent.polyBudget ? 0.9 : 0.0,
    textureSpec: intent.textureSpec ? 0.85 : 0.0,
    outputFormat: intent.outputFormat ? 0.95 : 0.0,
  };

  // 利用用户稳定偏好提升置信度
  if (userProfile.stablePreferences) {
    for (const [field, value] of Object.entries(userProfile.stablePreferences)) {
      if (value && confidence[field] !== undefined && confidence[field] < 0.5) {
        confidence[field] = Math.max(confidence[field], 0.6);
        // 使用用户偏好填充缺失字段
        if (field === 'style' && !intent.style) {
          intent.style = value;
        }
        if (field === 'useCase' && !intent.useCase) {
          intent.useCase = value;
        }
      }
    }
  }

  // 生成候选澄清问题
  const clarificationQuestions = generateClarificationQuestions(intent, confidence);

  // 判断是否需要澄清（有critical或important级别的问题）
  const needsClarification = clarificationQuestions.some(
    q => q.priority === 'critical' || q.priority === 'important'
  );

  return { intent, confidence, needsClarification, clarificationQuestions };
}

/**
 * 轻量级实时预测（预测性澄清）
 * 用户打字时300ms防抖调用，只做关键词前缀匹配
 * 性能优先，不做完整解析
 */
export function quickPredict(partialInput: string): PredictiveField[] {
  const fields: PredictiveField[] = []
  const input = partialInput.toLowerCase().trim()
  
  if (input.length < 2) return fields
  
  // 检测是否提到了对象类型关键词
  const hasObjectHint = Object.keys(OBJECT_TYPE_MAP).some(key => input.includes(key))
  
  if (hasObjectHint) {
    // 检查是否已经包含风格关键词
    const hasStyle = Object.keys(STYLE_MAP).some(key => input.includes(key))
    if (!hasStyle) {
      fields.push({
        field: 'style',
        label: '风格',
        options: [
          { value: 'realistic', label: '写实' },
          { value: 'cartoon', label: '卡通' },
          { value: 'lowpoly', label: '低面数' },
          { value: 'stylized', label: '风格化' }
        ],
        confidence: 0.6
      })
    }
    
    // 检查是否已经包含用途关键词
    const hasUseCase = Object.keys(USE_CASE_MAP).some(key => input.includes(key))
    if (!hasUseCase) {
      fields.push({
        field: 'useCase',
        label: '用途',
        options: [
          { value: 'game_asset', label: '游戏' },
          { value: 'product_display', label: '展示' },
          { value: '3d_print', label: '打印' },
          { value: 'film_animation', label: '影视' }
        ],
        confidence: 0.5
      })
    }
  }
  
  // 高精度相关关键词触发拓扑建议
  const qualityHints = ['高精度', '精细', '细节', '高质量', 'detailed']
  if (qualityHints.some(hint => input.includes(hint))) {
    fields.push({
      field: 'topology',
      label: '拓扑',
      options: [
        { value: 'quad', label: '四边面' },
        { value: 'tri', label: '三角面' },
        { value: 'auto', label: '自动' }
      ],
      confidence: 0.4
    })
  }
  
  return fields
}
