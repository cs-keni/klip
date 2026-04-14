import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, AnimatePresence, animate } from 'framer-motion'
import { Volume2, Type, Zap, Palette, Crop, ArrowRightLeft, X, Unlink, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useWaveform } from '@/hooks/useWaveform'
import WaveformCanvas from './WaveformCanvas'
import type { TimelineClip, TextSettings, ColorSettings, CropSettings, Transition } from '@/types/timeline'

interface TimelineClipViewProps {
  clip: TimelineClip
  pxPerSec: number
  trackHeight: number
  isSelected: boolean
  isPrimary: boolean
  isLocked: boolean
}

const CLIP_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  video: { bg: 'rgba(109, 40, 217, 0.88)', border: '#a78bfa', text: '#ede9fe' },
  audio: { bg: 'rgba(29,  78, 216, 0.88)', border: '#93c5fd', text: '#dbeafe' },
  image: { bg: 'rgba(6,  120, 155, 0.88)', border: '#67e8f9', text: '#cffafe' },
  color: { bg: 'rgba(30,  30,  46, 0.92)', border: '#52525b', text: '#d4d4d8' },
  music: { bg: 'rgba(15, 118,  54, 0.88)', border: '#86efac', text: '#dcfce7' },
  text:  { bg: 'rgba(8,  145, 178, 0.88)', border: '#22d3ee', text: '#cffafe' }
}

