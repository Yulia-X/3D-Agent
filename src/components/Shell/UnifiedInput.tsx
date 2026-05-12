import React, { useState, useRef, useCallback } from 'react'
import { Sparkles, ArrowUp, X, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface UnifiedInputProps {
  onSubmit: (text: string, options?: { images?: string[]; files?: File[] }) => void
  disabled?: boolean
  placeholder?: string
}

export const UnifiedInput: React.FC<UnifiedInputProps> = ({
  onSubmit,
  disabled = false,
  placeholder = '描述你想要的3D模型...',
}) => {
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed && images.length === 0 && files.length === 0) return

    onSubmit(trimmed, {
      images: images.length > 0 ? images : undefined,
      files: files.length > 0 ? files : undefined,
    })
    setText('')
    setImages([])
    setFiles([])
  }, [text, images, files, onSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            if (dataUrl) {
              setImages((prev) => [...prev, dataUrl])
            }
          }
          reader.readAsDataURL(file)
        }
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const imageFiles = droppedFiles.filter((f) => f.type.startsWith('image/'))
    const otherFiles = droppedFiles.filter((f) => !f.type.startsWith('image/'))

    // Convert images to data URLs for preview
    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (dataUrl) {
          setImages((prev) => [...prev, dataUrl])
        }
      }
      reader.readAsDataURL(file)
    })

    if (otherFiles.length > 0) {
      setFiles((prev) => [...prev, ...otherFiles])
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const hasContent = text.trim().length > 0 || images.length > 0 || files.length > 0

  return (
    <div className="relative w-full">
      {/* Main input container */}
      <div
        className={`
          relative flex items-center gap-2 rounded-full
          bg-space-800/80 border transition-all duration-200
          px-4 py-2
          ${isDragOver
            ? 'border-neon-blue border-dashed shadow-neon-blue'
            : 'border-white/10 hover:border-neon-blue/40 focus-within:border-neon-blue/60 focus-within:shadow-neon-blue'
          }
          ${disabled ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Left icon */}
        <Sparkles className="w-4 h-4 text-neon-purple shrink-0" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none min-w-0"
        />

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !hasContent}
          className={`
            shrink-0 w-7 h-7 rounded-full flex items-center justify-center
            transition-all duration-200
            ${hasContent
              ? 'bg-neon-blue text-space-900 hover:shadow-neon-blue'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
            }
          `}
        >
          <ArrowUp className="w-4 h-4" />
        </button>

        {/* Drag overlay text */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-full bg-neon-blue/10 flex items-center justify-center pointer-events-none"
            >
              <span className="text-xs text-neon-blue font-medium">释放以添加文件</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Attached previews */}
      <AnimatePresence>
        {(images.length > 0 || files.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-2 left-4 right-4 flex flex-wrap gap-2 p-2 rounded-lg bg-space-800/90 border border-white/10 backdrop-blur-md"
          >
            {/* Image thumbnails */}
            {images.map((src, i) => (
              <div key={`img-${i}`} className="relative group w-12 h-12 rounded overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* File chips */}
            {files.map((file, i) => (
              <div
                key={`file-${i}`}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/70"
              >
                <ImageIcon className="w-3 h-3" />
                <span className="max-w-[80px] truncate">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-white/40 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
