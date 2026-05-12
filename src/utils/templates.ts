import { TaskTemplate, GenerationParameters, AgentStep, GenerationTask } from '../types';

// 从当前任务创建模板
export function createTemplateFromTask(
  task: GenerationTask,
  name: string,
  description: string,
  creator: string
): TaskTemplate {
  return {
    id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    creator,
    createdAt: Date.now(),
    parameters: task.parameters,
    agentSteps: task.agentSteps,
    previewUrl: task.result?.thumbnailUrl,
    tags: extractTags(task),
    usageCount: 0,
  };
}

// 从模板生成参数（用于快速生成）
export function applyTemplate(template: TaskTemplate): {
  parameters: GenerationParameters;
  agentSteps?: AgentStep[];
} {
  return {
    parameters: { ...template.parameters },
    agentSteps: template.agentSteps ? [...template.agentSteps] : undefined,
  };
}

// 从任务提取标签
function extractTags(task: GenerationTask): string[] {
  const tags: string[] = [];
  if (task.style) tags.push(task.style);
  if (task.parameters.outputFormat) tags.push(task.parameters.outputFormat);
  if (task.parameters.textureResolution) tags.push(`${task.parameters.textureResolution}px`);
  if (task.parameters.topology) tags.push(task.parameters.topology);
  return tags;
}

// 预置模板（内置几个默认模板给用户选择）
export const DEFAULT_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-default-game-asset',
    name: '游戏资产（低面数）',
    description: '适合移动端游戏的低多边形风格模型',
    creator: 'system',
    createdAt: 0,
    parameters: {
      cfgScale: 7.5,
      samplingSteps: 30,
      seed: -1,
      topology: 'tri',
      textureResolution: 1024,
      polyBudget: 5000,
      uvMethod: 'auto',
      outputFormat: 'glb',
    },
    tags: ['游戏', '低面数', 'GLB'],
    usageCount: 128,
  },
  {
    id: 'tpl-default-high-quality',
    name: '影视级高品质',
    description: '适合CG渲染和影视制作的高精度模型',
    creator: 'system',
    createdAt: 0,
    parameters: {
      cfgScale: 12,
      samplingSteps: 80,
      seed: -1,
      topology: 'quad',
      textureResolution: 4096,
      polyBudget: 50000,
      uvMethod: 'smart',
      outputFormat: 'fbx',
    },
    tags: ['影视', '高品质', 'FBX', '4K'],
    usageCount: 86,
  },
  {
    id: 'tpl-default-3d-print',
    name: '3D打印优化',
    description: '适合3D打印的密封水密网格模型',
    creator: 'system',
    createdAt: 0,
    parameters: {
      cfgScale: 9,
      samplingSteps: 50,
      seed: -1,
      topology: 'tri',
      textureResolution: 2048,
      polyBudget: 20000,
      uvMethod: 'auto',
      outputFormat: 'obj',
    },
    tags: ['3D打印', 'OBJ'],
    usageCount: 64,
  },
];

// 搜索/过滤模板
export function filterTemplates(templates: TaskTemplate[], query: string): TaskTemplate[] {
  const lowerQuery = query.toLowerCase();
  return templates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
