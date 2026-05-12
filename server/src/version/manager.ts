import { getDb } from '../db/connection.js'
import { VersionTree, VersionNode, VersionAssets, ChangeScope, ExecutionDAG } from '../types.js'

export class VersionManager {
  /**
   * 创建空版本树
   */
  createTree(taskId: string): VersionTree {
    const db = getDb()
    const tree: VersionTree = {
      taskId,
      root: null,
      currentHead: '',
    }

    db.prepare(`
      INSERT INTO version_trees (task_id, root_id, current_head)
      VALUES (?, ?, ?)
    `).run(taskId, null, '')

    return tree
  }

  /**
   * 获取版本树
   */
  getTree(taskId: string): VersionTree | null {
    const db = getDb()
    const treeRow = db.prepare('SELECT * FROM version_trees WHERE task_id = ?').get(taskId) as any
    if (!treeRow) return null

    let rootNode: VersionNode | null = null
    if (treeRow.root_id) {
      rootNode = this.getVersion(treeRow.root_id)
    }

    return {
      taskId: treeRow.task_id,
      root: rootNode,
      currentHead: treeRow.current_head,
    }
  }

  /**
   * 添加新版本节点
   */
  addVersion(taskId: string, params: {
    parentId: string | null
    assets: VersionAssets
    trigger: VersionNode['trigger']
    changeScope: ChangeScope
    dagExecuted: ExecutionDAG | null
  }): VersionNode {
    const db = getDb()

    // 计算同级节点数量，生成版本号
    const siblings = this.getSiblingCount(taskId, params.parentId)
    const id = this.generateVersionId(taskId, params.parentId, siblings)

    const node: VersionNode = {
      id,
      parentId: params.parentId,
      children: [],
      assets: params.assets,
      createdAt: Date.now(),
      trigger: params.trigger,
      changeScope: params.changeScope,
      dagExecuted: params.dagExecuted,
    }

    // 插入版本记录
    db.prepare(`
      INSERT INTO versions (id, task_id, parent_id, children, assets, created_at, trigger_data, change_scope, dag_executed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      node.id,
      taskId,
      node.parentId,
      JSON.stringify(node.children),
      JSON.stringify(node.assets),
      node.createdAt,
      JSON.stringify(node.trigger),
      JSON.stringify(node.changeScope),
      node.dagExecuted ? JSON.stringify(node.dagExecuted) : null,
    )

    // 更新父节点的children
    if (params.parentId) {
      const parentRow = db.prepare('SELECT children FROM versions WHERE id = ?').get(params.parentId) as any
      if (parentRow) {
        const children: string[] = JSON.parse(parentRow.children)
        children.push(id)
        db.prepare('UPDATE versions SET children = ? WHERE id = ?').run(JSON.stringify(children), params.parentId)
      }
    }

    // 更新版本树
    const treeRow = db.prepare('SELECT * FROM version_trees WHERE task_id = ?').get(taskId) as any
    if (treeRow) {
      if (!params.parentId) {
        // root级别节点
        if (!treeRow.root_id) {
          db.prepare('UPDATE version_trees SET root_id = ?, current_head = ? WHERE task_id = ?').run(id, id, taskId)
        }
      }
      // 总是更新currentHead到最新节点
      db.prepare('UPDATE version_trees SET current_head = ? WHERE task_id = ?').run(id, taskId)
    }

    return node
  }

  /**
   * 生成版本号（包含taskId前缀确保全局唯一）
   * - 首个版本：{taskId}:V1
   * - 编辑子版本：{taskId}:V1.1, {taskId}:V1.2...
   * - 全新生成（另一个root分叉）：{taskId}:V2, {taskId}:V3...
   */
  private generateVersionId(taskId: string, parentId: string | null, existingSiblings: number): string {
    if (!parentId) {
      return `${taskId}:V${existingSiblings + 1}`
    }
    // 子版本：在父版本ID基础上追加序号
    return `${parentId}.${existingSiblings + 1}`
  }

  /**
   * 获取同级节点数量
   */
  private getSiblingCount(taskId: string, parentId: string | null): number {
    const db = getDb()
    if (parentId) {
      const parentRow = db.prepare('SELECT children FROM versions WHERE id = ?').get(parentId) as any
      if (!parentRow) return 0
      const children: string[] = JSON.parse(parentRow.children)
      return children.length
    }
    // root级别：计算该task下parentId为null的版本数
    const result = db.prepare('SELECT COUNT(*) as cnt FROM versions WHERE task_id = ? AND parent_id IS NULL').get(taskId) as { cnt: number }
    return result.cnt
  }

  /**
   * 检出版本（切换currentHead）
   */
  checkout(taskId: string, versionId: string): void {
    const db = getDb()
    db.prepare('UPDATE version_trees SET current_head = ? WHERE task_id = ?').run(versionId, taskId)
  }

  /**
   * 分叉（从某版本创建新分支起点）
   */
  fork(taskId: string, fromVersionId: string): VersionNode {
    const sourceNode = this.getVersion(fromVersionId)
    if (!sourceNode) {
      throw new Error(`Version ${fromVersionId} not found`)
    }

    return this.addVersion(taskId, {
      parentId: fromVersionId,
      assets: { ...sourceNode.assets },
      trigger: {
        type: 'variant_fork',
        userInput: `Fork from ${fromVersionId}`,
        resolvedIntent: {},
      },
      changeScope: { geometry: false, texture: false, skeleton: false, animation: false, print: false, metadata: false },
      dagExecuted: null,
    })
  }

  /**
   * 评分
   */
  rateVersion(versionId: string, rating: 'good' | 'bad', comment?: string): void {
    const db = getDb()
    db.prepare('UPDATE versions SET user_rating = ?, user_comment = ? WHERE id = ?').run(
      rating,
      comment || null,
      versionId,
    )
  }

  /**
   * 获取版本路径（root → target）
   */
  getVersionPath(taskId: string, targetId: string): string[] {
    const path: string[] = []
    let currentId: string | null = targetId

    while (currentId) {
      path.unshift(currentId)
      const node = this.getVersion(currentId)
      if (!node || !node.parentId) break
      currentId = node.parentId
    }

    return path
  }

  /**
   * 判断是否有分支
   */
  hasBranches(taskId: string): boolean {
    const db = getDb()
    const rows = db.prepare('SELECT children FROM versions WHERE task_id = ?').all(taskId) as any[]
    return rows.some(row => {
      const children: string[] = JSON.parse(row.children)
      return children.length > 1
    })
  }

  /**
   * 获取所有版本
   */
  getAllVersions(taskId: string): VersionNode[] {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM versions WHERE task_id = ? ORDER BY created_at ASC').all(taskId) as any[]
    return rows.map(row => this.rowToNode(row))
  }

  /**
   * 获取单个版本
   */
  getVersion(versionId: string): VersionNode | null {
    const db = getDb()
    const row = db.prepare('SELECT * FROM versions WHERE id = ?').get(versionId) as any
    if (!row) return null
    return this.rowToNode(row)
  }

  /**
   * 数据库行转为VersionNode
   */
  private rowToNode(row: any): VersionNode {
    return {
      id: row.id,
      parentId: row.parent_id || null,
      children: JSON.parse(row.children),
      assets: JSON.parse(row.assets),
      createdAt: row.created_at,
      trigger: JSON.parse(row.trigger_data),
      changeScope: JSON.parse(row.change_scope),
      dagExecuted: row.dag_executed ? JSON.parse(row.dag_executed) : null,
      userRating: row.user_rating || null,
      userComment: row.user_comment || undefined,
    }
  }
}
