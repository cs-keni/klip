import { useState, useEffect, type ButtonHTMLAttributes } from 'react'
import klipIcon from '@/assets/icon.ico'
import { motion } from 'framer-motion'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'

export default function TitleBar(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const { projectName, hasUnsavedChanges } = useProjectStore()

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    window.api.window.onMaximizedChanged(setIsMaximized)
    return () => window.api.window.removeMaximizedListener()
  }, [])

  return (
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
          onClick={() => window.api.window.close()}
          aria-label="Close"
          hoverClass="hover:bg-[#c42b1c] hover:text-white"
        >
          <X size={12} strokeWidth={2} />
        </TitleBarButton>
      </div>
    </div>
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
