import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useWaveform } from '@/hooks/useWaveform'
import WaveformCanvas from './WaveformCanvas'
import type { TimelineClip } from '@/types/timeline'

interface TimelineClipViewProps {
  clip: TimelineClip
  pxPerSec: number
  trackHeight: number
  isSelected: boolean
}

const CLIP_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  video: { bg: 'rgba(109, 40, 217, 0.88)', border: '#a78bfa', text: '#ede9fe' },
  audio: { bg: 'rgba(29,  78, 216, 0.88)', border: '#93c5fd', text: '#dbeafe' },
  image: { bg: 'rgba(6,  120, 155, 0.88)', border: '#67e8f9', text: '#cffafe' },
  color: { bg: 'rgba(30,  30,  46, 0.92)', border: '#52525b', text: '#d4d4d8' },
  music: { bg: 'rgba(15, 118,  54, 0.88)', border: '#86efac', text: '#dcfce7' }
}

const EDGE_HIT   = 8    // px width of trim handle hit area
const MIN_DUR    = 0.1  // minimum clip duration in seconds
const MIN_LABEL  = 32   // px below which we hide the label
const SNAP_PX    = 8    // snap threshold in screen pixels
const PADDING    = 4    // vertical padding within track lane

type DragMode = 'move' | 'trim-left' | 'trim-right'

interface DragState {
  mode: DragMode
  startX: number
  origStart: number
  origDuration: number
  origTrimStart: number
}