const EDGE_HIT  = 8     // px width of trim handle hit area
const MIN_DUR   = 0.1   // minimum clip duration in seconds
const MIN_LABEL = 32    // px below which we hide the label
const SNAP_PX   = 8     // snap threshold in screen pixels
const PADDING   = 4     // vertical padding within track lane

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
  isSelected,
  isPrimary,
  isLocked
}: TimelineClipViewProps): JSX.Element {
  const {
    clips, transitions, playheadTime,
    moveClip, trimClip, selectClip, toggleClipInSelection,
    setClipVolume, setClipSpeed, setClipFades, unlinkClip,
    setTextSettings, setColorSettings, setCropSettings, setClipRole,
    addTransition, removeTransition,
    snapEnabled
  } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  const mediaClip = mediaClips.find((m) => m.id === clip.mediaClipId) ?? null

  // ── Waveform (audio + video clips) ──────────────────────────────────────────
  const { peaks, loading: waveformLoading } = useWaveform(mediaClip?.path ?? null, clip.type, clip.id)

  // ── Motion values for 60fps drag ────────────────────────────────────────────
  const leftMV  = useMotionValue(clip.startTime * pxPerSec)
  const widthMV = useMotionValue(Math.max(2, clip.duration * pxPerSec))

  const isDragging = useRef(false)
  const [isDraggingState, setIsDraggingState] = useState(false)

  useEffect(() => {
    if (!isDragging.current) {
      // Spring-animate position/size changes so zoom transitions and undo/redo feel smooth
      animate(leftMV, clip.startTime * pxPerSec, { type: 'spring', stiffness: 500, damping: 38, restDelta: 0.5 })
      animate(widthMV, Math.max(2, clip.duration * pxPerSec), { type: 'spring', stiffness: 500, damping: 38, restDelta: 0.5 })
    }
  }, [clip.startTime, clip.duration, pxPerSec, leftMV, widthMV])

  const style     = CLIP_STYLE[clip.type] ?? CLIP_STYLE.video
  const bg        = clip.type === 'color' && clip.color ? clip.color + 'dd' : style.bg
  const clipHeight = trackHeight - PADDING * 2
  const dispWidth  = clip.duration * pxPerSec
  const showLabel  = dispWidth >= MIN_LABEL

  // ── Context menu ─────────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // ── Snap helpers ─────────────────────────────────────────────────────────────
  function buildSnapPoints(): number[] {
    const pts: number[] = [0, playheadTime]
    for (const c of clips) {
      if (c.id === clip.id) continue
      pts.push(c.startTime, c.startTime + c.duration)
    }
    return pts
  }

  function snapTime(t: number, pts: number[]): number {
    if (!snapEnabled) return t
    const threshold = SNAP_PX / pxPerSec
    let best = t, bestDist = threshold
    for (const p of pts) {
      const d = Math.abs(t - p)
      if (d < bestDist) { bestDist = d; best = p }
    }
    return best
  }

  // ── Drag ─────────────────────────────────────────────────────────────────────
  function startDrag(e: React.PointerEvent, mode: DragMode) {
    if (e.button !== 0) return
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()

    // Ctrl/Cmd+click → toggle this clip in/out of the multi-selection
    if (e.ctrlKey || e.metaKey) {
      toggleClipInSelection(clip.id)
      return
    }

    selectClip(clip.id)
    isDragging.current = true
    setIsDraggingState(true)

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
      setIsDraggingState(false)

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
            trimStart: Math.max(0, drag.origTrimStart + dtActual * (clip.speed ?? 1)),
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

  // ── Transition badge (video clips only) ──────────────────────────────────────
  const fromTransition = transitions.find((t) => t.fromClipId === clip.id) ?? null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <motion.div
        className={cn('absolute select-none touch-none', isDraggingState ? 'z-30' : isSelected ? 'z-20' : 'z-10', isLocked && 'pointer-events-none opacity-70')}
        style={{ left: leftMV, width: widthMV, top: PADDING, height: clipHeight }}
        initial={{ opacity: 0, scaleX: 0.88 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0, scaleX: 0, originX: 0, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          selectClip(clip.id)
          setCtxMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {/* ── Left trim handle ──────────────────────────────────────────────── */}
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

        {/* ── Clip body ─────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            background:  bg,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: isDraggingState ? style.border : isSelected ? style.border : 'rgba(255,255,255,0.12)',
            boxShadow: isDraggingState
              ? `0 14px 36px rgba(0,0,0,0.55), 0 0 0 1px ${style.border}99`
              : isPrimary
                ? `0 0 0 1px ${style.border}, 0 0 8px ${style.border}44`
                : isSelected
                  ? `0 0 0 1px ${style.border}88`
                  : '0 1px 3px rgba(0,0,0,0.4)',
            opacity: isDraggingState ? 0.72 : 1,
            transition: 'opacity 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease'
          }}
          onPointerDown={(e) => startDrag(e, 'move')}
        >
          {/* Top-edge highlight strip */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: `${style.border}55` }}
          />

          {/* Waveform skeleton while audio is loading */}
          {waveformLoading && !peaks && (clip.type === 'audio' || clip.type === 'video') && dispWidth > 24 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center gap-px px-1">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm animate-pulse"
                  style={{
                    height: `${16 + Math.abs(Math.sin(i * 1.4 + 0.8)) * 28}%`,
                    background: style.text,
                    opacity: 0.11,
                    animationDelay: `${(i % 6) * 120}ms`,
                    animationDuration: '1.4s'
                  }}
                />
              ))}
            </div>
          )}

          {/* Waveform — audio and video clips */}
          {peaks && (
            <WaveformCanvas
              peaks={peaks}
              trimStart={clip.trimStart}
              duration={clip.duration}
              color={style.text}
              opacity={clip.type === 'video' ? 0.25 : 0.4}
            />
          )}

          {/* Audio fade-in overlay */}
          {(clip.fadeIn ?? 0) > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0 pointer-events-none z-10"
              style={{
                width: Math.min((clip.fadeIn! * pxPerSec), dispWidth / 2),
                background: `linear-gradient(to right, ${style.bg}, transparent)`
              }}
            />
          )}

          {/* Audio fade-out overlay */}
          {(clip.fadeOut ?? 0) > 0 && (
            <div
              className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
              style={{
                width: Math.min((clip.fadeOut! * pxPerSec), dispWidth / 2),
                background: `linear-gradient(to left, ${style.bg}, transparent)`
              }}
            />
          )}

          {/* Text clip: show content preview */}
          {clip.type === 'text' && clip.textSettings && (
            <div
              className="absolute inset-0 flex items-center justify-center px-2 pointer-events-none overflow-hidden"
            >
              <span
                className="text-[11px] font-semibold truncate"
                style={{ color: clip.textSettings.fontColor || '#fff' }}
              >
                {clip.textSettings.content || 'Text'}
              </span>
            </div>
          )}

          {/* Linked audio badge */}
          {clip.linkedClipId && dispWidth > 28 && (
            <div
              className="absolute bottom-1 right-1 pointer-events-none z-10 opacity-50"
              title="Linked to audio clip"
            >
              <Link2 size={8} style={{ color: style.text }} />
            </div>
          )}

          {/* Intro / Outro role badge */}
          {clip.role && dispWidth > 48 && (
            <div
              className="absolute top-1 left-1 pointer-events-none z-10"
              title={clip.role === 'intro' ? 'Intro clip' : 'Outro clip'}
            >
              <span
                className="text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded"
                style={{
                  background: clip.role === 'intro' ? 'rgba(234,179,8,0.85)' : 'rgba(239,68,68,0.85)',
                  color: '#fff'
                }}
              >
                {clip.role}
              </span>
            </div>
          )}

          {/* Name + duration + badges */}
          {showLabel && (
            <div className="absolute inset-0 flex items-start justify-between px-1.5 pt-1 gap-1 pointer-events-none overflow-hidden">
              <span
                className="text-[10px] font-semibold leading-tight truncate"
                style={{ color: style.text }}
              >
                {clip.type !== 'text' ? clip.name : ''}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {clip.speed !== undefined && clip.speed !== 1 && dispWidth > 60 && (
                  <span
                    className="text-[9px] font-mono leading-tight opacity-80 flex items-center gap-0.5"
                    style={{ color: style.text }}
                  >
                    <Zap size={8} />
                    {clip.speed}×
                  </span>
                )}
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
          {clip.thumbnail && dispWidth > 60 && clip.type !== 'text' && (
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

        {/* ── Right trim handle ─────────────────────────────────────────────── */}
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

        {/* ── Audio fade-in handle ──────────────────────────────────────────── */}
        {clip.type !== 'text' && (
          <FadeHandle
            side="in"
            fadeDuration={clip.fadeIn ?? 0}
            clipDuration={clip.duration}
            pxPerSec={pxPerSec}
            clipHeight={clipHeight}
            color={style.border}
            onFadeChange={(newFadeIn) => setClipFades(clip.id, newFadeIn, clip.fadeOut ?? 0)}
          />
        )}

        {/* ── Audio fade-out handle ─────────────────────────────────────────── */}
        {clip.type !== 'text' && (
          <FadeHandle
            side="out"
            fadeDuration={clip.fadeOut ?? 0}
            clipDuration={clip.duration}
            pxPerSec={pxPerSec}
            clipHeight={clipHeight}
            color={style.border}
            onFadeChange={(newFadeOut) => setClipFades(clip.id, clip.fadeIn ?? 0, newFadeOut)}
          />
        )}

        {/* ── Transition badge at the right edge ───────────────────────────── */}
        {fromTransition && (
          <div
            className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none z-10"
            style={{ width: Math.min(fromTransition.duration * pxPerSec, 40) }}
          >
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: `linear-gradient(to right, transparent, ${style.border}88)`
              }}
            />
            <ArrowRightLeft size={8} className="absolute right-1 opacity-80" style={{ color: style.border }} />
          </div>
        )}
      </motion.div>

      {/* ── Clip context menu ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {ctxMenu && (
          <ClipContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            clip={clip}
            clips={clips}
            transitions={transitions}
            onVolumeChange={(v) => setClipVolume(clip.id, v)}
            onSpeedChange={(v) => setClipSpeed(clip.id, v)}
            onTextChange={(s) => setTextSettings(clip.id, s)}
            onColorChange={(s) => setColorSettings(clip.id, s)}
            onCropChange={(s) => setCropSettings(clip.id, s)}
            onAddTransition={(t) => addTransition(t)}
            onRemoveTransition={(id) => removeTransition(id)}
            onUnlink={() => unlinkClip(clip.id)}
            onFadeChange={(fi, fo) => setClipFades(clip.id, fi, fo)}
            onNormalize={(v) => setClipVolume(clip.id, v)}
            onRoleChange={(role) => setClipRole(clip.id, role)}
            mediaPath={mediaClip?.path ?? null}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Clip context menu ──────────────────────────────────────────────────────────

type Section = 'volume' | 'fade' | 'speed' | 'text' | 'colorgrade' | 'crop' | 'transition'

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4]

/** Target integrated loudness for normalization (EBU R128 / YouTube standard). */
const NORMALIZE_TARGET_LUFS = -18

function ClipContextMenu({
  x, y, clip, clips, transitions,
  onVolumeChange, onSpeedChange, onTextChange,
  onColorChange, onCropChange, onAddTransition, onRemoveTransition,
  onUnlink, onFadeChange, onNormalize, onRoleChange, mediaPath, onClose
}: {
  x: number
  y: number
  clip: TimelineClip
  clips: TimelineClip[]
  transitions: Transition[]
  onVolumeChange: (v: number) => void
  onSpeedChange: (v: number) => void
  onTextChange: (s: TextSettings) => void
  onColorChange: (s: ColorSettings | undefined) => void
  onCropChange: (s: CropSettings | undefined) => void
  onAddTransition: (t: Transition) => void
  onRemoveTransition: (id: string) => void
  onUnlink: () => void
  onFadeChange: (fadeIn: number, fadeOut: number) => void
  onNormalize: (volume: number) => void
  onRoleChange: (role: 'intro' | 'outro' | undefined) => void
  mediaPath: string | null
  onClose: () => void
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [openSection, setOpenSection] = useState<Section | null>(
    clip.type === 'text' ? 'text' : null
  )
  const [normalizing, setNormalizing] = useState(false)

  // Find adjacent clips for transitions
  const adjacentNext = clips
    .filter((c) => c.trackId === clip.trackId && c.startTime > clip.startTime)
    .sort((a, b) => a.startTime - b.startTime)[0] ?? null

  const existingFromTransition = transitions.find((t) => t.fromClipId === clip.id) ?? null

  const MENU_W  = 248
  const MENU_MAX_H = 480
  const safeX = Math.min(x, window.innerWidth  - MENU_W - 8)
  const safeY = Math.min(y, window.innerHeight - MENU_MAX_H - 8)

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

  // ── Local state mirrors for controlled sliders ──────────────────────────────
  const volume    = clip.volume ?? 1
  const speed     = clip.speed  ?? 1
  const fadeIn    = clip.fadeIn  ?? 0
  const fadeOut   = clip.fadeOut ?? 0
  const colorS    = clip.colorSettings ?? { brightness: 0, contrast: 0, saturation: 0 }
  const cropS     = clip.cropSettings  ?? { zoom: 1, panX: 0, panY: 0 }
  const textS     = clip.textSettings  ?? {
    content: 'New Text', fontSize: 48, fontFamily: 'Arial', fontColor: '#ffffff', bgColor: 'transparent',
    bold: false, italic: false, alignment: 'center' as const, positionX: 0.5, positionY: 0.8,
    animationPreset: 'none' as const
  }

  const canHaveAudio      = clip.type !== 'text' && clip.type !== 'image' && clip.type !== 'color'
  const canHaveFade       = clip.type !== 'text'
  const canHaveSpeed      = clip.type !== 'text'
  const canHaveColorGrade = clip.type === 'video' || clip.type === 'image' || clip.type === 'color'
  const canHaveCrop       = clip.type === 'video' || clip.type === 'image'
  const canHaveTransition = clip.type === 'video' && adjacentNext?.type === 'video'

  async function handleNormalize() {
    if (!mediaPath || normalizing) return
    setNormalizing(true)
    try {
      const result = await window.api.waveform.analyzeLoudness(mediaPath)
      if (result && isFinite(result.inputI)) {
        const gainDB = NORMALIZE_TARGET_LUFS - result.inputI
        const linear = Math.pow(10, gainDB / 20)
        // Clamp to the 0-2 range (200% max)
        onNormalize(Math.max(0, Math.min(2, linear)))
      }
    } finally {
      setNormalizing(false)
    }
  }

  function toggleSection(s: Section) {
    setOpenSection((prev) => (prev === s ? null : s))
  }

  return createPortal(
    <motion.div
      ref={menuRef}
      className="fixed z-[9999] rounded-xl border border-[var(--border)] bg-[var(--bg-overlay)] shadow-2xl overflow-hidden"
      style={{ left: safeX, top: safeY, width: MENU_W, maxHeight: MENU_MAX_H, overflowY: 'auto' }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      {/* ── Volume (non-text clips) ───────────────────────────────────────── */}
      {clip.type !== 'text' && (
        <MenuSection
          icon={<Volume2 size={11} />}
          label="Volume"
          open={openSection === 'volume'}
          onToggle={() => toggleSection('volume')}
        >
          <SliderRow
            min={0} max={200} step={1}
            value={Math.round(volume * 100)}
            display={`${Math.round(volume * 100)}%`}
            onChange={(v) => onVolumeChange(v / 100)}
          />
          {volume > 1.005 && (
            <p className="text-[9px] text-amber-400/70 mt-1">
              &gt;100% applies gain at export; preview is capped at 100%
            </p>
          )}
          {/* Normalize button — only for clips with real audio */}
          {canHaveAudio && mediaPath && (
            <button
              onClick={handleNormalize}
              disabled={normalizing}
              className={cn(
                'mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-colors duration-100',
                normalizing
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:text-[var(--accent)]'
              )}
            >
              {normalizing
                ? <><Loader2 size={9} className="animate-spin" /> Analyzing…</>
                : <><Volume2 size={9} /> Normalize to −18 LUFS</>
              }
            </button>
          )}
        </MenuSection>
      )}

      {/* ── Audio Fades ──────────────────────────────────────────────────── */}
      {canHaveFade && (
        <MenuSection
          icon={<span className="text-[9px] font-mono opacity-80">↗↘</span>}
          label="Audio Fades"
          open={openSection === 'fade'}
          onToggle={() => toggleSection('fade')}
        >
          <div className="space-y-2">
            <div>
              <p className="text-[9px] text-[var(--text-muted)] mb-1">Fade In</p>
              <SliderRow
                min={0} max={Math.min(10, Math.floor(clip.duration / 2 * 10) / 10)} step={0.1}
                value={parseFloat(fadeIn.toFixed(1))}
                display={fadeIn > 0 ? `${fadeIn.toFixed(1)}s` : 'Off'}
                onChange={(v) => onFadeChange(v, fadeOut)}
              />
            </div>
            <div>
              <p className="text-[9px] text-[var(--text-muted)] mb-1">Fade Out</p>
              <SliderRow
                min={0} max={Math.min(10, Math.floor(clip.duration / 2 * 10) / 10)} step={0.1}
                value={parseFloat(fadeOut.toFixed(1))}
                display={fadeOut > 0 ? `${fadeOut.toFixed(1)}s` : 'Off'}
                onChange={(v) => onFadeChange(fadeIn, v)}
              />
            </div>
          </div>
        </MenuSection>
      )}

      {/* ── Speed ────────────────────────────────────────────────────────── */}
      {canHaveSpeed && (
        <MenuSection
          icon={<Zap size={11} />}
          label="Speed"
          open={openSection === 'speed'}
          onToggle={() => toggleSection('speed')}
        >
          <div className="flex gap-1 flex-wrap">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-mono font-semibold transition-colors duration-75',
                  Math.abs(speed - s) < 0.01
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </MenuSection>
      )}

      {/* ── Text settings (text clips only) ──────────────────────────────── */}
      {clip.type === 'text' && (
        <MenuSection
          icon={<Type size={11} />}
          label="Text"
          open={openSection === 'text'}
          onToggle={() => toggleSection('text')}
        >
          <TextSettingsPanel
            settings={textS}
            onChange={onTextChange}
          />
        </MenuSection>
      )}

      {/* ── Color Grade ──────────────────────────────────────────────────── */}
      {canHaveColorGrade && (
        <MenuSection
          icon={<Palette size={11} />}
          label={clip.colorSettings ? 'Color Grade ●' : 'Color Grade'}
          open={openSection === 'colorgrade'}
          onToggle={() => toggleSection('colorgrade')}
        >
          <div className="space-y-2">
            <SliderRow
              label="Brightness"
              min={-100} max={100} step={1}
              value={Math.round(colorS.brightness * 100)}
              display={fmtSigned(colorS.brightness)}
              onChange={(v) => onColorChange({ ...colorS, brightness: v / 100 })}
              zero
            />
            <SliderRow
              label="Contrast"
              min={-100} max={100} step={1}
              value={Math.round(colorS.contrast * 100)}
              display={fmtSigned(colorS.contrast)}
              onChange={(v) => onColorChange({ ...colorS, contrast: v / 100 })}
              zero
            />
            <SliderRow
              label="Saturation"
              min={-100} max={100} step={1}
              value={Math.round(colorS.saturation * 100)}
              display={fmtSigned(colorS.saturation)}
              onChange={(v) => onColorChange({ ...colorS, saturation: v / 100 })}
              zero
            />
            {clip.colorSettings && (
              <button
                onClick={() => onColorChange(undefined)}
                className="text-[9px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </MenuSection>
      )}

      {/* ── Crop / Zoom ──────────────────────────────────────────────────── */}
      {canHaveCrop && (
        <MenuSection
          icon={<Crop size={11} />}
          label={clip.cropSettings ? 'Crop / Zoom ●' : 'Crop / Zoom'}
          open={openSection === 'crop'}
          onToggle={() => toggleSection('crop')}
        >
          <div className="space-y-2">
            {/* Quick presets */}
            <div className="flex gap-1.5">
              <button
                onClick={() => onCropChange({ zoom: 2.0, panX: 0, panY: 0 })}
                className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-75"
                title="2× zoom centered — quick punch-in effect"
              >
                Punch In
              </button>
              {clip.cropSettings && (
                <button
                  onClick={() => onCropChange(undefined)}
                  className="px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-red-400 transition-colors duration-75"
                >
                  Reset
                </button>
              )}
            </div>
            <SliderRow
              label="Zoom"
              min={100} max={400} step={5}
              value={Math.round(cropS.zoom * 100)}
              display={`${cropS.zoom.toFixed(2)}×`}
              onChange={(v) => onCropChange({ ...cropS, zoom: v / 100 })}
            />
            {cropS.zoom > 1 && (
              <>
                <ZoomMinimap
                  zoom={cropS.zoom}
                  panX={cropS.panX}
                  panY={cropS.panY}
                  thumbnail={clip.thumbnail}
                  onChange={(px, py) => onCropChange({ ...cropS, panX: px, panY: py })}
                />
                <SliderRow
                  label="Pan X"
                  min={-100} max={100} step={1}
                  value={Math.round(cropS.panX * 100)}
                  display={fmtSigned(cropS.panX)}
                  onChange={(v) => onCropChange({ ...cropS, panX: v / 100 })}
                  zero
                />
                <SliderRow
                  label="Pan Y"
                  min={-100} max={100} step={1}
                  value={Math.round(cropS.panY * 100)}
                  display={fmtSigned(cropS.panY)}
                  onChange={(v) => onCropChange({ ...cropS, panY: v / 100 })}
                  zero
                />
              </>
            )}
          </div>
        </MenuSection>
      )}

      {/* ── Transition ───────────────────────────────────────────────────── */}
      {canHaveTransition && (
        <MenuSection
          icon={<ArrowRightLeft size={11} />}
          label="Transition at End"
          open={openSection === 'transition'}
          onToggle={() => toggleSection('transition')}
        >
          <div className="space-y-1.5">
            {existingFromTransition ? (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-secondary)] capitalize">
                  {existingFromTransition.type} — {existingFromTransition.duration.toFixed(1)}s
                </span>
                <button
                  onClick={() => onRemoveTransition(existingFromTransition.id)}
                  className="flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={9} /> Remove
                </button>
              </div>
            ) : (
              <p className="text-[9px] text-[var(--text-muted)]">No transition</p>
            )}
            <div className="flex gap-1.5 flex-wrap">
              {(['fade', 'dip-to-black'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    onAddTransition({
                      id: crypto.randomUUID(),
                      fromClipId: clip.id,
                      toClipId: adjacentNext!.id,
                      type,
                      duration: 0.5
                    })
                  }}
                  className={cn(
                    'px-2 py-1 rounded text-[10px] font-medium transition-colors duration-75',
                    existingFromTransition?.type === type
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  {type === 'fade' ? 'Fade' : 'Dip to Black'}
                </button>
              ))}
            </div>
            {existingFromTransition && (
              <SliderRow
                label="Duration"
                min={2} max={30} step={1}
                value={Math.round(existingFromTransition.duration * 10)}
                display={`${existingFromTransition.duration.toFixed(1)}s`}
                onChange={(v) => onAddTransition({ ...existingFromTransition, duration: v / 10 })}
              />
            )}
          </div>
        </MenuSection>
      )}

      {/* ── Unlink Audio ─────────────────────────────────────────────────── */}
      {clip.linkedClipId && (
        <div className="border-t border-[var(--border-subtle)] py-1">
          <button
            onClick={() => { onUnlink(); onClose() }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-amber-300 transition-colors duration-75"
          >
            <span className="opacity-70"><Unlink size={11} /></span>
            Unlink Audio
          </button>
        </div>
      )}

      {/* ── Intro / Outro designation ─────────────────────────────────────── */}
      {(clip.type === 'video' || clip.type === 'image' || clip.type === 'color') && (
        <div className="border-t border-[var(--border-subtle)] py-1">
          <div className="px-3 pb-1 pt-0.5">
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Mark as</p>
            <div className="flex gap-1.5">
              {(['intro', 'outro'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => { onRoleChange(clip.role === role ? undefined : role); onClose() }}
                  className={cn(
                    'flex-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors duration-75',
                    clip.role === role
                      ? role === 'intro'
                        ? 'bg-yellow-500/80 text-white'
                        : 'bg-red-500/80 text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>,
    document.body
  )
}

// ── Text settings panel ────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  'Arial', 'Impact', 'Georgia', 'Verdana', 'Trebuchet MS',
  'Times New Roman', 'Courier New', 'system-ui'
] as const

const POSITION_PRESETS = [
  { label: 'Top',         positionX: 0.5, positionY: 0.1  },
  { label: 'Center',      positionX: 0.5, positionY: 0.5  },
  { label: 'Lower Third', positionX: 0.5, positionY: 0.85 }
] as const

const ANIM_PRESETS = [
  { value: 'none',     label: 'None'     },
  { value: 'fade-in',  label: 'Fade In'  },
  { value: 'slide-up', label: 'Slide Up' }
] as const

function TextSettingsPanel({
  settings, onChange
}: {
  settings: TextSettings
  onChange: (s: TextSettings) => void
}): JSX.Element {
  return (
    <div className="space-y-2.5">
      {/* Content */}
      <textarea
        value={settings.content}
        onChange={(e) => onChange({ ...settings, content: e.target.value })}
        rows={3}
        className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-dim)] resize-none"
        placeholder="Enter text…"
      />

      {/* Font family */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-[var(--text-muted)] w-14 shrink-0">Font</span>
        <select
          value={settings.fontFamily}
          onChange={(e) => onChange({ ...settings, fontFamily: e.target.value })}
          className="flex-1 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-dim)] cursor-pointer"
          style={{ fontFamily: settings.fontFamily }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font size */}
      <SliderRow
        label="Size"
        min={12} max={200} step={2}
        value={settings.fontSize}
        display={`${settings.fontSize}px`}
        onChange={(v) => onChange({ ...settings, fontSize: v })}
      />

      {/* Colors row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[9px] text-[var(--text-muted)] w-14 shrink-0">Color</span>
          <input
            type="color"
            value={settings.fontColor}
            onChange={(e) => onChange({ ...settings, fontColor: e.target.value })}
            className="w-6 h-5 rounded border border-[var(--border-subtle)] cursor-pointer p-0 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-[9px] text-[var(--text-muted)] w-14 shrink-0">Background</span>
          <input
            type="color"
            value={settings.bgColor === 'transparent' ? '#000000' : settings.bgColor}
            onChange={(e) => onChange({ ...settings, bgColor: e.target.value })}
            className="w-6 h-5 rounded border border-[var(--border-subtle)] cursor-pointer p-0 bg-transparent"
          />
          <button
            onClick={() => onChange({ ...settings, bgColor: 'transparent' })}
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded transition-colors',
              settings.bgColor === 'transparent'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            None
          </button>
        </div>
      </div>

      {/* Style toggles */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange({ ...settings, bold: !settings.bold })}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-bold transition-colors',
            settings.bold
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          )}
        >
          B
        </button>
        <button
          onClick={() => onChange({ ...settings, italic: !settings.italic })}
          className={cn(
            'px-2 py-1 rounded text-[10px] italic transition-colors',
            settings.italic
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          )}
        >
          I
        </button>
        <div className="w-px h-4 bg-[var(--border-subtle)]" />
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            onClick={() => onChange({ ...settings, alignment: align })}
            className={cn(
              'px-1.5 py-1 rounded text-[9px] font-semibold transition-colors',
              settings.alignment === align
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            )}
          >
            {align === 'left' ? '⇤' : align === 'center' ? '⇔' : '⇥'}
          </button>
        ))}
      </div>

      {/* Position anchor presets */}
      <div>
        <p className="text-[9px] text-[var(--text-muted)] mb-1">Position</p>
        <div className="flex gap-1.5 mb-2">
          {POSITION_PRESETS.map((preset) => {
            const active =
              Math.abs(settings.positionX - preset.positionX) < 0.01 &&
              Math.abs(settings.positionY - preset.positionY) < 0.01
            return (
              <button
                key={preset.label}
                onClick={() => onChange({ ...settings, positionX: preset.positionX, positionY: preset.positionY })}
                className={cn(
                  'flex-1 px-1 py-1 rounded text-[9px] font-medium transition-colors duration-75',
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <SliderRow
          label="X"
          min={0} max={100} step={1}
          value={Math.round(settings.positionX * 100)}
          display={`${Math.round(settings.positionX * 100)}%`}
          onChange={(v) => onChange({ ...settings, positionX: v / 100 })}
        />
        <div className="mt-1.5">
          <SliderRow
            label="Y"
            min={0} max={100} step={1}
            value={Math.round(settings.positionY * 100)}
            display={`${Math.round(settings.positionY * 100)}%`}
            onChange={(v) => onChange({ ...settings, positionY: v / 100 })}
          />
        </div>
        <p className="text-[8px] text-[var(--text-muted)] mt-1 opacity-70">Drag text in preview to reposition</p>
      </div>

      {/* Animation preset */}
      <div>
        <p className="text-[9px] text-[var(--text-muted)] mb-1">Animation</p>
        <div className="flex gap-1.5">
          {ANIM_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onChange({ ...settings, animationPreset: value as TextSettings['animationPreset'] })}
              className={cn(
                'flex-1 px-1.5 py-1 rounded text-[9px] font-medium transition-colors duration-75',
                settings.animationPreset === value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Zoom minimap ──────────────────────────────────────────────────────────────
// Shows a thumbnail of the clip with a draggable box representing the zoomed
// viewport. Drag the box (or click anywhere) to reposition the zoom focus.

function ZoomMinimap({
  zoom, panX, panY, thumbnail, onChange
}: {
  zoom: number
  panX: number
  panY: number
  thumbnail: string | null
  onChange: (panX: number, panY: number) => void
}): JSX.Element {
  const mapRef = useRef<HTMLDivElement>(null)

  // Zoom box dimensions as fractions of the minimap (1/zoom each axis)
  const boxW = 1 / zoom
  const boxH = 1 / zoom

  // Box top-left position as a fraction, derived from panX/panY.
  // panX=0/panY=0 → centered; panX=±1 → fully to the left/right edge.
  // halfRange = the maximum distance the box center can travel from 0.5.
  const halfRange = 0.5 - 0.5 / zoom
  const boxLeft = 0.5 - boxW / 2 + panX * halfRange
  const boxTop  = 0.5 - boxH / 2 + panY * halfRange

  // Convert a fractional minimap coordinate to panX/panY, clamped to ±1.
  function fracToPan(fx: number, fy: number): [number, number] {
    const newPanX = halfRange !== 0 ? (fx - 0.5) / halfRange : 0
    const newPanY = halfRange !== 0 ? (fy - 0.5) / halfRange : 0
    return [
      Math.max(-1, Math.min(1, newPanX)),
      Math.max(-1, Math.min(1, newPanY))
    ]
  }

  // Drag the zoom box
  function startBoxDrag(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const map = mapRef.current
    if (!map) return
    const rect = map.getBoundingClientRect()

    // Where inside the box did the pointer land (as fraction of minimap)?
    const clickFracX = (e.clientX - rect.left) / rect.width
    const clickFracY = (e.clientY - rect.top) / rect.height
    const boxCenterX = boxLeft + boxW / 2
    const boxCenterY = boxTop  + boxH / 2
    const offsetX = clickFracX - boxCenterX
    const offsetY = clickFracY - boxCenterY

    function onMove(ev: PointerEvent) {
      const newFracX = (ev.clientX - rect.left) / rect.width
      const newFracY = (ev.clientY - rect.top) / rect.height
      // Desired new box center, corrected for where we grabbed
      const centerX = Math.max(boxW / 2, Math.min(1 - boxW / 2, newFracX - offsetX))
      const centerY = Math.max(boxH / 2, Math.min(1 - boxH / 2, newFracY - offsetY))
      onChange(...fracToPan(centerX, centerY))
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
  }

  // Click on the background → jump box center to that point
  function onMapClick(e: React.MouseEvent) {
    const map = mapRef.current
    if (!map) return
    const rect = map.getBoundingClientRect()
    const fx = (e.clientX - rect.left) / rect.width
    const fy = (e.clientY - rect.top) / rect.height
    const cx = Math.max(boxW / 2, Math.min(1 - boxW / 2, fx))
    const cy = Math.max(boxH / 2, Math.min(1 - boxH / 2, fy))
    onChange(...fracToPan(cx, cy))
  }

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`

  return (
    <div
      ref={mapRef}
      className="relative w-full rounded overflow-hidden bg-[var(--bg-base)] border border-[var(--border-subtle)] cursor-crosshair select-none"
      style={{ aspectRatio: '16 / 9' }}
      onClick={onMapClick}
    >
      {/* Thumbnail background */}
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        // Subtle grid fallback when no thumbnail available
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 9px)',
              'repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.06) 8px, rgba(255,255,255,0.06) 9px)'
            ].join(', ')
          }}
        />
      )}

      {/* Dark mask — four strips surrounding the zoom box */}
      {/* Top */}
      <div className="absolute inset-x-0 bg-black/60 pointer-events-none"
        style={{ top: 0, height: pct(boxTop) }} />
      {/* Bottom */}
      <div className="absolute inset-x-0 bg-black/60 pointer-events-none"
        style={{ top: pct(boxTop + boxH), bottom: 0 }} />
      {/* Left */}
      <div className="absolute bg-black/60 pointer-events-none"
        style={{ left: 0, width: pct(boxLeft), top: pct(boxTop), height: pct(boxH) }} />
      {/* Right */}
      <div className="absolute bg-black/60 pointer-events-none"
        style={{ left: pct(boxLeft + boxW), right: 0, top: pct(boxTop), height: pct(boxH) }} />

      {/* Zoom box — draggable */}
      <div
        className="absolute border-2 rounded-[2px] cursor-grab active:cursor-grabbing"
        style={{
          left:   pct(boxLeft),
          top:    pct(boxTop),
          width:  pct(boxW),
          height: pct(boxH),
          borderColor: 'var(--accent)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4)'
        }}
        onPointerDown={startBoxDrag}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner tick marks */}
        <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l border-white/60 rounded-tl-[1px]" />
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t border-r border-white/60 rounded-tr-[1px]" />
        <div className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b border-l border-white/60 rounded-bl-[1px]" />
        <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r border-white/60 rounded-br-[1px]" />
      </div>

      {/* Label */}
      <div className="absolute bottom-1 right-1.5 text-[8px] font-mono text-white/50 pointer-events-none select-none">
        {zoom.toFixed(1)}×
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function MenuSection({
  icon, label, open, onToggle, children
}: {
  icon: React.ReactNode
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-elevated)] transition-colors duration-75"
      >
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
        <span className="text-[var(--text-muted)] text-[10px]">{open ? '▴' : '▾'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SliderRow({
  label, min, max, step, value, display, onChange, zero = false
}: {
  label?: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (v: number) => void
  zero?: boolean
}): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[9px] text-[var(--text-muted)] w-16 shrink-0">{label}</span>
      )}
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)] h-1 cursor-pointer"
        onDoubleClick={zero ? () => onChange(0) : undefined}
      />
      <span className="text-[10px] font-mono text-[var(--text-secondary)] w-10 text-right tabular-nums shrink-0">
        {display}
      </span>
    </div>
  )
}

function fmtSigned(v: number): string {
  const pct = Math.round(v * 100)
  return pct === 0 ? '0%' : pct > 0 ? `+${pct}%` : `${pct}%`
}

// ── FadeHandle ─────────────────────────────────────────────────────────────────
// A small draggable diamond on the top edge of a clip that lets the user
// scrub a fade-in or fade-out duration. Hover shows it; disappears when fade = 0.

const FADE_HANDLE_PX = 10  // handle size in px

function FadeHandle({
  side,
  fadeDuration,
  clipDuration,
  pxPerSec,
  color,
  onFadeChange
}: {
  side: 'in' | 'out'
  fadeDuration: number
  clipDuration: number
  pxPerSec: number
  clipHeight: number
  color: string
  onFadeChange: (newDuration: number) => void
}): JSX.Element {
  const isDragging = useRef(false)
  const maxFade    = clipDuration / 2
  const fadePx     = fadeDuration * pxPerSec

  // Position the handle at the end of the fade region (clamped to clip bounds)
  const handleLeft = side === 'in'
    ? Math.min(fadePx, maxFade * pxPerSec)
    : undefined
  const handleRight = side === 'out'
    ? Math.min(fadePx, maxFade * pxPerSec)
    : undefined

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (e.button !== 0) return
    isDragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    let rawPx: number
    if (side === 'in') {
      rawPx = e.clientX - rect.left
    } else {
      rawPx = rect.right - e.clientX
    }
    const newDur = Math.max(0, Math.min(maxFade, rawPx / pxPerSec))
    onFadeChange(parseFloat(newDur.toFixed(2)))
  }

  function onPointerUp(e: React.PointerEvent) {
    isDragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <div
      className="absolute top-0 z-20 group/fade"
      style={{
        left:   handleLeft  !== undefined ? handleLeft  - FADE_HANDLE_PX / 2 : undefined,
        right:  handleRight !== undefined ? handleRight - FADE_HANDLE_PX / 2 : undefined,
        width:  FADE_HANDLE_PX,
        height: FADE_HANDLE_PX,
        cursor: 'ew-resize',
        // Show slightly above the clip top edge
        top: -FADE_HANDLE_PX / 2 + 1
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Diamond shape */}
      <div
        className="w-full h-full rotate-45 border transition-opacity duration-100"
        style={{
          borderColor: color,
          backgroundColor: fadeDuration > 0 ? color : 'transparent',
          opacity: fadeDuration > 0 ? 0.9 : 0,
          borderWidth: 1.5
        }}
      />
      {/* Tooltip */}
      {fadeDuration > 0 && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap
                     bg-black/80 text-white text-[9px] font-mono px-1 py-0.5 rounded
                     opacity-0 group-hover/fade:opacity-100 transition-opacity duration-100 pointer-events-none z-30"
        >
          {side === 'in' ? 'Fade in' : 'Fade out'} {fadeDuration.toFixed(1)}s
        </div>
      )}
    </div>
  )
}

