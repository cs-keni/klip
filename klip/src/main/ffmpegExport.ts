import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExportJob {
  outputPath: string
  // Video settings
  width: number
  height: number
  fps: number
  crf: number
  x264Preset: string   // 'fast' | 'medium' | 'slow'
  // Audio settings
  audioBitrate: string // e.g. '320k'
  sampleRate: number   // e.g. 48000
  // Timeline
  totalDuration: number
  videoTrackId: string
  audioTrackIds: string[]
  clips: ExportClip[]
  // Resolved from media store
  mediaPaths:  Record<string, string>  // mediaClipId → file path
  mediaTypes:  Record<string, string>  // mediaClipId → 'video'|'audio'|'image'|'color'
  mediaColors: Record<string, string>  // mediaClipId → hex color (color clips)
  // Track state
  trackMutes: Record<string, boolean>  // trackId → isMuted
  trackSolos: string[]                 // trackIds with isSolo=true
}

export interface ExportClip {
  id: string
  mediaClipId: string
  trackId: string
  startTime: number
  trimStart: number
  duration: number
  volume: number
}

export interface ExportProgress {
  progress: number  // 0–1
  fps: number
  speed: string
  etaSecs: number
}

// ── FFmpeg binary resolution ───────────────────────────────────────────────────

export function getFFmpegPath(): string {
  // Packaged app: look in Electron's resources directory
  if (process.env.NODE_ENV !== 'development') {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? ''
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const p = join(resourcesPath, name)
      if (existsSync(p)) return p
    }
  }

  // Dev: try ffmpeg-static (requires `npm install` to have run on Windows)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static') as string | null
    if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic
  } catch {
    // ignore
  }

  // Last resort: expect ffmpeg on the system PATH
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

// ── Mute/solo helpers ─────────────────────────────────────────────────────────

function isTrackMuted(trackId: string, job: ExportJob): boolean {
  if (job.trackMutes[trackId]) return true
  if (job.trackSolos.length > 0 && !job.trackSolos.includes(trackId)) return true
  return false
}

// ── Filter-complex builder ────────────────────────────────────────────────────

/**
 * Builds the complete FFmpeg argument list for a given export job.
 *
 * Strategy:
 *   1. Build a linear sequence of video + audio segments from the video track,
 *      inserting black-video / silence for any timeline gaps.
 *   2. Concat all video segments → [vout]
 *   3. Concat all audio segments → [video_audio]
 *   4. For each audio-track clip, create a silence-padded stream positioned at
 *      its timeline offset → mix with video_audio via amix → [aout]
 *   5. Encode with H.264 + AAC and output to job.outputPath.
 */
