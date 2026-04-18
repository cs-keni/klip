import { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAppSettingsStore } from '@/stores/appSettingsStore'
import { TUTORIAL_STEPS, type TutorialStep } from '@/lib/tutorialSteps'

// ── Geometry helpers ───────────────────────────────────────────────────────────

interface Rect { left: number; top: number; width: number; height: number }

const PADDING = 8     // spotlight padding around target
const CARD_W  = 300   // callout card width
const CARD_GAP = 14   // gap between spotlight edge and card

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(`[data-tutorial="${selector}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/** Return the best cardinal direction for the callout card given the target rect. */
function resolvePlacement(
  rect: Rect,
  preferred: TutorialStep['placement']
): 'top' | 'bottom' | 'left' | 'right' {
  if (preferred && preferred !== 'auto') return preferred
  // fallback: if target is in top half → show below, else above
  return rect.top + rect.height / 2 < window.innerHeight / 2 ? 'bottom' : 'top'
}

interface CardPosition {
  top:   number | 'auto'
  left:  number | 'auto'
  right: number | 'auto'
  bottom: number | 'auto'
}

function cardPosition(rect: Rect, placement: 'top' | 'bottom' | 'left' | 'right'): CardPosition {
  const sl = rect.left  - PADDING
  const st = rect.top   - PADDING
  const sr = rect.left  + rect.width  + PADDING
  const sb = rect.top   + rect.height + PADDING

  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

  switch (placement) {
    case 'bottom': {
      const top  = sb + CARD_GAP
      const left = clamp(sl + (rect.width - CARD_W) / 2, 12, window.innerWidth - CARD_W - 12)
      return { top, left, right: 'auto', bottom: 'auto' }
    }
    case 'top': {
      const bottom = window.innerHeight - st + CARD_GAP
      const left   = clamp(sl + (rect.width - CARD_W) / 2, 12, window.innerWidth - CARD_W - 12)
      return { bottom, left, top: 'auto', right: 'auto' }
    }
    case 'right': {
      const left = sr + CARD_GAP
      const top  = clamp(st + (rect.height - 120) / 2, 12, window.innerHeight - 200)
      return { left, top, right: 'auto', bottom: 'auto' }
    }
    case 'left': {
      const right = window.innerWidth - sl + CARD_GAP
      const top   = clamp(st + (rect.height - 120) / 2, 12, window.innerHeight - 200)
      return { right, top, left: 'auto', bottom: 'auto' }
    }
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

const cardVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 56, scale: 0.96 }),
  animate: { opacity: 1, x: 0, scale: 1 },
  exit:    (dir: number) => ({ opacity: 0, x: -dir * 40, scale: 0.97 })
}

export default function TutorialOverlay(): JSX.Element | null {
  const { hasSeenWalkthrough, setHasSeenWalkthrough } = useAppSettingsStore()

  const [active,    setActive]    = useState(!hasSeenWalkthrough)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect,      setRect]      = useState<Rect | null>(null)
  const [direction, setDirection] = useState<1 | -1>(1)

  // Re-activate if user clicks "Restart Tutorial" in settings
  useEffect(() => {
    if (!hasSeenWalkthrough) {
      setStepIndex(0)
      setActive(true)
    }
  }, [hasSeenWalkthrough])

  const step = TUTORIAL_STEPS[stepIndex]

  // Measure target element on step change and on resize
  useLayoutEffect(() => {
    if (!active || !step || !step.target) {
      setRect(null)
      return
    }

    let raf: number

    const measure = (): void => {
      const r = getTargetRect(step.target!)
      setRect(r)
    }

    // Small delay so DOM layout settles after step transition
    raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [active, step])

  const finish = useCallback(() => {
    setActive(false)
    setHasSeenWalkthrough(true)
  }, [setHasSeenWalkthrough])

  const next = useCallback(() => {
    setDirection(1)
    setStepIndex((i) => Math.min(i + 1, TUTORIAL_STEPS.length - 1))
  }, [])

  const prev = useCallback(() => {
    setDirection(-1)
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  if (!active) return null
  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast  = stepIndex === TUTORIAL_STEPS.length - 1
  const hasFocus = step.target !== null && rect !== null

  // Spotlight geometry
  const sl = hasFocus ? rect!.left  - PADDING : 0
  const st = hasFocus ? rect!.top   - PADDING : 0
  const sw = hasFocus ? rect!.width  + PADDING * 2 : 0
  const sh = hasFocus ? rect!.height + PADDING * 2 : 0

  // Card position
  const placement = hasFocus
    ? resolvePlacement(rect!, step.placement)
    : 'bottom'
  const pos = hasFocus ? cardPosition(rect!, placement) : { top: 'auto', left: 'auto', right: 'auto', bottom: 'auto' }

  const overlay = (
    <AnimatePresence>
      {active && (
        <motion.div
          key="tutorial-overlay"
          className="fixed inset-0 z-[300]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop — semi-transparent, pointer events pass through the spotlight hole via the cutout trick */}
          <div className="absolute inset-0 pointer-events-none">
            {hasFocus ? (
              // Spotlight via CSS clip-path SVG mask approach: use box-shadow on the highlight
              <div
                className="absolute rounded-lg pointer-events-none"
                style={{
                  left:      sl,
                  top:       st,
                  width:     sw,
                  height:    sh,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
                  border:    '1.5px solid rgba(139,92,246,0.6)',
                  outline:   '0 solid transparent',
                  borderRadius: 8
                }}
              />
            ) : (
              // No spotlight — full dim backdrop for centered dialog steps
              <div className="absolute inset-0 bg-black/72" />
            )}
          </div>

          {/* Callout card */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              className="absolute pointer-events-auto"
              style={
                hasFocus
                  ? {
                      top:    pos.top    === 'auto' ? undefined : pos.top,
                      left:   pos.left   === 'auto' ? undefined : pos.left,
                      right:  pos.right  === 'auto' ? undefined : pos.right,
                      bottom: pos.bottom === 'auto' ? undefined : pos.bottom,
                      width:  CARD_W
                    }
                  : {
                      // Centered dialog for non-target steps
                      top:    '50%',
                      left:   '50%',
                      width:  CARD_W,
                      transform: 'translate(-50%, -50%)'
                    }
              }
              custom={direction}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between px-4 pt-4 pb-0 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Step dots */}
                      <div className="flex items-center gap-1">
                        {TUTORIAL_STEPS.map((_, i) => (
                          <div
                            key={i}
                            className="rounded-full transition-all duration-200"
                            style={{
                              width:           i === stepIndex ? 14 : 5,
                              height:          5,
                              backgroundColor: i === stepIndex
                                ? 'var(--accent)'
                                : i < stepIndex
                                  ? 'rgba(139,92,246,0.35)'
                                  : 'var(--bg-overlay)',
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                        {stepIndex + 1} / {TUTORIAL_STEPS.length}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                      {step.title}
                    </h3>
                  </div>

                  {/* Close / skip all */}
                  <button
                    onClick={finish}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-100 mt-0.5"
                    title="Skip tutorial"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Body */}
                <p className="px-4 pt-2.5 pb-0 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  {step.body}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 pt-3 pb-4 gap-2">
                  <button
                    onClick={finish}
                    className="text-[11px] text-[var(--text-disabled)] hover:text-[var(--text-muted)] transition-colors duration-100"
                  >
                    Skip all
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!isFirst && (
                      <button
                        onClick={prev}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-100 active:scale-[0.95]"
                      >
                        <ChevronLeft size={12} />
                        Back
                      </button>
                    )}
                    <button
                      onClick={isLast ? finish : next}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-all duration-100 active:scale-[0.95]"
                    >
                      {isLast ? 'Done' : 'Next'}
                      {!isLast && <ChevronRight size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
