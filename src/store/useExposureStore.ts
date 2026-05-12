/**
 * 界面暴露层级管理
 * 基于行为信号控制界面渐进展开
 * 单向记忆：一旦展开过，下次默认展开（可手动收起）
 */
import { create } from 'zustand'
import { ExposureLevel } from '../types'

const EXPOSURE_STORAGE_KEY = '3d-agent-exposure-level'

function loadExposure(): ExposureLevel {
  try {
    const stored = localStorage.getItem(EXPOSURE_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    editPanel: false,
    debugPanel: false,
    versionTimeline: false,
    advancedParams: false,
  }
}

function saveExposure(level: ExposureLevel) {
  try {
    localStorage.setItem(EXPOSURE_STORAGE_KEY, JSON.stringify(level))
  } catch {}
}

interface ExposureStore {
  // 状态
  exposure: ExposureLevel
  // 临时收起状态（不持久化，用户可以暂时收起已展开的面板）
  collapsed: Partial<Record<keyof ExposureLevel, boolean>>

  // Actions（展开 — 单向记忆）
  expandEditPanel: () => void
  expandDebugPanel: () => void
  expandVersionTimeline: () => void
  expandAdvancedParams: () => void

  // Actions（临时收起/展开 — 不影响记忆）
  toggleCollapse: (panel: keyof ExposureLevel) => void

  // 查询：面板是否实际可见（已展开 且 未被临时收起）
  isPanelVisible: (panel: keyof ExposureLevel) => boolean

  // 行为信号处理
  handleSignal: (signal: ExposureSignal) => void
}

export type ExposureSignal =
  | 'user_dissatisfied'       // 用户说"不满意"
  | 'model_clicked'           // 点击模型区域
  | 'technical_term_used'     // 使用技术术语
  | 'more_controls_clicked'   // 点击"更多控制"
  | 'debug_toggled'           // 开关调试面板
  | 'file_uploaded'           // 上传.blend/.fbx
  | 'api_template_used'       // 使用API/模板
  | 'multiple_versions'       // 产生多版本

export const useExposureStore = create<ExposureStore>((set, get) => ({
  exposure: loadExposure(),
  collapsed: {},

  expandEditPanel: () => set((s) => {
    const newExposure = { ...s.exposure, editPanel: true }
    saveExposure(newExposure)
    return { exposure: newExposure }
  }),

  expandDebugPanel: () => set((s) => {
    const newExposure = { ...s.exposure, debugPanel: true }
    saveExposure(newExposure)
    return { exposure: newExposure }
  }),

  expandVersionTimeline: () => set((s) => {
    const newExposure = { ...s.exposure, versionTimeline: true }
    saveExposure(newExposure)
    return { exposure: newExposure }
  }),

  expandAdvancedParams: () => set((s) => {
    const newExposure = { ...s.exposure, advancedParams: true }
    saveExposure(newExposure)
    return { exposure: newExposure }
  }),

  toggleCollapse: (panel) => set((s) => ({
    collapsed: { ...s.collapsed, [panel]: !s.collapsed[panel] }
  })),

  isPanelVisible: (panel) => {
    const s = get()
    return s.exposure[panel] && !s.collapsed[panel]
  },

  handleSignal: (signal) => {
    const { expandEditPanel, expandDebugPanel, expandVersionTimeline, expandAdvancedParams } = get()
    
    switch (signal) {
      case 'user_dissatisfied':
      case 'model_clicked':
        expandEditPanel()
        break
      case 'technical_term_used':
        expandEditPanel()
        expandAdvancedParams()
        break
      case 'more_controls_clicked':
        expandEditPanel()
        break
      case 'debug_toggled':
        expandDebugPanel()
        break
      case 'file_uploaded':
      case 'api_template_used':
        expandEditPanel()
        expandAdvancedParams()
        break
      case 'multiple_versions':
        expandVersionTimeline()
        break
    }
  },
}))
