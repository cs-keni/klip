import { useRef, useEffect, useMemo, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX, Maximize2, Repeat, Zap, X, Loader2, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { pathToFileUrl, formatTimecode } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import type { TimelineClip, TextSettings } from '@/types/timeline'

const PREVIEW_SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const
type PreviewSpeed = typeof PREVIEW_SPEEDS[number]

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

  // ── Preview speed ─────────────────────────────────────────────────────────
  const [previewSpeed, setPreviewSpeed] = useState<PreviewSpeed>(1)

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const [showControls, setShowControls] = useState(true)
  const hideTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Video loading state ───────────────────────────────────────────────────
  const [isVideoLoading, setIsVideoLoading] = useState(false)

  // ── Scrub bar hover thumbnail ─────────────────────────────────────────────
  const [scrubHover, setScrubHover] = useState<{ frac: number; clientX: number } | null>(null)
  const [thumbUrl, setThumbUrl]     = useState<string | null>(null)
  const thumbVideoRef               = useRef<HTMLVideoElement>(null)
  const thumbGenRef                 = useRef(0)
  const scrubBarRef                 = useRef<HTMLDivElement>(null)

  // ── Save frame context menu ───────────────────────────────────────────────
  const [frameMenu, setFrameMenu] = useState<{ x: number; y: number } | null>(null)

  const handleSaveFrame = useCallback(async () => {
    setFrameMenu(null)
    const video = videoRef.current
    if (!video || !activeMediaClip || activeMediaClip.type !== 'video') return
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = video.videoWidth  || 1920
      canvas.height = video.videoHeight || 1080
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      await window.api.export.saveFrame(dataUrl)
    } catch { /* user cancelled or CORS */ }
  }, [activeMediaClip])

  // Close frame menu on outside click
  useEffect(() => {
    if (!frameMenu) return
    const close = () => setFrameMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [frameMenu])

  // ── Panel ref for fullscreen ──────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null)

  // ── Canvas ref — bounds used for text drag-to-position ────────────────────
  const canvasRef = useRef<HTMLDivElement>(null)

  // ── Speed selector open ───────────────────────────────────────────────────
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const speedMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSpeedMenu) return
    function onOutside(e: MouseEvent) {
      if (!speedMenuRef.current?.contains(e.target as Node)) setShowSpeedMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showSpeedMenu])

  // ── Store ────────────────────────────────────────────────────────────────
  const {
    tracks, clips: timelineClips, transitions,
    playheadTime, setPlayheadTime,
    isPlaying, setIsPlaying,
    shuttleSpeed, setShuttleSpeed,
    loopIn, loopOut, loopEnabled,
    toggleLoop,
    masterVolume, setMasterVolume,
    selectedClipId, setTextSettings
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

  // ── Audio level meters ────────────────────────────────────────────────────
  const [audioLevels, setAudioLevels] = useState({ left: 0, right: 0 })
  const [isClipping, setIsClipping]   = useState(false)
  const clipFlashRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const analyserLRef  = useRef<AnalyserNode | null>(null)
  const analyserRRef  = useRef<AnalyserNode | null>(null)
  const meterRafRef   = useRef<number | null>(null)
  const mediaSourceConnected = useRef(false)

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
  const shuttleSpeedRef      = useRef(shuttleSpeed)
  const previewSpeedRef      = useRef(previewSpeed)
  const masterVolumeRef      = useRef(masterVolume)
  const lastMasterVolumeRef  = useRef(masterVolume > 0 ? masterVolume : 1)

  useEffect(() => {
    masterVolumeRef.current = masterVolume
    if (masterVolume > 0) lastMasterVolumeRef.current = masterVolume
  }, [masterVolume])

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
  useEffect(() => { shuttleSpeedRef.current    = shuttleSpeed }, [shuttleSpeed])
  useEffect(() => { previewSpeedRef.current    = previewSpeed }, [previewSpeed])

  // ── Audio context + level meter setup ────────────────────────────────────
  // Connect the video element to an AnalyserNode once, on mount.
  // We split the stereo signal into L/R channels for the dual-bar meter.
  useEffect(() => {
    const video = videoRef.current
    if (!video || mediaSourceConnected.current) return

    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      const source    = ctx.createMediaElementSource(video)
      const splitter  = ctx.createChannelSplitter(2)
      const analyserL = ctx.createAnalyser()
      const analyserR = ctx.createAnalyser()
      const merger    = ctx.createChannelMerger(2)

      analyserL.fftSize = 256
      analyserR.fftSize = 256

      source.connect(splitter)
      splitter.connect(analyserL, 0)
      splitter.connect(analyserR, 1)
      analyserL.connect(merger, 0, 0)
      analyserR.connect(merger, 0, 1)
      merger.connect(ctx.destination)

      analyserLRef.current = analyserL
      analyserRRef.current = analyserR
      mediaSourceConnected.current = true

      const bufL = new Float32Array(analyserL.fftSize)
      const bufR = new Float32Array(analyserR.fftSize)

      function tick() {
        meterRafRef.current = requestAnimationFrame(tick)
        analyserL.getFloatTimeDomainData(bufL)
        analyserR.getFloatTimeDomainData(bufR)

        let maxL = 0, maxR = 0
        for (let i = 0; i < bufL.length; i++) {
          const a = Math.abs(bufL[i]); if (a > maxL) maxL = a
        }
        for (let i = 0; i < bufR.length; i++) {
          const a = Math.abs(bufR[i]); if (a > maxR) maxR = a
        }

        // Clipping indicator: flash red for 800ms when either channel peaks >= 0 dB
        if (maxL >= 1 || maxR >= 1) {
          setIsClipping(true)
          if (clipFlashRef.current) clearTimeout(clipFlashRef.current)
          clipFlashRef.current = setTimeout(() => setIsClipping(false), 800)
        }

        setAudioLevels({ left: maxL, right: maxR })
      }
      tick()
    } catch {
      // AudioContext creation may fail in certain environments; ignore silently
    }

    return () => {
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current)
      if (clipFlashRef.current) clearTimeout(clipFlashRef.current)
      audioCtxRef.current?.close().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally run once on mount

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

  function findPrevClipBefore(time: number): TimelineClip | null {
    // Clip whose end <= time (with small tolerance) — sorted by startTime desc
    return (
      videoClipsRef.current
        .filter((c) => c.startTime + c.duration <= time + 0.05)
        .sort((a, b) => b.startTime - a.startTime)[0] ?? null
    )
  }

  function getMediaClip(tlClip: TimelineClip) {
    return mediaClipsRef.current.find((m) => m.id === tlClip.mediaClipId) ?? null
  }

  /** Returns the best available playback path for a media clip.
   *  Prefers proxy (smooth 480p) when ready, falls back to source. */
  function getPlaybackPath(media: { path: string; proxyPath?: string | null; proxyStatus?: string }): string {
    if (media.proxyStatus === 'ready' && media.proxyPath) return media.proxyPath
    return media.path
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

  // ── Video loading events ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onWaiting  = () => setIsVideoLoading(true)
    const onCanPlay  = () => setIsVideoLoading(false)
    const onPlaying  = () => setIsVideoLoading(false)
    video.addEventListener('waiting',  onWaiting)
    video.addEventListener('canplay',  onCanPlay)
    video.addEventListener('playing',  onPlaying)
    return () => {
      video.removeEventListener('waiting',  onWaiting)
      video.removeEventListener('canplay',  onCanPlay)
      video.removeEventListener('playing',  onPlaying)
    }
  }, [])

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500)
  }, [])

  // Clean up the timer on unmount
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  // ── Fullscreen — F key ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        } else {
          panelRef.current?.requestFullscreen?.().catch(() => {})
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Playback engine ──────────────────────────────────────────────────────
  function stopPlayback() {
    isPlayingRef.current = false
    cancelRaf()
    videoRef.current?.pause()
    audioRef.current?.pause()
    clearClipEffects()
    setIsPlaying(false)
    // Do NOT reset shuttleSpeed here — callers manage that (Space/K key, play button)
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

    // Linked audio clips have their audio routed through the video element — skip them here
    if (tlClip.linkedClipId) { audio.pause(); return }

    const media = mediaClipsRef.current.find((m) => m.id === tlClip.mediaClipId)
    if (!media?.path) return

    audio.muted  = isEffectivelyMuted(tlClip.trackId, tracksRef.current)
    audio.volume = Math.max(0, Math.min(1, (tlClip.volume ?? 1) * masterVolumeRef.current))

    const url    = pathToFileUrl(media.path) // audio: always use source, proxies are video-only
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
      // Resolve audio control via linked audio clip (if any)
      const linkedAudio = tlClip.linkedClipId
        ? audioClipsRef.current.find((c) => c.id === tlClip.linkedClipId)
        : null
      const clipVol = linkedAudio?.volume ?? tlClip.volume ?? 1
      video.volume = Math.max(0, Math.min(1, clipVol * masterVolumeRef.current))
      video.muted  = isEffectivelyMuted(tlClip.trackId, tracksRef.current) ||
        (linkedAudio ? isEffectivelyMuted(linkedAudio.trackId, tracksRef.current) : false)
      // Effective rate = clip speed × user preview speed × shuttle multiplier (forward only)
      const shuttle = shuttleSpeedRef.current
      const effectiveRate = speed * previewSpeedRef.current * (shuttle > 0 ? shuttle : 1)
      video.playbackRate = Math.min(16, Math.max(0.0625, effectiveRate))
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

    const url        = pathToFileUrl(getPlaybackPath(media))
    const seekTo     = tlClip.trimStart + (fromPlayhead - tlClip.startTime) * speed
    const clipEndSrc = tlClip.trimStart + tlClip.duration * speed

    function doPlay() {
      if (!isPlayingRef.current) return
      const v = videoRef.current
      if (!v) return
      const shuttle = shuttleSpeedRef.current
      // If in reverse shuttle, don't use native video play — reverse RAF handles it
      if (shuttle < 0) {
        v.currentTime = seekTo
        applyClipEffects(tlClip)
        runReverseRaf(tlClip)
        return
      }
      v.currentTime  = seekTo
      const effectiveRate = speed * previewSpeedRef.current * (shuttle > 0 ? shuttle : 1)
      v.playbackRate = Math.min(16, Math.max(0.0625, effectiveRate))
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

  /**
   * Reverse playback — HTML5 video cannot play backward natively.
   * We manually step currentTime backward each animation frame.
   */
  function runReverseRaf(tlClip: TimelineClip) {
    cancelRaf()
    const clipSpeed = tlClip.speed ?? 1

    function tick() {
      const video = videoRef.current
      if (!video || !isPlayingRef.current) return

      const shuttle = Math.abs(shuttleSpeedRef.current)
      const dt = (1 / 60) * shuttle * previewSpeedRef.current
      const newVideoTime = Math.max(tlClip.trimStart, video.currentTime - dt)
      video.currentTime = newVideoTime

      // Compute the corresponding timeline position
      const newPlayhead = tlClip.startTime + (newVideoTime - tlClip.trimStart) / clipSpeed
      setPlayheadTime(Math.max(0, newPlayhead))

      // Loop check
      if (
        loopEnabledRef.current &&
        loopInRef.current !== null &&
        loopOutRef.current !== null &&
        newPlayhead <= loopInRef.current
      ) {
        cancelRaf()
        seekTo(loopOutRef.current)
        return
      }

      // Hit the start of this clip — try the previous clip
      if (newVideoTime <= tlClip.trimStart + 0.01) {
        const prevClip = findPrevClipBefore(tlClip.startTime - 0.01)
        if (prevClip) {
          // Load the previous clip and continue reversing from its end
          const prevMedia = mediaClipsRef.current.find((m) => m.id === prevClip.mediaClipId)
          if (prevMedia?.type === 'video' && prevMedia.path) {
            const prevUrl = pathToFileUrl(getPlaybackPath(prevMedia))
            const prevClipEnd = prevClip.trimStart + prevClip.duration * (prevClip.speed ?? 1)
            applyClipEffects(prevClip)
            if (currentSrcRef.current !== prevUrl) {
              currentSrcRef.current = prevUrl
              video.src = prevUrl
              video.load()
              video.addEventListener('loadedmetadata', () => {
                if (!isPlayingRef.current) return
                video.currentTime = Math.min(prevClipEnd, video.duration ?? prevClipEnd)
                runReverseRaf(prevClip)
              }, { once: true })
            } else {
              video.currentTime = Math.min(prevClipEnd, video.duration ?? prevClipEnd)
              runReverseRaf(prevClip)
            }
          } else {
            // Non-video prev clip — reverse through it purely by time
            const prevEnd = prevClip.startTime + prevClip.duration
            reverseAdvanceGap(newPlayhead, prevClip.startTime, () => {
              const beforePrev = findPrevClipBefore(prevClip.startTime - 0.01)
              if (beforePrev) {
                const m = mediaClipsRef.current.find((x) => x.id === beforePrev.mediaClipId)
                if (m?.type === 'video' && m.path) {
                  playClip(beforePrev, prevEnd) // reuse playClip which handles reverse
                } else {
                  stopPlayback()
                }
              } else {
                // At the very start
                setPlayheadTime(0)
                stopPlayback()
              }
            })
          }
        } else {
          // No previous clip — hit the start of the timeline
          setPlayheadTime(0)
          stopPlayback()
        }
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  /** Time-only reverse advance (for non-video clips during reverse shuttle). */
  function reverseAdvanceGap(from: number, to: number, onDone: () => void) {
    if (!isPlayingRef.current) return
    cancelRaf()
    if (from <= to + 0.001) { onDone(); return }

    const startWall = performance.now()
    const shuttle   = Math.abs(shuttleSpeedRef.current)

    function tick(now: number) {
      if (!isPlayingRef.current) return
      const elapsed  = (now - startWall) / 1000
      const newTime  = Math.max(to, from - elapsed * shuttle * previewSpeedRef.current)
      setPlayheadTime(newTime)
      if (newTime <= to) { onDone(); return }
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

  // Start / stop playback when isPlaying or shuttleSpeed changes
  useEffect(() => {
    if (!isPlaying) {
      stopPlayback()
      return
    }

    isPlayingRef.current = true
    const time    = playheadRef.current
    const shuttle = shuttleSpeedRef.current

    // ── Reverse shuttle ──────────────────────────────────────────────────────
    if (shuttle < 0) {
      const clip = findClipAt(time)
      if (clip) {
        const media = mediaClipsRef.current.find((m) => m.id === clip.mediaClipId)
        if (media?.type === 'video' && media.path) {
          const url    = pathToFileUrl(getPlaybackPath(media))
          const seekTo = clip.trimStart + (time - clip.startTime) * (clip.speed ?? 1)
          applyClipEffects(clip)
          if (currentSrcRef.current !== url) {
            currentSrcRef.current = url
            const vid = videoRef.current!
            vid.src = url
            vid.load()
            vid.addEventListener('loadedmetadata', () => {
              if (!isPlayingRef.current) return
              vid.currentTime = seekTo
              runReverseRaf(clip)
            }, { once: true })
          } else {
            videoRef.current!.currentTime = seekTo
            runReverseRaf(clip)
          }
        } else {
          // Non-video clip — reverse through it by time
          reverseAdvanceGap(time, clip.startTime, () => {
            const prevClip = findPrevClipBefore(clip.startTime - 0.01)
            if (prevClip) playClip(prevClip, prevClip.startTime + prevClip.duration)
            else stopPlayback()
          })
        }
      } else {
        // In a gap — reverse to the previous clip
        const prevClip = findPrevClipBefore(time)
        if (prevClip) {
          const prevEnd = prevClip.startTime + prevClip.duration
          reverseAdvanceGap(time, prevEnd, () => playClip(prevClip, prevEnd))
        } else {
          setPlayheadTime(0)
          stopPlayback()
        }
      }
      return () => { stopPlayback() }
    }

    // ── Forward playback ─────────────────────────────────────────────────────
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
  }, [isPlaying, shuttleSpeed]) // eslint-disable-line react-hooks/exhaustive-deps

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

    const url    = pathToFileUrl(getPlaybackPath(activeMediaClip))
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

  // ── Scrub bar hover thumbnail generation ─────────────────────────────────
  useEffect(() => {
    if (!scrubHover || totalDuration <= 0) {
      setThumbUrl(null)
      return
    }

    const hoverTime = scrubHover.frac * totalDuration
    const clip = videoClipsRef.current.find(
      (c) => hoverTime >= c.startTime && hoverTime < c.startTime + c.duration
    )
    if (!clip) { setThumbUrl(null); return }

    const media = mediaClipsRef.current.find((m) => m.id === clip.mediaClipId)
    if (!media?.path || media.type !== 'video') { setThumbUrl(null); return }

    const tv = thumbVideoRef.current
    if (!tv) return

    const url     = pathToFileUrl(getPlaybackPath(media))
    const seekSrc = clip.trimStart + (hoverTime - clip.startTime) * (clip.speed ?? 1)
    const gen     = ++thumbGenRef.current

    function capture() {
      if (thumbGenRef.current !== gen) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (ctx && tv) {
          ctx.drawImage(tv, 0, 0, 160, 90)
          setThumbUrl(canvas.toDataURL('image/jpeg', 0.75))
        }
      } catch { /* CORS / security guard */ }
    }

    tv.addEventListener('seeked', capture, { once: true })

    if (tv.getAttribute('data-thumb-src') !== url) {
      tv.setAttribute('data-thumb-src', url)
      tv.src = url
      tv.load()
      tv.addEventListener('loadedmetadata', () => {
        tv.currentTime = Math.max(0, Math.min(seekSrc, tv.duration ?? seekSrc))
      }, { once: true })
    } else {
      tv.currentTime = Math.max(0, Math.min(seekSrc, tv.duration ?? seekSrc))
    }

    return () => {
      thumbGenRef.current++ // invalidate in-flight capture
      tv.removeEventListener('seeked', capture)
    }
  }, [scrubHover?.frac, totalDuration]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Derived shuttle display ───────────────────────────────────────────────
  const shuttleLabel: string | null = (() => {
    if (shuttleSpeed === 0 || !isPlaying) return previewSpeed !== 1 ? `${previewSpeed}x` : null
    if (shuttleSpeed > 0 && shuttleSpeed !== 1) return `${shuttleSpeed}x`
    if (shuttleSpeed < 0) return `${shuttleSpeed}x`
    return null
  })()

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      className="preview-panel flex flex-col h-full bg-[var(--bg-base)]"
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
      onMouseLeave={() => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
        setShowControls(false)
      }}
    >
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
      <div
        ref={canvasRef}
        className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden"
        onContextMenu={(e) => {
          if (!activeMediaClip || activeMediaClip.type !== 'video') return
          e.preventDefault()
          setFrameMenu({ x: e.clientX, y: e.clientY })
        }}
      >

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

        {/* Hidden thumbnail video — used for scrub bar hover frame capture */}
        <video ref={thumbVideoRef} className="hidden" crossOrigin="anonymous" preload="metadata" />

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
            <TextOverlay
              key={clip.id}
              clipId={clip.id}
              settings={clip.textSettings}
              isSelected={clip.id === selectedClipId}
              canvasRef={canvasRef}
              onPositionChange={(px, py) =>
                setTextSettings(clip.id, { ...clip.textSettings!, positionX: px, positionY: py })
              }
            />
          )
        ))}

        {/* ── Video loading spinner ─────────────────────────────────────── */}
        <AnimatePresence>
          {isVideoLoading && isPlaying && (
            <motion.div
              key="loading"
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Loader2 size={28} className="text-white/60 animate-spin drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Speed / shuttle badge ─────────────────────────────────────── */}
        <AnimatePresence>
          {shuttleLabel && (
            <motion.div
              key="speed-badge"
              className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono font-semibold text-[var(--accent-bright)] pointer-events-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
            >
              {shuttleLabel}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls overlay ─────────────────────────────────────────── */}
        <AnimatePresence>
          {(showControls || !isPlaying) && (
            <motion.div
              key="controls"
              className="absolute inset-x-0 bottom-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              {/* Progress / scrub bar */}
              <div
                className="relative px-3 pb-1 pt-2 cursor-pointer group/bar"
                onClick={(e) => {
                  if (totalDuration <= 0) return
                  const rect = scrubBarRef.current?.getBoundingClientRect()
                  if (!rect) return
                  const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  seekTo(fraction * totalDuration)
                }}
                onMouseMove={(e) => {
                  if (totalDuration <= 0) return
                  const rect = scrubBarRef.current?.getBoundingClientRect()
                  if (!rect) return
                  const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  setScrubHover({ frac: fraction, clientX: e.clientX })
                }}
                onMouseLeave={() => {
                  setScrubHover(null)
                  setThumbUrl(null)
                }}
              >
                {/* Hover thumbnail */}
                <AnimatePresence>
                  {scrubHover && totalDuration > 0 && (() => {
                    const rect = scrubBarRef.current?.getBoundingClientRect()
                    const panelRect = panelRef.current?.getBoundingClientRect()
                    if (!rect || !panelRect) return null
                    const rawLeft = scrubHover.clientX - panelRect.left
                    // Clamp so thumbnail stays within panel
                    const clampedLeft = Math.max(80, Math.min(rawLeft, panelRect.width - 80))
                    return (
                      <motion.div
                        key="thumb"
                        className="absolute bottom-full mb-2 pointer-events-none z-50 flex flex-col items-center gap-1"
                        style={{ left: clampedLeft, transform: 'translateX(-50%)' }}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.1 }}
                      >
                        <div className="w-40 h-[90px] rounded overflow-hidden border border-white/15 shadow-xl bg-black flex items-center justify-center shrink-0">
                          {thumbUrl ? (
                            <img src={thumbUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <Loader2 size={12} className="animate-spin text-white/30" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-white/60 bg-black/60 px-1.5 py-0.5 rounded">
                          {formatTimecode(scrubHover.frac * totalDuration)}
                        </span>
                      </motion.div>
                    )
                  })()}
                </AnimatePresence>

                <div
                  ref={scrubBarRef}
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
                  {/* Hover position indicator */}
                  {scrubHover && (
                    <div
                      className="absolute top-1/2 w-1 h-[140%] bg-white/40 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${scrubHover.frac * 100}%` }}
                    />
                  )}
                  <div
                    className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${progressFraction * 100}%` }}
                  />
                </div>
              </div>

              {/* Transport row */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                {/* Timecode — current / total */}
                <div className="flex items-center gap-1 w-[140px] shrink-0">
                  <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                    {formatTimecode(playheadTime)}
                  </span>
                  {totalDuration > 0 && (
                    <>
                      <span className="text-[10px] text-[var(--text-muted)]">/</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatTimecode(totalDuration)}
                      </span>
                    </>
                  )}
                </div>

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
                    onClick={() => {
                      if (shuttleSpeed !== 0) { setShuttleSpeed(0); setIsPlaying(false) }
                      else { setIsPlaying(!isPlaying) }
                    }}
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

                <div className="flex items-center justify-end gap-1.5 w-[140px] shrink-0">
                  {/* Preview speed picker */}
                  <div className="relative" ref={speedMenuRef}>
                    <Tooltip content="Playback speed">
                      <button
                        onClick={() => setShowSpeedMenu((v) => !v)}
                        className={cn(
                          'flex items-center gap-0.5 h-6 px-1.5 rounded text-[10px] font-mono font-semibold transition-colors duration-100',
                          previewSpeed !== 1
                            ? 'text-[var(--accent-bright)] bg-[var(--accent-dim)]/30'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/10'
                        )}
                      >
                        {previewSpeed}x
                        <ChevronUp size={9} className={cn('transition-transform duration-150', showSpeedMenu ? 'rotate-180' : '')} />
                      </button>
                    </Tooltip>

                    <AnimatePresence>
                      {showSpeedMenu && (
                        <motion.div
                          key="speed-menu"
                          className="absolute bottom-full mb-1 right-0 bg-[var(--bg-elevated)] border border-[var(--border)] rounded shadow-lg overflow-hidden z-50"
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.12 }}
                        >
                          {PREVIEW_SPEEDS.map((s) => (
                            <button
                              key={s}
                              onClick={() => { setPreviewSpeed(s); setShowSpeedMenu(false) }}
                              className={cn(
                                'block w-full text-left px-3 py-1 text-[11px] font-mono transition-colors duration-75',
                                s === previewSpeed
                                  ? 'text-[var(--accent-bright)] bg-[var(--accent-dim)]/20'
                                  : 'text-[var(--text-secondary)] hover:bg-white/10'
                              )}
                            >
                              {s}x
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

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

                  {/* Master volume */}
                  <div className="flex items-center gap-1">
                    <Tooltip content={masterVolume === 0 ? 'Unmute' : `Master volume: ${Math.round(masterVolume * 100)}%`}>
                      <button
                        onClick={() =>
                          setMasterVolume(masterVolume > 0 ? 0 : lastMasterVolumeRef.current)
                        }
                        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                      >
                        {masterVolume === 0
                          ? <VolumeX size={13} />
                          : <Volume2 size={13} />
                        }
                      </button>
                    </Tooltip>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(masterVolume * 100)}
                      onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
                      className="w-14 h-1 cursor-pointer accent-[var(--accent)]"
                      title={`Master volume: ${Math.round(masterVolume * 100)}%`}
                      style={{ appearance: 'auto' }}
                    />
                  </div>

                  {/* Audio level meters */}
                  <Tooltip content={isClipping ? 'Clipping! Peak above 0 dB' : 'Audio level (L/R)'}>
                    <div className="flex items-end gap-0.5 h-4 cursor-default">
                      {/* L channel */}
                      <div className="flex flex-col-reverse gap-px w-1.5">
                        {Array.from({ length: 8 }).map((_, i) => {
                          const threshold = (i + 1) / 8
                          const lit = audioLevels.left >= threshold
                          const isHot = threshold > 0.875
                          const isWarm = threshold > 0.625
                          return (
                            <div
                              key={i}
                              className="w-full rounded-[1px] transition-none"
                              style={{
                                height: 2,
                                backgroundColor: lit
                                  ? isClipping && isHot
                                    ? '#ef4444'
                                    : isHot
                                      ? '#f97316'
                                      : isWarm
                                        ? '#eab308'
                                        : '#22c55e'
                                  : 'rgba(255,255,255,0.08)'
                              }}
                            />
                          )
                        })}
                      </div>
                      {/* R channel */}
                      <div className="flex flex-col-reverse gap-px w-1.5">
                        {Array.from({ length: 8 }).map((_, i) => {
                          const threshold = (i + 1) / 8
                          const lit = audioLevels.right >= threshold
                          const isHot = threshold > 0.875
                          const isWarm = threshold > 0.625
                          return (
                            <div
                              key={i}
                              className="w-full rounded-[1px] transition-none"
                              style={{
                                height: 2,
                                backgroundColor: lit
                                  ? isClipping && isHot
                                    ? '#ef4444'
                                    : isHot
                                      ? '#f97316'
                                      : isWarm
                                        ? '#eab308'
                                        : '#22c55e'
                                  : 'rgba(255,255,255,0.08)'
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </Tooltip>

                  <Tooltip content="Fullscreen  F">
                    <button
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                      onClick={() => {
                        if (document.fullscreenElement) {
                          document.exitFullscreen().catch(() => {})
                        } else {
                          panelRef.current?.requestFullscreen?.().catch(() => {})
                        }
                      }}
                    >
                      <Maximize2 size={13} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Save frame context menu ───────────────────────────────────── */}
        <AnimatePresence>
          {frameMenu && (
            <motion.div
              key="frame-menu"
              className="fixed z-[9999] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden py-1 min-w-[160px]"
              style={{ left: frameMenu.x, top: frameMenu.y }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.08 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleSaveFrame}
                className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors"
              >
                Save Frame as PNG…
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Text overlay renderer ──────────────────────────────────────────────────────

function TextOverlay({
  clipId,
  settings,
  isSelected,
  canvasRef,
  onPositionChange
}: {
  clipId: string
  settings: TextSettings
  isSelected: boolean
  canvasRef: React.RefObject<HTMLDivElement>
  onPositionChange: (positionX: number, positionY: number) => void
}): JSX.Element {
  const {
    content, fontSize, fontFamily, fontColor, bgColor,
    bold, italic, alignment, positionX, positionY, animationPreset
  } = settings

  const isDragging = useRef(false)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSelected) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current || !canvasRef.current) return
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const newX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newY = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height))
    onPositionChange(newX, newY)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    isDragging.current = false
    ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
  }

  const translateX = alignment === 'left' ? '0' : alignment === 'right' ? '-100%' : '-50%'

  const style: CSSProperties = {
    position:   'absolute',
    left:       `${positionX * 100}%`,
    top:        `${positionY * 100}%`,
    transform:  `translate(${translateX}, -50%)`,
    fontSize:   `${fontSize * 0.056}vw`,
    fontFamily: fontFamily || 'Arial',
    color:      fontColor,
    fontWeight: bold   ? 'bold'   : 'normal',
    fontStyle:  italic ? 'italic' : 'normal',
    textAlign:  alignment,
    whiteSpace: 'pre-wrap',
    userSelect: 'none',
    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
    padding:    bgColor !== 'transparent' ? '4px 10px' : undefined,
    backgroundColor: bgColor !== 'transparent' ? bgColor : undefined,
    borderRadius:    bgColor !== 'transparent' ? '4px' : undefined,
    lineHeight: 1.2,
    cursor:     isSelected ? 'grab' : 'default',
    pointerEvents: isSelected ? 'auto' : 'none',
    // Selection indicator: subtle outline when selected
    outline:    isSelected ? '1px dashed rgba(255,255,255,0.4)' : undefined,
    outlineOffset: isSelected ? '4px' : undefined,
    zIndex: 10
  }

  // Animation variants based on preset
  const initial = animationPreset === 'fade-in'
    ? { opacity: 0 }
    : animationPreset === 'slide-up'
      ? { opacity: 0, y: 20 }
      : { opacity: 1 }

  const animate = animationPreset !== 'none'
    ? { opacity: 1, y: 0 }
    : { opacity: 1 }

  return (
    <motion.div
      key={clipId}
      style={style}
      initial={initial}
      animate={animate}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {content}
    </motion.div>
  )
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
