// ============================================================
// 3D Model Agent Server - 类型定义
// ============================================================
// 从前端 types 独立重新定义，不依赖前端项目

// ============================================================
// 基础类型
// ============================================================

// 用户等级
export type UserLevel = 'beginner' | 'intermediate' | 'expert'

// 用户档案
export interface UserProfile {
  level: UserLevel
  usageCount: number
  unlockedFeatures: string[]
  preferences: Record<string, any>
  firstVisit: boolean
  clarificationHistory: ClarificationHistory
  stablePreferences: Record<string, string>
}

export interface ClarificationHistory {
  asked: number
  answered: number
  skipped: number
  avgResponseTime: number
}

// ============================================================
// 澄清系统
// ============================================================

export interface ClarificationQuestion {
  id?: string
  field: string
  question: string
  type: 'single_choice' | 'multi_choice' | 'text' | 'image_select'
  options?: ClarificationOption[]
  priority: 'critical' | 'important' | 'nice_to_have'
  impact: 'high' | 'medium' | 'low'
  timeout?: number
  recommendedDefault?: string
  defaultValue?: string
  reason?: string
}

export interface ClarificationOption {
  label: string
  value: string
  description?: string
  thumbnail?: string
}

export interface ClarificationDecision {
  shouldClarify: boolean
  questions: ClarificationQuestion[]
  fallbackStrategy: 'use_defaults' | 'ask_later' | 'mark_pending' | 'block'
  strategy?: ModeStrategy
  reason?: string
}

export interface ModeStrategy {
  maxQuestions: number
  allowedPriorities: readonly string[]
  timeout: number
  timeoutBehavior: string
}

export interface IntentParseResult {
  intent: Record<string, any>
  confidence: Record<string, number>
  needsClarification: boolean
  clarificationQuestions: ClarificationQuestion[]
  isNew?: boolean
  changeScope?: ChangeScope | null
  summary?: string
}

export interface UserClarificationResponse {
  questionId: string
  field: string
  value: string
  timestamp: number
}

// ============================================================
// 界面暴露层级
// ============================================================

export interface ExposureLevel {
  editPanel: boolean
  debugPanel: boolean
  versionTimeline: boolean
  advancedParams: boolean
}

// ============================================================
// 任务状态
// ============================================================

export type TaskState = 'idle' | 'parsing' | 'clarifying' | 'planning' | 'executing' | 'confirming' | 'completed' | 'error_recovery'

export interface Task {
  id: string
  state: TaskState
  prompt: string
  images?: string[]
  fromVersion?: string
  createdAt: number
  completedAt?: number
  error?: string
}

// ============================================================
// 版本树
// ============================================================

export interface VersionTree {
  taskId: string
  root: VersionNode | null
  currentHead: string
}

export interface VersionNode {
  id: string
  parentId: string | null
  children: string[]
  assets: VersionAssets
  createdAt: number
  trigger: VersionTrigger
  changeScope: ChangeScope
  dagExecuted: ExecutionDAG | null
  userRating?: 'good' | 'bad' | null
  userComment?: string
}

export interface VersionAssets {
  modelUrl: string
  textureUrls: string[]
  thumbnailUrl: string
  metadata: ModelMetadata
  meshyTaskId?: string
  formats?: Record<string, string>
}

export interface ModelMetadata {
  polyCount: number
  format: string
  dimensions: { x: number; y: number; z: number }
  hasAnimation: boolean
  hasSkeleton: boolean
}

export interface VersionTrigger {
  type: 'initial_generation' | 'edit_request' | 'variant_fork' | 'auto_refinement'
  userInput: string
  resolvedIntent: Record<string, any>
}

// ============================================================
// 变更范围
// ============================================================

export interface ChangeScope {
  geometry: boolean
  texture: boolean
  skeleton: boolean
  animation: boolean
  print: boolean
  metadata: boolean
}

// ============================================================
// DAG执行
// ============================================================

export interface ExecutionDAG {
  nodes: DAGNode[]
  edges: DAGEdge[]
}

