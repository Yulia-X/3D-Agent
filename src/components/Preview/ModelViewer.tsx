import React, { Suspense, useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { usePreviewStore } from '../../store/usePreviewStore'

interface ModelViewerProps {
  baseColor?: string
  metallic?: number
  roughness?: number
  emission?: string
  emissionStrength?: number
  rotation?: { x: number; y: number; z: number }
  scale?: number
  lighting?: 'studio' | 'outdoor' | 'dramatic' | 'neutral'
  showGrid?: boolean
  autoRotate?: boolean
  backgroundColor?: string
  geometry?: 'box' | 'sphere' | 'torus' | 'cylinder' | 'cone' | 'torusKnot'
  className?: string
  compact?: boolean
  modelUrl?: string | null
  // 新增Props
  onModelClick?: (position: { x: number; y: number; z: number }) => void
  onModelHover?: (hovered: boolean) => void
  textureUrl?: string
  transitionProgress?: number
  previousModelUrl?: string
}

const DEG2RAD = Math.PI / 180

const lightingPresetMap: Record<string, string> = {
  studio: 'studio',
  outdoor: 'sunset',
  dramatic: 'night',
  neutral: 'apartment',
}

function GeometryMesh({
  geometry = 'box',
  baseColor = '#4fc3f7',
  metallic = 0.5,
  roughness = 0.5,
  emission,
  emissionStrength = 0,
  rotation = { x: 0, y: 0, z: 0 },
  scale = 1,
  autoRotate = false,
  onPointerOver,
  onPointerOut,
  onClick,
  textureUrl,
}: Pick<ModelViewerProps, 'geometry' | 'baseColor' | 'metallic' | 'roughness' | 'emission' | 'emissionStrength' | 'rotation' | 'scale' | 'autoRotate' | 'textureUrl'> & {
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    if (autoRotate && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  const geometryNode = useMemo(() => {
    switch (geometry) {
      case 'sphere': return <sphereGeometry args={[1, 64, 64]} />
      case 'torus': return <torusGeometry args={[0.8, 0.35, 32, 64]} />
      case 'cylinder': return <cylinderGeometry args={[0.7, 0.7, 1.6, 64]} />
      case 'cone': return <coneGeometry args={[0.8, 1.6, 64]} />
      case 'torusKnot': return <torusKnotGeometry args={[0.7, 0.25, 128, 32]} />
      default: return <boxGeometry args={[1.4, 1.4, 1.4]} />
    }
  }, [geometry])

  const emissionColor = emission ? new THREE.Color(emission) : new THREE.Color('#000000')

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    setHovered(true)
    onPointerOver?.(e)
  }, [onPointerOver])

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    setHovered(false)
    onPointerOut?.(e)
  }, [onPointerOut])

  return (
    <mesh
      ref={meshRef}
      rotation={[rotation.x * DEG2RAD, rotation.y * DEG2RAD, rotation.z * DEG2RAD]}
      scale={scale}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={onClick}
    >
      {geometryNode}
      <meshStandardMaterial
        color={hovered ? '#7dd3fc' : baseColor}
        metalness={metallic}
        roughness={roughness}
        emissive={emissionColor}
        emissiveIntensity={hovered ? (emissionStrength + 0.3) : emissionStrength}
      />
      {/* 悬停高亮边缘 */}
      {hovered && (
        <lineSegments>
          <edgesGeometry args={[meshRef.current?.geometry]} />
          <lineBasicMaterial color="#4fc3f7" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  )
}

// 增量贴图替换组件
function TextureUpdater({ url, scene }: { url: string; scene: THREE.Group | THREE.Object3D }) {
  const texture = useTexture(url)

  useEffect(() => {
    if (texture && scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.map = texture
            mat.needsUpdate = true
          }
        }
      })
    }
  }, [texture, scene])

  return null
}

// 加载真实 GLB/GLTF 模型
function LoadedModel({
  url,
  rotation = { x: 0, y: 0, z: 0 },
  scale = 1,
  autoRotate = false,
  baseColor,
  metallic,
  roughness,
  emission,
  emissionStrength,
  opacity = 1,
  textureUrl,
  onPointerOver,
  onPointerOut,
  onClick,
}: {
  url: string
  rotation?: { x: number; y: number; z: number }
  scale?: number
  autoRotate?: boolean
  baseColor?: string
  metallic?: number
  roughness?: number
  emission?: string
  emissionStrength?: number
  opacity?: number
  textureUrl?: string
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null!)
  const [hovered, setHovered] = useState(false)

  // 应用材质编辑到加载的模型
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (baseColor) mat.color.set(baseColor)
          if (metallic !== undefined) mat.metalness = metallic
          if (roughness !== undefined) mat.roughness = roughness
          if (emission) {
            mat.emissive.set(emission)
            mat.emissiveIntensity = emissionStrength || 1
          }
          mat.transparent = opacity < 1
          mat.opacity = opacity
        }
      }
    })
  }, [scene, baseColor, metallic, roughness, emission, emissionStrength, opacity])

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5
    }
  })

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    setHovered(true)
    onPointerOver?.(e)
  }, [onPointerOver])

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    setHovered(false)
    onPointerOut?.(e)
  }, [onPointerOut])

  return (
    <group
      ref={groupRef}
      rotation={[rotation.x * DEG2RAD, rotation.y * DEG2RAD, rotation.z * DEG2RAD]}
      scale={scale}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={onClick}
    >
      <primitive object={scene} />
      {/* 增量贴图替换 */}
      {textureUrl && <TextureUpdater url={textureUrl} scene={scene} />}
    </group>
  )
}

