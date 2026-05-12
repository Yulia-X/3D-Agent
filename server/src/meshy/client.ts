import { config } from '../config.js';
import type {
  TextTo3DPreviewRequest, TextTo3DRefineRequest,
  ImageTo3DRequest, MultiImageTo3DRequest,
  RemeshRequest, RiggingRequest, AnimationRequest,
  RetextureRequest, MultiColorPrintRequest,
  AnalyzePrintRequest, RepairPrintRequest,
  MeshyModelTaskResponse, RemeshTaskResponse,
  RiggingTaskResponse, AnimationTaskResponse,
  RetextureTaskResponse, MultiColorPrintTaskResponse,
  AnalyzePrintTaskResponse, RepairPrintTaskResponse,
  MeshyTaskType, BalanceResponse
} from '../types.js';

export class MeshyClient {
  private baseUrl: string;
  private apiKey: string;
  private isMock: boolean;
  private mockCreatedAt: Map<string, number> = new Map();

  constructor() {
    this.baseUrl = config.MESHY_API_BASE;
    this.apiKey = config.MESHY_API_KEY;
    this.isMock = config.MESHY_MOCK;
  }

  // === 私有核心请求方法 ===
  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        lastError = new Error(`Rate limited (429) on ${method} ${path}`);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Meshy API error ${response.status} on ${method} ${path}: ${errorBody}`);
      }

      return await response.json() as T;
    }
    throw lastError || new Error(`Max retries exceeded on ${method} ${path}`);
  }

  // === 创建任务 API（每个返回 taskId string） ===

  async textTo3DPreview(params: TextTo3DPreviewRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('text-to-3d-preview');
    const res = await this.request<{ result: string }>('POST', '/openapi/v2/text-to-3d', params);
    return res.result;
  }

  async textTo3DRefine(params: TextTo3DRefineRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('text-to-3d-refine');
    const res = await this.request<{ result: string }>('POST', '/openapi/v2/text-to-3d', params);
    return res.result;
  }

  async imageTo3D(params: ImageTo3DRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('image-to-3d');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/image-to-3d', params);
    return res.result;
  }

  async multiImageTo3D(params: MultiImageTo3DRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('multi-image-to-3d');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/multi-image-to-3d', params);
    return res.result;
  }

  async remesh(params: RemeshRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('remesh');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/remesh', params);
    return res.result;
  }

  async rigging(params: RiggingRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('rigging');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/rigging', params);
    return res.result;
  }

  async animation(params: AnimationRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('animation');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/animations', params);
    return res.result;
  }

  async retexture(params: RetextureRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('retexture');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/retexture', params);
    return res.result;
  }

  async multiColorPrint(params: MultiColorPrintRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('multi-color-print');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/print/multi-color', params);
    return res.result;
  }

  async analyzePrintability(params: AnalyzePrintRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('analyze-printability');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/print/analyze', params);
    return res.result;
  }

  async repairPrintability(params: RepairPrintRequest): Promise<string> {
    if (this.isMock) return this.mockCreateTask('repair-printability');
    const res = await this.request<{ result: string }>('POST', '/openapi/v1/print/repair', params);
    return res.result;
  }

  // === 查询任务 API（返回完整任务对象） ===

  async getTextTo3DTask(taskId: string): Promise<MeshyModelTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<MeshyModelTaskResponse>('GET', `/openapi/v2/text-to-3d/${taskId}`);
  }

  async getImageTo3DTask(taskId: string): Promise<MeshyModelTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<MeshyModelTaskResponse>('GET', `/openapi/v1/image-to-3d/${taskId}`);
  }

  async getMultiImageTo3DTask(taskId: string): Promise<MeshyModelTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<MeshyModelTaskResponse>('GET', `/openapi/v1/multi-image-to-3d/${taskId}`);
  }

  async getRemeshTask(taskId: string): Promise<RemeshTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<RemeshTaskResponse>('GET', `/openapi/v1/remesh/${taskId}`);
  }

  async getRiggingTask(taskId: string): Promise<RiggingTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<RiggingTaskResponse>('GET', `/openapi/v1/rigging/${taskId}`);
  }

  async getAnimationTask(taskId: string): Promise<AnimationTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<AnimationTaskResponse>('GET', `/openapi/v1/animations/${taskId}`);
  }

  async getRetextureTask(taskId: string): Promise<RetextureTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<RetextureTaskResponse>('GET', `/openapi/v1/retexture/${taskId}`);
  }

  async getMultiColorPrintTask(taskId: string): Promise<MultiColorPrintTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<MultiColorPrintTaskResponse>('GET', `/openapi/v1/print/multi-color/${taskId}`);
  }

  async getAnalyzePrintTask(taskId: string): Promise<AnalyzePrintTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<AnalyzePrintTaskResponse>('GET', `/openapi/v1/print/analyze/${taskId}`);
  }

  async getRepairPrintTask(taskId: string): Promise<RepairPrintTaskResponse> {
    if (this.isMock) return this.mockGetStatus(taskId) as any;
    return this.request<RepairPrintTaskResponse>('GET', `/openapi/v1/print/repair/${taskId}`);
  }

  // === 余额 API ===
  async getBalance(): Promise<number> {
    if (this.isMock) return 1000;
    const res = await this.request<BalanceResponse>('GET', '/openapi/v1/balance');
    return res.balance;
  }

  // === 统一查询入口（根据 taskType 路由） ===
  async getTaskByType(taskId: string, taskType: MeshyTaskType): Promise<any> {
    switch (taskType) {
      case 'text-to-3d': return this.getTextTo3DTask(taskId);
      case 'image-to-3d': return this.getImageTo3DTask(taskId);
      case 'multi-image-to-3d': return this.getMultiImageTo3DTask(taskId);
      case 'remesh': return this.getRemeshTask(taskId);
      case 'rigging': return this.getRiggingTask(taskId);
      case 'animation': return this.getAnimationTask(taskId);
      case 'retexture': return this.getRetextureTask(taskId);
      case 'multi-color-print': return this.getMultiColorPrintTask(taskId);
      case 'analyze-print': return this.getAnalyzePrintTask(taskId);
      case 'repair-print': return this.getRepairPrintTask(taskId);
      default: throw new Error(`Unknown task type: ${taskType}`);
    }
  }

  // === Mock 实现 ===
  private mockCreateTask(endpoint: string): string {
    const taskId = `mock-${endpoint}-${Date.now()}`;
    this.mockCreatedAt.set(taskId, Date.now());
    return taskId;
  }

  private mockGetStatus(taskId: string): MeshyModelTaskResponse {
    const createdAt = this.mockCreatedAt.get(taskId) || Date.now();
    const elapsed = Date.now() - createdAt;
    const now = Date.now();

    if (elapsed < 3000) {
      return {
        id: taskId, status: 'PENDING', progress: 0,
        created_at: createdAt, started_at: 0, finished_at: 0,
        task_error: null,
      };
    }
    if (elapsed < 8000) {
      const progress = Math.min(95, Math.floor(((elapsed - 3000) / 5000) * 95));
      return {
        id: taskId, status: 'IN_PROGRESS', progress,
        created_at: createdAt, started_at: createdAt + 3000, finished_at: 0,
        task_error: null,
      };
    }
    // 模拟真实 Meshy CDN URL（必须为 https:// 协议，前端 isValidModelUrl 验证要求）
    return {
      id: taskId, status: 'SUCCEEDED', progress: 100,
      created_at: createdAt, started_at: createdAt + 3000, finished_at: now,
      task_error: null,
      model_urls: {
        glb: `https://assets.meshy.ai/mock/${taskId}/output.glb`,
        fbx: `https://assets.meshy.ai/mock/${taskId}/output.fbx`,
      },
      texture_urls: [{ base_color: `https://assets.meshy.ai/mock/${taskId}/texture_diffuse.png` }],
      thumbnail_url: `https://assets.meshy.ai/mock/${taskId}/thumbnail.png`,
    };
  }
}

export const meshyClient = new MeshyClient();
