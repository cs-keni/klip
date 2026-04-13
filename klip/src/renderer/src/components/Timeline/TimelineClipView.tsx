import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, AnimatePresence } from 'framer-motion'
import { Volume2, Type, Zap, Palette, Crop, ArrowRightLeft, X, Unlink, Link2 } from 'lucide-react'
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
    setClipVolume, setClipSpeed, unlinkClip,
    setTextSettings, setColorSettings, setCropSettings,
    addTransition, removeTransition,
    snapEnabled
  } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  const mediaClip = mediaClips.find((m) => m.id === clip.mediaClipId) ?? null

  // ── Waveform (audio clips only) ──────────────────────────────────────────────
  const { peaks } = useWaveform(mediaClip?.path ?? null, clip.type)

  // ── Motion values for 60fps drag ────────────────────────────────────────────
  const leftMV  = useMotionValue(clip.startTime * pxPerSec)
  const widthMV = useMotionValue(Math.max(2, clip.duration * pxPerSec))

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
        className={cn('absolute select-none touch-none', isSelected ? 'z-20' : 'z-10', isLocked && 'pointer-events-none opacity-70')}
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
            borderColor: isSelected ? style.border : 'rgba(255,255,255,0.12)',
            boxShadow: isPrimary
              ? `0 0 0 1px ${style.border}, 0 0 8px ${style.border}44`
              : isSelected
                ? `0 0 0 1px ${style.border}88`
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
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Clip context menu ──────────────────────────────────────────────────────────

type Section = 'volume' | 'speed' | 'text' | 'colorgrade' | 'crop' | 'transition'

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 4]

function ClipContextMenu({
  x, y, clip, clips, transitions,
  onVolumeChange, onSpeedChange, onTextChange,
  onColorChange, onCropChange, onAddTransition, onRemoveTransition, onUnlink, onClose
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
  onClose: () => void
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [openSection, setOpenSection] = useState<Section | null>(
    clip.type === 'text' ? 'text' : null
  )

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
  const colorS    = clip.colorSettings ?? { brightness: 0, contrast: 0, saturation: 0 }
  const cropS     = clip.cropSettings  ?? { zoom: 1, panX: 0, panY: 0 }
  const textS     = clip.textSettings  ?? {
    content: 'New Text', fontSize: 48, fontColor: '#ffffff', bgColor: 'transparent',
    bold: false, italic: false, alignment: 'center', positionX: 0.5, positionY: 0.8
  }

  const canHaveSpeed     = clip.type !== 'text'
  const canHaveColorGrade = clip.type === 'video' || clip.type === 'image' || clip.type === 'color'
  const canHaveCrop      = clip.type === 'video' || clip.type === 'image'
  const canHaveTransition = clip.type === 'video' && adjacentNext?.type === 'video'

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
            {clip.cropSettings && (
              <button
                onClick={() => onCropChange(undefined)}
                className="text-[9px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                Reset
              </button>
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
    </motion.div>,
    document.body
  )
}

// ── Text settings panel ────────────────────────────────────────────────────────

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

      {/* Position */}
      <SliderRow
        label="Pos X"
        min={0} max={100} step={1}
        value={Math.round(settings.positionX * 100)}
        display={`${Math.round(settings.positionX * 100)}%`}
        onChange={(v) => onChange({ ...settings, positionX: v / 100 })}
      />
      <SliderRow
        label="Pos Y"
        min={0} max={100} step={1}
        value={Math.round(settings.positionY * 100)}
        display={`${Math.round(settings.positionY * 100)}%`}
        onChange={(v) => onChange({ ...settings, positionY: v / 100 })}
      />
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
