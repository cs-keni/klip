import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

export default function PreviewPanel(): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-surface)]">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
          Preview
        </span>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">00:00:00:00</span>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden"
        onMouseEnter={() => setControlsVisible(true)}
        onMouseLeave={() => !isPlaying && setControlsVisible(true)}
      >
        {/* Empty state */}
        <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
            <Play size={18} className="text-[var(--text-muted)] ml-0.5" />
          </div>
          <p className="text-xs text-[var(--text-muted)]">No clips in timeline</p>
        </div>

        {/* Overlay controls — fade on hover */}
        <motion.div
          className="absolute inset-x-0 bottom-0 flex flex-col"
          initial={false}
          animate={{ opacity: controlsVisible ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Scrub bar */}
          <div className="px-3 pb-1">
            <div className="h-[3px] rounded-full bg-[var(--bg-overlay)] overflow-hidden cursor-pointer">
              <div className="h-full w-0 bg-[var(--accent)] rounded-full" />
            </div>
          </div>

          {/* Transport row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
            {/* Timecode */}
            <span className="text-[11px] font-mono text-[var(--text-secondary)] w-[72px]">
              00:00:00:00
            </span>

            {/* Transport buttons */}
            <div className="flex-1 flex items-center justify-center gap-1">
              <TransportBtn label="Step back  ←">
                <StepBackIcon />
              </TransportBtn>

              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={() => setIsPlaying((p) => !p)}
                title="Play / Pause  Space"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.span
                      key="pause"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Pause size={14} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="play"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Play size={14} className="ml-0.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <TransportBtn label="Step forward  →">
                <StepForwardIcon />
              </TransportBtn>
            </div>

            {/* Right controls */}
            <div className="w-[72px] flex items-center justify-end gap-2">
              <Tooltip content="Volume">
                <button className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <Volume2 size={13} />
                </button>
              </Tooltip>
              <Tooltip content="Fullscreen  F">
                <button className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <Maximize2 size={13} />
                </button>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function TransportBtn({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <Tooltip content={label}>
      <button className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-secondary)] transition-colors duration-100 active:scale-[0.93]">
        {children}
      </button>
    </Tooltip>
  )
}

function StepBackIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M12 2L5.5 7L12 12V2Z" />
    </svg>
  )
}

function StepForwardIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="10.5" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M2 2L8.5 7L2 12V2Z" />
    </svg>
  )
}
