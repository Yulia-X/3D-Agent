import React, { useEffect, useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Grid } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { CanvasCard } from '../../store/useCanvasStore';

// 远程资源 URL 通过后端代理（解决 CORS 问题）
function getProxiedUrl(url: string): string {
  // 已经是代理 URL 或本地 blob URL，不再代理
  if (url.startsWith('http://localhost:3001/api/proxy-model') || url.startsWith('blob:')) {
    return url;
  }
  // 代理所有远程 http/https URL（不仅限于 meshy.ai，兼容各类 CDN）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `http://localhost:3001/api/proxy-model?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function ModelScene({ url, wireframe }: { url: string; wireframe: boolean }) {
  const proxiedUrl = getProxiedUrl(url);
  const { scene } = useGLTF(proxiedUrl);

  // 切换线框模式
  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = wireframe;
      }
    });
  }, [scene, wireframe]);

  return <primitive object={scene.clone()} />;
}

export function ModelViewerModal() {
  const [card, setCard] = useState<CanvasCard | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [bgColor, setBgColor] = useState<'dark' | 'light' | 'gradient'>('dark');

  useEffect(() => {
    const handler = (e: CustomEvent<CanvasCard>) => {
      setCard(e.detail);
      setWireframe(false);
    };
    window.addEventListener('open-model-viewer', handler as EventListener);
    return () => window.removeEventListener('open-model-viewer', handler as EventListener);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!card) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCard(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [card]);

  const bgStyles: Record<string, string> = {
    dark: 'bg-black',
    light: 'bg-gray-200',
    gradient: 'bg-gradient-to-b from-space-900 to-space-800',
  };

  if (!card) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="model-viewer-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] flex flex-col"
      >
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => setCard(null)}
        />

        {/* 顶部信息栏 */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-white text-lg font-medium">{card.title}</h2>
            <span className="text-white/40 text-sm">{card.version}</span>
            {card.meshyTaskId && (
              <span className="text-white/30 text-xs font-mono">ID: {card.meshyTaskId}</span>
            )}
          </div>
          <button
            onClick={() => setCard(null)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 3D 渲染区域 */}
        <div className={`relative z-10 flex-1 mx-6 mb-4 rounded-xl overflow-hidden ${bgStyles[bgColor]}`}>
          <Canvas camera={{ position: [0, 1, 4], fov: 50 }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <directionalLight position={[-3, 3, -3]} intensity={0.4} />
            <Suspense fallback={null}>
              <ModelScene url={card.modelUrl} wireframe={wireframe} />
              <Environment preset="city" />
            </Suspense>
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              minDistance={1}
              maxDistance={20}
              autoRotate={false}
            />
            <Grid
              infiniteGrid
              fadeDistance={30}
              fadeStrength={3}
              cellSize={0.5}
              cellColor="#ffffff10"
              sectionSize={2}
              sectionColor="#ffffff20"
            />
          </Canvas>
        </div>

        {/* 底部工具栏 */}
        <div className="relative z-10 flex items-center justify-center gap-3 px-6 py-3 mb-2">
          {/* 线框模式 */}
          <button
            onClick={() => setWireframe(!wireframe)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              wireframe
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-white/5 text-white/60 border border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            线框模式
          </button>

          {/* 背景色切换 */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setBgColor('dark')}
              className={`w-6 h-6 rounded-full bg-black border-2 ${bgColor === 'dark' ? 'border-white' : 'border-white/20'}`}
            />
            <button
              onClick={() => setBgColor('light')}
              className={`w-6 h-6 rounded-full bg-gray-200 border-2 ${bgColor === 'light' ? 'border-white' : 'border-white/20'}`}
            />
            <button
              onClick={() => setBgColor('gradient')}
              className={`w-6 h-6 rounded-full bg-gradient-to-b from-indigo-900 to-purple-900 border-2 ${bgColor === 'gradient' ? 'border-white' : 'border-white/20'}`}
            />
          </div>

          {/* 下载按钮 */}
          <button
            onClick={() => {
              const url = card.formats?.glb || card.modelUrl;
              if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${card.title || 'model'}.glb`;
                a.click();
              }
            }}
            className="px-4 py-2 rounded-lg text-sm bg-white/5 text-white/60 border border-white/10 hover:text-white hover:bg-white/10 transition-colors"
          >
            下载模型
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
