import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderOpen, Play, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/mediaUtils'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'

// ── Presets ────────────────────────────────────────────────────────────────────

interface Preset {
  id: string
  label: string
  sub: string
  width: number
  height: number
  fps: number
  crf: number
  x264Preset: string
  audioBitrate: string
}

const PRESETS: Preset[] = [
  {
    id: 'yt-1080-60',
    label: 'YouTube 1080p60',
    sub: '1920 × 1080 · 60fps · H.264 CRF 18',
    width: 1920, height: 1080, fps: 60,
    crf: 18, x264Preset: 'fast', audioBitrate: '320k'
  },
  {
    id: 'yt-1440-60',
    label: 'YouTube 1440p60',
    sub: '2560 × 1440 · 60fps · H.264 CRF 18',
    width: 2560, height: 1440, fps: 60,
    crf: 18, x264Preset: 'fast', audioBitrate: '320k'
  },
  {
    id: 'yt-1080-30',
    label: 'YouTube 1080p30',
    sub: '1920 × 1080 · 30fps · H.264 CRF 18',
    width: 1920, height: 1080, fps: 30,
    crf: 18, x264Preset: 'fast', audioBitrate: '320k'
  },
  {
    id: 'preview',
    label: 'Preview / Draft',
    sub: '1280 × 720 · 30fps · H.264 CRF 28 (fast)',
    width: 1280, height: 720, fps: 30,
    crf: 28, x264Preset: 'veryfast', audioBitrate: '192k'
  }
]

// ── Types ──────────────────────────────────────────────────────────────────────

type DialogState = 'idle' | 'exporting' | 'done' | 'error'

interface ExportProgress {
  progress: number
  fps: number
  speed: string
  etaSecs: number
}

interface ExportDialogProps {
  onClose: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExportDialog({ onClose }: ExportDialogProps): JSX.Element {
  const { tracks, clips: timelineClips } = useTimelineStore()
  const { clips: mediaClips } = useMediaStore()

  // ── Settings state ──────────────────────────────────────────────────────────
  const [presetId, setPresetId]         = useState('yt-1080-60')
  const [outputFolder, setOutputFolder] = useState('')
  const [fileName, setFileName]         = useState('my-edit')
  const [dialogState, setDialogState]   = useState<DialogState>('idle')
  const [progress, setProgress]         = useState<ExportProgress | null>(null)
  const [errorMsg, setErrorMsg]         = useState('')
  const [doneOutput, setDoneOutput]     = useState('')

  // Full resolved path shown as preview
  const sep = outputFolder ? (outputFolder.includes('/') ? '/' : '\\') : '/'
  const outputPath = outputFolder
    ? `${outputFolder}${sep}${fileName.replace(/\.mp4$/i, '')}.mp4`
    : ''

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]

  // ── Derived timeline info ───────────────────────────────────────────────────
  const videoTrack = tracks.find((t) => t.type === 'video')
  const videoClips = videoTrack
    ? timelineClips.filter((c) => c.trackId === videoTrack.id)
    : []

  const totalDuration = timelineClips.reduce(
    (max, c) => Math.max(max, c.startTime + c.duration), 0
  )

  const estimatedMB = Math.round(
    (totalDuration * (preset.width * preset.height * preset.fps * 0.07 / 1024 / 1024))
  )

  // ── Subscribe to export events ──────────────────────────────────────────────
  useEffect(() => {
    const unsubProgress = window.api.export.onProgress((p) => setProgress(p))
    const unsubDone     = window.api.export.onDone((path) => {
      setDialogState('done')
      setDoneOutput(path)
    })
    const unsubError    = window.api.export.onError((msg) => {
      setDialogState('error')
      setErrorMsg(msg)
    })
    return () => { unsubProgress(); unsubDone(); unsubError() }
  }, [])

  // ── Pick output folder ──────────────────────────────────────────────────────
  const handlePickFolder = useCallback(async () => {
    const folder = await window.api.export.pickOutputFolder()
    if (folder) setOutputFolder(folder)
  }, [])

  // ── Start export ────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!outputPath || videoClips.length === 0) return

    const mediaPaths:  Record<string, string> = {}
    const mediaTypes:  Record<string, string> = {}
    const mediaColors: Record<string, string> = {}

