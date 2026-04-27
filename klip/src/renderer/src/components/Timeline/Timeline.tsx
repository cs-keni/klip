import { useRef, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, Maximize2, Undo2, Redo2, Magnet, Repeat, Timer, Film, Music, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTimecode } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { useMediaStore } from '@/stores/mediaStore'
import { toast } from '@/stores/toastStore'
import { HEADER_WIDTH, TRACK_HEIGHT } from '@/types/timeline'
import type { TrackType } from '@/types/timeline'
import { subscribeSnapTime } from '@/lib/snapIndicator'
import { markRipple } from '@/lib/rippleSignal'
import { flashCopy } from '@/lib/copyFlash'
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
    shuttleSpeed, setShuttleSpeed,
    snapEnabled, toggleSnap,
    loopIn, loopOut, loopEnabled,
    setLoopIn, setLoopOut, toggleLoop, clearLoop,
    past, future,
    setPlayheadTime, setPxPerSec,
    removeClip, removeSelectedClips,
    selectClip,
    splitClip,
    rippleDelete, rippleDeleteSelected,
    copySelectedClips, pasteClips, pasteClipsWithRipple,
    trimToPlayhead,
    undo, redo,
    markers, addMarker, removeMarker, updateMarkerLabel,
    addTrack, selectClip: selectClipStore
  } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const minimapRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [containerWidth, setContainerWidth] = useState(800)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [rulerFormat, setRulerFormat] = useState<'seconds' | 'timecode'>('seconds')

  // ── Lasso selection state ─────────────────────────────────────────────────
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const lassoStartRef = useRef<{ x: number; y: number; scrollLeft: number } | null>(null)

  // ── Audio scrub ────────────────────────────────────────────────────────────
  const scrubCtxRef = useRef<AudioContext | null>(null)
  const scrubBufferCache = useRef<Map<string, AudioBuffer>>(new Map())
  const scrubSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const lastScrubRef = useRef(0)
  const [showAddTrack, setShowAddTrack] = useState(false)

  useEffect(() => {
    if (!showAddTrack) return
    function onDown() { setShowAddTrack(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showAddTrack])

  // ── Smooth zoom animation ─────────────────────────────────────────────────
  // displayPxPerSec lerps toward the store's pxPerSec (the target) each rAF.
  // All rendering uses displayPxPerSec; store operations still use pxPerSec.

  const displayPxPerSecRef = useRef(pxPerSec)
  const [displayPxPerSec, setDisplayPxPerSec] = useState(pxPerSec)
  // When zooming with the wheel, we record what timeline time is under the cursor
  // so we can keep it anchored as displayPxPerSec animates toward the target.
  const zoomAnchorRef = useRef<{ time: number; mouseX: number } | null>(null)
  const zoomAnimRafRef = useRef<number | null>(null)

  useEffect(() => {
    if (zoomAnimRafRef.current !== null) cancelAnimationFrame(zoomAnimRafRef.current)

    function step(): void {
      const cur = displayPxPerSecRef.current
      const diff = pxPerSec - cur

      if (Math.abs(diff) < 0.05) {
        displayPxPerSecRef.current = pxPerSec
        setDisplayPxPerSec(pxPerSec)
        if (zoomAnchorRef.current && scrollRef.current) {
          scrollRef.current.scrollLeft = Math.max(
            0,
            zoomAnchorRef.current.time * pxPerSec - zoomAnchorRef.current.mouseX
          )
        }
        zoomAnchorRef.current = null
        zoomAnimRafRef.current = null
        return
      }

      const next = cur + diff * 0.2
      displayPxPerSecRef.current = next
      setDisplayPxPerSec(next)

      // Keep the anchor point (time under cursor) locked during animation
      if (zoomAnchorRef.current && scrollRef.current) {
        scrollRef.current.scrollLeft = Math.max(
          0,
          zoomAnchorRef.current.time * next - zoomAnchorRef.current.mouseX
        )
      }

      zoomAnimRafRef.current = requestAnimationFrame(step)
    }

    zoomAnimRafRef.current = requestAnimationFrame(step)
    return () => {
      if (zoomAnimRafRef.current !== null) cancelAnimationFrame(zoomAnimRafRef.current)
    }
  }, [pxPerSec])

  // ── Scroll momentum ───────────────────────────────────────────────────────

  const scrollVelRef   = useRef(0)
  const scrollMomRafRef = useRef<number | null>(null)

  // ── Derived dimensions ────────────────────────────────────────────────────

  const lastClipEnd    = clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
  const totalDuration  = Math.max(lastClipEnd + 60, 120)
  const contentWidth   = totalDuration * displayPxPerSec

  // ── Scroll sync ───────────────────────────────────────────────────────────

  const handleScroll = useCallback(() => {
    setScrollLeft(scrollRef.current?.scrollLeft ?? 0)
  }, [])

  // ── Container width tracking (for virtualization) ─────────────────────────

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Seed initial width
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Snap indicator ────────────────────────────────────────────────────────
  // TimelineClipView publishes the snapped time (seconds) while dragging near
  // a snap point. We subscribe here and render a hairline across all tracks.

  const [snapIndicatorTime, setSnapIndicatorTime] = useState<number | null>(null)

  useEffect(() => subscribeSnapTime(setSnapIndicatorTime), [])

  // ── Auto-scroll during playback ───────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return
    const el = scrollRef.current
    if (!el) return

    const playheadX   = HEADER_WIDTH + playheadTime * displayPxPerSecRef.current
    const visibleEnd  = el.scrollLeft + el.clientWidth

    if (playheadX > visibleEnd - SCROLL_MARGIN) {
      el.scrollLeft = playheadX - HEADER_WIDTH - SCROLL_MARGIN
    }
  }, [playheadTime, isPlaying, pxPerSec])

  // ── Wheel: horizontal scroll (with momentum) OR zoom (cursor-anchored) ───

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function runMomentum(): void {
      scrollVelRef.current *= 0.85
      if (!scrollRef.current || Math.abs(scrollVelRef.current) < 0.5) {
        scrollVelRef.current = 0
        scrollMomRafRef.current = null
        return
      }
      scrollRef.current.scrollLeft += scrollVelRef.current
      scrollMomRafRef.current = requestAnimationFrame(runMomentum)
    }

    function handleWheel(e: WheelEvent): void {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.85 : 1.18
        const newPps = Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, pxPerSec * factor))

        // Record cursor anchor: what timeline time is under the cursor right now
        const rect = el.getBoundingClientRect()
        const mouseX = e.clientX - rect.left - HEADER_WIDTH
        if (mouseX > 0) {
          zoomAnchorRef.current = {
            time: (el.scrollLeft + mouseX) / displayPxPerSecRef.current,
            mouseX
          }
        }

        setPxPerSec(newPps)
      } else {
        e.preventDefault()
        // Kill any ongoing momentum and start a new one seeded from this delta
        if (scrollMomRafRef.current !== null) cancelAnimationFrame(scrollMomRafRef.current)
        const delta = e.deltaX + e.deltaY
        el.scrollLeft += delta
        scrollVelRef.current = delta * 0.45
        scrollMomRafRef.current = requestAnimationFrame(runMomentum)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      if (scrollMomRafRef.current !== null) cancelAnimationFrame(scrollMomRafRef.current)
    }
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
      // Command palette — Ctrl+K works everywhere (even inside inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        useCommandPaletteStore.getState().toggle()
        return
      }

      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // ── Transport ──────────────────────────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault()
        // Space always cancels shuttle and toggles normal play/pause
        if (shuttleSpeed !== 0) { setShuttleSpeed(0); setIsPlaying(false) }
        else { setIsPlaying(!isPlaying) }
        return
      }
      // J/K/L shuttle — escalating speed machine
      // L: forward 1x → 2x → 4x; J: reverse 1x → 2x → 4x; K: stop
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const next = shuttleSpeed <= 0 ? 1 : shuttleSpeed === 1 ? 2 : shuttleSpeed === 2 ? 4 : 4
        setShuttleSpeed(next)
        setIsPlaying(true)
        return
      }
      if (e.key === 'k' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setShuttleSpeed(0)
        setIsPlaying(false)
        return
      }
      if (e.key === 'j' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const next = shuttleSpeed >= 0 ? -1 : shuttleSpeed === -1 ? -2 : shuttleSpeed === -2 ? -4 : -4
        setShuttleSpeed(next)
        setIsPlaying(true)
        return
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
        e.preventDefault()
        copySelectedClips()
        const { selectedClipIds } = useTimelineStore.getState()
        if (selectedClipIds.length > 0) {
          flashCopy(selectedClipIds)
          toast(selectedClipIds.length === 1 ? 'Clip copied' : `${selectedClipIds.length} clips copied`, 'info', 1800)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault(); pasteClips(); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'V' && e.shiftKey) {
        e.preventDefault(); pasteClipsWithRipple(); return
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
          // Mark ripple BEFORE the store update so the spring delay fires correctly
          markRipple()
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

      // Marker — drop a pin at the playhead
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        addMarker(playheadTime)
        toast(`Marker at ${formatTimecode(playheadTime).slice(3, 8)}`, 'info', 1800)
        return
      }

      // Navigate to previous/next marker
      if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const { markers: currentMarkers, playheadTime: ph } = useTimelineStore.getState()
        const prev = [...currentMarkers]
          .sort((a, b) => b.time - a.time)
          .find((mk) => mk.time < ph - 0.01)
        if (prev !== undefined) setPlayheadTime(prev.time)
        return
      }
      if (e.key === ']' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const { markers: currentMarkers, playheadTime: ph } = useTimelineStore.getState()
        const next = [...currentMarkers]
          .sort((a, b) => a.time - b.time)
          .find((mk) => mk.time > ph + 0.01)
        if (next !== undefined) setPlayheadTime(next.time)
        return
      }

      // Zoom to selection (Shift+\)
      if (e.key === '|' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        const { clips: currentClips, selectedClipIds: selIds } = useTimelineStore.getState()
        const selClips = currentClips.filter((c) => selIds.includes(c.id))
        if (selClips.length > 0) {
          const selStart = Math.min(...selClips.map((c) => c.startTime))
          const selEnd   = Math.max(...selClips.map((c) => c.startTime + c.duration))
          const selDur   = selEnd - selStart
          if (selDur > 0.01) {
            const visibleWidth = (scrollRef.current?.clientWidth ?? 800) - HEADER_WIDTH
            const newPps = Math.max(MIN_PX_PER_SEC, Math.min(MAX_PX_PER_SEC, visibleWidth / selDur))
            setPxPerSec(newPps)
            const scrollLeft = Math.max(0, selStart * newPps - HEADER_WIDTH - 40)
            scrollRef.current?.scrollTo({ left: scrollLeft, behavior: 'smooth' })
          }
        } else {
          zoomToFit()
        }
        return
      }

      // Go to next / previous edit point (clip boundary)
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        const { clips: currentClips, playheadTime: ph } = useTimelineStore.getState()
        const boundaries = [...new Set([
          0,
          ...currentClips.map((c) => c.startTime),
          ...currentClips.map((c) => c.startTime + c.duration)
        ])].sort((a, b) => a - b)
        if (e.key === 'ArrowDown') {
          const next = boundaries.find((b) => b > ph + 0.01)
          if (next !== undefined) setPlayheadTime(next)
        } else {
          const prev = [...boundaries].reverse().find((b) => b < ph - 0.01)
          if (prev !== undefined) setPlayheadTime(prev)
        }
        return
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
    shuttleSpeed, setShuttleSpeed,
    playheadTime, setPlayheadTime,
    zoomToFit, undo, redo,
    selectedClipId, selectedClipIds,
    removeClip, removeSelectedClips,
    splitClip, rippleDelete, rippleDeleteSelected,
    copySelectedClips, pasteClips, pasteClipsWithRipple,
    trimToPlayhead, toggleSnap,
    loopIn, loopOut, loopEnabled,
    setLoopIn, setLoopOut, toggleLoop, clearLoop,
    addMarker, zoomToFit, setPxPerSec
  ])

  // ── Deselect when clicking empty space ───────────────────────────────────

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) selectClipStore(null)
  }

  // ── Lasso selection ───────────────────────────────────────────────────────

  function handleLassoPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only start on left-button clicks on the content area itself (not on clips)
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-clip-id]') || target.closest('[data-track]')) return
    // Don't start lasso on ruler
    const rect = scrollRef.current!.getBoundingClientRect()
    const relY = e.clientY - rect.top
    if (relY < RULER_HEIGHT) return

    lassoStartRef.current = {
      x: e.clientX - rect.left + scrollRef.current!.scrollLeft,
      y: e.clientY - rect.top  + scrollRef.current!.scrollTop,
      scrollLeft: scrollRef.current!.scrollLeft
    }

    const onMove = (ev: PointerEvent) => {
      if (!lassoStartRef.current) return
      const curX = ev.clientX - rect.left + scrollRef.current!.scrollLeft
      const curY = ev.clientY - rect.top  + scrollRef.current!.scrollTop
      setLasso({
        x1: Math.min(lassoStartRef.current.x, curX),
        y1: Math.min(lassoStartRef.current.y, curY),
        x2: Math.max(lassoStartRef.current.x, curX),
        y2: Math.max(lassoStartRef.current.y, curY)
      })
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!lassoStartRef.current) { setLasso(null); return }

      const curX = ev.clientX - rect.left + scrollRef.current!.scrollLeft
      const curY = ev.clientY - rect.top  + scrollRef.current!.scrollTop
      const lx1 = Math.min(lassoStartRef.current.x, curX)
      const lx2 = Math.max(lassoStartRef.current.x, curX)
      const ly1 = Math.min(lassoStartRef.current.y, curY)
      const ly2 = Math.max(lassoStartRef.current.y, curY)

      if (lx2 - lx1 > 4 && ly2 - ly1 > 4) {
        // Compute which clips intersect
        let trackTop = RULER_HEIGHT
        const selected: string[] = []
        for (const track of tracks) {
          const h = track.isCollapsed ? 18 : TRACK_HEIGHT[track.type]
          const trackBottom = trackTop + h
          const trackClips = clips.filter((c) => c.trackId === track.id)
          for (const clip of trackClips) {
            const clipLeft  = HEADER_WIDTH + clip.startTime * displayPxPerSecRef.current
            const clipRight = HEADER_WIDTH + (clip.startTime + clip.duration) * displayPxPerSecRef.current
            if (clipLeft < lx2 && clipRight > lx1 && trackTop < ly2 && trackBottom > ly1) {
              selected.push(clip.id)
            }
          }
          trackTop = trackBottom
        }
        if (selected.length > 0) {
          useTimelineStore.setState({
            selectedClipIds: selected,
            selectedClipId: selected[0]
          })
        }
      }
      lassoStartRef.current = null
      setLasso(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Audio scrubbing ───────────────────────────────────────────────────────

  async function playScrubSlice(time: number) {
    const now = Date.now()
    if (now - lastScrubRef.current < 60) return
    lastScrubRef.current = now

    const ctx = scrubCtxRef.current ?? (() => {
      const c = new AudioContext()
      scrubCtxRef.current = c
      return c
    })()

    // Find an audio or video clip at this time
    const audioClip = clips.find((c) =>
      (c.type === 'audio' || c.type === 'video') &&
      c.startTime <= time && c.startTime + c.duration >= time
    )
    if (!audioClip) return
    const mc = mediaClips.find((m) => m.id === audioClip.mediaClipId)
    if (!mc?.path) return

    const path = mc.path

    if (!scrubBufferCache.current.has(path)) {
      try {
        const { pathToFileUrl } = await import('@/lib/mediaUtils')
        const resp = await fetch(pathToFileUrl(path))
        const ab = await resp.arrayBuffer()
        const buffer = await ctx.decodeAudioData(ab)
        scrubBufferCache.current.set(path, buffer)
      } catch { return }
    }

    const buffer = scrubBufferCache.current.get(path)!
    if (scrubSourceRef.current) {
      try { scrubSourceRef.current.stop() } catch { /* already stopped */ }
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    const offsetInMedia = audioClip.trimStart + (time - audioClip.startTime) * (audioClip.speed ?? 1)
    const safeOffset = Math.max(0, Math.min(offsetInMedia, buffer.duration - 0.08))
    src.start(0, safeOffset, 0.08)
    scrubSourceRef.current = src
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  const playheadPx       = HEADER_WIDTH + playheadTime * displayPxPerSec
  const totalTrackHeight = tracks.reduce((h, t) => h + (t.isCollapsed ? 18 : TRACK_HEIGHT[t.type]), 0)

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

        {/* Ruler format toggle */}
        <ToolbarButton
          icon={<Timer size={11} />}
          title={rulerFormat === 'seconds' ? 'Switch to timecode (HH:MM:SS:FF)' : 'Switch to seconds'}
          onClick={() => setRulerFormat((f) => f === 'seconds' ? 'timecode' : 'seconds')}
          active={rulerFormat === 'timecode'}
        />

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

        <span className="text-[10px] font-mono text-[var(--text-muted)] select-none">
          {formatTimecode(playheadTime)}
        </span>
      </div>

      {/* ── Minimap ──────────────────────────────────────────────────────── */}
      <TimelineMinimap
        clips={clips}
        tracks={tracks}
        totalDuration={totalDuration}
        scrollLeft={scrollLeft}
        containerWidth={containerWidth - HEADER_WIDTH}
        pxPerSec={displayPxPerSec}
        contentWidth={contentWidth}
        onScrollTo={(sl) => { if (scrollRef.current) scrollRef.current.scrollLeft = sl }}
      />

      {/* ── Scrollable timeline body ──────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-auto relative"
        onScroll={handleScroll}
        onClick={handleContainerClick}
        onPointerDown={handleLassoPointerDown}
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
              pxPerSec={displayPxPerSec}
              totalDuration={totalDuration}
              playheadTime={playheadTime}
              scrollLeft={scrollLeft}
              onScrub={(t) => { setPlayheadTime(t); playScrubSlice(t) }}
              onScrubStart={() => { setIsPlaying(false); setIsScrubbing(true) }}
              onScrubEnd={() => setIsScrubbing(false)}
              markers={markers}
              onAddMarker={(t) => addMarker(t)}
              onRemoveMarker={removeMarker}
              onUpdateMarkerLabel={updateMarkerLabel}
              onUpdateMarkerColor={(id, color) => useTimelineStore.getState().updateMarkerColor(id, color)}
              format={rulerFormat}
            />
          </div>

          {/* ── Track rows ─────────────────────────────────────────────── */}
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              clips={clips.filter((c) => c.trackId === track.id)}
              pxPerSec={displayPxPerSec}
              scrollLeft={scrollLeft}
              contentWidth={contentWidth}
              containerWidth={containerWidth}
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

          {/* ── Add Track row ───────────────────────────────────────────── */}
          <div
            className="flex items-center border-b border-[var(--border-subtle)]"
            style={{ height: 28, minWidth: HEADER_WIDTH + contentWidth }}
          >
            <div
              className="shrink-0 flex items-center px-2 gap-1 z-10 bg-[var(--bg-surface)]"
              style={{ width: HEADER_WIDTH, position: 'sticky', left: 0 }}
            >
              <div className="relative">
                <button
                  onClick={() => setShowAddTrack((v) => !v)}
                  title="Add track"
                  className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-light)] transition-colors duration-75"
                >
                  <Plus size={11} />
                  <span>Add Track</span>
                </button>
                <AnimatePresence>
                  {showAddTrack && (
                    <motion.div
                      className="absolute bottom-full mb-1 left-0 z-[9999] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-overlay)] shadow-xl min-w-[140px]"
                      initial={{ opacity: 0, scale: 0.94, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 4 }}
                      transition={{ duration: 0.1, ease: 'easeOut' }}
                    >
                      {([
                        { type: 'video' as TrackType, label: 'Video', icon: <Film size={11} /> },
                        { type: 'audio' as TrackType, label: 'Audio', icon: <Mic size={11} /> },
                        { type: 'music' as TrackType, label: 'Music', icon: <Music size={11} /> }
                      ]).map(({ type, label, icon }) => (
                        <button
                          key={type}
                          onClick={() => { addTrack(type); setShowAddTrack(false) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors duration-75"
                        >
                          <span className="opacity-70">{icon}</span>
                          {label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* ── Lasso selection rect ─────────────────────────────────────────── */}
        {lasso && (
          <div
            className="absolute pointer-events-none z-40"
            style={{
              left:   lasso.x1 - (scrollRef.current?.scrollLeft ?? 0),
              top:    lasso.y1 - (scrollRef.current?.scrollTop ?? 0),
              width:  lasso.x2 - lasso.x1,
              height: lasso.y2 - lasso.y1,
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.6)',
              borderRadius: 3
            }}
          />
        )}

        {/* ── Loop region overlay ─────────────────────────────────────────── */}
        {loopIn !== null && loopOut !== null && loopOut > loopIn && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left:   HEADER_WIDTH + loopIn  * displayPxPerSec,
              width:  (loopOut - loopIn) * displayPxPerSec,
              top:    RULER_HEIGHT,
              height: totalTrackHeight,
              backgroundColor: loopEnabled ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.06)',
              borderLeft:  '1px solid rgba(168,85,247,0.6)',
              borderRight: '1px solid rgba(168,85,247,0.6)'
            }}
          />
        )}

        {/* ── Snap indicator line ────────────────────────────────────────── */}
        <AnimatePresence>
          {snapIndicatorTime !== null && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left:    HEADER_WIDTH + snapIndicatorTime * displayPxPerSec,
                top:     RULER_HEIGHT,
                height:  totalTrackHeight,
                width:   1,
                zIndex:  25
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08 }}
            >
              {/* Hairline */}
              <div
                className="absolute inset-0"
                style={{ background: 'rgba(250, 204, 21, 0.75)' }}
              />
              {/* Diamond cap at top */}
              <div
                className="absolute -translate-x-[3px]"
                style={{
                  top: -4,
                  width: 7,
                  height: 7,
                  background: 'rgba(250, 204, 21, 0.9)',
                  transform: 'translateX(-3px) rotate(45deg)'
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

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

// ── Timeline Minimap ────────────────────────────────────────────────────────

const CLIP_MINI_COLOR: Record<string, string> = {
  video:   '#a78bfa',
  audio:   '#60a5fa',
  image:   '#22d3ee',
  color:   '#71717a',
  music:   '#4ade80',
  text:    '#22d3ee'
}

function TimelineMinimap({
  clips, tracks, totalDuration, scrollLeft, containerWidth, pxPerSec, contentWidth, onScrollTo
}: {
  clips: import('@/types/timeline').TimelineClip[]
  tracks: import('@/types/timeline').Track[]
  totalDuration: number
  scrollLeft: number
  containerWidth: number
  pxPerSec: number
  contentWidth: number
  onScrollTo: (sl: number) => void
}): JSX.Element | null {
  if (totalDuration <= 0) return null
  const mmRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const viewportFrac  = Math.min(1, (containerWidth) / Math.max(1, contentWidth))
  const viewportLeft  = (scrollLeft / Math.max(1, contentWidth)) * (1 - viewportFrac > 0 ? 1 : 1)
  const scrollRatio   = contentWidth > containerWidth ? scrollLeft / (contentWidth - containerWidth) : 0
  const vpW = viewportFrac * 100
  const vpL = scrollRatio * (100 - vpW)

  function seekFromMouse(clientX: number) {
    const rect = mmRef.current?.getBoundingClientRect()
    if (!rect) return
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const targetScrollLeft = frac * contentWidth - containerWidth / 2
    onScrollTo(Math.max(0, targetScrollLeft))
  }

  function handlePointerDown(e: React.PointerEvent) {
    isDragging.current = true
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    seekFromMouse(e.clientX)
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    seekFromMouse(e.clientX)
  }
  function handlePointerUp() {
    isDragging.current = false
  }

  return (
    <div
      ref={mmRef}
      className="shrink-0 bg-[var(--bg-base)] border-b border-[var(--border-subtle)] relative cursor-pointer select-none overflow-hidden"
      style={{ height: 22 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header offset blank */}
      <div className="absolute top-0 bottom-0 left-0 bg-[var(--bg-surface)] z-10 pointer-events-none"
        style={{ width: HEADER_WIDTH }} />

      {/* Clip blocks */}
      {clips.map((clip) => (
        <div
          key={clip.id}
          className="absolute top-2 bottom-2 rounded-sm pointer-events-none"
          style={{
            left:  HEADER_WIDTH + (clip.startTime / totalDuration) * (mmRef.current?.clientWidth ? mmRef.current.clientWidth - HEADER_WIDTH : 500),
            width: Math.max(2, (clip.duration / totalDuration) * (mmRef.current?.clientWidth ? mmRef.current.clientWidth - HEADER_WIDTH : 500)),
            background: clip.labelColor ?? CLIP_MINI_COLOR[clip.type] ?? '#a78bfa',
            opacity: 0.7
          }}
        />
      ))}

      {/* Viewport window */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-10"
        style={{
          left:  `calc(${HEADER_WIDTH}px + ${vpL}% * (100% - ${HEADER_WIDTH}px) / 100)`,
          width: `calc(${vpW}% * (100% - ${HEADER_WIDTH}px) / 100)`,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 2
        }}
      />
    </div>
  )
}
