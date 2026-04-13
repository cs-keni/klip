import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TextSettingsExport {
  content: string
  fontSize: number
  fontColor: string
  bgColor: string
  bold: boolean
  italic: boolean
  alignment: 'left' | 'center' | 'right'
  positionX: number
  positionY: number
}

export interface ColorSettingsExport {
  brightness: number  // -1 to 1
  contrast: number    // -1 to 1
  saturation: number  // -1 to 1
}

export interface CropSettingsExport {
  zoom: number    // 1.0 = no zoom
  panX: number    // -1 to 1
  panY: number    // -1 to 1
}

export interface ExportJob {
  outputPath: string
  // Video settings
  width: number
  height: number
  fps: number
  crf: number
  x264Preset: string
  // Audio settings
  audioBitrate: string
  sampleRate: number
  // Timeline
  totalDuration: number
  videoTrackId: string
  audioTrackIds: string[]
  overlayTrackId: string
  clips: ExportClip[]
  // Transitions
  transitions: ExportTransition[]
  // Resolved from media store
  mediaPaths:  Record<string, string>
  mediaTypes:  Record<string, string>
  mediaColors: Record<string, string>
  // Track state
  trackMutes: Record<string, boolean>
  trackSolos: string[]
}

export interface ExportClip {
  id: string
  mediaClipId: string
  trackId: string
  /** Explicit clip type (avoids mediaTypes lookup for synthetic clips). */
  clipType: 'video' | 'audio' | 'image' | 'color' | 'text'
  startTime: number
  trimStart: number
  duration: number
  volume: number
  speed?: number
  /** Audio fade-in duration in seconds (0 = none). */
  fadeIn?: number
  /** Audio fade-out duration in seconds (0 = none). */
  fadeOut?: number
  textSettings?: TextSettingsExport
  colorSettings?: ColorSettingsExport
  cropSettings?: CropSettingsExport
}

export interface ExportTransition {
  fromClipId: string
  toClipId: string
  type: 'fade' | 'dip-to-black'
  duration: number
}

export interface ExportProgress {
  progress: number
  fps: number
  speed: string
  etaSecs: number
}

// ── FFmpeg binary resolution ───────────────────────────────────────────────────

export function getFFmpegPath(): string {
  if (process.env.NODE_ENV !== 'development') {
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? ''
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const p = join(resourcesPath, name)
      if (existsSync(p)) return p
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static') as string | null
    if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic
  } catch {
    // ignore
  }

  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

// ── Mute/solo helpers ─────────────────────────────────────────────────────────

function isTrackMuted(trackId: string, job: ExportJob): boolean {
  if (job.trackMutes[trackId]) return true
  if (job.trackSolos.length > 0 && !job.trackSolos.includes(trackId)) return true
  return false
}

// ── drawtext escaping ─────────────────────────────────────────────────────────

function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g,  "\\'")
    .replace(/:/g,  '\\:')
    .replace(/\n/g, '\\n')
}

// ── Color grade filter ────────────────────────────────────────────────────────

function colorGradeFilter(cs: ColorSettingsExport): string {
  // FFmpeg eq filter: brightness -1..1, contrast 1 = no change, saturation 0..3
  const contrast   = 1 + cs.contrast          // map -1..1 → 0..2
  const saturation = Math.max(0, Math.min(3, 1 + cs.saturation))
  return `eq=brightness=${cs.brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`
}

// ── Crop/zoom filter ──────────────────────────────────────────────────────────

function cropZoomFilter(crop: CropSettingsExport): string {
  if (crop.zoom <= 1.001) return ''
  const z  = crop.zoom
  const px = crop.panX
  const py = crop.panY
  // crop=iw/Z:ih/Z:iw/2*(1-1/Z)*(1+PX):ih/2*(1-1/Z)*(1+PY)
  const cropW = `iw/${z.toFixed(4)}`
  const cropH = `ih/${z.toFixed(4)}`
  const cropX = `iw/2*(1-1/${z.toFixed(4)})*(1+${px.toFixed(4)})`
  const cropY = `ih/2*(1-1/${z.toFixed(4)})*(1+${py.toFixed(4)})`
  // After crop, scale back to original (the main scaleFilter handles final output size)
  return `crop=${cropW}:${cropH}:${cropX}:${cropY}`
}