export interface DAGNode {
  id: string
  agentType: SubAgentType
  action: string
  params: Record<string, any>
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  estimatedDuration: number
  estimatedCost: number
  canParallel: boolean
  condition?: DAGCondition
  result?: any
}

export interface DAGEdge {
  from: string
  to: string
  dataKey: string
}

export interface DAGCondition {
  type: 'quality_pass' | 'user_confirm' | 'threshold'
  params: Record<string, any>
}

export type SubAgentType = 'generation' | 'texture' | 'mesh' | 'rigging' | 'animation' | 'print' | 'format' | 'quality'

// ============================================================
// 子Agent
// ============================================================

export interface SubTask {
  id: string
  parentTaskId: string
  type: SubAgentType
  inputs: Record<string, any>
  constraints: TaskConstraints
  experienceHints: ExperienceEntry[]
}

export interface TaskConstraints {
  maxCredits: number
  maxDuration: number
  qualityThreshold: number
}

export interface SubTaskResult {
  status: 'success' | 'partial' | 'failed'
  outputs: Record<string, any>
  metadata: {
    duration: number
    creditsCost: number
    meshyTaskId: string
    qualityScore?: number
  }
  experience?: ExperienceEntry
}

// ============================================================
// 预览
// ============================================================

export interface PreviewUpdate {
  type: 'instant' | 'incremental' | 'full_replace'
}

export interface PreviewState {
  modelUrl: string | null
  isLoading: boolean
  incrementalUpdate: boolean
  previousModelUrl: string | null
  transitionProgress: number
}

// ============================================================
// WebSocket事件
// ============================================================

export type WSEvent =
  | { type: 'task:progress'; taskId: string; step: string; progress: number; estimatedRemaining: number }
  | { type: 'node:progress'; taskId: string; nodeId: string; nodeName: string; stepIndex: number; totalSteps: number; progress: number }
  | { type: 'dag:node_done'; taskId: string; nodeId: string; output: any }
  | { type: 'clarification:needed'; payload: ClarificationPayload }
  | { type: 'confirm:needed'; confirmType: ConfirmationType; payload: any }
  | { type: 'preview:incremental'; textureUrl: string }
  | { type: 'preview:complete'; taskId: string; modelUrl: string; version: VersionNode }
  | { type: 'version:updated'; tree: VersionTree }
  | { type: 'balance:update'; balance: number }
  | { type: 'error:recoverable'; message: string; suggestedAction: string }
  | { type: 'error:fatal'; message: string }
  | { type: 'reasoning:step'; taskId: string; step: string; detail: string }

export type WSCommand =
  | { type: 'generate'; prompt: string; images?: string[]; fromVersion?: string }
  | { type: 'edit'; prompt: string; targetVersion: string; sourceModelUrl?: string; sourceTaskId?: string }
  | { type: 'clarification:response'; payload: UserClarificationResponse[] }
  | { type: 'confirm:response'; accepted: boolean; choice?: string }
  | { type: 'cancel'; taskId: string }
  | { type: 'version:checkout'; versionId: string }
  | { type: 'version:fork'; fromVersionId: string }
  | { type: 'balance:query' }
  | { type: 'profile:sync'; profile: Partial<UserProfile> }

export interface ClarificationPayload {
  checkpoint: ClarificationCheckpoint
  questions: ClarificationQuestion[]
}

export type ConfirmationType = 'concept_select' | 'quality' | 'cost' | 'fork'

// ============================================================
// 澄清检查点
// ============================================================

export interface ClarificationCheckpoint {
  triggerPoint: 'pre_planning' | 'mid_execution' | 'post_result'
  shouldTrigger: boolean
  questions: ClarificationQuestion[]
  snapshot: PipelineSnapshot
  timeout: {
    default: number
    expanded: number
    debug: number
  }
}

export interface PipelineSnapshot {
  taskId: string
  dagState: ExecutionDAG | null
  completedNodes: string[]
  pendingNodes: string[]
  resolvedParams: Record<string, any>
}

