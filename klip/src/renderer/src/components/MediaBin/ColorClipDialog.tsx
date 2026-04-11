import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Square } from 'lucide-react'

interface ColorClipDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, color: string, duration: number) => void
}

const PRESET_COLORS = [
  '#000000',
  '#ffffff',
  '#1a1a2e',
  '#0f3460',
  '#e94560',
  '#f5a623',
  '#7c3aed',
  '#22c55e'
]

function colorName(hex: string): string {
  const map: Record<string, string> = {
    '#000000': 'Black',
    '#ffffff': 'White',
    '#1a1a2e': 'Deep Navy',
    '#0f3460': 'Navy Blue',
    '#e94560': 'Crimson',
    '#f5a623': 'Amber',
    '#7c3aed': 'Violet',
    '#22c55e': 'Emerald'
  }
  return map[hex.toLowerCase()] ?? 'Color'
}

export default function ColorClipDialog({
  open,
  onClose,
  onCreate
}: ColorClipDialogProps): JSX.Element {
  const [color, setColor] = useState('#000000')
  const [name, setName] = useState('Black')
  const [duration, setDuration] = useState(5)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // When color changes from a preset, auto-update the name
  function selectPreset(hex: string) {
    setColor(hex)
    setName(colorName(hex))
  }

  // Keep name in sync with color picker if user hasn't customised it
  const prevColorRef = useRef(color)
  useEffect(() => {
    if (prevColorRef.current !== color) {
      const wasAuto = name === colorName(prevColorRef.current)
      if (wasAuto) setName(colorName(color))
      prevColorRef.current = color
    }
  }, [color, name])

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [open])

  function handleCreate() {
    if (duration > 0 && name.trim()) {
      onCreate(name.trim() || colorName(color), color, duration)
      onClose()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') onClose()
  }

  const modal = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[9000] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="fixed z-[9001] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] shadow-2xl"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Square size={13} className="text-[var(--accent-bright)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Solid Color Clip
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Color preview + picker */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => colorInputRef.current?.click()}
                  className="w-14 h-14 rounded-lg border-2 border-[var(--border-strong)] flex-shrink-0 transition-transform active:scale-95 hover:scale-105"
                  style={{ backgroundColor: color }}
                  title="Click to pick a color"
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="sr-only"
                />
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-[var(--text-muted)]">Color presets</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => selectPreset(hex)}
                        className="w-5 h-5 rounded border transition-all"
                        style={{
                          backgroundColor: hex,
                          borderColor:
                            color.toLowerCase() === hex ? 'var(--accent-bright)' : 'var(--border)',
                          transform:
                            color.toLowerCase() === hex ? 'scale(1.2)' : 'scale(1)'
                        }}
                        title={colorName(hex)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-muted)] font-medium">Clip name</label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-light)] transition-colors"
                  placeholder="e.g. Black Intro"
                  maxLength={64}
                />
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-xs text-[var(--text-muted)] font-medium">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(0.1, Math.min(3600, Number(e.target.value))))}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-light)] transition-colors"
                  min={0.1}
                  max={3600}
                  step={0.5}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-md text-xs font-medium bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || duration <= 0}
                  className="flex-1 py-2 rounded-md text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                >
                  Create Clip
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return createPortal(modal, document.body)
}
