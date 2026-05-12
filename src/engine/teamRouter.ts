/**
 * 团队协作澄清路由
 * 建立 fallback chain，支持团队场景下的澄清路由
 * 当前为前端 stub，预留后端接口
 */
import { ClarificationTarget, TeamConfig, ProjectDefault } from '../types'

const TEAM_CONFIG_KEY = '3d-agent-team-config'

/**
 * 加载团队配置
 */
export function loadTeamConfig(): TeamConfig | null {
  try {
    const stored = localStorage.getItem(TEAM_CONFIG_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * 保存团队配置
 */
export function saveTeamConfig(config: TeamConfig): void {
  try {
    localStorage.setItem(TEAM_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Storage unavailable
  }
}

/**
 * 核心路由逻辑：决定澄清问题发给谁
 * Fallback chain:
 * 1. 用户本人在线 → 问本人
 * 2. 团队有该字段的项目级默认 → 用项目默认
 * 3. 同团队成员在线 → 路由给队友（stub，当前不支持）
 * 4. 超时策略 → 用系统默认 + 标记待确认
 */
export function resolveClarificationTarget(
  userId: string,
  teamConfig: TeamConfig | null,
  field: string
): ClarificationTarget {
  // 无团队配置时，直接问本人
  if (!teamConfig) {
    return { type: 'self' }
  }

  // Step 1: 检查用户本人是否在线
  const isUserOnline = teamConfig.onlineMembers.includes(userId)
  if (isUserOnline) {
    return { type: 'self' }
  }

  // Step 2: 检查项目级默认值
  const projectDefault = teamConfig.projectDefaults.find(d => d.field === field)
  if (projectDefault) {
    return {
      type: 'project_default',
      value: projectDefault.value
    }
  }

  // Step 3: 检查同团队成员是否在线（stub - 未来支持）
  const onlineTeammates = teamConfig.members.filter(
    m => m.userId !== userId && m.isOnline
  )
  if (onlineTeammates.length > 0) {
    // 当前版本不实际路由给队友，仅标记可能性
    // 未来可通过WebSocket推送给队友
    return {
      type: 'teammate',
      userId: onlineTeammates[0].userId,
      pendingConfirmation: true
    }
  }

  // Step 4: 全部不可用，使用系统默认 + 标记待确认
  return {
    type: 'system_default',
    pendingConfirmation: true
  }
}

/**
 * 获取项目级默认值
 */
export function getProjectDefaults(teamConfig: TeamConfig | null): ProjectDefault[] {
  if (!teamConfig) return []
  return teamConfig.projectDefaults
}

/**
 * 设置项目级默认值
 */
export function setProjectDefault(
  teamConfig: TeamConfig,
  field: string,
  value: string,
  setBy: string
): TeamConfig {
  const existing = teamConfig.projectDefaults.findIndex(d => d.field === field)
  const newDefault: ProjectDefault = {
    field,
    value,
    setBy,
    updatedAt: Date.now()
  }

  const updatedDefaults = [...teamConfig.projectDefaults]
  if (existing >= 0) {
    updatedDefaults[existing] = newDefault
  } else {
    updatedDefaults.push(newDefault)
  }

  const updatedConfig: TeamConfig = {
    ...teamConfig,
    projectDefaults: updatedDefaults
  }

  saveTeamConfig(updatedConfig)
  return updatedConfig
}

/**
 * 移除项目级默认值
 */
export function removeProjectDefault(
  teamConfig: TeamConfig,
  field: string
): TeamConfig {
  const updatedConfig: TeamConfig = {
    ...teamConfig,
    projectDefaults: teamConfig.projectDefaults.filter(d => d.field !== field)
  }
  saveTeamConfig(updatedConfig)
  return updatedConfig
}

/**
 * 更新成员在线状态（模拟，实际应由WebSocket驱动）
 */
export function updateMemberOnlineStatus(
  teamConfig: TeamConfig,
  userId: string,
  isOnline: boolean
): TeamConfig {
  const updatedMembers = teamConfig.members.map(m =>
    m.userId === userId ? { ...m, isOnline } : m
  )
  const updatedOnline = isOnline
    ? [...new Set([...teamConfig.onlineMembers, userId])]
    : teamConfig.onlineMembers.filter(id => id !== userId)

  const updatedConfig: TeamConfig = {
    ...teamConfig,
    members: updatedMembers,
    onlineMembers: updatedOnline
  }

  saveTeamConfig(updatedConfig)
  return updatedConfig
}
