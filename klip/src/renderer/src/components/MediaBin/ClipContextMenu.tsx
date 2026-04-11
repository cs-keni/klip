import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Pencil, Trash2, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaClip } from '@/types/media'

interface ClipContextMenuProps {
  clip: MediaClip
  x: number
  y: number
  onClose: () => void
  onRename: () => void
  onRemove: () => void
  onReveal: () => void
}

export default function ClipContextMenu({
  clip,
  x,
  y,
  onClose,
  onRename,
  onRemove,
  onReveal
}: ClipContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  // Clamp to viewport so the menu never goes off-screen
  const MENU_W = 180
  const MENU_H = clip.type === 'color' ? 80 : 112
  const clampedX = Math.min(x, window.innerWidth - MENU_W - 8)
  const clampedY = Math.min(y, window.innerHeight - MENU_H - 8)

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const menu = (
    <motion.div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-overlay)] shadow-xl"
      style={{ left: clampedX, top: clampedY }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      <div className="py-1">
        <MenuItem
          icon={<Pencil size={13} />}
          label="Rename"
          onClick={() => {
            onRename()
            onClose()
          }}
        />
        {clip.type !== 'color' && (
          <MenuItem
            icon={<FolderOpen size={13} />}
            label="Reveal in Explorer"
            onClick={() => {
              onReveal()
              onClose()
            }}
          />
        )}
        <div className="my-1 h-px bg-[var(--border-subtle)]" />
        <MenuItem
          icon={<Trash2 size={13} />}
          label="Remove from Project"
          onClick={() => {
            onRemove()
            onClose()
          }}
          destructive
        />
      </div>
    </motion.div>
  )

  return createPortal(menu, document.body)
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive = false
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-left',
        'transition-colors duration-75',
        destructive
          ? 'text-[var(--destructive)] hover:bg-red-950/40'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
      )}
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  )
}
