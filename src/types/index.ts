// ============================================================
// 3D Model Agent - 类型定义
// ============================================================
// 文件结构：
//   1. 基础类型（保留给 engine/ 使用）
//      - 用户等级 & 档案
//      - 生成质量 & 成本
//      - 澄清系统
//      - A/B 问题优化
//      - 训练数据
//      - 团队协作
//      - 预测性澄清
//      - 澄清队列
//   2. 新架构类型
//      - 界面暴露层级
//      - 任务状态
//      - 版本树
//      - 变更范围
//      - DAG执行
//      - 子Agent
//      - 预览
//      - WebSocket事件
//      - 澄清检查点
//      - 确认点
//      - 经验库
//      - Orchestrator
//      - 用户偏好
//      - 积分系统
// ============================================================

// ============================================================
// 基础类型（保留给 engine/ 使用）
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

// 生成质量
export type GenerationQuality = 'preview' | 'standard' | 'high'

// 成本配置
export interface CostConfig {
  creditCosts: Record<GenerationQuality, number>
  timeCostFactor: number
  satisfactionWeights: Record<string, number>
}

// 澄清系统类型（供 engine/ 使用）
export interface ClarificationQuestion {
  id?: string
  field: string
  question: string
  type: 'single_choice' | 'multi_choice' | 'text' | 'image_select' | 'range' | 'confirm'
  options?: ClarificationOption[]
  priority: 'critical' | 'important' | 'nice_to_have'
  impact: 'high' | 'medium' | 'low'
  timeout?: number
  recommendedDefault?: string
  defaultValue?: string
  reason?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  metadata?: Record<string, any>
}

export interface ClarificationOption {
  label: string
  value: string
  description?: string
  thumbnail?: string
  isRecommended?: boolean
}

// --- 澄清轮次 ---
export interface ClarificationRound {
  roundId: string
  roundIndex: number
  messageId: string
  status: 'active' | 'answered' | 'timeout'
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
}

export interface UserClarificationResponse {
  questionId: string
  field: string
  value: string
  timestamp: number
}

// A/B 问题优化
export interface QuestionVariant {
  id: string
  field: string
  question: string
  options?: ClarificationOption[]
  stats: VariantStats
  retired: boolean
  createdAt: number
}

export interface VariantStats {
  shown: number
  answered: number
  skipped: number
  avgTime: number
}

// 训练数据
export interface TrainingSample {
  id: string
  prompt: string
  missingField: string
  correctValue: string
  userLevel: string
  timestamp: number
  variantId?: string
}

// 团队协作
export interface TeamConfig {
  teamId: string
  teamName: string
  members: TeamMember[]
  projectDefaults: ProjectDefault[]
  onlineMembers: string[]
}

export interface TeamMember {
  userId: string
  name: string
  role: 'admin' | 'member'
  isOnline: boolean
}

export interface ProjectDefault {
  field: string
  value: string
  setBy: string
  updatedAt: number
}

export interface ClarificationTarget {
  type: 'self' | 'project_default' | 'teammate' | 'system_default'
  value?: string
  userId?: string
  pendingConfirmation?: boolean
}

// 预测性澄清
export interface PredictiveSelection {
  field: string
  value: string
  label: string
  source: 'chip' | 'typed'
}

export interface PredictiveField {
  field: string
  label: string
  options: Array<{ value: string; label: string }>
  confidence: number
}

// 澄清队列
export interface ClarificationQueueItem {
  taskId: string
  questions: ClarificationQuestion[]
  createdAt: number
  priority: 'high' | 'normal' | 'low'
  originalPrompt: string
}

export interface RetryState {
  questionId: string
  attempts: number
  maxAttempts: number
  lastAttemptAt: number
  status: 'pending' | 'retrying' | 'success' | 'failed'
  backoffMs: number
}

// ============================================================
// 新架构类型
// ============================================================

// --- 界面暴露层级 ---
export interface ExposureLevel {
  editPanel: boolean
  debugPanel: boolean
  versionTimeline: boolean
  advancedParams: boolean
}

// --- 任务状态 ---
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

// --- 版本树 ---
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

// --- 变更范围 ---
export interface ChangeScope {
  geometry: boolean
  texture: boolean
  skeleton: boolean
  animation: boolean
  print: boolean
  metadata: boolean
}

// --- DAG执行 ---
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

// --- 子Agent ---
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

// --- 预览 ---
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