// ============================================================
// 确认点
// ============================================================

export interface ConfirmationPoint {
  type: ConfirmationType
  payload: ConceptSelectPayload | CostPayload | QualityPayload | ForkPayload
}

export interface ConceptSelectPayload {
  concepts: Array<{ id: string; thumbnailUrl: string; description: string }>
}

export interface CostPayload {
  operation: string
  creditsCost: number
  currentBalance: number
}

export interface QualityPayload {
  issues: Array<{ type: string; description: string; autoFixable: boolean }>
}

export interface ForkPayload {
  baseVersion: string
  description: string
}

// ============================================================
// 经验库
// ============================================================

export interface ExperienceEntry {
  id: string
  conditions: {
    inputPattern: string
    objectType?: string
    artStyle?: string
    meshyEndpoint: string
    errorType?: string
    qualityIssue?: string
  }
  resolution: {
    strategy: 'retry_with_params' | 'fallback_endpoint' | 'add_constraint' | 'user_guidance'
    adjustedParams?: Record<string, any>
    fallbackAction?: string
    userMessage?: string
    preventionRule?: string
  }
  frequency: number
  successRate: number
  scope: 'global' | 'user' | 'task_type'
  createdAt: number
  lastHitAt: number
}

export interface ExperienceQuery {
  inputPattern?: string
  objectType?: string
  meshyEndpoint?: string
  errorType?: string
}

// ============================================================
// Orchestrator
// ============================================================

export type OrchestratorState = 'intent_parsing' | 'clarification_needed' | 'planning' | 'executing' | 'waiting_user_confirm' | 'completed' | 'error_recovery'

export interface OrchestratorContext {
  taskId: string
  /** For edit operations: the original task ID whose version tree should receive the new version */
  versionTreeTaskId?: string
  userId: string
  userProfile: UserProfile
  currentVersion: VersionNode | null
  resolvedIntent: Record<string, any>
  executionPlan: ExecutionDAG | null
  experienceHits: ExperienceEntry[]
  state: OrchestratorState
  changeScope: ChangeScope | null
}

// ============================================================
// 用户偏好
// ============================================================

export interface AppPreferences {
  defaultExposure: 'minimal' | 'standard' | 'full'
  rememberPanelState: boolean
  autoConfirmLowCost: boolean
}

// ============================================================
// 积分系统
// ============================================================

export interface CreditSystem {
  balance: number
  history: CreditTransaction[]
}

export interface CreditTransaction {
  id: string
  operation: string
  amount: number
  timestamp: number
  taskId: string
}

// 积分成本映射
export const CREDIT_COSTS: Record<string, number> = {
  'text-to-3d-preview': 1,
  'text-to-3d-refine': 3,
  'image-to-3d': 3,
  'multi-image-to-3d': 5,
  'retexture': 2,
  'remesh': 2,
  'rigging': 3,
  'animation': 4,
  'multi-color-print': 2,
  'analyze-printability': 1,
  'repair-printability': 2,
  'quality-check': 0,
  'format-convert': 0,
}

// ============================================================
// 后端扩展类型
// ============================================================

// 会话管理
export interface Session {
  id: string
  userId: string
  connectedAt: number
  lastActivity: number
  userProfile: UserProfile
}

// 任务持久化模型
export interface TaskRecord {
  id: string
  sessionId: string
  state: TaskState
  prompt: string
  images: string[] | null
  fromVersion: string | null
  resolvedIntent: Record<string, any> | null
  executionDAG: ExecutionDAG | null
  changeScope: ChangeScope | null
  experienceHits: string[]  // experience IDs
  createdAt: number
  completedAt: number | null
  error: string | null
}

// Meshy API相关

// Meshy任务状态（大写，对应API实际返回值）
export type MeshyTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

// 基础任务字段（通用）
export interface MeshyTaskBase {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  created_at: number;
  started_at: number;
  finished_at: number;
  expires_at?: number;
  task_error: { message: string } | null;
  consumed_credits?: number;
  preceding_tasks?: number;
}

