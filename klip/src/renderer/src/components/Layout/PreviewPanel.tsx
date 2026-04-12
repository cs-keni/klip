import { useRef, useEffect, useMemo, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { pathToFileUrl, formatTimecode } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import type { TimelineClip } from '@/types/timeline'

export default function PreviewPanel(): JSX.Element {
  // ── Store ────────────────────────────────────────────────────────────────
  const {
    tracks, clips: timelineClips,
    playheadTime, setPlayheadTime,
    isPlaying, setIsPlaying
  } = useTimelineStore()

  const { clips: mediaClips } = useMediaStore()

  // ── Derived: clips on the first video track, sorted ──────────────────────
  const videoTrack = useMemo(() => tracks.find((t) => t.type === 'video'), [tracks])

  const videoClips = useMemo(
    () =>
      videoTrack
        ? timelineClips
            .filter((c) => c.trackId === videoTrack.id)
            .sort((a, b) => a.startTime - b.startTime)
        : [],
    [timelineClips, videoTrack]
  )

  const totalDuration = useMemo(() => {
    if (videoClips.length === 0) return 0
    const last = videoClips[videoClips.length - 1]
    return last.startTime + last.duration
  }, [videoClips])

  // ── Refs (stable across renders, safe to use inside rAF closures) ────────
  const videoRef       = useRef<HTMLVideoElement>(null)
  const isPlayingRef   = useRef(false)
  const rafRef         = useRef<number | null>(null)
  const currentSrcRef  = useRef('')          // tracks what src we last set
  const videoClipsRef  = useRef(videoClips)
  const mediaClipsRef  = useRef(mediaClips)
  const playheadRef    = useRef(playheadTime)

  // Keep refs in sync with latest renders
  useEffect(() => { videoClipsRef.current  = videoClips  }, [videoClips])
  useEffect(() => { mediaClipsRef.current  = mediaClips  }, [mediaClips])
  useEffect(() => { playheadRef.current    = playheadTime }, [playheadTime])
  useEffect(() => { isPlayingRef.current   = isPlaying   }, [isPlaying])

  // ── Helpers (use refs so closures always see latest data) ────────────────

  function findClipAt(time: number): TimelineClip | null {
    return (
      videoClipsRef.current.find(
        (c) => time >= c.startTime && time < c.startTime + c.duration
      ) ?? null
    )
  }

  function findNextClipAfter(time: number): TimelineClip | null {
    return (
      videoClipsRef.current
        .filter((c) => c.startTime >= time - 0.01)
        .sort((a, b) => a.startTime - b.startTime)[0] ?? null
    )
  }

  function getMediaClip(tlClip: TimelineClip) {
    return mediaClipsRef.current.find((m) => m.id === tlClip.mediaClipId) ?? null
  }

  function cancelRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  // ── Playback engine ──────────────────────────────────────────────────────

  function stopPlayback() {
    isPlayingRef.current = false
    cancelRaf()
    videoRef.current?.pause()
    setIsPlaying(false)
  }

  function playClip(tlClip: TimelineClip, fromPlayhead: number) {
    if (!isPlayingRef.current) return
    const media = getMediaClip(tlClip)
    const video = videoRef.current
    if (!video) return

    if (!media || media.type !== 'video' || !media.path) {
      // Non-video clip (image / color): advance time via rAF then continue
      const clipEnd = tlClip.startTime + tlClip.duration
      advanceGap(fromPlayhead, clipEnd, () => {
        const next = findNextClipAfter(clipEnd)
        if (next && next.id !== tlClip.id) {
          if (next.startTime > clipEnd + 0.01) {
            advanceGap(clipEnd, next.startTime, () => playClip(next, next.startTime))
          } else {
            playClip(next, next.startTime)
          }
        } else {
          stopPlayback()
        }
      })
      return
    }

    const url        = pathToFileUrl(media.path)
    const seekTo     = tlClip.trimStart + (fromPlayhead - tlClip.startTime)
    const clipEndSrc = tlClip.trimStart + tlClip.duration

    function doPlay() {
      if (!isPlayingRef.current) return
      video.currentTime = seekTo
      video.play().catch((err) => {
        // AbortError fires when play() is interrupted by a rapid src change — safe to ignore
        if (isPlayingRef.current && (err as DOMException).name !== 'AbortError') stopPlayback()
      })
      runRafLoop(tlClip, clipEndSrc)
    }

    if (currentSrcRef.current !== url) {
      currentSrcRef.current = url
      video.pause()
      video.src = url
      video.load()
      video.addEventListener('loadedmetadata', doPlay, { once: true })
    } else {
      doPlay()
    }
  }

  function runRafLoop(tlClip: TimelineClip, clipEndInSource: number) {
    cancelRaf()

    function tick() {
      const video = videoRef.current
      if (!video || !isPlayingRef.current) return

      // Sync playhead to video's actual clock
      const newPlayhead = tlClip.startTime + (video.currentTime - tlClip.trimStart)
      setPlayheadTime(newPlayhead)

      // Detect clip end
      if (video.ended || video.currentTime >= clipEndInSource - 0.05) {
        const clipEnd = tlClip.startTime + tlClip.duration
        const next    = findNextClipAfter(clipEnd)

        if (next && next.id !== tlClip.id) {
          if (next.startTime > clipEnd + 0.01) {
            // Gap between clips — pause video while we advance the clock
            video.pause()
            advanceGap(clipEnd, next.startTime, () => playClip(next, next.startTime))
          } else {
            // Adjacent clip — don't pause, just switch src immediately
            playClip(next, next.startTime)
          }
        } else {
          video.pause()
          setPlayheadTime(clipEnd)
          stopPlayback()
        }
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  /** Advance playhead through a gap (or non-video segment) in real time. */
  function advanceGap(from: number, to: number, onDone: () => void) {
    if (!isPlayingRef.current) return
    cancelRaf()
    const duration = to - from
    if (duration <= 0.001) { onDone(); return }

    const startWall = performance.now()

    function tick(now: number) {
      if (!isPlayingRef.current) return
      const newTime = Math.min(from + (now - startWall) / 1000, to)
      setPlayheadTime(newTime)
      if (newTime >= to) { onDone(); return }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // Start / stop playback when isPlaying changes
  useEffect(() => {
    if (!isPlaying) {
      stopPlayback()
      return
    }

    isPlayingRef.current = true
    const time = playheadRef.current
    const clip = findClipAt(time)

    if (clip) {
      playClip(clip, time)
    } else {
      const next = findNextClipAfter(time)
      if (next) {
        if (next.startTime > time + 0.01) {
          advanceGap(time, next.startTime, () => playClip(next, next.startTime))
        } else {
          playClip(next, next.startTime)
        }
      } else {
        setIsPlaying(false)
      }
    }

    return () => { stopPlayback() }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scrub (when NOT playing) ─────────────────────────────────────────────
  // Runs whenever playheadTime changes and we are paused
  const activeTimelineClip = useMemo(() => findClipAt(playheadTime), [playheadTime, videoClips]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeMediaClip    = useMemo(
    () => (activeTimelineClip ? mediaClips.find((m) => m.id === activeTimelineClip.mediaClipId) ?? null : null),
    [activeTimelineClip, mediaClips]
  )

  useEffect(() => {
    if (isPlayingRef.current) return // rAF loop handles it
    const video = videoRef.current
    if (!video) return

    if (!activeMediaClip || !activeTimelineClip || activeMediaClip.type !== 'video' || !activeMediaClip.path) {
      // No video at playhead — clear src so element shows nothing (black)
      if (currentSrcRef.current) {
        currentSrcRef.current = ''
        video.removeAttribute('src')
        video.load()
      }
      return
    }

    const url    = pathToFileUrl(activeMediaClip.path)
    const seekTo = activeTimelineClip.trimStart + (playheadTime - activeTimelineClip.startTime)

    if (currentSrcRef.current !== url) {
      currentSrcRef.current = url
      video.src = url
      video.load()
      video.addEventListener('loadedmetadata', () => {
        if (!isPlayingRef.current) video.currentTime = seekTo
      }, { once: true })
    } else {
      video.currentTime = seekTo
    }
  }, [playheadTime, activeMediaClip?.id, activeTimelineClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Display helpers ──────────────────────────────────────────────────────
  const isEmpty    = videoClips.length === 0
  const showColor  = activeTimelineClip?.type === 'color'
  const showImage  = !showColor && activeMediaClip?.type === 'image'
  const showVideo  = !showColor && !showImage && !isEmpty

  const colorBg  = showColor ? (activeTimelineClip!.color ?? '#000') : null
  const imageSrc = showImage && activeMediaClip?.path ? pathToFileUrl(activeMediaClip.path) : null

  const progressFraction = totalDuration > 0 ? Math.min(1, playheadTime / totalDuration) : 0

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-surface)]">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
          Preview
        </span>
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          {formatTimecode(playheadTime)}
        </span>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden">

        {/* Video element — always in DOM for seamless src switching */}
        <video
          ref={videoRef}
          className={cn('max-w-full max-h-full', showVideo ? 'block' : 'hidden')}
          playsInline
          crossOrigin="anonymous"
        />

        {/* Color clip */}
        {showColor && (
          <div className="absolute inset-0" style={{ backgroundColor: colorBg ?? '#000' }} />
        )}

        {/* Image clip */}
        {showImage && imageSrc && (
          <img
            src={imageSrc}
            alt=""
            className="max-w-full max-h-full object-contain"
            crossOrigin="anonymous"
          />
        )}

        {/* Empty / gap state */}
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 text-center pointer-events-none select-none">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center">
              <Play size={18} className="text-[var(--text-muted)] ml-0.5" />
            </div>
            <p className="text-xs text-[var(--text-muted)]">No clips in timeline</p>
          </div>
        )}

        {/* ── Controls overlay ─────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col">
          {/* Progress / scrub bar — YouTube-style: grows on hover, dot appears */}
          <div
            className="px-3 pb-1 pt-2 cursor-pointer group/bar"
            onClick={(e) => {
              if (totalDuration <= 0) return
              // measure the inner track, not the padding wrapper
              const track = e.currentTarget.querySelector<HTMLDivElement>('[data-track]')
              if (!track) return
              const rect = track.getBoundingClientRect()
              const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              setPlayheadTime(fraction * totalDuration)
            }}
          >
            <div
              data-track=""
              className="h-[3px] group-hover/bar:h-[5px] rounded-full bg-[var(--bg-overlay)] relative transition-all duration-150"
            >
              <div
                className="h-full bg-[var(--accent)] rounded-full"
                style={{ width: `${progressFraction * 100}%` }}
              />
              {/* Scrub dot */}
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${progressFraction * 100}%` }}
              />
            </div>
          </div>

          {/* Transport row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
            {/* Timecode */}
            <span className="text-[11px] font-mono text-[var(--text-secondary)] w-[72px]">
              {formatTimecode(playheadTime)}
            </span>

            {/* Transport buttons */}
            <div className="flex-1 flex items-center justify-center gap-1">
              <TransportBtn
                label="Step back  ←"
                onClick={() => setPlayheadTime(Math.max(0, playheadTime - 1 / 30))}
              >
                <StepBackIcon />
              </TransportBtn>

              <motion.button
                tabIndex={-1}  // Space bar is handled by the global keyboard handler
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={() => setIsPlaying(!isPlaying)}
                title="Play / Pause  Space"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.span
                      key="pause"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Pause size={14} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="play"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Play size={14} className="ml-0.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <TransportBtn
                label="Step forward  →"
                onClick={() => setPlayheadTime(playheadTime + 1 / 30)}
              >
                <StepForwardIcon />
              </TransportBtn>
            </div>

            {/* Right controls */}
            <div className="w-[72px] flex items-center justify-end gap-2">
              <Tooltip content="Volume (coming soon)">
                <button className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
                  <Volume2 size={13} />
                </button>
              </Tooltip>
              <Tooltip content="Fullscreen  F">
                <button
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  onClick={() => videoRef.current?.requestFullscreen?.()}
                >
                  <Maximize2 size={13} />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TransportBtn({
  children,
  label,
  onClick
}: {
  children: ReactNode
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <Tooltip content={label}>
      <button
        tabIndex={-1}
        onClick={onClick}
        className="flex items-center justify-center w-7 h-7 rounded text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-secondary)] transition-colors duration-100 active:scale-[0.93]"
      >
        {children}
      </button>
    </Tooltip>
  )
}

function StepBackIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M12 2L5.5 7L12 12V2Z" />
    </svg>
  )
}

function StepForwardIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="10.5" y="2" width="1.5" height="10" rx="0.5" />
      <path d="M2 2L8.5 7L2 12V2Z" />
    </svg>
  )
}
