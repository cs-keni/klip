import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Pause, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { pathToFileUrl, formatTimecode, formatDuration } from '@/lib/mediaUtils'
import { useSourceViewerStore } from '@/stores/sourceViewerStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import type { TimelineClip } from '@/types/timeline'

export default function SourceClipViewer(): JSX.Element | null {
  const { isOpen, clip, inPoints, outPoints, closeViewer, setInPoint, setOutPoint } =
    useSourceViewerStore()

  if (!isOpen || !clip) return null

  return (
    <AnimatePresence>
      <SourceViewerInner
        key={clip.id}
        clipId={clip.id}
        inPoints={inPoints}
        outPoints={outPoints}
        closeViewer={closeViewer}
        setInPoint={setInPoint}
        setOutPoint={setOutPoint}
      />
    </AnimatePresence>
  )
}

// ── Inner component (has its own stable ref state) ─────────────────────────────

interface InnerProps {
  clipId: string
  inPoints:  Record<string, number>
  outPoints: Record<string, number>
  closeViewer: () => void
  setInPoint:  (id: string, t: number) => void
  setOutPoint: (id: string, t: number) => void
}

function SourceViewerInner({
  clipId, inPoints, outPoints, closeViewer, setInPoint, setOutPoint
}: InnerProps): JSX.Element {
  const { clips: mediaClips } = useMediaStore()
  const clip = mediaClips.find((c) => c.id === clipId) ?? null

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]   = useState(clip?.duration ?? 0)
  const videoRef    = useRef<HTMLVideoElement>(null)
  const rafRef      = useRef<number | null>(null)
  const isPlayingRef = useRef(false)

  const inPoint  = clip ? (inPoints[clip.id]  ?? 0) : 0
  const outPoint = clip ? (outPoints[clip.id] ?? Math.max(0, (clip.duration > 0 ? clip.duration : duration))) : 0

  // Effective out point — default to clip duration if not set
  const effectiveOut = outPoint > 0 ? outPoint : duration

  // ── Load clip into video element ─────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return

    const isAudioOnly = clip.type === 'audio'
    const url = clip.path ? pathToFileUrl(clip.path) : ''
    video.src = url
    video.load()

    const onMeta = () => {
      setDuration(isFinite(video.duration) ? video.duration : 0)
      video.currentTime = inPoint
      setCurrentTime(inPoint)
    }
    video.addEventListener('loadedmetadata', onMeta, { once: true })

    // Suppress unused var warning for isAudioOnly (kept for future waveform work)
    void isAudioOnly

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.pause()
      video.src = ''
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [clip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF playback ticker ──────────────────────────────────────────────────

  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  const startRaf = useCallback(() => {
    stopRaf()
    function tick() {
      const video = videoRef.current
      if (!video || !isPlayingRef.current) return
      setCurrentTime(video.currentTime)

      // Loop when we reach the out-point
      if (video.currentTime >= effectiveOut - 0.05 || video.ended) {
        video.currentTime = inPoint
        setCurrentTime(inPoint)
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [effectiveOut, inPoint, stopRaf])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      stopRaf()
    } else {
      // If at or past out-point, restart from in-point
      if (video.currentTime >= effectiveOut - 0.05) {
        video.currentTime = inPoint
      }
      video.play().catch(() => {})
      setIsPlaying(true)
      startRaf()
    }
  }, [isPlaying, effectiveOut, inPoint, startRaf, stopRaf])

  // ── Scrub bar ────────────────────────────────────────────────────────────

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newTime = frac * duration
    video.currentTime = newTime
    setCurrentTime(newTime)
  }, [duration])

  // ── Set in/out points ────────────────────────────────────────────────────

  const handleSetIn = useCallback(() => {
    if (!clip) return
    const t = videoRef.current?.currentTime ?? currentTime
    setInPoint(clip.id, t)
    // If out-point is now before in-point, clear it
    if (effectiveOut <= t + 0.1) {
      setOutPoint(clip.id, Math.min(t + 5, duration))
    }
  }, [clip, currentTime, effectiveOut, duration, setInPoint, setOutPoint])

  const handleSetOut = useCallback(() => {
    if (!clip) return
    const t = videoRef.current?.currentTime ?? currentTime
    setOutPoint(clip.id, t)
  }, [clip, currentTime, setOutPoint])

  // ── Add to Timeline ──────────────────────────────────────────────────────

  const handleAddToTimeline = useCallback(() => {
    if (!clip) return
    const { tracks, clips: tlClips, addClip, playheadTime } = useTimelineStore.getState()

    // Pick destination track based on clip type
    const targetTrack = clip.type === 'audio'
      ? tracks.find((t) => t.type === 'audio' || t.type === 'music')
      : tracks.find((t) => t.type === 'video')

    if (!targetTrack || targetTrack.isLocked) return

    // Default startTime = end of last clip on this track, or playheadTime
    const trackClips = tlClips.filter((c) => c.trackId === targetTrack.id)
    const lastEnd = trackClips.reduce((mx, c) => Math.max(mx, c.startTime + c.duration), 0)
    const startTime = Math.max(playheadTime, lastEnd)

    const trimStart  = inPoint
    const clipDuration = Math.max(0.1, effectiveOut - inPoint)

    const newClip: TimelineClip = {
      id:          crypto.randomUUID(),
      mediaClipId: clip.id,
      trackId:     targetTrack.id,
      startTime,
      duration:    clipDuration,
      trimStart,
      type:        clip.type === 'color' ? 'color' : clip.type,
      name:        clip.name,
      thumbnail:   clip.thumbnail,
      color:       clip.color
    }

    addClip(newClip)
    closeViewer()
  }, [clip, inPoint, effectiveOut, closeViewer])

  // ── Keyboard shortcuts (local to this modal) ─────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') { e.preventDefault(); closeViewer(); return }
      if (e.key === ' ')      { e.preventDefault(); handlePlayPause(); return }
      if (e.key === 'i' && !e.ctrlKey) { e.preventDefault(); handleSetIn(); return }
      if (e.key === 'o' && !e.ctrlKey) { e.preventDefault(); handleSetOut(); return }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const video = videoRef.current
        if (video) { const t = Math.min(video.currentTime + 1/30, duration); video.currentTime = t; setCurrentTime(t) }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const video = videoRef.current
        if (video) { const t = Math.max(video.currentTime - 1/30, 0); video.currentTime = t; setCurrentTime(t) }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeViewer, handlePlayPause, handleSetIn, handleSetOut, duration])

  // ── Derived display ──────────────────────────────────────────────────────

  const progressFrac  = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const inFrac        = duration > 0 ? Math.min(1, inPoint       / duration) : 0
  const outFrac       = duration > 0 ? Math.min(1, effectiveOut  / duration) : 0
  const selectionSecs = Math.max(0, effectiveOut - inPoint)

  const isAudioOnly = clip?.type === 'audio'
  const isColor     = clip?.type === 'color'
  const hasVideo    = !isAudioOnly && !isColor && clip?.path

  return (
    <motion.div
      className="fixed inset-0 z-[5000] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={closeViewer}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 flex flex-col w-[700px] max-w-[95vw] max-h-[85vh] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl overflow-hidden"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              Source Clip Viewer
            </p>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate mt-0.5" title={clip?.name}>
              {clip?.name}
            </p>
          </div>
          <button
            onClick={closeViewer}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Video / Audio area */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden" style={{ aspectRatio: '16/9' }}>
          {hasVideo ? (
            <video
              ref={videoRef}
              className="max-w-full max-h-full"
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              style={{ transition: 'none' }}
            />
          ) : isAudioOnly ? (
            <div className="flex flex-col items-center gap-3 select-none pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
                <Music size={24} className="text-[var(--accent)]" />
              </div>
              <p className="text-xs text-[var(--text-muted)]">{formatDuration(duration)}</p>
              {/* Hidden audio element still drives the logic */}
              <video ref={videoRef} className="hidden" playsInline preload="auto" crossOrigin="anonymous" />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: clip?.color ?? '#000' }}
            />
          )}

          {/* Play/pause overlay on click */}
          {hasVideo && (
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={handlePlayPause}
            />
          )}
        </div>

        {/* Scrub bar */}
        <div className="px-4 pt-3 pb-1">
          <div
            className="h-[5px] rounded-full bg-[var(--bg-overlay)] relative cursor-pointer group/scrub hover:h-[7px] transition-all duration-100"
            onClick={handleScrubClick}
          >
            {/* In-to-out region */}
            {outFrac > inFrac && (
              <div
                className="absolute top-0 h-full bg-purple-500/30 rounded-full pointer-events-none"
                style={{ left: `${inFrac * 100}%`, width: `${(outFrac - inFrac) * 100}%` }}
              />
            )}
            {/* Playhead progress */}
            <div
              className="h-full bg-[var(--accent)] rounded-full pointer-events-none"
              style={{ width: `${progressFrac * 100}%` }}
            />
            {/* In-point marker */}
            {inFrac > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-purple-400 pointer-events-none"
                style={{ left: `${inFrac * 100}%` }}
              />
            )}
            {/* Out-point marker */}
            {outFrac < 1 && outFrac > 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-purple-400 pointer-events-none"
                style={{ left: `${outFrac * 100}%` }}
              />
            )}
            {/* Thumb */}
            <div
              className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/scrub:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${progressFrac * 100}%` }}
            />
          </div>
        </div>

        {/* Timecode row */}
        <div className="flex items-center justify-between px-4 py-1 text-[11px] font-mono">
          <span className="text-purple-400">IN  {formatTimecode(inPoint).slice(0, 11)}</span>
          <span className="text-[var(--text-secondary)]">{formatTimecode(currentTime)}</span>
          <span className="text-purple-400">OUT {formatTimecode(effectiveOut).slice(0, 11)}</span>
        </div>

        {/* Transport & action row */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] shrink-0">

          {/* In/Out buttons */}
          <Tooltip content="Set In-Point  I">
            <button
              onClick={handleSetIn}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition-colors"
            >
              <InPointIcon />
              In
            </button>
          </Tooltip>

          <Tooltip content="Set Out-Point  O">
            <button
              onClick={handleSetOut}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 transition-colors"
            >
              <OutPointIcon />
              Out
            </button>
          </Tooltip>

          {/* Transport */}
          <div className="flex-1 flex items-center justify-center gap-1.5">
            <SvButton label="Step back  ←" onClick={() => {
              const v = videoRef.current; if (v) { const t = Math.max(v.currentTime - 1/30, 0); v.currentTime = t; setCurrentTime(t) }
            }}>
              <StepBackIcon />
            </SvButton>

            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={handlePlayPause}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isPlaying
                  ? <motion.span key="p" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.09 }}><Pause size={13} /></motion.span>
                  : <motion.span key="pl" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={{ duration: 0.09 }}><Play size={13} className="ml-0.5" /></motion.span>
                }
              </AnimatePresence>
            </motion.button>

            <SvButton label="Step forward  →" onClick={() => {
              const v = videoRef.current; if (v) { const t = Math.min(v.currentTime + 1/30, duration); v.currentTime = t; setCurrentTime(t) }
            }}>
              <StepForwardIcon />
            </SvButton>
          </div>

          {/* Selection info */}
          <span className="text-[11px] text-[var(--text-muted)] font-mono min-w-[56px] text-right">
            {selectionSecs > 0 ? formatDuration(selectionSecs) : '–'}
          </span>

          {/* Add to Timeline */}
          <Tooltip content={`Add selection to timeline at playhead  (${formatDuration(selectionSecs)})`}>
            <button
              onClick={handleAddToTimeline}
              disabled={!clip || selectionSecs <= 0}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                'bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] active:scale-[0.97]',
                'disabled:opacity-40 disabled:pointer-events-none'
              )}
            >
              <Plus16 />
              Add to Timeline
            </button>
          </Tooltip>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Micro icons ────────────────────────────────────────────────────────────────

function InPointIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
      <rect x="1" y="1" width="1.5" height="9" rx="0.5" />
      <path d="M3.5 5.5L8 2.5v6L3.5 5.5Z" />
    </svg>
  )
}
function OutPointIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
      <rect x="8.5" y="1" width="1.5" height="9" rx="0.5" />
      <path d="M7.5 5.5L3 2.5v6L7.5 5.5Z" />
    </svg>
  )
}
function StepBackIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M12 2L5.5 7L12 12V2Z" />
    </svg>
  )
}
function StepForwardIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
      <rect x="10.5" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M2 2L8.5 7L2 12V2Z" />
    </svg>
  )
}
function Plus16(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SvButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }): JSX.Element {
  return (
    <Tooltip content={label}>
      <button
        onClick={onClick}
        className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-secondary)] transition-colors active:scale-[0.93]"
      >
        {children}
      </button>
    </Tooltip>
  )
}
