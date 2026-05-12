/**
 * 行为信号检测Hook
 * 监听用户行为并触发界面渐进展开
 */
import { useCallback } from 'react'
import { useExposureStore, ExposureSignal } from '../store/useExposureStore'

// 技术术语列表
const TECHNICAL_TERMS = [
  '拓扑', 'topology', '四边面', 'quad', '三角面', 'tri',
  'remesh', '重建网格', '面数', 'polycount', 'polygon',
  'PBR', 'UV', '法线', 'normal map', '置换', 'displacement',
  '骨骼', 'rigging', '权重', 'weight paint',
  'LOD', '细分', 'subdivision', '布尔', 'boolean',
  'HDRI', '环境光遮蔽', 'AO', '全局光照', 'GI',
  'FBX', 'GLTF', 'GLB', 'OBJ', 'USDZ', 'blend',
]

// 不满意关键词
const DISSATISFACTION_TERMS = [
  '不满意', '不对', '不好', '重做', '换一个', '不喜欢',
  '太差', '不行', '重新', '算了', '还是',
]

export function useExposureSignals() {
  const handleSignal = useExposureStore(s => s.handleSignal)

  /**
   * 分析用户输入文本中的行为信号
   */
  const analyzeInput = useCallback((text: string) => {
    const lower = text.toLowerCase()
    
    // 检测技术术语
    if (TECHNICAL_TERMS.some(term => lower.includes(term.toLowerCase()))) {
      handleSignal('technical_term_used')
    }
    
    // 检测不满意表达
    if (DISSATISFACTION_TERMS.some(term => lower.includes(term))) {
      handleSignal('user_dissatisfied')
    }
  }, [handleSignal])

  /**
   * 检测文件上传
   */
  const handleFileUpload = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (['blend', 'fbx', 'obj', 'gltf', 'glb', 'usdz'].includes(ext || '')) {
      handleSignal('file_uploaded')
    }
  }, [handleSignal])

  /**
   * 用户点击模型
   */
  const handleModelClick = useCallback(() => {
    handleSignal('model_clicked')
  }, [handleSignal])

  /**
   * 触发特定信号
   */
  const triggerSignal = useCallback((signal: ExposureSignal) => {
    handleSignal(signal)
  }, [handleSignal])

  return {
    analyzeInput,
    handleFileUpload,
    handleModelClick,
    triggerSignal,
  }
}
