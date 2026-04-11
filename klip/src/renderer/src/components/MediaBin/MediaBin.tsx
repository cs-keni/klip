import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Upload, Film, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaStore } from '@/stores/mediaStore'
import { processMediaFile, getMediaTypeFromPath } from '@/lib/mediaUtils'
import type { MediaClip } from '@/types/media'
import ClipCard from './ClipCard'
import SkeletonCard from './SkeletonCard'
import ClipContextMenu from './ClipContextMenu'
import ColorClipDialog from './ColorClipDialog'

const ACCEPTED_EXTENSIONS = /\.(mp4|mkv|mov|avi|webm|mp3|wav|aac|flac|ogg|m4a|png|jpg|jpeg|webp)$/i

interface ContextMenuState {
  clip: MediaClip
  x: number
  y: number
}

export default function MediaBin(): JSX.Element {
  const { clips, addClip, removeClip, updateClip, renameClip, selectClip, selectedClipId } =
    useMediaStore()
  const [dragCounter, setDragCounter] = useState(0)
  const [colorDialogOpen, setColorDialogOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renamingClipId, setRenamingClipId] = useState<string | null>(null)
  const processingRef = useRef<Set<string>>(new Set())

  const isDragOver = dragCounter > 0

  // Delete key removes the currently selected clip
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Don't fire while the user is typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (selectedClipId) {
        removeClip(selectedClipId)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedClipId, removeClip])

  // ─── Import flow ────────────────────────────────────────────────────────────

  const importPaths = useCallback(
    async (rawPaths: string[]) => {
      const existingPaths = new Set(clips.map((c) => c.path))
      const paths = rawPaths.filter(
        (p) => ACCEPTED_EXTENSIONS.test(p) && !existingPaths.has(p)
      )
      if (paths.length === 0) return

      // 1. Create placeholder clips right away (they show as skeletons)
      const pending: Array<{ id: string; path: string }> = paths.map((p) => {
        const id = crypto.randomUUID()
        const type = getMediaTypeFromPath(p)
        const name = p.replace(/\\/g, '/').split('/').pop() ?? p

        const clip: MediaClip = {
          id,
          type,
          path: p,
          name,
          duration: 0,
          width: 0,
          height: 0,
          fps: 0,
          fileSize: 0,
          thumbnail: null,
          thumbnailStatus: 'generating',
          isOnTimeline: false,
          isMissing: false,
          addedAt: Date.now()
        }
        addClip(clip)
        processingRef.current.add(id)
        return { id, path: p }
      })

      // 2. Process each clip in parallel
      await Promise.allSettled(
        pending.map(async ({ id, path }) => {
          try {
            const [fileInfo, media] = await Promise.all([
              window.api.media.getFileInfo(path),
              processMediaFile(path)
            ])
            updateClip(id, {
              duration: media.duration,
              width: media.width,
              height: media.height,
              fileSize: fileInfo.size,
              thumbnail: media.thumbnail,
              thumbnailStatus: 'ready'
            })
          } catch {
            updateClip(id, { thumbnailStatus: 'error' })
          } finally {
            processingRef.current.delete(id)
          }
        })
      )
    },
    [clips, addClip, updateClip]
  )

  const handleOpenDialog = useCallback(async () => {
    const paths = await window.api.media.openDialog()
    if (paths.length > 0) await importPaths(paths)
  }, [importPaths])

  // ─── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragCounter((c) => c + 1)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragCounter((c) => Math.max(0, c - 1))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragCounter(0)
      // Electron extends File with a .path property
      const paths = Array.from(e.dataTransfer.files).map(
        (f) => (f as File & { path: string }).path
      )
      if (paths.length > 0) await importPaths(paths)
    },
    [importPaths]
  )

  // ─── Context menu actions ────────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent, clip: MediaClip) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ clip, x: e.clientX, y: e.clientY })
  }, [])

  const handleReveal = useCallback((path: string) => {
    window.api.media.revealInExplorer(path)
  }, [])

  // ─── Color clip creation ─────────────────────────────────────────────────────

  const handleCreateColorClip = useCallback(
    (name: string, color: string, duration: number) => {
      // createColorClip is defined inside the store but we need it here
      const id = crypto.randomUUID()
      const clip: MediaClip = {
        id,
        type: 'color',
        path: '',
        name,
        duration,
        width: 0,
        height: 0,
        fps: 0,
        fileSize: 0,
        thumbnail: null,
        thumbnailStatus: 'idle',
        color,
        isOnTimeline: false,
        isMissing: false,
        addedAt: Date.now()
      }
      addClip(clip)
    },
    [addClip]
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isEmpty = clips.length === 0

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Media Bin
          {clips.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--text-disabled)]">
              {clips.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <HeaderButton
            icon={<Square size={12} />}
            title="Solid Color Clip"
            onClick={() => setColorDialogOpen(true)}
          />
          <HeaderButton
            icon={<Upload size={12} />}
            title="Import Media"
            label="Import"
            onClick={handleOpenDialog}
            accent
          />
        </div>
      </div>

      {/* Content area */}
      <div
        className={cn(
          'flex-1 min-h-0 overflow-y-auto relative transition-all duration-150',
          isDragOver && 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-glow)]'
        )}
        onClick={() => {
          selectClip(null)
          setContextMenu(null)
        }}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
                <Upload size={20} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-[var(--accent-bright)]">Drop to import</p>
              <p className="text-xs text-[var(--text-muted)]">MP4, MKV, MOV, MP3, WAV, PNG, JPG…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {isEmpty ? (
          <EmptyState onImport={handleOpenDialog} onColorClip={() => setColorDialogOpen(true)} />
        ) : (
          <div className="p-2 grid grid-cols-2 gap-2 content-start">
            <AnimatePresence mode="popLayout">
              {clips.map((clip) =>
                clip.thumbnailStatus === 'generating' ? (
                  <motion.div
                    key={clip.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  >
                    <SkeletonCard />
                  </motion.div>
                ) : (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    isSelected={selectedClipId === clip.id}
                    isRenaming={renamingClipId === clip.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectClip(clip.id)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, clip)}
                    onRenameCommit={(name) => {
                      renameClip(clip.id, name)
                      setRenamingClipId(null)
                    }}
                    onRenameCancel={() => setRenamingClipId(null)}
                  />
                )
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ClipContextMenu
            key="ctx"
            clip={contextMenu.clip}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onRename={() => setRenamingClipId(contextMenu.clip.id)}
            onRemove={() => {
              removeClip(contextMenu.clip.id)
              setContextMenu(null)
            }}
            onReveal={() => handleReveal(contextMenu.clip.path)}
          />
        )}
      </AnimatePresence>

      {/* Color clip dialog */}
      <ColorClipDialog
        open={colorDialogOpen}
        onClose={() => setColorDialogOpen(false)}
        onCreate={handleCreateColorClip}
      />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function HeaderButton({
  icon,
  title,
  label,
  onClick,
  accent = false
}: {
  icon: ReactNode
  title: string
  label?: string
  onClick: () => void
  accent?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors duration-100 active:scale-[0.96]',
        accent
          ? 'bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent)] hover:text-white'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

function EmptyState({
  onImport,
  onColorClip
}: {
  onImport: () => void
  onColorClip: () => void
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center min-h-[200px]">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center">
        <Film size={24} className="text-[var(--text-muted)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">No media yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
          Import videos or images, or drag files here
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[160px]">
        <button
          onClick={onImport}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent)] hover:text-white transition-colors duration-100 active:scale-[0.97]"
        >
          <Upload size={12} />
          Import Media
        </button>
        <button
          onClick={onColorClip}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] transition-colors duration-100 active:scale-[0.97]"
        >
          <Square size={12} />
          Solid Color Clip
        </button>
      </div>
    </div>
  )
}
