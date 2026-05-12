/**
 * 全局通用状态
 * 精简后只保留：用户档案、偏好、积分系统
 */
import { create } from 'zustand'
import { UserProfile, AppPreferences, CreditSystem, CreditTransaction } from '../types'
import { wsService } from '../hooks/useWebSocket'

const USER_PROFILE_KEY = '3d-agent-user-profile'
const PREFERENCES_KEY = '3d-agent-preferences'
const ANSWER_HISTORY_KEY = '3d-agent-answer-history'

function loadUserProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(USER_PROFILE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    level: 'intermediate',
    usageCount: 0,
    unlockedFeatures: [],
    preferences: {},
    firstVisit: true,
    clarificationHistory: { asked: 0, answered: 0, skipped: 0, avgResponseTime: 0 },
    stablePreferences: {},
  }
}

function saveUserProfile(profile: UserProfile) {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile))
  } catch {}
}

function loadPreferences(): AppPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    defaultExposure: 'minimal',
    rememberPanelState: true,
    autoConfirmLowCost: true,
  }
}

function savePreferences(prefs: AppPreferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs))
  } catch {}
}

function loadAnswerHistory(): Record<string, string[]> {
  try {
    const stored = localStorage.getItem(ANSWER_HISTORY_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {}
}

function saveAnswerHistory(history: Record<string, string[]>) {
  try {
    localStorage.setItem(ANSWER_HISTORY_KEY, JSON.stringify(history))
  } catch {}
}

interface AppStore {
  // 用户
  userProfile: UserProfile
  updateUserProfile: (updates: Partial<UserProfile>) => void
  incrementUsage: () => void
  
  // 偏好
  preferences: AppPreferences
  updatePreferences: (updates: Partial<AppPreferences>) => void
  
  // 积分
  credits: CreditSystem
  deductCredits: (amount: number, operation: string, taskId: string) => boolean
  addCredits: (amount: number) => void
  syncBalance: (balance: number) => void
  
  // 澄清历史（供 engine/ 使用）
  updateClarificationHistory: (answered: boolean, responseTime?: number) => void

  // 偏好学习
  answerHistory: Record<string, string[]>
  recordAnswer: (field: string, value: string) => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  userProfile: loadUserProfile(),
  
  updateUserProfile: (updates) => set((s) => {
    const newProfile = { ...s.userProfile, ...updates }
    saveUserProfile(newProfile)
    return { userProfile: newProfile }
  }),
  
  incrementUsage: () => set((s) => {
    const newProfile = { ...s.userProfile, usageCount: s.userProfile.usageCount + 1 }
    saveUserProfile(newProfile)
    return { userProfile: newProfile }
  }),

  preferences: loadPreferences(),
  
  updatePreferences: (updates) => set((s) => {
    const newPrefs = { ...s.preferences, ...updates }
    savePreferences(newPrefs)
    return { preferences: newPrefs }
  }),

  credits: {
    balance: 100,  // 初始100积分
    history: [],
  },
  
  deductCredits: (amount, operation, taskId) => {
    const state = get()
    if (state.credits.balance < amount) return false
    
    const transaction: CreditTransaction = {
      id: `tx-${Date.now()}`,
      operation,
      amount: -amount,
      timestamp: Date.now(),
      taskId,
    }
    
    set({
      credits: {
        balance: state.credits.balance - amount,
        history: [...state.credits.history, transaction],
      }
    })
    return true
  },
  
  addCredits: (amount) => set((s) => ({
    credits: {
      ...s.credits,
      balance: s.credits.balance + amount,
    }
  })),

  syncBalance: (balance) => set((s) => ({
    credits: {
      ...s.credits,
      balance,
    }
  })),

  updateClarificationHistory: (answered, responseTime) => set((s) => {
    const history = { ...s.userProfile.clarificationHistory }
    history.asked++
    if (answered) {
      history.answered++
      if (responseTime) {
        history.avgResponseTime = history.avgResponseTime + (responseTime - history.avgResponseTime) / history.answered
      }
    } else {
      history.skipped++
    }
    const newProfile = { ...s.userProfile, clarificationHistory: history }
    saveUserProfile(newProfile)
    return { userProfile: newProfile }
  }),

  // 偏好学习
  answerHistory: loadAnswerHistory(),

  recordAnswer: (field, value) => set((s) => {
    const prev = s.answerHistory[field] || []
    // 保留最近5次
    const updated = [...prev, value].slice(-5)
    const newHistory = { ...s.answerHistory, [field]: updated }
    saveAnswerHistory(newHistory)

    // 如果最近3次完全相同 → 自动写入 stablePreferences
    let newProfile = s.userProfile
    if (updated.length >= 3) {
      const last3 = updated.slice(-3)
      if (last3.every((v) => v === last3[0])) {
        newProfile = {
          ...s.userProfile,
          stablePreferences: { ...s.userProfile.stablePreferences, [field]: last3[0] },
        }
        saveUserProfile(newProfile)
        // 同步到后端
        try {
          wsService.send({
            type: 'profile:sync',
            profile: { stablePreferences: newProfile.stablePreferences },
          })
        } catch {}
      }
    }

    return { answerHistory: newHistory, userProfile: newProfile }
  }),
}))
