import { useRef, useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Maximize2, Undo2, Redo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimelineStore } from '@/stores/timelineStore'
import { HEADER_WIDTH, TRACK_HEIGHT } from '@/types/timeline'
import TimelineRuler from './TimelineRuler'
import TrackRow from './TrackRow'

const RULER_HEIGHT = 28
const MIN_PX_PER_SEC = 2
const MAX_PX_PER_SEC = 1000

export default function Timeline(): JSX.Element {
  const {
    tracks, clips,
    playheadTime, pxPerSec,
    selectedClipId,
    past, future,
    setPlayheadTime, setPxPerSec,
    removeClip, selectClip,
    splitClip, rippleDelete,
    undo, redo
  } = useTimelineStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)

  // ── Derived dimensions ────────────────────────────────────────────────────

  const lastClipEnd = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
  const totalDuration = Math.max(lastClipEnd + 60, 120)
  const contentWidth = totalDuration * pxPerSec

  // ── Scroll sync ───────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0)
  }, [])

  // ── Wheel: horizontal scroll OR zoom ─────────────────────────────────────

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.85 : 1.18
        setPxPerSec(Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, pxPerSec * factor)))
      } else {
        // Reroute vertical scroll → horizontal scroll
        e.preventDefault()
        el!.scrollLeft += e.deltaY + e.deltaX
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el!.removeEventListener('wheel', handleWheel)
  }, [pxPerSec, setPxPerSec])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const zoomToFit = useCallback(() => {
    const visibleWidth = (scrollRef.current?.clientWidth ?? 800) - HEADER_WIDTH
    const newPps = Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, visibleWidth / totalDuration))
    setPxPerSec(newPps)
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
  }, [totalDuration, setPxPerSec])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === '\\') { e.preventDefault(); zoomToFit(); return }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo(); return
      }
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault(); redo(); return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        e.preventDefault()
        if (e.shiftKey) rippleDelete(selectedClipId)
        else removeClip(selectedClipId)
        return
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && selectedClipId) {
        e.preventDefault(); splitClip(selectedClipId); return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [zoomToFit, undo, redo, selectedClipId, removeClip, splitClip, rippleDelete])

  // ── Deselect when clicking empty space ───────────────────────────────────

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) selectClip(null)
  }

  // ── Playhead line position ────────────────────────────────────────────────
  // Left offset within the scrollable content area (not the viewport)
  const playheadPx = HEADER_WIDTH + playheadTime * pxPerSec

  const totalTrackHeight = tracks.reduce((h, t) => h + TRACK_HEIGHT[t.type], 0)

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 h-8 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Undo2 size={12} />}
            title="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={past.length === 0}
          />
          <ToolbarButton
            icon={<Redo2 size={12} />}
            title="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={future.length === 0}
          />
        </div>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<Minus size={12} />}
            title="Zoom out"
            onClick={() => setPxPerSec(pxPerSec * 0.75)}
          />
          <span className="text-[10px] font-mono text-[var(--text-muted)] w-12 text-center select-none">
            {pxPerSec >= 100
              ? `${Math.round(pxPerSec)}px/s`
              : `${pxPerSec.toFixed(1)}px/s`}
          </span>
          <ToolbarButton
            icon={<Plus size={12} />}
            title="Zoom in"
            onClick={() => setPxPerSec(pxPerSec * 1.35)}
          />
          <ToolbarButton
            icon={<Maximize2 size={11} />}
            title="Zoom to fit (\)"
            onClick={zoomToFit}
          />
        </div>

        <div className="flex-1" />

        {/* Playhead time display */}
        <span className="text-[10px] font-mono text-[var(--text-muted)] select-none">
          {formatTimecode(playheadTime)}
        </span>
      </div>

      {/* ── Scrollable timeline body ──────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto relative"
        onScroll={handleScroll}
        onClick={handleContainerClick}
      >
        {/* Inner container — wide enough for all content */}
        <div style={{ minWidth: HEADER_WIDTH + contentWidth }}>
          {/* ── Ruler row ──────────────────────────────────────────────── */}
          <div
            className="flex border-b border-[var(--border)] shrink-0"
            style={{ height: RULER_HEIGHT, minWidth: HEADER_WIDTH + contentWidth }}
          >
            {/* Corner cell */}
            <div
              className="shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)] z-10"
              style={{ width: HEADER_WIDTH, position: 'sticky', left: 0 }}
            />
            {/* Ruler */}
            <TimelineRuler
              pxPerSec={pxPerSec}
              totalDuration={totalDuration}
              playheadTime={playheadTime}
              scrollLeft={scrollLeft}
              onScrub={setPlayheadTime}
              onScrubStart={() => setIsScrubbing(true)}
              onScrubEnd={() => setIsScrubbing(false)}
            />
          </div>

          {/* ── Track rows ─────────────────────────────────────────────── */}
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              clips={clips.filter((c) => c.trackId === track.id)}
              pxPerSec={pxPerSec}
              scrollLeft={scrollLeft}
              contentWidth={contentWidth}
              selectedClipId={selectedClipId}
            />
          ))}

          {/* Empty-state hint */}
          {clips.length === 0 && (
            <div className="flex pointer-events-none py-4">
              <div style={{ width: HEADER_WIDTH, flexShrink: 0 }} />
              <p className="text-xs text-[var(--text-muted)] px-4">
                Drag clips from the Media Bin to start editing
              </p>
            </div>
          )}
        </div>

        {/* ── Playhead line (inside scroll container, full track height) ── */}
        <div
          className={cn(
            'absolute top-0 w-px pointer-events-none z-20 transition-none',
            isScrubbing ? 'bg-[var(--accent-bright)]' : 'bg-[var(--accent)]'
          )}
          style={{
            left: playheadPx,
            // Start below ruler, span all tracks
            top: RULER_HEIGHT,
            height: totalTrackHeight
          }}
        />
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  title,
  onClick,
  disabled = false
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-75 active:scale-90"
    >
      {icon}
    </button>
  )
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 30) // 30fps frames
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
}