// --- WebSocket事件 ---
export type WSEvent =
  | { type: 'task:progress'; taskId: string; step: string; progress: number; estimatedRemaining: number }
  | { type: 'node:progress'; taskId: string; nodeId: string; nodeName: string; stepIndex: number; totalSteps: number; progress: number }
  | { type: 'dag:node_done'; taskId: string; nodeId: string; output: any }
  | { type: 'clarification:needed'; payload: ClarificationPayload }
  | { type: 'confirm:needed'; confirmType: ConfirmationType; payload: any }
  | { type: 'preview:incremental'; textureUrl: string }
  | { type: 'preview:complete'; taskId?: string; modelUrl: string; version: VersionNode }
  | { type: 'version:updated'; tree: VersionTree }
  | { type: 'balance:update'; balance: number }
  | { type: 'error:recoverable'; message: string; suggestedAction: string }
  | { type: 'error:fatal'; message: string }

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

// --- 澄清检查点 ---
export interface ClarificationCheckpoint {
  triggerPoint: 'pre_planning' | 'mid_execution' | 'post_result'
  shouldTrigger: boolean
  questions: ClarificationQuestion[]
  snapshot: PipelineSnapshot
  timeout: {
    default: number    // 30000
    expanded: number   // 120000
    debug: number      // 0
  }
}

export interface PipelineSnapshot {
  taskId: string
  dagState: ExecutionDAG | null
  completedNodes: string[]
  pendingNodes: string[]
  resolvedParams: Record<string, any>
}

// --- 确认点 ---
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

// --- 经验库 ---
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

// --- Orchestrator ---
export type OrchestratorState = 'intent_parsing' | 'clarification_needed' | 'planning' | 'executing' | 'waiting_user_confirm' | 'completed' | 'error_recovery'

export interface OrchestratorContext {
  taskId: string
  userId: string
  userProfile: UserProfile
  currentVersion: VersionNode | null
  resolvedIntent: Record<string, any>
  executionPlan: ExecutionDAG | null
  experienceHits: ExperienceEntry[]
  state: OrchestratorState
  changeScope: ChangeScope | null
}

// --- 用户偏好 ---
export interface AppPreferences {
  defaultExposure: 'minimal' | 'standard' | 'full'
  rememberPanelState: boolean
  autoConfirmLowCost: boolean
}

// --- 积分系统 ---
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

// --- 积分成本映射 ---
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
// 旧引擎兼容类型（供 engine/ 和 utils/ 使用）
// ============================================================

export type AppMode = 'explore' | 'pipeline'
export type ViewMode = 'simple' | 'professional'

export type ChatIntentType =
  | 'generate'
  | 'edit-material'
  | 'edit-transform'
  | 'edit-lighting'
  | 'export'
  | 'pipeline'
  | 'query'
  | 'greeting'
  | 'unknown'

export type PanelMode =
  | 'preview'
  | 'edit-material'
  | 'edit-transform'
  | 'edit-lighting'
  | 'pipeline-detail'

export interface ChatIntent {
  type: ChatIntentType
  confidence: number
  extractedParams?: Record<string, any>
  originalMessage: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  contentType: string
  timestamp: number
  metadata?: Record<string, any>
}

export interface GenerationParameters {
  cfgScale: number
  samplingSteps: number
  seed: number
  topology: string
  textureResolution: number
  polyBudget: number
  uvMethod: string
  outputFormat: string
}

export interface AgentStep {
  id: string
  name: string
  type: string
  status: string
  progress: number
  inputs: Record<string, any>
  outputs: Record<string, any>
  position: { x: number; y: number }
  connections: string[]
}

export interface EditSettings {
  material: {
    baseColor: string
    metallic: number
    roughness: number
    emission: string
    emissionStrength: number
    normalStrength: number
  }
  rotation: { x: number; y: number; z: number }
  scale: number
  lighting: string
  background: string
}

export interface StylePreset {
  id: string
  name: string
  thumbnail: string
  description: string
  tags: string[]
}

export interface GenerationTask {
  id: string
  status: string
  style?: string
  parameters: GenerationParameters
  agentSteps?: AgentStep[]
  result?: {
    thumbnailUrl?: string
    modelUrl?: string
  }
}

export interface TaskTemplate {
  id: string
  name: string
  description: string
  creator: string
  createdAt: number
  parameters: GenerationParameters
  agentSteps?: AgentStep[]
  previewUrl?: string
  tags: string[]
  usageCount: number
}

export interface IntentAnalysis {
  detectedLevel: UserLevel
  keywords: string[]
  suggestedMode: AppMode
  suggestedViewMode: ViewMode
  confidence: number
  autoParams?: Partial<GenerationParameters>
}
