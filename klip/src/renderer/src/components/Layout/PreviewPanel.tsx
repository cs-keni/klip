import { useRef, useEffect, useMemo, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, Maximize2, Repeat, Zap, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { pathToFileUrl, formatTimecode } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import type { TimelineClip, TextSettings } from '@/types/timeline'

/** Returns true if a track is effectively muted given the global solo state. */
function isEffectivelyMuted(trackId: string, tracks: ReturnType<typeof useTimelineStore.getState>['tracks']): boolean {
  const track = tracks.find((t) => t.id === trackId)
  if (!track) return false
  if (track.isMuted) return true
  const anySolo = tracks.some((t) => t.isSolo)
  return anySolo && !track.isSolo
}

export default function PreviewPanel(): JSX.Element {
  // ── Quick Preview state ──────────────────────────────────────────────────
  type QuickPreviewState = 'idle' | 'rendering' | 'ready'
  const [qpState, setQpState]         = useState<QuickPreviewState>('idle')
  const [qpProgress, setQpProgress]   = useState(0)
  const [qpError, setQpError]         = useState<string | null>(null)
  const qpVideoRef                    = useRef<HTMLVideoElement>(null)

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    tracks, clips: timelineClips, transitions,
    playheadTime, setPlayheadTime,
    isPlaying, setIsPlaying,
    loopIn, loopOut, loopEnabled,
    toggleLoop
  } = useTimelineStore()

  const { clips: mediaClips } = useMediaStore()

  // ── Derived: video track clips ───────────────────────────────────────────
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

  // ── Derived: audio + music track clips ──────────────────────────────────
  const audioTracks = useMemo(() => tracks.filter((t) => t.type === 'audio' || t.type === 'music'), [tracks])

  const audioClips = useMemo(
    () =>
      timelineClips
        .filter((c) => audioTracks.some((t) => t.id === c.trackId))
        .sort((a, b) => a.startTime - b.startTime),
    [timelineClips, audioTracks]
  )

  // ── Derived: overlay (text) clips ────────────────────────────────────────
  const overlayTrack = useMemo(() => tracks.find((t) => t.type === 'overlay'), [tracks])
  const overlayClips = useMemo(
    () =>
      overlayTrack
        ? timelineClips
            .filter((c) => c.trackId === overlayTrack.id && c.type === 'text')
            .sort((a, b) => a.startTime - b.startTime)
        : [],
    [timelineClips, overlayTrack]
  )

  const totalDuration = useMemo(() => {
    const allClips = [...videoClips, ...audioClips]
    if (allClips.length === 0) return 0
    return allClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
  }, [videoClips, audioClips])

  // ── Refs ─────────────────────────────────────────────────────────────────
  const videoRef             = useRef<HTMLVideoElement>(null)
  const audioRef             = useRef<HTMLAudioElement>(null)
  const isPlayingRef         = useRef(false)
  const rafRef               = useRef<number | null>(null)
  const currentSrcRef        = useRef('')
  const currentAudioSrcRef   = useRef('')
  const videoClipsRef        = useRef(videoClips)
  const audioClipsRef        = useRef(audioClips)
  const mediaClipsRef        = useRef(mediaClips)
  const tracksRef            = useRef(tracks)
  const transitionsRef       = useRef(transitions)
  const playheadRef          = useRef(playheadTime)
  const fadeInRef            = useRef<{ startWall: number; duration: number } | null>(null)
  const loopInRef            = useRef(loopIn)
  const loopOutRef           = useRef(loopOut)
  const loopEnabledRef       = useRef(loopEnabled)

  useEffect(() => { videoClipsRef.current      = videoClips   }, [videoClips])
  useEffect(() => { audioClipsRef.current      = audioClips   }, [audioClips])
  useEffect(() => { mediaClipsRef.current      = mediaClips   }, [mediaClips])
  useEffect(() => { tracksRef.current          = tracks       }, [tracks])
  useEffect(() => { transitionsRef.current     = transitions  }, [transitions])
  useEffect(() => { playheadRef.current        = playheadTime }, [playheadTime])
  useEffect(() => { isPlayingRef.current       = isPlaying    }, [isPlaying])
  useEffect(() => { loopInRef.current          = loopIn       }, [loopIn])
  useEffect(() => { loopOutRef.current         = loopOut      }, [loopOut])
  useEffect(() => { loopEnabledRef.current     = loopEnabled  }, [loopEnabled])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function findClipAt(time: number): TimelineClip | null {
    return videoClipsRef.current.find(
      (c) => time >= c.startTime && time < c.startTime + c.duration
    ) ?? null
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

  // ── Opacity management for transitions ───────────────────────────────────
  function computeVideoOpacity(tlClip: TimelineClip, playhead: number): number {
    // Fade-in (incoming transition)
    if (fadeInRef.current) {
      const elapsed = (performance.now() - fadeInRef.current.startWall) / 1000
      const progress = Math.min(1, elapsed / fadeInRef.current.duration)
      if (progress >= 1) { fadeInRef.current = null; return 1 }
      return progress
    }
    // Fade-out (outgoing transition)
    const outT = transitionsRef.current.find((t) => t.fromClipId === tlClip.id)
    if (outT) {
      const clipEnd   = tlClip.startTime + tlClip.duration
      const fadeStart = clipEnd - outT.duration
      if (playhead >= fadeStart) {
        return Math.max(0, 1 - (playhead - fadeStart) / outT.duration)
      }
    }
    return 1
  }

  function applyClipEffects(clip: TimelineClip) {
    const video = videoRef.current
    if (!video) return

    // Color grade via CSS filter
    if (clip.colorSettings) {
      const { brightness, contrast, saturation } = clip.colorSettings
      video.style.filter = [
        `brightness(${1 + brightness})`,
        `contrast(${1 + contrast})`,
        `saturate(${1 + saturation})`
      ].join(' ')
    } else {
      video.style.filter = ''
    }

    // Crop / zoom via CSS transform
    if (clip.cropSettings && clip.cropSettings.zoom > 1) {
      const { zoom, panX, panY } = clip.cropSettings
      const maxPan = ((zoom - 1) / (2 * zoom)) * 100
      video.style.transform = `scale(${zoom}) translate(${panX * maxPan}%, ${panY * maxPan}%)`
    } else {
      video.style.transform = ''
    }
  }

  function clearClipEffects() {
    const video = videoRef.current
    if (!video) return
    video.style.filter    = ''
    video.style.transform = ''
    video.style.opacity   = '1'
  }

  // ── Playback engine ──────────────────────────────────────────────────────
  function stopPlayback() {
    isPlayingRef.current = false
    cancelRaf()
    videoRef.current?.pause()
    audioRef.current?.pause()
    clearClipEffects()
    setIsPlaying(false)
  }

  // ── Audio track helpers ──────────────────────────────────────────────────
  function findAudioClipAt(time: number): TimelineClip | null {
    return audioClipsRef.current.find(
      (c) => time >= c.startTime && time < c.startTime + c.duration
    ) ?? null
  }

  function startAudioPlayback(fromTime: number) {
    const audio = audioRef.current
    if (!audio) return

    const tlClip = findAudioClipAt(fromTime)
    if (!tlClip) { audio.pause(); return }

    const media = mediaClipsRef.current.find((m) => m.id === tlClip.mediaClipId)
    if (!media?.path) return

    audio.muted  = isEffectivelyMuted(tlClip.trackId, tracksRef.current)
    audio.volume = tlClip.volume ?? 1

    const url    = pathToFileUrl(media.path)
    const seekTo = tlClip.trimStart + (fromTime - tlClip.startTime)

    if (currentAudioSrcRef.current !== url) {
      currentAudioSrcRef.current = url
      audio.src = url
      audio.load()
      audio.addEventListener('loadedmetadata', () => {
        if (!isPlayingRef.current) return
        audio.currentTime = seekTo
        audio.play().catch(() => {})
      }, { once: true })
    } else {
      audio.currentTime = seekTo
      audio.play().catch(() => {})
    }
  }

  function playClip(tlClip: TimelineClip, fromPlayhead: number) {
    if (!isPlayingRef.current) return
    const media = getMediaClip(tlClip)
    const video = videoRef.current
    if (!video) return

    // Speed for this clip
    const speed = tlClip.speed ?? 1

    // Check for incoming transition → start fade-in
    const inT = transitionsRef.current.find((t) => t.toClipId === tlClip.id)
    if (inT) {
      fadeInRef.current = { startWall: performance.now(), duration: inT.duration }
    } else {
      fadeInRef.current = null
      video.style.opacity = '1'
    }

    if (media?.type === 'video') {
      video.volume = tlClip.volume ?? 1
      video.muted  = isEffectivelyMuted(tlClip.trackId, tracksRef.current)
      video.playbackRate = speed
    }

    if (!media || media.type !== 'video' || !media.path) {
      // Non-video clip: advance time via rAF
      applyClipEffects(tlClip)
      const clipEnd = tlClip.startTime + tlClip.duration
      advanceGap(fromPlayhead, clipEnd, () => {
        clearClipEffects()
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
    const seekTo     = tlClip.trimStart + (fromPlayhead - tlClip.startTime) * speed
    const clipEndSrc = tlClip.trimStart + tlClip.duration * speed

    function doPlay() {
      if (!isPlayingRef.current) return
      const v = videoRef.current
      if (!v) return
      v.currentTime  = seekTo
      v.playbackRate = speed
      applyClipEffects(tlClip)
      v.play().catch((err) => {
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
    const speed = tlClip.speed ?? 1

    function tick() {
      const video = videoRef.current
      if (!video || !isPlayingRef.current) return

      // Sync playhead to video's actual clock (adjusted for speed)
      const newPlayhead = tlClip.startTime + (video.currentTime - tlClip.trimStart) / speed
      setPlayheadTime(newPlayhead)

      // ── Loop check ──────────────────────────────────────────────────────
      if (
        loopEnabledRef.current &&
        loopInRef.current !== null &&
        loopOutRef.current !== null &&
        newPlayhead >= loopOutRef.current
      ) {
        const jumpTo = loopInRef.current
        video.pause()
        cancelRaf()
        seekTo(jumpTo)
        return
      }

      // Apply transition opacity
      const opacity = computeVideoOpacity(tlClip, newPlayhead)
      video.style.opacity = String(opacity)

      // Detect clip end
      if (video.ended || video.currentTime >= clipEndInSource - 0.05) {
        const clipEnd = tlClip.startTime + tlClip.duration
        const next    = findNextClipAfter(clipEnd)

        if (next && next.id !== tlClip.id) {
          clearClipEffects()
          if (next.startTime > clipEnd + 0.01) {
            video.pause()
            advanceGap(clipEnd, next.startTime, () => playClip(next, next.startTime))
          } else {
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

      // Loop check during gap advance
      if (
        loopEnabledRef.current &&
        loopInRef.current !== null &&
        loopOutRef.current !== null &&
        newTime >= loopOutRef.current
      ) {
        cancelRaf()
        seekTo(loopInRef.current)
        return
      }

      if (newTime >= to) { onDone(); return }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // ── Seek ─────────────────────────────────────────────────────────────────
  function seekTo(time: number) {
    playheadRef.current = time
    setPlayheadTime(time)

    if (!isPlayingRef.current) return

    cancelRaf()
    videoRef.current?.pause()
    audioRef.current?.pause()
    startAudioPlayback(time)

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
        stopPlayback()
      }
    }
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
        return
      }
    }

    startAudioPlayback(time)

    return () => { stopPlayback() }
  }, [isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scrub (paused) ───────────────────────────────────────────────────────
  const activeTimelineClip = useMemo(() => findClipAt(playheadTime), [playheadTime, videoClips]) // eslint-disable-line react-hooks/exhaustive-deps
  const activeMediaClip    = useMemo(
    () => (activeTimelineClip ? mediaClips.find((m) => m.id === activeTimelineClip.mediaClipId) ?? null : null),
    [activeTimelineClip, mediaClips]
  )

  useEffect(() => {
    if (isPlayingRef.current) return
    const video = videoRef.current
    if (!video) return

    if (!activeMediaClip || !activeTimelineClip || activeMediaClip.type !== 'video' || !activeMediaClip.path) {
      if (currentSrcRef.current) {
        currentSrcRef.current = ''
        video.removeAttribute('src')
        video.load()
      }
      // Apply effects even for non-video clips during scrub
      if (activeTimelineClip) applyClipEffects(activeTimelineClip)
      else clearClipEffects()
      return
    }

    const url    = pathToFileUrl(activeMediaClip.path)
    const offset = activeTimelineClip.trimStart + (playheadTime - activeTimelineClip.startTime) * (activeTimelineClip.speed ?? 1)

    applyClipEffects(activeTimelineClip)

    if (currentSrcRef.current !== url) {
      currentSrcRef.current = url
      video.src = url
      video.load()
      video.addEventListener('loadedmetadata', () => {
        if (!isPlayingRef.current) video.currentTime = offset
      }, { once: true })
    } else {
      video.currentTime = offset
    }
  }, [playheadTime, activeMediaClip?.id, activeTimelineClip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-apply effects when color/crop settings change while paused ────────
  // The scrub effect above only re-runs on clip/time changes, not settings changes.
  // This separate effect watches the individual setting values so adjusting
  // brightness/contrast/zoom in the context menu is immediately visible.
  useEffect(() => {
    if (isPlayingRef.current) return
    if (activeTimelineClip) applyClipEffects(activeTimelineClip)
    else clearClipEffects()
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    activeTimelineClip?.colorSettings?.brightness,
    activeTimelineClip?.colorSettings?.contrast,
    activeTimelineClip?.colorSettings?.saturation,
    activeTimelineClip?.cropSettings?.zoom,
    activeTimelineClip?.cropSettings?.panX,
    activeTimelineClip?.cropSettings?.panY,
  ])

  // ── Quick Render Preview ─────────────────────────────────────────────────

  // Subscribe to quick preview IPC events
  useEffect(() => {
    const unsubProgress = window.api.export.onQuickPreviewProgress((p) => {
      setQpProgress(p.progress)
    })
    const unsubDone = window.api.export.onQuickPreviewDone((filePath) => {
      setQpState('ready')
      setQpError(null)
      // Auto-play the result
      setTimeout(() => {
        const vid = qpVideoRef.current
        if (!vid) return
        vid.src = pathToFileUrl(filePath)
        vid.load()
        vid.play().catch(() => {})
      }, 100)
    })
    const unsubError = window.api.export.onQuickPreviewError((msg) => {
      setQpState('idle')
      setQpError(msg)
    })
    return () => { unsubProgress(); unsubDone(); unsubError() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleQuickPreview = useCallback(() => {
    const {
      tracks: allTracks,
      clips: allClips,
      transitions: allTransitions
    } = useTimelineStore.getState()
    const { clips: allMedia } = useMediaStore.getState()

    const videoTrackLocal  = allTracks.find((t) => t.type === 'video')
    const audioTracksLocal = allTracks.filter((t) => t.type === 'audio' || t.type === 'music')
    const overlayTrackLocal = allTracks.find((t) => t.type === 'overlay')

    if (!videoTrackLocal) return

    const totalDur = allClips.reduce((mx, c) => Math.max(mx, c.startTime + c.duration), 0)
    if (totalDur <= 0) return

    const mediaPaths:  Record<string, string> = {}
    const mediaTypes:  Record<string, string> = {}
    const mediaColors: Record<string, string> = {}
    for (const mc of allMedia) {
      if (mc.path)  mediaPaths[mc.id]  = mc.path
      mediaTypes[mc.id]  = mc.type
      if (mc.color) mediaColors[mc.id] = mc.color
    }

    const job = {
      outputPath: '__quick_preview__',   // main process overrides this with a temp path
      width: 1280, height: 720, fps: 30,
      crf: 30, x264Preset: 'ultrafast',
      audioBitrate: '128k', sampleRate: 44100,
      totalDuration: totalDur,
      videoTrackId:   videoTrackLocal.id,
      audioTrackIds:  audioTracksLocal.map((t) => t.id),
      overlayTrackId: overlayTrackLocal?.id ?? '',
      clips: allClips.map((c) => ({
        id: c.id, mediaClipId: c.mediaClipId, trackId: c.trackId,
        clipType: c.type, startTime: c.startTime, trimStart: c.trimStart,
        duration: c.duration, volume: c.volume ?? 1, speed: c.speed,
        textSettings: c.textSettings, colorSettings: c.colorSettings, cropSettings: c.cropSettings
      })),
      transitions: allTransitions.map((t) => ({
        fromClipId: t.fromClipId, toClipId: t.toClipId, type: t.type, duration: t.duration
      })),
      mediaPaths, mediaTypes, mediaColors,
      trackMutes: Object.fromEntries(allTracks.map((t) => [t.id, t.isMuted])),
      trackSolos: allTracks.filter((t) => t.isSolo).map((t) => t.id)
    }

    setQpState('rendering')
    setQpProgress(0)
    setQpError(null)
    window.api.export.quickPreview(job)
  }, [])

  const handleCloseQuickPreview = useCallback(() => {
    window.api.export.cancelQuickPreview()
    setQpState('idle')
    setQpProgress(0)
    setQpError(null)
    const vid = qpVideoRef.current
    if (vid) { vid.pause(); vid.src = '' }
  }, [])

  // Active text clips at playhead
  const activeTextClips = useMemo(
    () => overlayClips.filter(
      (c) => playheadTime >= c.startTime && playheadTime < c.startTime + c.duration
    ),
    [overlayClips, playheadTime]
  )

  // ── Display helpers ──────────────────────────────────────────────────────
  const isEmpty   = videoClips.length === 0
  const showColor = activeTimelineClip?.type === 'color'
  const showImage = !showColor && activeMediaClip?.type === 'image'
  const showVideo = !showColor && !showImage && !isEmpty

  const colorBg  = showColor ? (activeTimelineClip!.color ?? '#000') : null
  const imageSrc = showImage && activeMediaClip?.path ? pathToFileUrl(activeMediaClip.path) : null

  const progressFraction = totalDuration > 0 ? Math.min(1, playheadTime / totalDuration) : 0

  // Loop region fractions on the scrub bar
  const loopInFrac  = (loopIn  !== null && totalDuration > 0) ? Math.min(1, loopIn  / totalDuration) : null
  const loopOutFrac = (loopOut !== null && totalDuration > 0) ? Math.min(1, loopOut / totalDuration) : null

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

        {/* ── Quick Render Preview overlay ────────────────────────────── */}
        <AnimatePresence>
          {qpState === 'rendering' && (
            <motion.div
              key="qp-rendering"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Rendering Quick Preview…</p>
              <div className="w-48 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--accent)] rounded-full"
                  animate={{ width: `${qpProgress * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">{Math.round(qpProgress * 100)}%  ·  720p Draft</p>
              <button
                onClick={handleCloseQuickPreview}
                className="mt-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
              >
                Cancel
              </button>
            </motion.div>
          )}

          {qpState === 'ready' && (
            <motion.div
              key="qp-ready"
              className="absolute inset-0 z-30 flex flex-col bg-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between px-3 py-1.5 shrink-0 bg-[var(--bg-elevated)]">
                <span className="text-[11px] font-semibold text-[var(--accent-bright)] uppercase tracking-widest">
                  Quick Preview  ·  Draft 720p
                </span>
                <button
                  onClick={handleCloseQuickPreview}
                  className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <video
                  ref={qpVideoRef}
                  className="max-w-full max-h-full"
                  controls
                  playsInline
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {qpError && (
          <div className="absolute bottom-16 left-3 right-3 z-40 bg-red-950/80 border border-red-700/50 rounded px-3 py-2 text-[11px] text-red-300">
            Quick Preview failed: {qpError.slice(0, 120)}
          </div>
        )}

        {/* Video element — always in DOM for seamless src switching */}
        <video
          ref={videoRef}
          className={cn('max-w-full max-h-full', showVideo ? 'block' : 'hidden')}
          playsInline
          crossOrigin="anonymous"
          style={{ transition: 'none' }}
        />

        {/* Hidden audio element */}
        <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />

        {/* Color clip */}
        {showColor && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: colorBg ?? '#000',
              filter: activeTimelineClip?.colorSettings
                ? buildCssFilter(activeTimelineClip.colorSettings)
                : undefined
            }}
          />
        )}

        {/* Image clip */}
        {showImage && imageSrc && (
          <img
            src={imageSrc}
            alt=""
            className="max-w-full max-h-full object-contain"
            crossOrigin="anonymous"
            style={{
              filter: activeTimelineClip?.colorSettings
                ? buildCssFilter(activeTimelineClip.colorSettings)
                : undefined,
              ...(activeTimelineClip?.cropSettings && activeTimelineClip.cropSettings.zoom > 1
                ? buildCssTransform(activeTimelineClip.cropSettings)
                : {})
            }}
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

        {/* ── Text overlays ──────────────────────────────────────────────── */}
        {activeTextClips.map((clip) => (
          clip.textSettings && (
            <TextOverlay key={clip.id} settings={clip.textSettings} />
          )
        ))}

        {/* ── Controls overlay ─────────────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col">
          {/* Progress / scrub bar */}
          <div
            className="px-3 pb-1 pt-2 cursor-pointer group/bar"
            onClick={(e) => {
              if (totalDuration <= 0) return
              const track = e.currentTarget.querySelector<HTMLDivElement>('[data-track]')
              if (!track) return
              const rect = track.getBoundingClientRect()
              const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              seekTo(fraction * totalDuration)
            }}
          >
            <div
              data-track=""
              className="h-[3px] group-hover/bar:h-[5px] rounded-full bg-[var(--bg-overlay)] relative transition-all duration-150"
            >
              {/* Loop region band */}
              {loopInFrac !== null && loopOutFrac !== null && loopOutFrac > loopInFrac && (
                <div
                  className="absolute top-0 h-full rounded-full pointer-events-none"
                  style={{
                    left: `${loopInFrac * 100}%`,
                    width: `${(loopOutFrac - loopInFrac) * 100}%`,
                    backgroundColor: loopEnabled ? 'rgba(168,85,247,0.5)' : 'rgba(168,85,247,0.25)'
                  }}
                />
              )}
              <div
                className="h-full bg-[var(--accent)] rounded-full"
                style={{ width: `${progressFraction * 100}%` }}
              />
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${progressFraction * 100}%` }}
              />
            </div>
          </div>

          {/* Transport row */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
            <span className="text-[11px] font-mono text-[var(--text-secondary)] w-[72px]">
              {formatTimecode(playheadTime)}
            </span>

            <div className="flex-1 flex items-center justify-center gap-1">
              <TransportBtn
                label="Step back  ←"
                onClick={() => seekTo(Math.max(0, playheadTime - 1 / 30))}
              >
                <StepBackIcon />
              </TransportBtn>

              <motion.button
                tabIndex={-1}
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
                onClick={() => seekTo(playheadTime + 1 / 30)}
              >
                <StepForwardIcon />
              </TransportBtn>
            </div>

            <div className="flex items-center justify-end gap-1.5" style={{ width: 110 }}>
              {/* Loop toggle */}
              <Tooltip content={loopEnabled ? 'Loop on  Ctrl+L' : 'Loop off  Ctrl+L'}>
                <button
                  onClick={toggleLoop}
                  className={cn(
                    'flex items-center justify-center w-6 h-6 rounded transition-colors duration-100',
                    loopEnabled
                      ? 'text-purple-400 bg-purple-500/20'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/10'
                  )}
                >
                  <Repeat size={11} />
                </button>
              </Tooltip>

              {/* Quick Render Preview */}
              <Tooltip content="Quick Render Preview — low-res FFmpeg draft for seamless playback">
                <button
                  onClick={handleQuickPreview}
                  disabled={isEmpty || qpState === 'rendering'}
                  className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-yellow-400 hover:bg-white/10 transition-colors duration-100 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Zap size={11} />
                </button>
              </Tooltip>

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

// ── Text overlay renderer ──────────────────────────────────────────────────────

function TextOverlay({ settings }: { settings: TextSettings }): JSX.Element {
  const {
    content, fontSize, fontColor, bgColor,
    bold, italic, alignment, positionX, positionY
  } = settings

  const style: CSSProperties = {
    position:  'absolute',
    left:      `${positionX * 100}%`,
    top:       `${positionY * 100}%`,
    transform: alignment === 'left'
      ? 'translate(0, -50%)'
      : alignment === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(-50%, -50%)',
    fontSize:   `${fontSize * 0.056}vw`,   // scale relative to preview width
    color:      fontColor,
    fontWeight: bold   ? 'bold'   : 'normal',
    fontStyle:  italic ? 'italic' : 'normal',
    textAlign:  alignment,
    whiteSpace: 'pre-wrap',
    pointerEvents: 'none',
    userSelect: 'none',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    padding:    bgColor !== 'transparent' ? '4px 10px' : undefined,
    backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
    borderRadius:    bgColor !== 'transparent' ? '4px' : undefined,
    lineHeight: 1.2
  }

  return <div style={style}>{content}</div>
}

// ── CSS helpers ────────────────────────────────────────────────────────────────

function buildCssFilter(cs: { brightness: number; contrast: number; saturation: number }): string {
  return [
    `brightness(${1 + cs.brightness})`,
    `contrast(${1 + cs.contrast})`,
    `saturate(${1 + cs.saturation})`
  ].join(' ')
}

function buildCssTransform(crop: { zoom: number; panX: number; panY: number }): CSSProperties {
  const { zoom, panX, panY } = crop
  const maxPan = ((zoom - 1) / (2 * zoom)) * 100
  return { transform: `scale(${zoom}) translate(${panX * maxPan}%, ${panY * maxPan}%)` }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