    for (const mc of mediaClips) {
      if (mc.path)  mediaPaths[mc.id]  = mc.path
      mediaTypes[mc.id]  = mc.type
      if (mc.color) mediaColors[mc.id] = mc.color
    }

    const audioTracks  = tracks.filter((t) => t.type === 'audio' || t.type === 'music')
    const overlayTrack = tracks.find((t) => t.type === 'overlay')

    const { transitions } = useTimelineStore.getState()

    const job = {
      outputPath,
      width: preset.width,
      height: preset.height,
      fps: preset.fps,
      crf: preset.crf,
      x264Preset: preset.x264Preset,
      audioBitrate: preset.audioBitrate,
      sampleRate: 48000,
      totalDuration,
      videoTrackId:  videoTrack?.id ?? '',
      audioTrackIds: audioTracks.map((t) => t.id),
      overlayTrackId: overlayTrack?.id ?? '',
      clips: timelineClips.map((c) => ({
        id:          c.id,
        mediaClipId: c.mediaClipId,
        trackId:     c.trackId,
        clipType:    c.type,
        startTime:   c.startTime,
        trimStart:   c.trimStart,
        duration:    c.duration,
        volume:      c.volume ?? 1,
        speed:       c.speed,
        textSettings:  c.textSettings,
        colorSettings: c.colorSettings,
        cropSettings:  c.cropSettings
      })),
      transitions: transitions.map((t) => ({
        fromClipId: t.fromClipId,
        toClipId:   t.toClipId,
        type:       t.type,
        duration:   t.duration
      })),
      mediaPaths,
      mediaTypes,
      mediaColors,
      trackMutes: Object.fromEntries(tracks.map((t) => [t.id, t.isMuted])),
      trackSolos: tracks.filter((t) => t.isSolo).map((t) => t.id)
    }

    setDialogState('exporting')
    setProgress(null)
    await window.api.export.start(job)
  }, [outputPath, videoClips.length, mediaClips, tracks, timelineClips, totalDuration, preset, videoTrack])

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    window.api.export.cancel()
    setDialogState('idle')
    setProgress(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dialogState === 'exporting' ? undefined : onClose}
      />

      {/* Dialog */}
      <motion.div
        className="relative z-10 w-[520px] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl overflow-hidden"
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Export Video</h2>
          {dialogState !== 'exporting' && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {dialogState === 'idle' && (
            <IdleContent
              key="idle"
              presetId={presetId}
              setPresetId={setPresetId}
              outputFolder={outputFolder}
              fileName={fileName}
              setFileName={setFileName}
              outputPath={outputPath}
              onPickFolder={handlePickFolder}
              onExport={handleExport}
              onClose={onClose}
              videoClipCount={videoClips.length}
              totalDuration={totalDuration}
              estimatedMB={estimatedMB}
              preset={preset}
            />
          )}

          {dialogState === 'exporting' && (
            <ExportingContent
              key="exporting"
              progress={progress}
              totalDuration={totalDuration}
              onCancel={handleCancel}
            />
          )}

          {dialogState === 'done' && (
            <DoneContent
              key="done"
              outputPath={doneOutput}
              onReveal={() => window.api.media.revealInExplorer(doneOutput)}
              onClose={onClose}
            />
          )}

          {dialogState === 'error' && (
            <ErrorContent
              key="error"
              message={errorMsg}
              onRetry={() => setDialogState('idle')}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ── Sub-screens ────────────────────────────────────────────────────────────────

function IdleContent({
  presetId, setPresetId,
  outputFolder, fileName, setFileName, outputPath,
  onPickFolder, onExport, onClose,
  videoClipCount, totalDuration, estimatedMB, preset
}: {
  presetId: string
  setPresetId: (id: string) => void
  outputFolder: string
  fileName: string
  setFileName: (n: string) => void
  outputPath: string
  onPickFolder: () => void
  onExport: () => void
  onClose: () => void
  videoClipCount: number
  totalDuration: number
  estimatedMB: number
  preset: Preset
}): JSX.Element {
  const canExport = videoClipCount > 0 && outputFolder.length > 0 && fileName.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <div className="px-5 py-4 space-y-5">
        {/* Timeline summary */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-base)] text-xs text-[var(--text-muted)]">
          <Stat label="Duration" value={formatDuration(totalDuration)} />
          <div className="w-px h-6 bg-[var(--border-subtle)]" />
          <Stat label="Video clips" value={String(videoClipCount)} />
          <div className="w-px h-6 bg-[var(--border-subtle)]" />
          <Stat label="Est. size" value={`~${estimatedMB} MB`} />
        </div>

        {videoClipCount === 0 && (
          <p className="text-xs text-[var(--text-muted)] bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            No video clips on the timeline. Add clips before exporting.
          </p>
        )}

        {/* Preset selection */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] block mb-2">
            Preset
          </label>
          <div className="space-y-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors duration-75',
                  presetId === p.id
                    ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--border)]'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors',
                    presetId === p.id ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--border)]'
                  )}
                />
                <div>
                  <div className={cn('text-xs font-semibold', presetId === p.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                    {p.label}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{p.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Output location */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] block">
            Save To
          </label>

          {/* Folder picker */}
          <div className="flex gap-2">
            <div
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs truncate cursor-default"
              style={{ color: outputFolder ? 'var(--text-secondary)' : 'var(--text-muted)' }}
              title={outputFolder}
            >
              {outputFolder || 'No folder selected'}
            </div>
            <button
              onClick={onPickFolder}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <FolderOpen size={12} />
              Browse
            </button>
          </div>

          {/* File name */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="my-edit"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-dim)] transition-colors"
            />
            <span className="text-xs text-[var(--text-muted)] shrink-0">.mp4</span>
          </div>

          {/* Full path preview */}
          {outputPath && (
            <p className="text-[10px] text-[var(--text-muted)] truncate px-1" title={outputPath}>
              → {outputPath}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-subtle)]">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onExport}
          disabled={!canExport}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Play size={11} />
          Export
        </button>
      </div>
    </motion.div>
  )
}

