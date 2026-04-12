import { useRef, useState, useEffect, useCallback } from 'react'
import { Minus, Plus, Maximize2, Undo2, Redo2, Magnet, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimecode } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { HEADER_WIDTH, TRACK_HEIGHT } from '@/types/timeline'
import TimelineRuler from './TimelineRuler'
import TrackRow from './TrackRow'

const RULER_HEIGHT    = 28
const MIN_PX_PER_SEC  = 2
const MAX_PX_PER_SEC  = 1000
const FRAME           = 1 / 30   // one frame at 30fps
const SCROLL_MARGIN   = 80       // px to keep playhead from viewport edge during playback

export default function Timeline(): JSX.Element {
  const {
    tracks, clips,
    playheadTime, pxPerSec,
    selectedClipId, selectedClipIds,
    isPlaying, setIsPlaying,
    snapEnabled, toggleSnap,
    loopIn, loopOut, loopEnabled,
    setLoopIn, setLoopOut, toggleLoop, clearLoop,
    past, future,
    setPlayheadTime, setPxPerSec,
    removeClip, removeSelectedClips,
    selectClip,
    splitClip,
    rippleDelete, rippleDeleteSelected,
    copySelectedClips, pasteClips,
    trimToPlayhead,
    undo, redo
  } = useTimelineStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)

  // ── Derived dimensions ────────────────────────────────────────────────────

  const lastClipEnd    = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
  const totalDuration  = Math.max(lastClipEnd + 60, 120)
  const contentWidth   = totalDuration * pxPerSec

  // ── Scroll sync ───────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0)
  }, [])

  // ── Auto-scroll during playback ───────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return
    const el = scrollRef.current
    if (!el) return

    const playheadX   = HEADER_WIDTH + playheadTime * pxPerSec
    const visibleEnd  = el.scrollLeft + el.clientWidth

    if (playheadX > visibleEnd - SCROLL_MARGIN) {
      el.scrollLeft = playheadX - HEADER_WIDTH - SCROLL_MARGIN
    }
  }, [playheadTime, isPlaying, pxPerSec])

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

      // ── Transport ──────────────────────────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
        return
      }
      // L = play, K = pause, J = seek back 10s
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); if (!isPlaying) setIsPlaying(true); return
      }
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setIsPlaying(false); return
      }
      if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setIsPlaying(false); setPlayheadTime(Math.max(0, playheadTime - 10)); return
      }

      // ── Frame step ─────────────────────────────────────────────────────
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault(); setPlayheadTime(playheadTime + FRAME); return
      }
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault(); setPlayheadTime(Math.max(0, playheadTime - FRAME)); return
      }

      // ── Trim to playhead ───────────────────────────────────────────────
      if (e.key === 'q' && !e.ctrlKey && !e.metaKey && selectedClipId) {
        e.preventDefault(); trimToPlayhead(selectedClipId, 'end'); return
      }
      if (e.key === 'w' && !e.ctrlKey && !e.metaKey && selectedClipId) {
        e.preventDefault(); trimToPlayhead(selectedClipId, 'start'); return
      }

      // ── Copy / paste ───────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        e.preventDefault(); copySelectedClips(); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault(); pasteClips(); return
      }

      // ── Editing ────────────────────────────────────────────────────────
      if (e.key === '\\' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); zoomToFit(); return
      }
      if (e.key === '\\' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); toggleSnap(); return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo(); return
      }
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault(); redo(); return
      }

      // Delete / ripple-delete — works on all selected clips
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length === 0) return
        e.preventDefault()
        if (e.shiftKey) {
          if (selectedClipIds.length > 1) rippleDeleteSelected()
          else rippleDelete(selectedClipIds[0])
        } else {
          if (selectedClipIds.length > 1) removeSelectedClips()
          else removeClip(selectedClipIds[0])
        }
        return
      }

      // Split — uses primary selected clip only
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && selectedClipId) {
        e.preventDefault(); splitClip(selectedClipId); return
      }

      // ── Loop in/out/toggle ─────────────────────────────────────────────
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setLoopIn(playheadTime); return
      }
      if (e.key === 'o' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); setLoopOut(playheadTime); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault(); toggleLoop(); return
      }
      if (e.key === 'Escape') {
        // Clear loop if it's active, otherwise let other handlers take it
        if (loopEnabled || loopIn !== null || loopOut !== null) {
          e.preventDefault(); clearLoop(); return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    isPlaying, setIsPlaying,
    playheadTime, setPlayheadTime,
    zoomToFit, undo, redo,
    selectedClipId, selectedClipIds,
    removeClip, removeSelectedClips,
    splitClip, rippleDelete, rippleDeleteSelected,
    copySelectedClips, pasteClips,
    trimToPlayhead, toggleSnap,
    loopIn, loopOut, loopEnabled,
    setLoopIn, setLoopOut, toggleLoop, clearLoop
  ])

  // ── Deselect when clicking empty space ───────────────────────────────────

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) selectClip(null)
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  const playheadPx       = HEADER_WIDTH + playheadTime * pxPerSec
  const totalTrackHeight = tracks.reduce((h, t) => h + TRACK_HEIGHT[t.type], 0)

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 h-8 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={<Undo2 size={12} />} title="Undo (Ctrl+Z)" onClick={undo} disabled={past.length === 0} />
          <ToolbarButton icon={<Redo2 size={12} />} title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={future.length === 0} />
        </div>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={<Minus size={12} />} title="Zoom out" onClick={() => setPxPerSec(pxPerSec * 0.75)} />
          <span className="text-[10px] font-mono text-[var(--text-muted)] w-12 text-center select-none">
            {pxPerSec >= 100 ? `${Math.round(pxPerSec)}px/s` : `${pxPerSec.toFixed(1)}px/s`}
          </span>
          <ToolbarButton icon={<Plus size={12} />} title="Zoom in" onClick={() => setPxPerSec(pxPerSec * 1.35)} />
          <ToolbarButton icon={<Maximize2 size={11} />} title="Zoom to fit (\)" onClick={zoomToFit} />
        </div>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        {/* Snap toggle */}
        <ToolbarButton
          icon={<Magnet size={11} />}
          title={snapEnabled ? 'Snapping on (Ctrl+\\)' : 'Snapping off (Ctrl+\\)'}
          onClick={toggleSnap}
          active={snapEnabled}
        />

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        {/* Loop toggle */}
        <ToolbarButton
          icon={<Repeat size={11} />}
          title={loopEnabled ? 'Loop on (Ctrl+L) — I to set in, O to set out' : 'Loop off (Ctrl+L)'}
          onClick={toggleLoop}
          active={loopEnabled}
        />
        {(loopIn !== null || loopOut !== null) && (
          <span className="text-[10px] font-mono text-[var(--accent-bright)] select-none">
            {loopIn !== null ? formatTimecode(loopIn).slice(0, 7) : '--:--'} – {loopOut !== null ? formatTimecode(loopOut).slice(0, 7) : '--:--'}
          </span>
        )}

        <div className="flex-1" />

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
        <div style={{ minWidth: HEADER_WIDTH + contentWidth }}>
          {/* ── Ruler ──────────────────────────────────────────────────── */}
          <div
            className="flex border-b border-[var(--border)] shrink-0"
            style={{ height: RULER_HEIGHT, minWidth: HEADER_WIDTH + contentWidth }}
          >
            <div
              className="shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)] z-10"
              style={{ width: HEADER_WIDTH, position: 'sticky', left: 0 }}
            />
            <TimelineRuler
              pxPerSec={pxPerSec}
              totalDuration={totalDuration}
              playheadTime={playheadTime}
              scrollLeft={scrollLeft}
              onScrub={setPlayheadTime}
              onScrubStart={() => { setIsPlaying(false); setIsScrubbing(true) }}
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
              selectedClipIds={selectedClipIds}
            />
          ))}

          {clips.length === 0 && (
            <div className="flex pointer-events-none py-4">
              <div style={{ width: HEADER_WIDTH, flexShrink: 0 }} />
              <p className="text-xs text-[var(--text-muted)] px-4">
                Drag clips from the Media Bin to start editing
              </p>
            </div>
          )}
        </div>

        {/* ── Loop region overlay ─────────────────────────────────────────── */}
        {loopIn !== null && loopOut !== null && loopOut > loopIn && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left:   HEADER_WIDTH + loopIn  * pxPerSec,
              width:  (loopOut - loopIn) * pxPerSec,
              top:    RULER_HEIGHT,
              height: totalTrackHeight,
              backgroundColor: loopEnabled ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.06)',
              borderLeft:  '1px solid rgba(168,85,247,0.6)',
              borderRight: '1px solid rgba(168,85,247,0.6)'
            }}
          />
        )}

        {/* ── Playhead line ──────────────────────────────────────────────── */}
        <div
          className={cn(
            'absolute top-0 w-px pointer-events-none z-20 transition-none',
            isScrubbing ? 'bg-[var(--accent-bright)]' : 'bg-[var(--accent)]'
          )}
          style={{ left: playheadPx, top: RULER_HEIGHT, height: totalTrackHeight }}
        />
      </div>
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────

function ToolbarButton({
  icon, title, onClick, disabled = false, active = false
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center justify-center w-6 h-6 rounded transition-colors duration-75 active:scale-90',
        active
          ? 'text-[var(--accent-light)] bg-[var(--accent-glow)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
        'disabled:opacity-30 disabled:cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  )
}
