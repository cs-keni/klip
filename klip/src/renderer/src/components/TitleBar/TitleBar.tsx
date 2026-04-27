import { useState, useEffect, useCallback, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import klipIcon from '@/assets/icon.ico'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import { saveProject } from '@/lib/projectIO'

export default function TitleBar(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const { projectName, hasUnsavedChanges } = useProjectStore()

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    window.api.window.onMaximizedChanged(setIsMaximized)
    return () => window.api.window.removeMaximizedListener()
  }, [])

  const handleCloseClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true)
    } else {
      window.api.window.close()
    }
  }, [hasUnsavedChanges])

  const handleSaveAndClose = useCallback(async () => {
    setShowCloseConfirm(false)
    const saved = await saveProject()
    if (saved) window.api.window.close()
  }, [])

  const handleDiscardAndClose = useCallback(() => {
    setShowCloseConfirm(false)
    window.api.window.close()
  }, [])

  return (
    <>
      <div className="titlebar-drag flex items-center h-[38px] bg-[var(--bg-base)] border-b border-[var(--border-subtle)] shrink-0 select-none">
        {/* Left: Logo + app name */}
        <div className="titlebar-no-drag flex items-center gap-2 pl-3 pr-4 h-full shrink-0">
          <KlipLogo size={18} />
          <span className="text-[var(--text-primary)] font-semibold text-[13px] tracking-tight">
            Klip
          </span>
        </div>

        {/* Center: Project name — drag region covers this area */}
        <div className="flex-1 flex items-center justify-center h-full min-w-0">
          {projectName && (
            <span data-testid="project-name" className="text-[var(--text-muted)] text-xs truncate max-w-xs">
              {projectName}
              {hasUnsavedChanges && (
                <span className="ml-1.5 text-[var(--accent-bright)] text-[10px]">●</span>
              )}
            </span>
          )}
        </div>

        {/* Right: Window controls */}
        <div className="titlebar-no-drag flex items-center h-full shrink-0">
          <TitleBarButton
            onClick={() => window.api.window.minimize()}
            aria-label="Minimize"
            hoverClass="hover:bg-[var(--bg-elevated)]"
          >
            <Minus size={12} strokeWidth={2} />
          </TitleBarButton>

          <TitleBarButton
            onClick={() => window.api.window.maximize()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            hoverClass="hover:bg-[var(--bg-elevated)]"
          >
            {isMaximized ? <RestoreIcon /> : <Square size={11} strokeWidth={1.5} />}
          </TitleBarButton>

          <TitleBarButton
            onClick={handleCloseClick}
            aria-label="Close"
            hoverClass="hover:bg-[#c42b1c] hover:text-white"
          >
            <X size={12} strokeWidth={2} />
          </TitleBarButton>
        </div>
      </div>

      {/* Save-before-close confirmation — portalled so it sits above everything */}
      {createPortal(
        <AnimatePresence>
          {showCloseConfirm && (
            <motion.div
              className="fixed inset-0 z-[99999] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowCloseConfirm(false)}
              />
              <motion.div
                className="relative z-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 w-[340px] shadow-2xl flex flex-col gap-4"
                initial={{ scale: 0.94, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.34, 1.1, 0.64, 1] }}
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-[var(--text-primary)] font-semibold text-sm">Save before closing?</h2>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                    You have unsaved changes. Closing now will discard them.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowCloseConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors duration-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDiscardAndClose}
                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--destructive)] hover:bg-red-950/40 transition-colors duration-100"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleSaveAndClose}
                    className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

interface TitleBarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hoverClass: string
}

function TitleBarButton({
  children,
  hoverClass,
  className,
  ...props
}: TitleBarButtonProps): JSX.Element {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'flex items-center justify-center w-11 h-full text-[var(--text-muted)] transition-colors duration-100',
        hoverClass,
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}

function KlipLogo({ size = 18 }: { size?: number }): JSX.Element {
  return (
    <img
      src={klipIcon}
      width={size}
      height={size}
      style={{ imageRendering: 'auto', display: 'block' }}
      alt="Klip"
    />
  )
}

function RestoreIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3">
      {/* Front window */}
      <rect x="3" y="1" width="7" height="7" rx="0.5" />
      {/* Back window peeking out */}
      <path d="M1 4v5.5c0 .28.22.5.5.5H7" />
    </svg>
  )
}

export { KlipLogo }
