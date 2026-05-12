/**
 * BranchGraph - SVG分支图视图
 * 当版本树有分支（某节点有多个children）时自动使用
 * 从左到右布局，分支向上/下分叉，支持缩放/平移
 */
import { useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useVersionStore } from '../../store/useVersionStore'
import { VersionNode } from '../../types'

export interface BranchGraphProps {
  onVersionSelect?: (versionId: string) => void
}

interface NodePosition {
  id: string
  x: number
  y: number
  node: VersionNode
}

interface Edge {
  from: NodePosition
  to: NodePosition
}

const NODE_RADIUS = 14
const NODE_SPACING_X = 120
const NODE_SPACING_Y = 50
const PADDING_X = 60
const PADDING_Y = 60

export function BranchGraph({ onVersionSelect }: BranchGraphProps) {
  const { versionTree, allVersions, checkout } = useVersionStore()
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // 布局计算：BFS从root开始，分配位置
  const { nodes, edges, width } = useMemo(() => {
    if (!versionTree.root) return { nodes: [], edges: [], width: 200 }

    const positions: NodePosition[] = []
    const edgeList: Edge[] = []
    const visited = new Set<string>()

    // BFS层级布局
    interface QueueItem { id: string; depth: number; lane: number }
    const queue: QueueItem[] = [{ id: versionTree.root.id, depth: 0, lane: 0 }]
    const depthLanes: Record<number, number> = {} // depth → next available lane

    while (queue.length > 0) {
      const { id, depth, lane } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const node = allVersions[id]
      if (!node) continue

      const x = PADDING_X + depth * NODE_SPACING_X
      const y = PADDING_Y + lane * NODE_SPACING_Y

      const pos: NodePosition = { id, x, y, node }
      positions.push(pos)

      // 子节点
      node.children.forEach((childId, idx) => {
        const childLane = node.children.length > 1
          ? lane + idx - Math.floor(node.children.length / 2)
          : lane

        if (!depthLanes[depth + 1]) depthLanes[depth + 1] = 0
        queue.push({ id: childId, depth: depth + 1, lane: childLane })
      })
    }

    // 归一化Y坐标（确保不为负）
    const minY = Math.min(...positions.map(p => p.y))
    if (minY < PADDING_Y) {
      const offset = PADDING_Y - minY
      positions.forEach(p => { p.y += offset })
    }

    // 构建边
    const posMap = new Map(positions.map(p => [p.id, p]))
    positions.forEach(pos => {
      const node = pos.node
      node.children.forEach(childId => {
        const childPos = posMap.get(childId)
        if (childPos) {
          edgeList.push({ from: pos, to: childPos })
        }
      })
    })

    const maxX = Math.max(...positions.map(p => p.x)) + PADDING_X
    return { nodes: positions, edges: edgeList, width: maxX }
  }, [versionTree.root, allVersions])

  const height = 120

  // 平移交互
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true)
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setTransform(t => ({
        ...t,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }))
    }
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  // 缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(t => ({
      ...t,
      scale: Math.max(0.5, Math.min(2, t.scale * delta))
    }))
  }, [])

  const handleNodeClick = (versionId: string) => {
    checkout(versionId)
    onVersionSelect?.(versionId)
  }

  if (nodes.length === 0) return null

  return (
    <div
      className="w-full h-[120px] overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        width="100%"
        height={height}
        className="select-none"
        style={{
          minWidth: width * transform.scale,
        }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* 渐变定义 */}
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(79,195,247,0.6)" />
              <stop offset="100%" stopColor="rgba(179,136,255,0.6)" />
            </linearGradient>
            <filter id="glow-filter">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 边（曲线） */}
          {edges.map((edge, idx) => {
            const midX = (edge.from.x + edge.to.x) / 2
            const path = `M ${edge.from.x} ${edge.from.y} C ${midX} ${edge.from.y}, ${midX} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`
            return (
              <path
                key={idx}
                d={path}
                fill="none"
                stroke="url(#edge-gradient)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            )
          })}

          {/* 节点 */}
          {nodes.map((pos) => {
            const isActive = pos.id === versionTree.currentHead
            return (
              <g
                key={pos.id}
                className="cursor-pointer"
                onClick={() => handleNodeClick(pos.id)}
              >
                {/* 活跃节点glow */}
                {isActive && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={NODE_RADIUS + 4}
                    fill="none"
                    stroke="#4fc3f7"
                    strokeWidth={2}
                    opacity={0.4}
                    filter="url(#glow-filter)"
                  />
                )}
                {/* 节点圆 */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? NODE_RADIUS + 2 : NODE_RADIUS}
                  fill={isActive ? '#4fc3f7' : '#1a1a52'}
                  stroke={isActive ? '#4fc3f7' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isActive ? 2 : 1}
                />
                {/* 版本号标签 */}
                <text
                  x={pos.x}
                  y={pos.y + NODE_RADIUS + 14}
                  textAnchor="middle"
                  fill={isActive ? '#4fc3f7' : 'rgba(255,255,255,0.7)'}
                  fontSize={10}
                  fontFamily="monospace"
                >
                  V{pos.id}
                </text>
                {/* 缩略圆内文字 */}
                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize={9}
                  fontWeight="bold"
                >
                  {pos.id.length > 3 ? pos.id.slice(-2) : pos.id}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