// ── Speed filter chains ───────────────────────────────────────────────────────

/**
 * atempo only accepts values in [0.5, 2.0].
 * For speeds outside that range, chain multiple atempo filters.
 */
function buildAtempoChain(speed: number): string {
  const filters: string[] = []
  let remaining = speed

  while (remaining > 2.0) {
    filters.push('atempo=2.0')
    remaining /= 2.0
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5')
    remaining /= 0.5
  }
  filters.push(`atempo=${remaining.toFixed(6)}`)
  return filters.join(',')
}

// ── Filter-complex builder ────────────────────────────────────────────────────

export function buildFFmpegArgs(job: ExportJob): string[] {
  const { width, height, fps, crf, x264Preset, audioBitrate, sampleRate, totalDuration } = job
  const chLayout = 'stereo'

  // ── Separate clips by track ───────────────────────────────────────────────
  const videoClips = job.clips
    .filter((c) => c.trackId === job.videoTrackId)
    .sort((a, b) => a.startTime - b.startTime)

  const audioClips = job.audioTrackIds.length > 0
    ? job.clips
        .filter((c) => job.audioTrackIds.includes(c.trackId) && !isTrackMuted(c.trackId, job))
        .sort((a, b) => a.startTime - b.startTime)
    : []

  const textClips = job.clips
    .filter((c) => c.trackId === job.overlayTrackId && c.clipType === 'text' && c.textSettings)
    .sort((a, b) => a.startTime - b.startTime)

  const videoMuted = isTrackMuted(job.videoTrackId, job)

  if (videoClips.length === 0) {
    throw new Error('No video clips on the video track. Add video clips before exporting.')
  }

  // ── Input management ──────────────────────────────────────────────────────
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

  for (const clip of videoClips) {
    const path = job.mediaPaths[clip.mediaClipId]
    const type = clip.clipType
    if (path && type === 'video') getVideoAudioInput(path)
  }
  for (const clip of audioClips) {
    const path = job.mediaPaths[clip.mediaClipId]
    if (path) getVideoAudioInput(path)
  }

  // ── Build filter_complex ──────────────────────────────────────────────────
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
    const gap = clip.startTime - currentTime
    if (gap > 0.001) pushGap(gap)

    const vl = `sv${segIdx}`, al = `sa${segIdx}`
    const type  = clip.clipType
    const path  = job.mediaPaths[clip.mediaClipId]
    const color = job.mediaColors[clip.mediaClipId]
    const vol   = clip.volume ?? 1
    const speed = clip.speed ?? 1

    // Source duration consumed (accounting for speed)
    const sourceDuration = clip.duration * speed
    const trimEnd = clip.trimStart + sourceDuration

    // Transition fade filters for this segment
    const fromTransition = job.transitions.find((t) => t.fromClipId === clip.id)
    const toTransition   = job.transitions.find((t) => t.toClipId === clip.id)

    // Output duration of this segment = clip.duration
    const outDuration = clip.duration

    function videoFadeFilters(): string {
      const parts: string[] = []
      if (toTransition) {
        parts.push(`fade=t=in:st=0:d=${toTransition.duration.toFixed(3)}`)
      }
      if (fromTransition) {
        const fadeStart = Math.max(0, outDuration - fromTransition.duration)
        parts.push(`fade=t=out:st=${fadeStart.toFixed(3)}:d=${fromTransition.duration.toFixed(3)}`)
      }
      return parts.length ? ',' + parts.join(',') : ''
    }

    function audioFadeFilters(): string {
      const parts: string[] = []
      // Clip-level fade in (takes priority over transition fade in)
      const fadeIn = clip.fadeIn ?? 0
      if (fadeIn > 0) {
        parts.push(`afade=t=in:st=0:d=${fadeIn.toFixed(3)}`)
      } else if (toTransition) {
        parts.push(`afade=t=in:st=0:d=${toTransition.duration.toFixed(3)}`)
      }
      // Clip-level fade out (takes priority over transition fade out)
      const fadeOut = clip.fadeOut ?? 0
      if (fadeOut > 0) {
        const fadeStart = Math.max(0, outDuration - fadeOut)
        parts.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`)
      } else if (fromTransition) {
        const fadeStart = Math.max(0, outDuration - fromTransition.duration)
        parts.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${fromTransition.duration.toFixed(3)}`)
      }
      return parts.length ? ',' + parts.join(',') : ''
    }

    // Extra video filters (color grade, crop)
    function extraVideoFilters(): string {
      const parts: string[] = []
      if (clip.cropSettings && clip.cropSettings.zoom > 1.001) {
        const cf = cropZoomFilter(clip.cropSettings)
        if (cf) parts.push(cf)
      }
      if (clip.colorSettings) {
        parts.push(colorGradeFilter(clip.colorSettings))
      }
      return parts.length ? ',' + parts.join(',') : ''
    }

    if (type === 'video' && path) {
      const ii = getVideoAudioInput(path)
      const speedV = speed !== 1 ? `,setpts=(PTS-STARTPTS)*(1/${speed.toFixed(6)})` : ',setpts=PTS-STARTPTS'
      const speedA = speed !== 1 ? `,${buildAtempoChain(speed)}` : ''

      filterParts.push(
        `[${ii}:v]trim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)}` +
        `${speedV}` +
        `${extraVideoFilters()}` +
        `,${scaleFilter},fps=fps=${fps}` +
        `${videoFadeFilters()}[${vl}]`
      )
      if (!videoMuted) {
        filterParts.push(
          `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
          `asetpts=PTS-STARTPTS${speedA},volume=${vol}` +
          `${audioFadeFilters()}[${al}]`
        )
      } else {
        filterParts.push(
          `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
        )
      }
    } else if (type === 'image' && path) {
      const ii     = addImageInput(path, clip.duration)
      const extraV = extraVideoFilters()
      filterParts.push(
        `[${ii}:v]setpts=PTS-STARTPTS${extraV},${scaleFilter},fps=fps=${fps}${videoFadeFilters()}[${vl}]`
      )
      // Image clips have no audio
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
      )
    } else if (type === 'color') {
      const hexColor = (color ?? '#000000').replace('#', '0x')
      // Color clips: apply color grade if present (via eq filter on the generated stream)
      const gradeFilter = clip.colorSettings ? `,${colorGradeFilter(clip.colorSettings)}` : ''
      filterParts.push(
        `color=${hexColor}:s=${width}x${height}:r=${fps}:d=${clip.duration.toFixed(6)}${gradeFilter}${videoFadeFilters()}[${vl}]`
      )
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.duration.toFixed(6)}[${al}]`
      )
    } else {
      pushGap(clip.duration)
      currentTime = clip.startTime + clip.duration
      continue
    }

    videoSegLabels.push(vl)
    audioSegLabels.push(al)
    segIdx++
    currentTime = clip.startTime + clip.duration
  }

  const trailing = totalDuration - currentTime
  if (trailing > 0.001) pushGap(trailing)

  const concatN = videoSegLabels.length
  const vConcat = videoSegLabels.map((l) => `[${l}]`).join('')
  const aConcat = audioSegLabels.map((l) => `[${l}]`).join('')
  filterParts.push(`${vConcat}concat=n=${concatN}:v=1:a=0[vconcat]`)
  filterParts.push(`${aConcat}concat=n=${concatN}:v=0:a=1[video_audio]`)

  // ── Text overlay drawtext filters ──────────────────────────────────────────
  let videoOut = 'vconcat'

  for (let i = 0; i < textClips.length; i++) {
    const clip = textClips[i]
    const ts   = clip.textSettings!
    const outLabel = i === textClips.length - 1 ? 'vout' : `vtxt${i}`

    const scaledSize = Math.round(ts.fontSize * height / 1080)
    const hexColor   = ts.fontColor.replace('#', '')
    const enableExpr = `between(t,${clip.startTime.toFixed(3)},${(clip.startTime + clip.duration).toFixed(3)})`

    // X position based on alignment
    let xExpr: string
    if (ts.alignment === 'center') {
      xExpr = `(w-text_w)/2+${(ts.positionX - 0.5).toFixed(4)}*w`
    } else if (ts.alignment === 'right') {
      xExpr = `${ts.positionX.toFixed(4)}*w-text_w`
    } else {
      xExpr = `${ts.positionX.toFixed(4)}*w`
    }
    const yExpr = `${ts.positionY.toFixed(4)}*h-text_h/2`

    const boxArgs = ts.bgColor !== 'transparent'
      ? `:box=1:boxcolor=${ts.bgColor.replace('#', '')}@0.8:boxborderw=8`
      : ''

    const boldArg   = ts.bold   ? ':bold=1'   : ''
    const italicArg = ts.italic ? ':italic=1' : ''

    const drawtextFilter =
      `drawtext=text='${escapeDrawtext(ts.content)}'` +
      `:fontsize=${scaledSize}` +
      `:fontcolor=${hexColor}` +
      `${boldArg}${italicArg}` +
      `:x=${xExpr}:y=${yExpr}` +
      `:enable='${enableExpr}'` +
      `${boxArgs}`

    filterParts.push(`[${videoOut}]${drawtextFilter}[${outLabel}]`)
    videoOut = outLabel
  }

  // If no text clips, pass vconcat through as vout
  if (textClips.length === 0) {
    filterParts.push(`[vconcat]copy[vout]`)
  }

  // ── Audio-track clips: silence-pad + amix ────────────────────────────────
  const audioMixSources: string[] = ['[video_audio]']

  for (let i = 0; i < audioClips.length; i++) {
    const clip = audioClips[i]
    const path = job.mediaPaths[clip.mediaClipId]
    if (!path) continue

    const ii      = getVideoAudioInput(path)
    const vol     = clip.volume ?? 1
    const speed   = clip.speed  ?? 1
    const trimEnd = clip.trimStart + clip.duration * speed
    const speedA  = speed !== 1 ? `,${buildAtempoChain(speed)}` : ''
    const prefLbl = `apre${i}`
    const clipLbl = `aclip${i}`
    const padLbl  = `apad${i}`

    // Clip-level audio fades for this music/extra-audio clip
    const aFadeIn  = clip.fadeIn  ?? 0
    const aFadeOut = clip.fadeOut ?? 0
    const aFadeFilters = [
      aFadeIn  > 0 ? `afade=t=in:st=0:d=${aFadeIn.toFixed(3)}`                                                        : '',
      aFadeOut > 0 ? `afade=t=out:st=${Math.max(0, clip.duration - aFadeOut).toFixed(3)}:d=${aFadeOut.toFixed(3)}` : ''
    ].filter(Boolean).join(',')
    const aFadeSuffix = aFadeFilters ? `,${aFadeFilters}` : ''

    if (clip.startTime > 0.001) {
      filterParts.push(
        `aevalsrc=0|0:channel_layout=${chLayout}:sample_rate=${sampleRate}:d=${clip.startTime.toFixed(6)}[${prefLbl}]`
      )
      filterParts.push(
        `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
        `asetpts=PTS-STARTPTS${speedA},volume=${vol}${aFadeSuffix}[${clipLbl}]`
      )
      filterParts.push(`[${prefLbl}][${clipLbl}]concat=n=2:v=0:a=1[${padLbl}]`)
    } else {
      filterParts.push(
        `[${ii}:a]atrim=start=${clip.trimStart.toFixed(6)}:end=${trimEnd.toFixed(6)},` +
        `asetpts=PTS-STARTPTS${speedA},volume=${vol}${aFadeSuffix}[${padLbl}]`
      )
    }

    audioMixSources.push(`[${padLbl}]`)
  }

  if (audioMixSources.length === 1) {
    filterParts.push(`[video_audio]aformat=channel_layouts=${chLayout}[aout]`)
  } else {
    const mixN = audioMixSources.length
    filterParts.push(
      `${audioMixSources.join('')}amix=inputs=${mixN}:duration=first:dropout_transition=0[aout]`
    )
  }

  // ── Assemble final args ───────────────────────────────────────────────────
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

  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    stderr += text

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