export function buildFFmpegArgs(job: ExportJob): string[] {
  const { width, height, fps, crf, x264Preset, audioBitrate, sampleRate, totalDuration } = job
  const chLayout = 'stereo'

  // ── Separate clips by track ─────────────────────────────────────────────────
  const videoClips = job.clips
    .filter((c) => c.trackId === job.videoTrackId)
    .sort((a, b) => a.startTime - b.startTime)

  const audioClips = job.audioTrackIds.length > 0
    ? job.clips
        .filter((c) => job.audioTrackIds.includes(c.trackId) && !isTrackMuted(c.trackId, job))
        .sort((a, b) => a.startTime - b.startTime)
    : []

  const videoMuted = isTrackMuted(job.videoTrackId, job)

  if (videoClips.length === 0) {
    throw new Error('No video clips on the video track. Add video clips before exporting.')
  }

  // ── Input management ────────────────────────────────────────────────────────
  //
  // Image clips require -loop 1 -t D before -i, so they get dedicated entries.
  // Video/audio files are deduplicated (same file = same -i index).

  interface InputEntry { preArgs: string[]; path: string }
  const inputs: InputEntry[] = []

  function getVideoAudioInput(path: string): number {
    const idx = inputs.findIndex((e) => e.preArgs.length === 0 && e.path === path)
    if (idx !== -1) return idx
    inputs.push({ preArgs: [], path })
    return inputs.length - 1
  }

  function addImageInput(path: string, duration: number): number {
    inputs.push({ preArgs: ['-loop', '1', '-t', duration.toFixed(6)], path })
    return inputs.length - 1
  }

  // Pre-register inputs in the order they appear (video first, then audio track)
  for (const clip of videoClips) {
    const path = job.mediaPaths[clip.mediaClipId]
    const type = job.mediaTypes[clip.mediaClipId]
    if (path && type === 'video') getVideoAudioInput(path)
    // images registered on-the-fly below (need per-clip duration)
  }
  for (const clip of audioClips) {
    const path = job.mediaPaths[clip.mediaClipId]
    if (path) getVideoAudioInput(path)
  }

  // ── Build filter_complex ────────────────────────────────────────────────────

  const filterParts: string[] = []
  const videoSegLabels: string[] = []
  const audioSegLabels: string[] = []
  let segIdx = 0
  let currentTime = 0

  const scaleFilter =
    `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`

  function pushGap(duration: number) {
    if (duration < 0.001) return
    const vl = `sv${segIdx}`, al = `sa${segIdx}`
    filterParts.push(`color=black:s=${width}x${height}:r=${fps}:d=${duration.toFixed(6)}[${vl}]`)
    filterParts.push(`aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${duration.toFixed(6)}[${al}]`)
    videoSegLabels.push(vl)
    audioSegLabels.push(al)
    segIdx++
  }

  for (const clip of videoClips) {
    // Gap before this clip
    const gap = clip.startTime - currentTime
    if (gap > 0.001) pushGap(gap)

    const vl = `sv${segIdx}`, al = `sa${segIdx}`
    const type  = job.mediaTypes[clip.mediaClipId]
    const path  = job.mediaPaths[clip.mediaClipId]
    const color = job.mediaColors[clip.mediaClipId]
    const vol   = clip.volume ?? 1
    const trimEnd = clip.trimStart + clip.duration

    if (type === 'video' && path) {
      const ii = getVideoAudioInput(path)
      filterParts.push(
        `[${ii}:v]trim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
        `setpts=PTS-STARTPTS,${scaleFilter},fps=fps=${fps}[${vl}]`
      )
      if (!videoMuted) {
        filterParts.push(
          `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
          `asetpts=PTS-STARTPTS,volume=${vol}[${al}]`
        )
      } else {
        filterParts.push(
          `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
        )
      }
    } else if (type === 'image' && path) {
      const ii = addImageInput(path, clip.duration)
      filterParts.push(
        `[${ii}:v]setpts=PTS-STARTPTS,${scaleFilter},fps=fps=${fps}[${vl}]`
      )
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
      )
    } else if (type === 'color') {
      const hexColor = (color ?? '#000000').replace('#', '0x')
      filterParts.push(
        `color=${hexColor}:s=${width}x${height}:r=${fps}:d=${clip.duration.toFixed(6)}[${vl}]`
      )
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
      )
    } else {
      // Unknown / missing path → treat as gap
      pushGap(clip.duration)
      currentTime = clip.startTime + clip.duration
      continue
    }

    videoSegLabels.push(vl)
    audioSegLabels.push(al)
    segIdx++
    currentTime = clip.startTime + clip.duration
  }

  // Trailing gap to reach totalDuration
  const trailing = totalDuration - currentTime
  if (trailing > 0.001) pushGap(trailing)

  // Concat all video + audio segments
  const concatN  = videoSegLabels.length
  const vConcat  = videoSegLabels.map((l) => `[${l}]`).join('')
  const aConcat  = audioSegLabels.map((l) => `[${l}]`).join('')
  filterParts.push(`${vConcat}concat=n=${concatN}:v=1:a=0[vout]`)
  filterParts.push(`${aConcat}concat=n=${concatN}:v=0:a=1[video_audio]`)

  // ── Audio-track clips: position each with silence prefix, then mix ──────────

  const audioMixSources: string[] = ['[video_audio]']

  for (let i = 0; i < audioClips.length; i++) {
    const clip = audioClips[i]
    const path = job.mediaPaths[clip.mediaClipId]
    if (!path) continue

    const ii      = getVideoAudioInput(path)
    const vol     = clip.volume ?? 1
    const trimEnd = clip.trimStart + clip.duration
    const prefLbl = `apre${i}`
    const clipLbl = `aclip${i}`
    const padLbl  = `apad${i}`

    if (clip.startTime > 0.001) {
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.startTime.toFixed(6)}[${prefLbl}]`
      )
      filterParts.push(
        `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
        `asetpts=PTS-STARTPTS,volume=${vol}[${clipLbl}]`
      )
      filterParts.push(`[${prefLbl}][${clipLbl}]concat=n=2:v=0:a=1[${padLbl}]`)
    } else {
      filterParts.push(
        `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
        `asetpts=PTS-STARTPTS,volume=${vol}[${padLbl}]`
      )
    }

    audioMixSources.push(`[${padLbl}]`)
  }

  // Final audio: pass-through or amix
  if (audioMixSources.length === 1) {
    filterParts.push(`[video_audio]aformat=channel_layouts=${chLayout}[aout]`)
  } else {
    const mixN = audioMixSources.length
    filterParts.push(
      `${audioMixSources.join('')}amix=inputs=${mixN}:duration=first:dropout_transition=0[aout]`
    )
  }

  // ── Assemble final args ─────────────────────────────────────────────────────

  const inputArgs: string[] = []
  for (const inp of inputs) {
    inputArgs.push(...inp.preArgs, '-i', inp.path)
  }

  return [
    ...inputArgs,
    '-filter_complex', filterParts.join(';\n'),
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', x264Preset,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', audioBitrate,
    '-ar', String(sampleRate),
    '-movflags', '+faststart',
    '-y',
    job.outputPath
  ]
}

