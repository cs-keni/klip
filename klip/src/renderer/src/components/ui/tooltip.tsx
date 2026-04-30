import {
  useState,
  useRef,
  type ReactNode,
  type CSSProperties
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  delay?: number
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({
  content,
  children,
  delay = 150,
  side = 'bottom'
}: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(): void {
    timer.current = setTimeout(() => setVisible(true), delay)
  }

  function hide(): void {
    if (timer.current) clearTimeout(timer.current)
    setVisible(false)
  }

  const sideStyles: Record<string, CSSProperties> = {
    top: { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
    left: { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' },
    right: { left: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' }
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className="pointer-events-none absolute z-50 whitespace-nowrap rounded bg-[var(--bg-overlay)] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-secondary)] shadow-lg"
            style={sideStyles[side]}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