export default function TimelineClipView({
  clip,
  pxPerSec,
  trackHeight,
  isSelected
}: TimelineClipViewProps): JSX.Element {
  const { clips, playheadTime, moveClip, trimClip, selectClip, setClipVolume } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  const mediaClip = mediaClips.find((m) => m.id === clip.mediaClipId) ?? null

  // ── Waveform (audio clips only) ─────────────────────────────────────────────
  const { peaks } = useWaveform(mediaClip?.path ?? null, clip.type)

  // ── Motion values drive left/width for 60fps drag without React re-renders ──
  const leftMV  = useMotionValue(clip.startTime * pxPerSec)
  const widthMV = useMotionValue(Math.max(2, clip.duration * pxPerSec))

  // Sync when the store updates (undo/redo, external changes)
  const isDragging = useRef(false)
  useEffect(() => {
    if (!isDragging.current) {
      leftMV.set(clip.startTime * pxPerSec)
      widthMV.set(Math.max(2, clip.duration * pxPerSec))
    }
  }, [clip.startTime, clip.duration, pxPerSec, leftMV, widthMV])

  const style     = CLIP_STYLE[clip.type] ?? CLIP_STYLE.video
  const bg        = clip.type === 'color' && clip.color ? clip.color + 'dd' : style.bg
  const clipHeight = trackHeight - PADDING * 2
  const dispWidth  = clip.duration * pxPerSec   // for label visibility (from store, not MV)
  const showLabel  = dispWidth >= MIN_LABEL

  // ── Context menu ────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // ── Snap helpers ────────────────────────────────────────────────────────────

  function buildSnapPoints(): number[] {
    const pts: number[] = [0, playheadTime]
    for (const c of clips) {
      if (c.id === clip.id) continue
      pts.push(c.startTime, c.startTime + c.duration)
    }
    return pts
  }

  function snapTime(t: number, pts: number[]): number {
    const threshold = SNAP_PX / pxPerSec
    let best = t, bestDist = threshold
    for (const p of pts) {
      const d = Math.abs(t - p)
      if (d < bestDist) { bestDist = d; best = p }
    }
    return best
  }

  // ── Drag ────────────────────────────────────────────────────────────────────

  function startDrag(e: React.PointerEvent, mode: DragMode) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    selectClip(clip.id)
    isDragging.current = true

    const drag: DragState = {
      mode,
      startX: e.clientX,
      origStart: clip.startTime,
      origDuration: clip.duration,
      origTrimStart: clip.trimStart
    }

    const snapPts = buildSnapPoints()

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - drag.startX
      const dt = dx / pxPerSec

      if (mode === 'move') {
        const newStart = snapTime(Math.max(0, drag.origStart + dt), snapPts)
        leftMV.set(newStart * pxPerSec)
      } else if (mode === 'trim-left') {
        const rawStart    = Math.max(0, drag.origStart + dt)
        const snapped     = snapTime(rawStart, snapPts)
        const newDuration = drag.origStart + drag.origDuration - snapped
        if (newDuration >= MIN_DUR) {
          leftMV.set(snapped * pxPerSec)
          widthMV.set(newDuration * pxPerSec)
        }
      } else {
        const rawEnd  = drag.origStart + drag.origDuration + dt
        const snapped = snapTime(rawEnd, snapPts)
        const newDur  = Math.max(MIN_DUR, snapped - drag.origStart)
        widthMV.set(newDur * pxPerSec)
      }
    }

    function onUp(ev: PointerEvent) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      isDragging.current = false

      const dx = ev.clientX - drag.startX
      const dt = dx / pxPerSec
      if (Math.abs(dx) < 3) return

      if (mode === 'move') {
        const newStart = snapTime(Math.max(0, drag.origStart + dt), snapPts)
        if (Math.abs(newStart - drag.origStart) > 0.001) moveClip(clip.id, newStart)
        else leftMV.set(drag.origStart * pxPerSec)
      } else if (mode === 'trim-left') {
        const rawStart    = Math.max(0, drag.origStart + dt)
        const snapped     = snapTime(rawStart, snapPts)
        const newDuration = drag.origStart + drag.origDuration - snapped
        if (newDuration >= MIN_DUR) {
          const dtActual = snapped - drag.origStart
          trimClip(clip.id, {
            startTime: snapped,
            trimStart: Math.max(0, drag.origTrimStart + dtActual),
            duration:  newDuration
          })
        } else {
          leftMV.set(drag.origStart    * pxPerSec)
          widthMV.set(drag.origDuration * pxPerSec)
        }
      } else {
        const rawEnd  = drag.origStart + drag.origDuration + dt
        const snapped = snapTime(rawEnd, snapPts)
        const newDur  = Math.max(MIN_DUR, snapped - drag.origStart)
        if (Math.abs(newDur - drag.origDuration) > 0.001) {
          trimClip(clip.id, { duration: newDur })
        } else {
          widthMV.set(drag.origDuration * pxPerSec)
        }
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <motion.div
        className={cn('absolute select-none touch-none', isSelected ? 'z-20' : 'z-10')}
        style={{ left: leftMV, width: widthMV, top: PADDING, height: clipHeight }}
        initial={{ opacity: 0, scaleX: 0.92 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0, scaleX: 0.92, transition: { duration: 0.1 } }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          selectClip(clip.id)
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {/* ── Left trim handle ─────────────────────────────────────────────── */}
        <div
          className="absolute left-0 top-0 h-full z-10 cursor-ew-resize group/trim-l"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => startDrag(e, 'trim-left')}
        >
          <div
            className="absolute right-0 top-1 bottom-1 w-0.5 rounded-full opacity-0 group-hover/trim-l:opacity-100 transition-opacity duration-100"
            style={{ background: style.border }}
          />
        </div>

        {/* ── Clip body ────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            background:  bg,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: isSelected ? style.border : 'rgba(255,255,255,0.12)',
            boxShadow:   isSelected
              ? `0 0 0 1px ${style.border}, 0 0 8px ${style.border}44`
              : '0 1px 3px rgba(0,0,0,0.4)'
          }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          {/* Top-edge highlight strip */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: `${style.border}55` }}
          />

          {/* Waveform — audio clips only */}
          {peaks && (
            <WaveformCanvas
              peaks={peaks}
              trimStart={clip.trimStart}
              duration={clip.duration}
              color={style.text}
              opacity={0.4}
            />
          )}

          {/* Name + duration label */}
          {showLabel && (
            <div className="absolute inset-0 flex items-start justify-between px-1.5 pt-1 gap-1 pointer-events-none overflow-hidden">
              <span
                className="text-[10px] font-semibold leading-tight truncate"
                style={{ color: style.text }}
              >
                {clip.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {clip.volume !== undefined && clip.volume !== 1 && dispWidth > 80 && (
                  <span
                    className="text-[9px] font-mono leading-tight opacity-70 flex items-center gap-0.5"
                    style={{ color: style.text }}
                  >
                    <Volume2 size={8} />
                    {Math.round(clip.volume * 100)}%
                  </span>
                )}
                {dispWidth > 80 && (
                  <span
                    className="text-[9px] font-mono leading-tight opacity-60"
                    style={{ color: style.text }}
                  >
                    {formatDuration(clip.duration)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Thumbnail strip at the bottom */}
          {clip.thumbnail && dispWidth > 60 && (
            <div
              className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: Math.min(28, clipHeight * 0.45) }}
            >
              <img
                src={clip.thumbnail}
                alt=""
                className="w-full h-full object-cover opacity-30"
                draggable={false}
              />
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(to bottom, ${bg} 0%, transparent 100%)` }}
              />
            </div>
          )}
        </div>

        {/* ── Right trim handle ────────────────────────────────────────────── */}
        <div
          className="absolute right-0 top-0 h-full z-10 cursor-ew-resize group/trim-r"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => startDrag(e, 'trim-right')}
        >
          <div
            className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full opacity-0 group-hover/trim-r:opacity-100 transition-opacity duration-100"
            style={{ background: style.border }}
          />
        </div>
      </motion.div>

      {/* ── Clip context menu ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {ctxMenu && (
          <ClipContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            volume={clip.volume ?? 1}
            onVolumeChange={(v) => setClipVolume(clip.id, v)}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Clip context menu ──────────────────────────────────────────────────────────

function ClipContextMenu({
  x, y, volume, onVolumeChange, onClose
}: {
  x: number
  y: number
  volume: number
  onVolumeChange: (v: number) => void
  onClose: () => void
}): JSX.Element {
  const menuRef  = useRef<HTMLDivElement>(null)
  const MENU_W   = 192
  const MENU_H   = 76
  const clampedX = Math.min(x, window.innerWidth  - MENU_W - 8)
  const clampedY = Math.min(y, window.innerHeight - MENU_H - 8)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      ref={menuRef}
      className="fixed z-[9999] rounded-lg border border-[var(--border)] bg-[var(--bg-overlay)] shadow-xl p-3"
      style={{ left: clampedX, top: clampedY, minWidth: MENU_W }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
        Volume
      </p>
      <div className="flex items-center gap-2">
        <Volume2 size={11} className="text-[var(--text-muted)] shrink-0" />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          className="flex-1 accent-[var(--accent)] h-1 cursor-pointer"
        />
        <span className="text-[10px] font-mono text-[var(--text-secondary)] w-8 text-right tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </motion.div>,
    document.body
  )
}
