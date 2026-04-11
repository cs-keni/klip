import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Film, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration, formatResolution } from '@/lib/mediaUtils'
import { useProjectStore } from '@/stores/projectStore'
import type { MediaClip } from '@/types/media'

interface ClipCardProps {
  clip: MediaClip
  isSelected: boolean
  isRenaming: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onRenameCommit: (name: string) => void
  onRenameCancel: () => void
}

function resolutionHeight(resolution: string): number {
  if (resolution === '4k') return 2160
  if (resolution === '1440p') return 1440
  if (resolution === '1080p') return 1080
  return 0
}

export default function ClipCard({
  clip,
  isSelected,
  isRenaming,
  onClick,
  onContextMenu,
  onRenameCommit,
  onRenameCancel
}: ClipCardProps): JSX.Element {
  const { settings } = useProjectStore()
  const renameRef = useRef<HTMLInputElement>(null)
  const [renameValue, setRenameValue] = useState(clip.name)

  // Focus the rename input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(clip.name)
      setTimeout(() => {
        renameRef.current?.focus()
        renameRef.current?.select()
      }, 30)
    }
  }, [isRenaming, clip.name])

  // Resolution mismatch: compare clip height vs project expected height
  const projectHeight = resolutionHeight(settings.resolution)
  const hasMismatch =
    clip.type === 'video' &&
    clip.height > 0 &&
    projectHeight > 0 &&
    clip.height !== projectHeight

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = renameValue.trim()
      if (trimmed) onRenameCommit(trimmed)
      else onRenameCancel()
    }
    if (e.key === 'Escape') onRenameCancel()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'group relative rounded-lg overflow-hidden cursor-pointer',
        'border transition-all duration-100',
        'bg-[var(--bg-elevated)]',
        isSelected
          ? 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent),0_0_12px_var(--accent-glow)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--accent-dim)] hover:shadow-[0_0_10px_var(--accent-glow)]'
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Thumbnail area */}
      <div className="relative w-full aspect-video overflow-hidden bg-[var(--bg-base)]">
        <Thumbnail clip={clip} />

        {/* Type badge — top-left */}
        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            {clip.type === 'video' && <Film size={10} className="text-white/80" />}
            {clip.type === 'image' && <ImageIcon size={10} className="text-white/80" />}
          </div>
        </div>

        {/* Mismatch warning — top-right */}
        {hasMismatch && (
          <div
            className="absolute top-1.5 right-1.5"
            title={`Resolution mismatch: clip is ${formatResolution(clip.width, clip.height)}, project is ${settings.resolution}`}
          >
            <div className="p-0.5 rounded bg-black/60 backdrop-blur-sm">
              <AlertTriangle size={11} className="text-[var(--warning)]" />
            </div>
          </div>
        )}

        {/* On-timeline indicator — bottom-right */}
        {clip.isOnTimeline && (
          <div className="absolute bottom-1.5 right-1.5">
            <CheckCircle2 size={12} className="text-[var(--success)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          </div>
        )}
      </div>

      {/* Info area */}
      <div className="px-2 py-1.5">
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => {
              const trimmed = renameValue.trim()
              if (trimmed) onRenameCommit(trimmed)
              else onRenameCancel()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-[var(--bg-surface)] border border-[var(--accent-light)] rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] focus:outline-none"
            maxLength={128}
          />
        ) : (
          <p
            className="text-xs font-medium text-[var(--text-primary)] truncate leading-tight"
            title={clip.name}
          >
            {clip.name}
          </p>
        )}

        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight truncate">
          {clip.type === 'color' ? (
            <>Color · {clip.duration}s</>
          ) : (
            <>
              {clip.duration > 0 ? formatDuration(clip.duration) : '–'}
              {clip.width > 0 && (
                <> · {formatResolution(clip.width, clip.height)}</>
              )}
            </>
          )}
        </p>
      </div>
    </motion.div>
  )
}

function Thumbnail({ clip }: { clip: MediaClip }): JSX.Element {
  if (clip.type === 'color') {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: clip.color }}>
        <div
          className="w-6 h-6 rounded border border-white/20 shadow-inner"
          style={{ backgroundColor: clip.color }}
        />
      </div>
    )
  }

  if (clip.thumbnailStatus === 'generating') {
    return <div className="w-full h-full skeleton" />
  }

  if (clip.thumbnailStatus === 'error' || !clip.thumbnail) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--bg-elevated)]">
        {clip.type === 'image' ? (
          <ImageIcon size={18} className="text-[var(--text-muted)]" />
        ) : (
          <Film size={18} className="text-[var(--text-muted)]" />
        )}
      </div>
    )
  }

  return (
    <motion.img
      src={clip.thumbnail ?? undefined}
      alt={clip.name}
      className="w-full h-full object-cover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      draggable={false}
    />
  )
}