// 保留旧接口以兼容，使用MeshyTaskBase扩展
export interface MeshyTaskResponse extends MeshyTaskBase {
  model_urls?: Record<string, string>;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
}

/** @deprecated 使用具体的请求类型（TextTo3DPreviewRequest等）代替 */
export interface MeshyCreateRequest {
  mode?: 'preview' | 'refine'
  prompt: string
  art_style?: string
  negative_prompt?: string
  topology?: string
  target_polycount?: number
  [key: string]: any
}

// ============================================================
// Meshy API 请求类型
// ============================================================

// Text-to-3D 预览请求
export interface TextTo3DPreviewRequest {
  mode: 'preview';
  prompt: string;
  model_type?: 'standard' | 'lowpoly';
  ai_model?: 'meshy-5' | 'meshy-6' | 'latest';
  should_remesh?: boolean;
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  decimation_mode?: 1 | 2 | 3 | 4;
  symmetry_mode?: 'off' | 'auto' | 'on';
  pose_mode?: 'a-pose' | 't-pose' | '';
  moderation?: boolean;
  target_formats?: string[];
  auto_size?: boolean;
  origin_at?: 'bottom' | 'center';
}

// Text-to-3D 精细化请求
export interface TextTo3DRefineRequest {
  mode: 'refine';
  preview_task_id: string;
  enable_pbr?: boolean;
  hd_texture?: boolean;
  texture_prompt?: string;
  texture_image_url?: string;
  ai_model?: 'meshy-5' | 'meshy-6' | 'latest';
  moderation?: boolean;
  remove_lighting?: boolean;
  target_formats?: string[];
  auto_size?: boolean;
  origin_at?: 'bottom' | 'center';
}

// Image-to-3D 请求
export interface ImageTo3DRequest {
  image_url?: string;
  input_task_id?: string;
  model_type?: 'standard' | 'lowpoly';
  ai_model?: 'meshy-5' | 'meshy-6' | 'latest';
  should_texture?: boolean;
  enable_pbr?: boolean;
  hd_texture?: boolean;
  texture_prompt?: string;
  texture_image_url?: string;
  should_remesh?: boolean;
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  decimation_mode?: 1 | 2 | 3 | 4;
  save_pre_remeshed_model?: boolean;
  symmetry_mode?: 'off' | 'auto' | 'on';
  pose_mode?: 'a-pose' | 't-pose' | '';
  image_enhancement?: boolean;
  remove_lighting?: boolean;
  moderation?: boolean;
  target_formats?: string[];
  auto_size?: boolean;
  origin_at?: 'bottom' | 'center';
}

// Multi-Image-to-3D 请求
export interface MultiImageTo3DRequest {
  image_urls?: string[];
  input_task_id?: string;
  ai_model?: 'meshy-5' | 'meshy-6' | 'latest';
  should_texture?: boolean;
  enable_pbr?: boolean;
  hd_texture?: boolean;
  texture_prompt?: string;
  texture_image_url?: string;
  should_remesh?: boolean;
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  decimation_mode?: 1 | 2 | 3 | 4;
  save_pre_remeshed_model?: boolean;
  symmetry_mode?: 'off' | 'auto' | 'on';
  pose_mode?: 'a-pose' | 't-pose' | '';
  image_enhancement?: boolean;
  remove_lighting?: boolean;
  moderation?: boolean;
  target_formats?: string[];
  auto_size?: boolean;
  origin_at?: 'bottom' | 'center';
}

// Remesh 请求
export interface RemeshRequest {
  input_task_id?: string;
  model_url?: string;
  target_formats?: string[];
  topology?: 'quad' | 'triangle';
  target_polycount?: number;
  decimation_mode?: 1 | 2 | 3 | 4;
  resize_height?: number;
  auto_size?: boolean;
  origin_at?: 'bottom' | 'center';
  convert_format_only?: boolean;
}