function Scene(props: ModelViewerProps & {
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}) {
  const {
    lighting = 'studio',
    showGrid = true,
    compact = false,
    backgroundColor,
    modelUrl,
    transitionProgress = 1,
    previousModelUrl,
    textureUrl,
    onPointerOver,
    onPointerOut,
    onClick,
    ...meshProps
  } = props

  const preset = lightingPresetMap[lighting] || 'studio'
  const hasModel = !!modelUrl
  const hasPreviousModel = !!previousModelUrl && transitionProgress < 1

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Environment preset={preset as any} background={false} />

      {/* 过渡动画：旧模型渐变为半透明 */}
      {hasPreviousModel && (
        <LoadedModel
          url={previousModelUrl!}
          {...meshProps}
          opacity={Math.max(0, 0.3 * (1 - transitionProgress))}
        />
      )}

      {/* 当前模型 */}
      {hasModel ? (
        <LoadedModel
          url={modelUrl!}
          {...meshProps}
          opacity={transitionProgress}
          textureUrl={textureUrl}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
        />
      ) : (
        <GeometryMesh
          {...meshProps}
          textureUrl={textureUrl}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
        />
      )}

      {showGrid && !compact && (
        <Grid
          position={[0, -1.2, 0]}
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#4fc3f7"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#4fc3f7"
          fadeDistance={8}
          fadeStrength={1}
          infiniteGrid
        />
      )}
      <OrbitControls
        enableZoom={!compact}
        enablePan={!compact}
        makeDefault
      />
    </>
  )
}

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-neon-blue/30 border-t-neon-blue rounded-full animate-spin" />
    </div>
  )
}

function ModelLoadError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="text-white/40 text-sm mb-2">模型加载失败</div>
      <div className="text-white/20 text-xs mb-3">请检查模型文件路径或网络连接</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-neon-blue/20 text-neon-blue text-xs hover:bg-neon-blue/30 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  )
}

export const ModelViewer = React.memo(function ModelViewer(props: ModelViewerProps) {
  const { className = '', compact = false, backgroundColor, modelUrl, onModelClick, onModelHover } = props
  const cameraPosition: [number, number, number] = compact ? [2.5, 1.5, 2.5] : [4, 3, 4]
  const [loadError, setLoadError] = useState(false)

  // 从 store 读取预览状态
  const preview = usePreviewStore((s) => s.preview)

  // 合并 store 状态和 props
  const effectiveModelUrl = props.modelUrl ?? preview.modelUrl
  const effectiveTransitionProgress = props.transitionProgress ?? preview.transitionProgress
  const effectivePreviousModelUrl = props.previousModelUrl ?? preview.previousModelUrl

  // 监听 modelUrl 变化，重置错误状态
  useEffect(() => {
    setLoadError(false)
  }, [effectiveModelUrl])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (onModelClick) {
      const point = e.point
      onModelClick({ x: point.x, y: point.y, z: point.z })
    }
  }, [onModelClick])

  const handlePointerOver = useCallback(() => {
    onModelHover?.(true)
  }, [onModelHover])

  const handlePointerOut = useCallback(() => {
    onModelHover?.(false)
  }, [onModelHover])

  return (
    <div className={`relative w-full h-full ${className}`} style={{ backgroundColor: backgroundColor || 'transparent' }}>
      {loadError ? (
        <ModelLoadError onRetry={() => setLoadError(false)} />
      ) : (
        <ErrorBoundary onError={() => setLoadError(true)}>
          <Suspense fallback={<LoadingFallback />}>
            <Canvas
              camera={{ position: cameraPosition, fov: compact ? 40 : 50 }}
              gl={{ antialias: true, alpha: true }}
              style={{ background: 'transparent' }}
            >
              <Scene
                {...props}
                modelUrl={effectiveModelUrl}
                transitionProgress={effectiveTransitionProgress}
                previousModelUrl={effectivePreviousModelUrl ?? undefined}
                onPointerOver={handlePointerOver as any}
                onPointerOut={handlePointerOut as any}
                onClick={handleClick as any}
              />
            </Canvas>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  )
})

// 简易错误边界组件
class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: () => void }> {
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.props.children
  }
}

export default ModelViewer
