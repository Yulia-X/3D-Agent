/**
 * 任务状态管理
 * 管理当前任务、执行DAG、管线阶段、澄清/确认状态
 */
import { create } from 'zustand'
import { Task, TaskState, ExecutionDAG, DAGNode, ClarificationPayload, ConfirmationPoint, ChangeScope, ClarificationRound } from '../types'

interface TaskStore {
  // 状态
  currentTask: Task | null
  taskHistory: Task[]
  executionDAG: ExecutionDAG | null
  clarificationPending: ClarificationPayload | null
  confirmationPending: ConfirmationPoint | null
  changeScope: ChangeScope | null
  clarificationRounds: ClarificationRound[]

  // Actions
  startTask: (prompt: string, options?: { images?: string[]; fromVersion?: string }) => void
  updateTaskState: (state: TaskState) => void
  completeTask: () => void
  failTask: (error: string) => void
  setExecutionDAG: (dag: ExecutionDAG) => void
  updateDAGNode: (nodeId: string, updates: Partial<DAGNode>) => void
  setClarificationPending: (payload: ClarificationPayload | null) => void
  setConfirmationPending: (point: ConfirmationPoint | null) => void
  setChangeScope: (scope: ChangeScope | null) => void
  addClarificationRound: (round: ClarificationRound) => void
  updateClarificationRound: (roundId: string, updates: Partial<ClarificationRound>) => void
  clearTask: () => void
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  currentTask: null,
  taskHistory: [],
  executionDAG: null,
  clarificationPending: null,
  confirmationPending: null,
  changeScope: null,
  clarificationRounds: [],

  startTask: (prompt, options) => {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      state: 'parsing',
      prompt,
      images: options?.images,
      fromVersion: options?.fromVersion,
      createdAt: Date.now(),
    }
    set({ currentTask: task, executionDAG: null, clarificationPending: null, confirmationPending: null })
  },

  updateTaskState: (state) => set((s) => ({
    currentTask: s.currentTask ? { ...s.currentTask, state } : null
  })),

  completeTask: () => set((s) => {
    if (!s.currentTask) return s
    const completed = { ...s.currentTask, state: 'completed' as TaskState, completedAt: Date.now() }
    return {
      currentTask: completed,
      taskHistory: [...s.taskHistory, completed]
    }
  }),

  failTask: (error) => set((s) => ({
    currentTask: s.currentTask ? { ...s.currentTask, state: 'error_recovery' as TaskState, error } : null
  })),

  setExecutionDAG: (dag) => set({ executionDAG: dag }),

  updateDAGNode: (nodeId, updates) => set((s) => {
    if (!s.executionDAG) return s
    return {
      executionDAG: {
        ...s.executionDAG,
        nodes: s.executionDAG.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
      }
    }
  }),

  setClarificationPending: (payload) => set({ clarificationPending: payload }),
  setConfirmationPending: (point) => set({ confirmationPending: point }),
  setChangeScope: (scope) => set({ changeScope: scope }),

  addClarificationRound: (round) => set((s) => ({
    clarificationRounds: [...s.clarificationRounds, round]
  })),

  updateClarificationRound: (roundId, updates) => set((s) => ({
    clarificationRounds: s.clarificationRounds.map((r) =>
      r.roundId === roundId ? { ...r, ...updates } : r
    )
  })),

  clearTask: () => set({
    currentTask: null,
    executionDAG: null,
    clarificationPending: null,
    confirmationPending: null,
    changeScope: null,
    clarificationRounds: [],
  }),
}))
