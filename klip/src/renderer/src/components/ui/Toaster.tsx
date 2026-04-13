import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react'
import { useToastStore, type Toast } from '@/stores/toastStore'

// ── Toaster host ──────────────────────────────────────────────────────────────
// Mount once at the app root. Renders all active toasts bottom-right.

export default function Toaster(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Individual toast ──────────────────────────────────────────────────────────

function ToastItem({ toast }: { toast: Toast }): JSX.Element {
  const dismiss = useToastStore((s) => s.dismiss)

  // Auto-dismiss after duration
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(id)
  }, [toast.id, toast.duration, dismiss])

  const Icon = ICONS[toast.type]
  const iconClass = ICON_COLORS[toast.type]
  const barClass  = BAR_COLORS[toast.type]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.94 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{    opacity: 0, x: 24, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="pointer-events-auto relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border)] shadow-xl w-[272px] overflow-hidden"
    >
      <Icon size={14} className={`shrink-0 ${iconClass}`} />

      <span className="text-xs text-[var(--text-primary)] flex-1 leading-relaxed select-none">
        {toast.message}
      </span>

      <button
        onClick={() => dismiss(toast.id)}
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-100"
        aria-label="Dismiss"
      >
        <X size={11} />
      </button>

      {/* Progress bar drains left over the toast duration */}
      <motion.div
        className={`absolute bottom-0 left-0 h-[2px] ${barClass}`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  )
}

// ── Style maps ────────────────────────────────────────────────────────────────

const ICONS = {
  success: CheckCircle2,
  info:    Info,
  warning: AlertTriangle,
  error:   AlertCircle
}

const ICON_COLORS: Record<Toast['type'], string> = {
  success: 'text-emerald-400',
  info:    'text-[var(--accent-bright)]',
  warning: 'text-amber-400',
  error:   'text-red-400'
}

const BAR_COLORS: Record<Toast['type'], string> = {
  success: 'bg-emerald-400',
  info:    'bg-[var(--accent-bright)]',
  warning: 'bg-amber-400',
  error:   'bg-red-400'
}
