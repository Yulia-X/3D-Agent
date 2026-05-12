import { MeshyClient, meshyClient } from './client.js';
import { MeshyTaskType } from '../types.js';

export class TaskPoller {
  private activePolls: Map<string, { timer: ReturnType<typeof setTimeout>; cancelled: boolean }> = new Map();

  constructor(
    private client: MeshyClient,
    private pollIntervalMs: number = 2000,
    private maxPollDuration: number = 300000
  ) {}

  // 开始轮询一个任务直到完成
  async pollUntilDone(
    taskId: string,
    taskType: MeshyTaskType,
    onProgress?: (progress: number, status: string) => void
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const startTime = Date.now();
      const pollState = { timer: setTimeout(() => {}, 0), cancelled: false };
      clearTimeout(pollState.timer);
      this.activePolls.set(taskId, pollState);

      const poll = async () => {
        if (pollState.cancelled) {
          this.activePolls.delete(taskId);
          reject(new Error(`Polling cancelled for task ${taskId}`));
          return;
        }

        // 超时检查
        if (Date.now() - startTime > this.maxPollDuration) {
          this.activePolls.delete(taskId);
          reject(new Error(`Polling timeout for task ${taskId} after ${this.maxPollDuration}ms`));
          return;
        }

        try {
          const result = await this.client.getTaskByType(taskId, taskType);

          // 调用进度回调
          if (onProgress) {
            onProgress(result.progress, result.status);
          }

          if (result.status === 'SUCCEEDED') {
            this.activePolls.delete(taskId);
            resolve(result);
            return;
          }

          if (result.status === 'FAILED') {
            this.activePolls.delete(taskId);
            const errorMsg = result.task_error?.message ?? 'Task failed without error message';
            reject(new Error(`Meshy task ${taskId} failed: ${errorMsg}`));
            return;
          }

          if (result.status === 'CANCELED') {
            this.activePolls.delete(taskId);
            reject(new Error(`Meshy task ${taskId} was canceled`));
            return;
          }

          // 继续轮询 (PENDING / IN_PROGRESS)
          pollState.timer = setTimeout(poll, this.pollIntervalMs);
        } catch (err) {
          this.activePolls.delete(taskId);
          reject(err);
        }
      };

      // 开始第一次轮询
      pollState.timer = setTimeout(poll, this.pollIntervalMs);
    });
  }

  // 取消轮询
  cancelPoll(taskId: string): void {
    const pollState = this.activePolls.get(taskId);
    if (pollState) {
      pollState.cancelled = true;
      clearTimeout(pollState.timer);
      this.activePolls.delete(taskId);
    }
  }

  // 获取活跃轮询数
  getActiveCount(): number {
    return this.activePolls.size;
  }
}

export const taskPoller = new TaskPoller(meshyClient);