// ── Export runner ─────────────────────────────────────────────────────────────

let activeProcess: ChildProcess | null = null

export function cancelExport(): void {
  if (activeProcess) {
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

export function runExport(
  job: ExportJob,
  onProgress: (p: ExportProgress) => void,
  onDone: (outputPath: string) => void,
  onError: (msg: string) => void
): void {
  const ffmpegPath = getFFmpegPath()
  let args: string[]

  try {
    args = buildFFmpegArgs(job)
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err))
    return
  }

  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  activeProcess = proc

  let stderr = ''

  // Progress lives on stderr (FFmpeg's default progress output)
  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    stderr += text

    // Parse: time=HH:MM:SS.CC  speed=Nx
    const timeMatch  = text.match(/time=(\d+):(\d+):(\d+\.\d+)/)
    const speedMatch = text.match(/speed=\s*([\d.]+)x/)
    const fpsMatch   = text.match(/fps=\s*(\d+)/)

    if (timeMatch) {
      const secs     = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3])
      const progress = Math.min(1, job.totalDuration > 0 ? secs / job.totalDuration : 0)
      const speed    = speedMatch ? parseFloat(speedMatch[1]) : 1
      const fps      = fpsMatch   ? parseInt(fpsMatch[1])     : 0
      const etaSecs  = speed > 0 ? ((1 - progress) * job.totalDuration) / speed : 0

      onProgress({ progress, fps, speed: `${speed.toFixed(1)}x`, etaSecs })
    }
  })

  proc.on('close', (code) => {
    activeProcess = null
    if (code === 0) {
      onDone(job.outputPath)
    } else {
      // Extract the last meaningful line from stderr for the error message
      const lines = stderr.split('\n').filter(Boolean)
      const msg = lines.slice(-5).join('\n') || `FFmpeg exited with code ${code}`
      onError(msg)
    }
  })

  proc.on('error', (err) => {
    activeProcess = null
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      onError(
        'FFmpeg not found. Run `npm install` from your Windows terminal (not WSL) ' +
        'to install the Windows binary, or ensure ffmpeg.exe is on your PATH.'
      )
    } else {
      onError(err.message)
    }
  })
}
