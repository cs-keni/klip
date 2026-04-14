import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Unlock, Volume2, VolumeX, Pencil, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import { TRACK_HEIGHT, HEADER_WIDTH, type Track, type TimelineClip } from '@/types/timeline'
import type { MediaClip } from '@/types/media'
import TimelineClipView from './TimelineClipView'

const TRACK_ACCENT: Record<Track['type'], string> = {
  video:   '#a78bfa',
  audio:   '#60a5fa',
  music:   '#4ade80',
  overlay: '#22d3ee'
}

/** How many pixels beyond each viewport edge to keep clips rendered.
 *  Large enough that AnimatePresence exit animations never fire while
 *  a clip is still within sight, and that fast scroll doesn't pop clips in. */
const OVERSCAN_PX = 800

interface TrackRowProps {
  track: Track
  clips: TimelineClip[]
  pxPerSec: number
  scrollLeft: number
  contentWidth: number
  containerWidth: number
  selectedClipId: string | null
  selectedClipIds: string[]
}

/** A gap between two adjacent clips on the same track. */
interface Gap {
  startTime: number
  endTime: number
  startPx: number
  widthPx: number
}

export default function TrackRow({
  track,
  clips,
  pxPerSec,
  scrollLeft,
  contentWidth,
  containerWidth,
  selectedClipId,
  selectedClipIds
}: TrackRowProps): JSX.Element {
  const {
    tracks, addClip, addClips, selectClip, renameTrack,
    toggleMute, toggleSolo, toggleLock,
    snapEnabled, closeGap
  } = useTimelineStore()
  const { clips: mediaClips, addClip: addMediaClip } = useMediaStore()

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(track.name)
  const [isDragOver, setIsDragOver] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [gapMenu, setGapMenu] = useState<{ x: number; y: number; gap: Gap } | null>(null)
  const dragCounterRef = useRef(0)
  const laneRef = useRef<HTMLDivElement>(null)

  const height = TRACK_HEIGHT[track.type]
  const accent = TRACK_ACCENT[track.type]

  // ── Gap detection ──────────────────────────────────────────────────────────

  const gaps: Gap[] = (() => {
    const sorted = [...clips].sort((a, b) => a.startTime - b.startTime)
    const result: Gap[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const end  = sorted[i].startTime + sorted[i].duration
      const next = sorted[i + 1].startTime
      if (next - end > 0.05) {
        result.push({
          startTime: end,
          endTime: next,
          startPx: end * pxPerSec,
          widthPx: (next - end) * pxPerSec
        })
      }
    }
    return result
  })()

  // ── Viewport-culled clip list ─────────────────────────────────────────────
  // Only mount clips that overlap the visible viewport (± OVERSCAN_PX buffer).
  // Selected clips are always kept mounted regardless of position so that
  // drag/trim operations and keyboard shortcuts work on off-screen selections.

  const visibleClips = useMemo(() => {
    const viewStart = (scrollLeft - OVERSCAN_PX) / pxPerSec
    const viewEnd   = (scrollLeft + containerWidth + OVERSCAN_PX) / pxPerSec
    return clips.filter((clip) => {
      const clipEnd = clip.startTime + clip.duration
      const inView  = clip.startTime <= viewEnd && clipEnd >= viewStart
      return inView || selectedClipIds.includes(clip.id)
    })
  }, [clips, scrollLeft, pxPerSec, containerWidth, selectedClipIds])

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const ACCEPTED_TYPES = ['application/klip-clip', 'application/klip-music']

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!ACCEPTED_TYPES.some((t) => e.dataTransfer.types.includes(t))) return
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDragOver(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!ACCEPTED_TYPES.some((t) => e.dataTransfer.types.includes(t))) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Shared: compute drop time from mouse X, with optional snapping. */
  function computeDropTime(clientX: number): number {
    const rect = laneRef.current!.getBoundingClientRect()
    const rawTime = Math.max(0, (clientX - rect.left + scrollLeft) / pxPerSec)
    if (!snapEnabled) return rawTime
    const SNAP_PX = 8
    const threshold = SNAP_PX / pxPerSec
    const snapPoints = [0, ...clips.flatMap((c) => [c.startTime, c.startTime + c.duration])]
    let best = threshold
    let snapped = rawTime
    for (const p of snapPoints) {
      const d = Math.abs(rawTime - p)
      if (d < best) { best = d; snapped = p }
    }
    return snapped
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)

      if (track.isLocked || track.type === 'overlay') return

      // ── Media bin clip drop ──────────────────────────────────────────────
      const mediaClipId = e.dataTransfer.getData('application/klip-clip')
      if (mediaClipId) {
        const mediaClip = mediaClips.find((c) => c.id === mediaClipId)
        if (!mediaClip) return
        const startTime = computeDropTime(e.clientX)
        const dur = mediaClip.duration > 0 ? mediaClip.duration : 5

        // Video on video track → auto-create linked audio clip on a1
        if (mediaClip.type === 'video' && track.type === 'video') {
          const audioTrack = tracks.find((t) => t.type === 'audio')
          if (audioTrack) {
            const videoClipId = crypto.randomUUID()
            const audioClipId = crypto.randomUUID()
            addClips([
              {
                id: videoClipId,
                mediaClipId,
                trackId: track.id,
                startTime,
                duration: dur,
                trimStart: 0,
                type: 'video',
                name: mediaClip.name,
                thumbnail: mediaClip.thumbnail,
                linkedClipId: audioClipId
              },
              {
                id: audioClipId,
                mediaClipId,
                trackId: audioTrack.id,
                startTime,
                duration: dur,
                trimStart: 0,
                type: 'audio',
                name: mediaClip.name,
                thumbnail: null,
                linkedClipId: videoClipId
              }
            ])
            return
          }
        }

        // Default: single clip (images, color clips, audio files, or video on non-video track)
        const newClip: TimelineClip = {
          id: crypto.randomUUID(),
          mediaClipId,
          trackId: track.id,
          startTime,
          duration: dur,
          trimStart: 0,
          type: mediaClip.type === 'color' ? 'color' : mediaClip.type,
          name: mediaClip.name,
          thumbnail: mediaClip.thumbnail,
          color: mediaClip.color
        }
        addClip(newClip)
        return
      }

      // ── Music library track drop ─────────────────────────────────────────
      const musicRaw = e.dataTransfer.getData('application/klip-music')
      if (musicRaw && (track.type === 'music' || track.type === 'audio')) {
        try {
          const musicData = JSON.parse(musicRaw) as {
            id: string; filePath: string; title: string; duration: number
          }
          // Find or create a MediaClip for this file path
          let mediaClip = mediaClips.find((c) => c.path === musicData.filePath)
          if (!mediaClip) {
            const newMedia: MediaClip = {
              id:              crypto.randomUUID(),
              type:            'audio',
              path:            musicData.filePath,
              name:            musicData.title,
              duration:        musicData.duration,
              width: 0, height: 0, fps: 0, fileSize: 0,
              thumbnail:       null,
              thumbnailStatus: 'idle',
              isOnTimeline:    false,
              isMissing:       false,
              addedAt:         Date.now()
            }
            addMediaClip(newMedia)
            mediaClip = newMedia
          }
          const startTime = computeDropTime(e.clientX)
          const newClip: TimelineClip = {
            id:          crypto.randomUUID(),
            mediaClipId: mediaClip.id,
            trackId:     track.id,
            startTime,
            duration:    musicData.duration > 0 ? musicData.duration : 180,
            trimStart:   0,
            type:        'audio',
            name:        musicData.title,
            thumbnail:   null
          }
          addClip(newClip)
        } catch {}
      }
    },
    [track, tracks, mediaClips, pxPerSec, scrollLeft, snapEnabled, addClip, addClips, addMediaClip, clips] // eslint-disable-line react-hooks/exhaustive-deps
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
          (track.isMuted || track.isLocked) && 'opacity-50'
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
            icon={<span className="text-[9px] font-bold leading-none">S</span>}
          />
          {/* Lock */}
          <TrackIconButton
            onClick={() => toggleLock(track.id)}
            title={track.isLocked ? 'Unlock track' : 'Lock track'}
            active={track.isLocked}
            icon={track.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
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

      {/* ── Gap context menu ────────────────────────────────────────────── */}
      <AnimatePresence>
        {gapMenu && (
          <GapContextMenu
            x={gapMenu.x}
            y={gapMenu.y}
            onClose={() => setGapMenu(null)}
            onCloseGap={() => {
              closeGap(track.id, gapMenu.gap.startTime)
              setGapMenu(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Clip lane ───────────────────────────────────────────────────── */}
      <div
        ref={laneRef}
        className={cn(
          'relative flex-1 transition-colors duration-100',
          isDragOver && !track.isLocked
            ? 'bg-[var(--accent-glow)] ring-1 ring-inset ring-[var(--accent-dim)]'
            : 'bg-[var(--bg-base)] hover:bg-[rgba(255,255,255,0.01)]',
          (track.isMuted || track.isLocked) && 'opacity-50'
        )}
        style={{ width: contentWidth }}
        onClick={() => selectClip(null)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Subtle second-interval grid lines — only rendered in viewport */}
        <GridLines
          pxPerSec={pxPerSec}
          height={height}
          scrollLeft={scrollLeft}
          viewportWidth={containerWidth}
        />

        {/* ── Gap indicators ──────────────────────────────────────────── */}
        {gaps.map((gap) => (
          <div
            key={gap.startTime}
            className="absolute top-1 bottom-1 z-5 cursor-pointer group/gap"
            style={{ left: gap.startPx, width: Math.max(gap.widthPx, 4) }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setGapMenu({ x: e.clientX, y: e.clientY, gap })
            }}
            onClick={(e) => {
              e.stopPropagation()
              setGapMenu({ x: e.clientX, y: e.clientY, gap })
            }}
          >
            {/* Gap fill */}
            <div
              className="absolute inset-0 rounded opacity-30 group-hover/gap:opacity-60 transition-opacity duration-100"
              style={{
                background: 'repeating-linear-gradient(90deg, rgba(251,191,36,0.3) 0px, rgba(251,191,36,0.3) 2px, transparent 2px, transparent 6px)',
                borderTop: '1px solid rgba(251,191,36,0.4)',
                borderBottom: '1px solid rgba(251,191,36,0.4)'
              }}
            />
            {/* Close-gap icon — only visible when wide enough */}
            {gap.widthPx > 20 && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/gap:opacity-100 transition-opacity duration-100">
                <ArrowLeftRight size={10} className="text-amber-400" />
              </div>
            )}
          </div>
        ))}

        <AnimatePresence>
          {visibleClips.map((clip) => (
            <TimelineClipView
              key={clip.id}
              clip={clip}
              pxPerSec={pxPerSec}
              trackHeight={height}
              isSelected={selectedClipIds.includes(clip.id)}
              isPrimary={selectedClipId === clip.id}
              isLocked={track.isLocked}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Track context menu ─────────────────────────────────────────────────────

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

// ── Gap context menu ───────────────────────────────────────────────────────

function GapContextMenu({
  x,
  y,
  onClose,
  onCloseGap
}: {
  x: number
  y: number
  onClose: () => void
  onCloseGap: () => void
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
          onClick={onCloseGap}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-left text-amber-400 hover:bg-[var(--bg-elevated)] hover:text-amber-300 transition-colors duration-75"
        >
          <span className="opacity-80"><ArrowLeftRight size={13} /></span>
          Close Gap
        </button>
      </div>
    </motion.div>,
    document.body
  )
}

// ── Track icon button ──────────────────────────────────────────────────────

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

/** Subtle vertical lines at each major/minor tick position.
 *  Only renders lines inside the current viewport to avoid thousands of
 *  DOM nodes on long timelines. */
function GridLines({
  pxPerSec,
  height,
  scrollLeft,
  viewportWidth
}: {
  pxPerSec: number
  height: number
  scrollLeft: number
  viewportWidth: number
}): JSX.Element | null {
  if (pxPerSec < 10 || pxPerSec > 500) return null

  let interval = 1
  if (pxPerSec < 20) interval = 10
  else if (pxPerSec < 50) interval = 5
  else if (pxPerSec < 100) interval = 2

  // Only generate lines that fall within the visible viewport (± 1 interval buffer)
  const visStart = Math.max(0, scrollLeft / pxPerSec - interval)
  const visEnd   = (scrollLeft + viewportWidth) / pxPerSec + interval
  const firstT   = Math.ceil(visStart / interval) * interval

  const lines: number[] = []
  for (let t = firstT; t <= visEnd; t += interval) {
    if (t > 0) lines.push(t)
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
