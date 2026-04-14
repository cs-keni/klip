import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { HELP_BY_ID, type HelpEntry } from '@/lib/helpContent'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TooltipState {
  entry: HelpEntry
  /** Bounding rect of the triggering element */
  targetRect: DOMRect
}

// ── WhatThisOverlay ────────────────────────────────────────────────────────────

/**
 * When `whatsThisMode` is active in the UI store:
 *  - Changes the body cursor to `help`
 *  - Listens to `mouseover` to detect elements with data-help="<id>"
 *  - Renders a floating rich tooltip near the hovered element
 *  - Pressing Escape exits the mode
 *
 * Mount this once inside AppLayout — it renders nothing when the mode is off.
 */
export default function WhatThisOverlay(): JSX.Element | null {
  const { whatsThisMode, setWhatsThisMode } = useUIStore()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const currentTargetRef = useRef<Element | null>(null)

  // ── Cursor style ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (whatsThisMode) {
      document.body.style.cursor = 'help'
    } else {
      document.body.style.cursor = ''
      setTooltip(null)
      currentTargetRef.current = null
    }
    return () => {
      document.body.style.cursor = ''
    }
  }, [whatsThisMode])

  // ── Escape key exits ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!whatsThisMode) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setWhatsThisMode(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [whatsThisMode, setWhatsThisMode])

  // ── Mouse tracking ──────────────────────────────────────────────────────────
  const handleMouseOver = useCallback(
    (e: MouseEvent): void => {
      const el = (e.target as Element).closest('[data-help]')
      if (el === currentTargetRef.current) return
      currentTargetRef.current = el

      if (!el) {
        setTooltip(null)
        return
      }

      const id = el.getAttribute('data-help') ?? ''
      const entry = HELP_BY_ID[id]
      if (!entry) {
        setTooltip(null)
        return
      }

      setTooltip({ entry, targetRect: el.getBoundingClientRect() })
    },
    []
  )

  useEffect(() => {
    if (!whatsThisMode) return
    document.addEventListener('mouseover', handleMouseOver)
    return () => document.removeEventListener('mouseover', handleMouseOver)
  }, [whatsThisMode, handleMouseOver])

  // ── Recompute rect on scroll/resize ────────────────────────────────────────
  useEffect(() => {
    if (!tooltip || !currentTargetRef.current) return
    const update = (): void => {
      const el = currentTargetRef.current
      if (!el) return
      setTooltip((prev) =>
        prev ? { ...prev, targetRect: el.getBoundingClientRect() } : null
      )
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [tooltip])

  if (!whatsThisMode) return null

  return createPortal(
    <>
      {/* Subtle full-screen tint to signal the mode is active */}
      <div
        className="fixed inset-0 z-[900] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(99,102,241,0.04) 100%)'
        }}
      />

      {/* Floating tooltip */}
      <AnimatePresence>
        {tooltip && (
          <FloatingTooltip
            key={tooltip.entry.id}
            tooltip={tooltip}
            onClose={() => setWhatsThisMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Mode badge — bottom-center */}
      <motion.div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[910] flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--bg-overlay)] border border-[var(--accent)]/40 shadow-lg pointer-events-none"
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" />
        <span className="text-[11px] font-medium text-[var(--accent-bright)]">
          What's This? — hover any element · Esc to exit
        </span>
      </motion.div>
    </>,
    document.body
  )
}

// ── FloatingTooltip ────────────────────────────────────────────────────────────

const CARD_WIDTH  = 280
const CARD_OFFSET = 10

function FloatingTooltip({
  tooltip,
  onClose
}: {
  tooltip: TooltipState
  onClose: () => void
}): JSX.Element {
  const { entry, targetRect } = tooltip
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Compute preferred position: below the element, horizontally centered
  let left = targetRect.left + targetRect.width / 2 - CARD_WIDTH / 2
  let top  = targetRect.bottom + CARD_OFFSET

  // Clamp horizontally
  left = Math.max(8, Math.min(left, vw - CARD_WIDTH - 8))

  // If it would overflow below, flip above
  const ESTIMATED_HEIGHT = 140
  if (top + ESTIMATED_HEIGHT > vh - 8) {
    top = targetRect.top - ESTIMATED_HEIGHT - CARD_OFFSET
  }

  // Clamp top
  top = Math.max(8, top)

  return (
    <motion.div
      key={entry.id}
      className="fixed z-[920] pointer-events-auto"
      style={{ left, top, width: CARD_WIDTH }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="rounded-xl bg-[var(--bg-overlay)] border border-[var(--accent)]/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
              {entry.title}
            </span>
            {entry.shortcut && (
              <div className="flex items-center gap-0.5 mt-0.5">
                <Keyboard size={9} className="text-[var(--text-disabled)] mr-0.5 shrink-0" />
                {entry.shortcut.map((key, i) => (
                  <span key={i} className="flex items-center gap-0.5">
                    <kbd className="px-1 py-0.5 rounded text-[9px] font-mono font-medium bg-[var(--bg-base)] border border-[var(--border)] text-[var(--accent-bright)] leading-none">
                      {key}
                    </kbd>
                    {i < entry.shortcut!.length - 1 && (
                      <span className="text-[9px] text-[var(--text-disabled)]">+</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-100"
          >
            <X size={11} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border-subtle)] mx-3.5" />

        {/* Description */}
        <p className="px-3.5 py-2.5 text-[11px] text-[var(--text-muted)] leading-relaxed">
          {entry.description}
        </p>

        {/* Accent bottom strip */}
        <div className="h-[2px] bg-gradient-to-r from-[var(--accent)]/60 via-[var(--accent-bright)]/40 to-transparent" />
      </div>
    </motion.div>
  )
}
