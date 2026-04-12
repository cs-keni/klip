import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Volume2, VolumeX, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import { TRACK_HEIGHT, HEADER_WIDTH, type Track, type TimelineClip } from '@/types/timeline'
import TimelineClipView from './TimelineClipView'

const TRACK_ACCENT: Record<Track['type'], string> = {
  video: '#a78bfa',
  audio: '#60a5fa',
  music: '#4ade80'
}

interface TrackRowProps {
  track: Track
  clips: TimelineClip[]
  pxPerSec: number
  scrollLeft: number
  contentWidth: number
  selectedClipId: string | null
}

export default function TrackRow({
  track,
  clips,
  pxPerSec,
  scrollLeft,
  contentWidth,
  selectedClipId
}: TrackRowProps): JSX.Element {
  const { addClip, selectClip, renameTrack, toggleMute, toggleSolo } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(track.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const dragCounterRef = useRef(0)
  const laneRef = useRef<HTMLDivElement>(null)

  const height = TRACK_HEIGHT[track.type]
  const accent = TRACK_ACCENT[track.type]

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/klip-clip')) return
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/klip-clip')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)

      const mediaClipId = e.dataTransfer.getData('application/klip-clip')
      if (!mediaClipId || track.isLocked) return

      const mediaClip = mediaClips.find((c) => c.id === mediaClipId)
      if (!mediaClip) return

      // Calculate drop time from mouse position
      const rect = laneRef.current!.getBoundingClientRect()
      const localX = e.clientX - rect.left
      const contentX = localX + scrollLeft
      const rawTime = Math.max(0, contentX / pxPerSec)

      // Snap to existing clip edges (same 8px threshold as TimelineClipView)
      const SNAP_PX = 8
      const snapThreshold = SNAP_PX / pxPerSec
      const snapPoints = [0, ...clips.flatMap((c) => [c.startTime, c.startTime + c.duration])]
      let startTime = rawTime
      let bestDist = snapThreshold
      for (const p of snapPoints) {
        const d = Math.abs(rawTime - p)
        if (d < bestDist) { bestDist = d; startTime = p }
      }

      const newClip: TimelineClip = {
        id: crypto.randomUUID(),
        mediaClipId,
        trackId: track.id,
        startTime,
        duration: mediaClip.duration > 0 ? mediaClip.duration : 5,
        trimStart: 0,
        type: mediaClip.type === 'color' ? 'color' : mediaClip.type,
        name: mediaClip.name,
        thumbnail: mediaClip.thumbnail,
        color: mediaClip.color
      }

      addClip(newClip)
    },
    [track, mediaClips, pxPerSec, scrollLeft, addClip]
  )

  // ── Track rename ───────────────────────────────────────────────────────────

  function commitRename() {
    const name = renameValue.trim()
    if (name && name !== track.name) renameTrack(track.id, name)
    else setRenameValue(track.name)
    setIsRenaming(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex border-b border-[var(--border-subtle)] group/track"
      style={{ height, minWidth: contentWidth + HEADER_WIDTH }}
    >
      {/* ── Track header (sticky) ───────────────────────────────────────── */}
      <div
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-2 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] z-10 cursor-default transition-opacity duration-150',
          track.isMuted && 'opacity-50'
        )}
        style={{ width: HEADER_WIDTH, position: 'sticky', left: 0 }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {/* Colour dot */}
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />

        {/* Track name / rename input */}
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenameValue(track.name); setIsRenaming(false) }
            }}
            className="flex-1 min-w-0 bg-[var(--bg-elevated)] border border-[var(--accent-light)] rounded px-1 text-xs text-[var(--text-primary)] focus:outline-none"
          />
        ) : (
          <span className="flex-1 min-w-0 text-xs text-[var(--text-secondary)] truncate">
            {track.name}
          </span>
        )}

        {/* Track actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/track:opacity-100 transition-opacity duration-100">
          {/* Mute */}
          <TrackIconButton
            onClick={() => toggleMute(track.id)}
            title={track.isMuted ? 'Unmute' : 'Mute'}
            active={track.isMuted}
            icon={track.isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
          />
          {/* Solo */}
          <TrackIconButton
            onClick={() => toggleSolo(track.id)}
            title={track.isSolo ? 'Unsolo' : 'Solo'}
            active={track.isSolo}
            icon={
              <span className="text-[9px] font-bold leading-none">S</span>
            }
          />
          {/* Lock (placeholder — Phase 8) */}
          <TrackIconButton
            onClick={() => {}}
            title={track.isLocked ? 'Unlock' : 'Lock track'}
            icon={<Lock size={10} />}
          />
        </div>
      </div>

      {/* ── Track context menu ──────────────────────────────────────────── */}
      <AnimatePresence>
        {contextMenu && (
          <TrackContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onRename={() => {
              setRenameValue(track.name)
              setIsRenaming(true)
              setContextMenu(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Clip lane ───────────────────────────────────────────────────── */}
      <div
        ref={laneRef}
        className={cn(
          'relative flex-1 transition-colors duration-100',
          isDragOver
            ? 'bg-[var(--accent-glow)] ring-1 ring-inset ring-[var(--accent-dim)]'
            : 'bg-[var(--bg-base)] hover:bg-[rgba(255,255,255,0.01)]',
          track.isMuted && 'opacity-50'
        )}
        style={{ width: contentWidth }}
        onClick={() => selectClip(null)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Subtle second-interval grid lines */}
        <GridLines pxPerSec={pxPerSec} height={height} contentWidth={contentWidth} />

        <AnimatePresence>
          {clips.map((clip) => (
            <TimelineClipView
              key={clip.id}
              clip={clip}
              pxPerSec={pxPerSec}
              trackHeight={height}
              isSelected={selectedClipId === clip.id}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TrackContextMenu({
  x,
  y,
  onClose,
  onRename
}: {
  x: number
  y: number
  onClose: () => void
  onRename: () => void
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const MENU_W = 160
  const MENU_H = 44
  const clampedX = Math.min(x, window.innerWidth - MENU_W - 8)
  const clampedY = Math.min(y, window.innerHeight - MENU_H - 8)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-overlay)] shadow-xl"
      style={{ left: clampedX, top: clampedY }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      <div className="py-1">
        <button
          onClick={onRename}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors duration-75"
        >
          <span className="opacity-70"><Pencil size={13} /></span>
          Rename
        </button>
      </div>
    </motion.div>,
    document.body
  )
}

function TrackIconButton({
  icon,
  title,
  onClick,
  active = false
}: {
  icon: ReactNode
  title: string
  onClick: () => void
  active?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center justify-center w-5 h-5 rounded transition-colors duration-75',
        active
          ? 'text-[var(--accent-light)] bg-[var(--accent-glow)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
      )}
    >
      {icon}
    </button>
  )
}

/** Subtle vertical lines at each major/minor tick position. */
function GridLines({
  pxPerSec,
  height,
  contentWidth
}: {
  pxPerSec: number
  height: number
  contentWidth: number
}): JSX.Element | null {
  // Only draw grid lines at reasonable densities
  if (pxPerSec < 10 || pxPerSec > 500) return null

  let interval = 1
  if (pxPerSec < 20) interval = 10
  else if (pxPerSec < 50) interval = 5
  else if (pxPerSec < 100) interval = 2

  const totalSecs = contentWidth / pxPerSec
  const lines: number[] = []
  for (let t = interval; t < totalSecs; t += interval) {
    lines.push(t)
  }

  return (
    <>
      {lines.map((t) => (
        <div
          key={t}
          className="absolute top-0 w-px pointer-events-none"
          style={{
            left: t * pxPerSec,
            height,
            background: 'rgba(255,255,255,0.025)'
          }}
        />
      ))}
    </>
  )
}
