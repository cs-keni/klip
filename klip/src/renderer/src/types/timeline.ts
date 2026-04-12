export type TrackType = 'video' | 'audio' | 'music' | 'overlay'

export const TRACK_HEIGHT: Record<TrackType, number> = {
  video: 64,
  audio: 56,
  music: 56,
  overlay: 44
}

export const HEADER_WIDTH = 160

export interface Track {
  id: string
  type: TrackType
  name: string
  isLocked: boolean
  isMuted: boolean
  isSolo: boolean
}

// ── Phase 6 settings types ─────────────────────────────────────────────────────

export interface TextSettings {
  content: string
  fontSize: number          // px on a 1080p canvas (e.g. 48)
  fontColor: string         // hex, e.g. '#ffffff'
  bgColor: string           // hex or 'transparent'
  bold: boolean
  italic: boolean
  alignment: 'left' | 'center' | 'right'
  positionX: number         // 0–1 (horizontal center of text box)
  positionY: number         // 0–1 (vertical center of text box)
}

export interface ColorSettings {
  brightness: number        // -1 to 1 (0 = no change)
  contrast: number          // -1 to 1 (0 = no change)
  saturation: number        // -1 to 1 (0 = no change)
}

export interface CropSettings {
  zoom: number              // 1.0 = no zoom, 4.0 = 4× zoom
  panX: number              // -1 to 1 (0 = centre)
  panY: number              // -1 to 1 (0 = centre)
}

export interface Transition {
  id: string
  fromClipId: string
  toClipId: string
  type: 'fade' | 'dip-to-black'
  duration: number          // seconds
}

// ── Core timeline types ────────────────────────────────────────────────────────

export interface TimelineClip {
  id: string
  /** References MediaClip.id in the media store. Text clips use their own id. */
  mediaClipId: string
  trackId: string

  /** Position on the timeline in seconds. */
  startTime: number
  /** Visible (output) duration in seconds. */
  duration: number
  /** Seconds trimmed from the start of the source media. */
  trimStart: number

  /** Drives colour coding and icon. 'text' = synthetic overlay clip. */
  type: 'video' | 'audio' | 'image' | 'color' | 'text'
  name: string
  thumbnail: string | null
  /** Only present for type === 'color'. */
  color?: string

  /** ID of the paired audio/video clip (linked video + audio clips). */
  linkedClipId?: string

  // ── Phase 5 ─────────────────────────────────────
  /** Playback volume multiplier (0–1, default 1). */
  volume?: number

  // ── Phase 6 ─────────────────────────────────────
  /** Playback speed multiplier (default 1.0). Source consumed = duration × speed. */
  speed?: number
  /** Only present for type === 'text'. */
  textSettings?: TextSettings
  /** Brightness / contrast / saturation adjustment (video, image, color clips). */
  colorSettings?: ColorSettings
  /** Digital zoom & pan (video, image clips). */
  cropSettings?: CropSettings
}

export interface HistoryEntry {
  tracks: Track[]
  clips: TimelineClip[]
  transitions: Transition[]
}