function ExportingContent({
  progress, totalDuration, onCancel
}: {
  progress: ExportProgress | null
  totalDuration: number
  onCancel: () => void
}): JSX.Element {
  const pct = progress ? Math.round(progress.progress * 100) : 0
  const elapsed = progress ? totalDuration * progress.progress / Math.max(0.1, parseFloat(progress.speed)) : 0

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="px-5 py-6 space-y-5"
    >
      <div className="flex items-center gap-3">
        <Loader2 size={16} className="text-[var(--accent)] shrink-0 animate-spin" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Encoding…</span>
        <span className="ml-auto text-sm font-mono font-semibold text-[var(--accent)]">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[var(--bg-base)] overflow-hidden">
        <motion.div
          className="h-full bg-[var(--accent)] rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Stats */}
      {progress && (
        <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span>{progress.fps} fps</span>
          <span>{progress.speed}</span>
          {progress.etaSecs > 0 && (
            <span>ETA {formatEta(progress.etaSecs)}</span>
          )}
          <span className="ml-auto">{formatDuration(elapsed)} / {formatDuration(totalDuration)}</span>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  )
}

function DoneContent({
  outputPath, onReveal, onClose
}: {
  outputPath: string
  onReveal: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="px-5 py-6 space-y-4"
    >
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <CheckCircle2 size={36} className="text-emerald-400" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">Export complete</p>
        <p className="text-xs text-[var(--text-muted)] max-w-xs truncate" title={outputPath}>
          {outputPath}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onReveal}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
        >
          <FolderOpen size={12} />
          Show in Explorer
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white hover:bg-[var(--accent-light)] transition-colors"
        >
          Done
        </button>
      </div>
    </motion.div>
  )
}

function ErrorContent({
  message, onRetry, onClose
}: {
  message: string
  onRetry: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="px-5 py-6 space-y-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Export failed</p>
          <pre className="text-[10px] text-[var(--text-muted)] whitespace-pre-wrap break-words max-h-40 overflow-y-auto font-mono bg-[var(--bg-base)] rounded-lg p-3">
            {message}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Close
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white hover:bg-[var(--accent-light)] transition-colors"
        >
          Back to Settings
        </button>
      </div>
    </motion.div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">{value}</span>
    </div>
  )
}

function formatEta(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}m ${s}s`
}
