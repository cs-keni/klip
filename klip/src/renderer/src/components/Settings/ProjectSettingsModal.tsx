import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useProjectStore,
  type Resolution,
  type FrameRate,
  type AspectRatio
} from '@/stores/projectStore'

// ── Segmented control ──────────────────────────────────────────────────────────

function SegCtrl<T extends string | number>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}): JSX.Element {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
            value === opt.value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Aspect ratio preview ───────────────────────────────────────────────────────

const AR_DIMS: Record<AspectRatio, { w: number; h: number }> = {
  '16:9': { w: 80, h: 45 },
  '9:16': { w: 45, h: 80 },
  '1:1':  { w: 60, h: 60 }
}

function AspectRatioPreview({ ratio }: { ratio: AspectRatio }): JSX.Element {
  const { w, h } = AR_DIMS[ratio]

  return (
    <div className="flex items-center justify-center w-24 h-24">
      <motion.div
        className="rounded border-2 border-[var(--accent)] bg-[var(--accent)]/10 flex items-center justify-center"
        animate={{ width: w, height: h }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      >
        <motion.span
          className="text-[10px] font-semibold text-[var(--accent)] select-none"
          animate={{ opacity: 1 }}
          key={ratio}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {ratio}
        </motion.span>
      </motion.div>
    </div>
  )
}

// ── Row layout helper ──────────────────────────────────────────────────────────

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="shrink-0 pt-0.5">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="w-52 shrink-0">{children}</div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface ProjectSettingsModalProps {
  open: boolean
  onClose: () => void
}

export default function ProjectSettingsModal({
  open,
  onClose
}: ProjectSettingsModalProps): JSX.Element {
  const { settings, updateSettings } = useProjectStore()
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={backdropRef}
          className="fixed inset-0 z-[300] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === backdropRef.current) onClose()
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-[480px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent)]/15">
                <Clapperboard size={14} className="text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Project Settings</h2>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Resolution, frame rate, and canvas for this project
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors duration-100"
              >
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 flex gap-6">
              {/* Settings */}
              <div className="flex-1 flex flex-col gap-5">
                <Row label="Resolution" description="Output canvas for preview & export">
                  <SegCtrl<Resolution>
                    value={settings.resolution}
                    onChange={(v) => updateSettings({ resolution: v })}
                    options={[
                      { value: '1080p', label: '1080p' },
                      { value: '1440p', label: '1440p' },
                      { value: '4k',    label: '4K' }
                    ]}
                  />
                </Row>

                <Row label="Frame Rate" description="Frames per second for the timeline">
                  <SegCtrl<FrameRate>
                    value={settings.frameRate}
                    onChange={(v) => updateSettings({ frameRate: v })}
                    options={[
                      { value: 24, label: '24 fps' },
                      { value: 30, label: '30 fps' },
                      { value: 60, label: '60 fps' }
                    ]}
                  />
                </Row>

                <Row label="Aspect Ratio" description="Canvas shape for preview & export">
                  <SegCtrl<AspectRatio>
                    value={settings.aspectRatio}
                    onChange={(v) => updateSettings({ aspectRatio: v })}
                    options={[
                      { value: '16:9', label: '16 : 9' },
                      { value: '9:16', label: '9 : 16' },
                      { value: '1:1',  label: '1 : 1' }
                    ]}
                  />
                </Row>
              </div>

              {/* Aspect ratio visual */}
              <div className="shrink-0 flex flex-col items-center justify-center gap-1.5 border-l border-[var(--border-subtle)] pl-6">
                <AspectRatioPreview ratio={settings.aspectRatio} />
                <p className="text-[10px] text-[var(--text-muted)]">Canvas preview</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/40">
              <p className="text-[11px] text-[var(--text-muted)]">
                Changes apply immediately. Override resolution in Export.
              </p>
              <button
                onClick={onClose}
                className="px-4 h-7 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-light)] transition-colors duration-100 active:scale-[0.96]"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(modal, document.body)
}
