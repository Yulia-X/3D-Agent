import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Palette, Move3D, Sun } from 'lucide-react'

interface EditControlsProps {
  onChange?: (params: Record<string, any>) => void
}

interface SectionState {
  material: boolean
  transform: boolean
  lighting: boolean
}

const LIGHTING_PRESETS = [
  { id: 'studio', label: '影棚', emoji: '💡' },
  { id: 'sunset', label: '日落', emoji: '🌅' },
  { id: 'night', label: '夜晚', emoji: '🌙' },
  { id: 'outdoor', label: '户外', emoji: '☀️' },
]

export function EditControls({ onChange }: EditControlsProps) {
  const [sections, setSections] = useState<SectionState>({
    material: true,
    transform: false,
    lighting: false,
  })

  const [material, setMaterial] = useState({
    baseColor: '#4fc3f7',
    metallic: 0.5,
    roughness: 0.5,
    emission: '#000000',
  })

  const [transform, setTransform] = useState({
    posX: 0, posY: 0, posZ: 0,
    rotX: 0, rotY: 0, rotZ: 0,
    scale: 1,
  })

  const [lightingPreset, setLightingPreset] = useState('studio')

  const toggleSection = (key: keyof SectionState) => {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  const handleMaterialChange = (key: string, value: number | string) => {
    const updated = { ...material, [key]: value }
    setMaterial(updated)
    onChange?.({ material: updated })
  }

  const handleTransformChange = (key: string, value: number) => {
    const updated = { ...transform, [key]: value }
    setTransform(updated)
    onChange?.({ transform: updated })
  }

  const handleLightingSelect = (preset: string) => {
    setLightingPreset(preset)
    onChange?.({ lighting: preset })
  }

  return (
    <div className="px-4 pb-4 space-y-1">
      {/* Material Sliders */}
      <CollapsibleSection
        title="材质"
        icon={<Palette size={13} />}
        open={sections.material}
        onToggle={() => toggleSection('material')}
      >
        <div className="space-y-3">
          {/* Base Color */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/50">基础色</label>
            <div className="relative">
              <input
                type="color"
                value={material.baseColor}
                onChange={(e) => handleMaterialChange('baseColor', e.target.value)}
                className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
              />
            </div>
          </div>

          {/* Metallic */}
          <SliderRow
            label="金属度"
            value={material.metallic}
            min={0} max={1} step={0.01}
            onChange={(v) => handleMaterialChange('metallic', v)}
          />

          {/* Roughness */}
          <SliderRow
            label="粗糙度"
            value={material.roughness}
            min={0} max={1} step={0.01}
            onChange={(v) => handleMaterialChange('roughness', v)}
          />

          {/* Emission Color */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-white/50">自发光色</label>
            <input
              type="color"
              value={material.emission}
              onChange={(e) => handleMaterialChange('emission', e.target.value)}
              className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Transform Controls */}
      <CollapsibleSection
        title="变换"
        icon={<Move3D size={13} />}
        open={sections.transform}
        onToggle={() => toggleSection('transform')}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">位移</span>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="X" value={transform.posX} onChange={(v) => handleTransformChange('posX', v)} />
              <NumberInput label="Y" value={transform.posY} onChange={(v) => handleTransformChange('posY', v)} />
              <NumberInput label="Z" value={transform.posZ} onChange={(v) => handleTransformChange('posZ', v)} />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">旋转</span>
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="X" value={transform.rotX} onChange={(v) => handleTransformChange('rotX', v)} step={1} />
              <NumberInput label="Y" value={transform.rotY} onChange={(v) => handleTransformChange('rotY', v)} step={1} />
              <NumberInput label="Z" value={transform.rotZ} onChange={(v) => handleTransformChange('rotZ', v)} step={1} />
            </div>
          </div>

          <SliderRow
            label="缩放"
            value={transform.scale}
            min={0.1} max={5} step={0.1}
            onChange={(v) => handleTransformChange('scale', v)}
          />
        </div>
      </CollapsibleSection>

      {/* Lighting Presets */}
      <CollapsibleSection
        title="光照预设"
        icon={<Sun size={13} />}
        open={sections.lighting}
        onToggle={() => toggleSection('lighting')}
      >
        <div className="grid grid-cols-2 gap-2">
          {LIGHTING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleLightingSelect(preset.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all border ${
                lightingPreset === preset.id
                  ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30 shadow-[0_0_8px_rgba(79,195,247,0.15)]'
                  : 'bg-white/[0.03] text-white/60 border-white/[0.06] hover:bg-white/[0.06] hover:text-white/80'
              }`}
            >
              <span>{preset.emoji}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}

/* ---- 子组件 ---- */

function CollapsibleSection({
  title, icon, open, onToggle, children
}: {
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-white/70 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={12} className="text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SliderRow({
  label, value, min, max, step, onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-white/50">{label}</label>
        <span className="text-[10px] font-mono text-white/40">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          bg-white/10
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-neon-blue
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(79,195,247,0.5)]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:h-3
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-neon-blue
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-pointer"
      />
    </div>
  )
}

function NumberInput({
  label, value, onChange, step = 0.1
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-white/30 text-center">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 rounded-md text-center text-[11px] font-mono text-white/80
          bg-white/[0.04] border border-white/[0.08]
          focus:outline-none focus:border-neon-blue/40
          [&::-webkit-inner-spin-button]:appearance-none
          [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  )
}
