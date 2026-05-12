import { IntentAnalysis, UserProfile, UserLevel, AppMode, ViewMode, GenerationParameters } from '../types';

// 专业关键词库（按权重分级）
export const PROFESSIONAL_KEYWORDS_HIGH: string[] = [
  '拓扑', 'topology', 'UV', 'PBR', 'LOD', '四边面', 'quad',
  '法线贴图', 'normal map', '置换贴图', 'displacement',
  '重拓扑', 'retopology', '布线', 'wireframe', 'edge flow',
  'ambient occlusion', 'AO', 'metallic', 'subsurface scattering',
  'HDRI', 'IBL', '光照探针', 'light probe',
  '骨骼绑定', 'rigging', '权重绘制', 'weight paint',
  'subdivision surface', '细分曲面',
];

const PROFESSIONAL_KEYWORDS_MEDIUM: string[] = [
  'FBX', 'USDZ', 'OBJ', 'glTF', 'GLB', 'USD',
  '2K', '4K', '贴图分辨率', 'texture resolution',
  '面数', 'poly count', 'vertices', '顶点',
  '材质球', 'shader', '着色器',
  'Blender', 'Maya', '3ds Max', 'ZBrush', 'Substance',
  'DCC', '工程文件',
];

const PROFESSIONAL_KEYWORDS_LOW: string[] = [
  '渲染', 'render', '光照', 'lighting',
  '材质', 'material', '纹理', 'texture',
  '动画', 'animation', '关键帧', 'keyframe',
  '导出', 'export', '格式', 'format',
];

// 终端用户典型表达
const CASUAL_PATTERNS: string[] = [
  '帮我做', '我想要', '可爱的', '酷的', '好看的',
  '生成一个', '做一个', '来一个', '给我',
  '头像', '壁纸', '表情包', '手办', '玩偶',
];

function countKeywordHits(prompt: string, keywords: string[]): { count: number; matched: string[] } {
  const lowerPrompt = prompt.toLowerCase();
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    }
  }
  return { count: matched.length, matched };
}

export function extractAutoParams(prompt: string): Partial<GenerationParameters> {
  const params: Partial<GenerationParameters> = {};

  // 检测输出格式
  if (/FBX/i.test(prompt)) params.outputFormat = 'fbx';
  if (/OBJ/i.test(prompt)) params.outputFormat = 'obj';
  if (/USDZ/i.test(prompt)) params.outputFormat = 'usdz';
  if (/GLB|glTF/i.test(prompt)) params.outputFormat = 'glb';

  // 检测贴图分辨率
  if (/4[Kk]|4096/.test(prompt)) params.textureResolution = 4096;
  if (/2[Kk]|2048/.test(prompt)) params.textureResolution = 2048;
  if (/1[Kk]|1024/.test(prompt)) params.textureResolution = 1024;

  // 检测拓扑类型
  if (/四边面|quad/i.test(prompt)) params.topology = 'quad';
  if (/三角面|tri(?:angle)?/i.test(prompt)) params.topology = 'tri';

  // 检测面数预算
  const polyMatch = prompt.match(/(\d+)[kK]?\s*(?:面|poly|polygons|vertices)/);
  if (polyMatch) {
    let count = parseInt(polyMatch[1]);
    if (/[kK]/.test(polyMatch[0])) count *= 1000;
    params.polyBudget = count;
  }

  return params;
}

export function analyzeIntent(prompt: string, userProfile: UserProfile): IntentAnalysis {
  // 1. 统计各级关键词命中数
  const highHits = countKeywordHits(prompt, PROFESSIONAL_KEYWORDS_HIGH);
  const mediumHits = countKeywordHits(prompt, PROFESSIONAL_KEYWORDS_MEDIUM);
  const lowHits = countKeywordHits(prompt, PROFESSIONAL_KEYWORDS_LOW);
  const casualHits = countKeywordHits(prompt, CASUAL_PATTERNS);

  // 2. 计算专业度评分（high*3 + medium*2 + low*1 - casual*2）
  const score = highHits.count * 3 + mediumHits.count * 2 + lowHits.count * 1 - casualHits.count * 2;

  // 3. 仅基于当前输入关键词判断 detectedLevel（不再依赖用户等级加成）
  const adjustedScore = score;

  // 4. 判断 detectedLevel
  let detectedLevel: UserLevel;
  if (adjustedScore >= 6 && highHits.count >= 2) {
    detectedLevel = 'expert';
  } else if (adjustedScore >= 3 && mediumHits.count >= 1) {
    detectedLevel = 'intermediate';
  } else {
    detectedLevel = 'beginner';
  }

  // 5. 推荐 suggestedMode 和 suggestedViewMode
  let suggestedMode: AppMode;
  let suggestedViewMode: ViewMode;

  if (detectedLevel === 'expert') {
    suggestedMode = 'pipeline';
    suggestedViewMode = 'professional';
  } else if (detectedLevel === 'intermediate') {
    suggestedMode = 'explore';
    suggestedViewMode = 'professional';
  } else {
    suggestedMode = 'explore';
    suggestedViewMode = 'simple';
  }

  // 6. 提取自动参数建议
  const autoParams = extractAutoParams(prompt);

  // 7. 计算 confidence
  const totalHits = highHits.count + mediumHits.count + lowHits.count;
  let confidence = Math.min(Math.abs(adjustedScore) / 10, 1.0);

  // 如果关键词命中总数 >= 3 → confidence += 0.1
  if (totalHits >= 3) {
    confidence += 0.1;
  }

  // 最终 clamp 到 [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  // 收集所有匹配的关键词
  const keywords = [...highHits.matched, ...mediumHits.matched, ...lowHits.matched];

  return {
    detectedLevel,
    keywords,
    suggestedMode,
    suggestedViewMode,
    confidence,
    autoParams: Object.keys(autoParams).length > 0 ? autoParams : undefined,
  };
}