// Rigging 请求
export interface RiggingRequest {
  input_task_id?: string;
  model_url?: string;
  height_meters?: number;
  texture_image_url?: string;
}

// Animation 请求
export interface AnimationRequest {
  rig_task_id: string;
  action_id: number;
  post_process?: {
    operation_type: 'change_fps' | 'fbx2usdz' | 'extract_armature';
    fps?: 24 | 25 | 30 | 60;
  };
}

// Retexture 请求
export interface RetextureRequest {
  input_task_id?: string;
  model_url?: string;
  text_style_prompt?: string;
  image_style_url?: string;
  ai_model?: 'meshy-5' | 'meshy-6' | 'latest';
  enable_original_uv?: boolean;
  enable_pbr?: boolean;
  hd_texture?: boolean;
  remove_lighting?: boolean;
  target_formats?: string[];
}

// 多色3D打印请求
export interface MultiColorPrintRequest {
  input_task_id?: string;
  model_url?: string;
  max_colors?: number;
  max_depth?: number;
}

// 可打印性分析请求
export interface AnalyzePrintRequest {
  input_task_id?: string;
  model_url?: string;
}

// 可打印性修复请求
export interface RepairPrintRequest {
  input_task_id?: string;
  model_url?: string;
}

// ============================================================
// Meshy API 响应类型
// ============================================================

// Text-to-3D / Image-to-3D / Multi-Image-to-3D 共享响应结构
export interface MeshyModelTaskResponse extends MeshyTaskBase {
  model_urls?: Record<string, string>;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
}

// Remesh 响应
export interface RemeshTaskResponse extends MeshyTaskBase {
  type: 'remesh';
  model_urls?: Record<string, string>;
}

// Retexture 响应
export interface RetextureTaskResponse extends MeshyTaskBase {
  type: 'retexture';
  model_urls?: Record<string, string>;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
}

// Rigging 响应
export interface RiggingTaskResponse extends MeshyTaskBase {
  type: 'rig';
  result?: {
    rigged_character_fbx_url: string;
    rigged_character_glb_url: string;
    basic_animations?: {
      walking_glb_url?: string;
      walking_fbx_url?: string;
      walking_armature_glb_url?: string;
      running_glb_url?: string;
      running_fbx_url?: string;
      running_armature_glb_url?: string;
    };
  };
}

// Animation 响应
export interface AnimationTaskResponse extends MeshyTaskBase {
  type: 'animate';
  result?: {
    animation_glb_url: string;
    animation_fbx_url: string;
    processed_usdz_url?: string;
    processed_armature_fbx_url?: string;
    processed_animation_fps_fbx_url?: string;
  };
}

// 多色打印响应
export interface MultiColorPrintTaskResponse extends MeshyTaskBase {
  type: 'print-multi-color';
  model_urls?: { '3mf'?: string };
}

// 可打印性分析响应
export interface AnalyzePrintTaskResponse extends MeshyTaskBase {
  type: 'print-analyze';
  printability?: {
    _version: string;
    status: 'healthy' | 'warning' | 'error' | 'unknown';
    issue_count: number;
    error_count: number;
    warning_count: number;
    metrics: {
      is_watertight: boolean;
      volume: number;
      non_manifold_edges: number;
      degenerate_faces: number;
      holes: number;
    };
    evaluated_at: number;
  } | null;
}

// 可打印性修复响应
export interface RepairPrintTaskResponse extends MeshyTaskBase {
  type: 'print-repair';
  model_urls?: Record<string, string>;
  thumbnail_url?: string;
  texture_urls?: any[];
}

// 余额响应
export interface BalanceResponse {
  balance: number;
}

// Meshy任务类型枚举（用于轮询路由）
export type MeshyTaskType =
  | 'text-to-3d'
  | 'image-to-3d'
  | 'multi-image-to-3d'
  | 'remesh'
  | 'rigging'
  | 'animation'
  | 'retexture'
  | 'multi-color-print'
  | 'analyze-print'
  | 'repair-print';
