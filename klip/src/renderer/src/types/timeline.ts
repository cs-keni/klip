export type TrackType = 'video' | 'audio' | 'music'

export const TRACK_HEIGHT: Record<TrackType, number> = {
  video: 64,
  audio: 48,
  music: 48
}

export const HEADER_WIDTH = 160

export interface Track {
  id: string
  type: TrackType
  name: string
  isLocked: boolean
  isMuted: boolean
}

export interface TimelineClip {
  id: string
  /** References MediaClip.id in the media store. */
  mediaClipId: string
  trackId: string

  /** Position on the timeline in seconds. */
  startTime: number
  /** Visible duration in seconds (may differ from source duration after trimming). */
  duration: number
  /** Seconds trimmed from the start of the source media. */
  trimStart: number

  /** Mirrors MediaClip.type — drives colour and icon. */
  type: 'video' | 'audio' | 'image' | 'color'
  name: string
  thumbnail: string | null
  /** Only present for type === 'color'. */
  color?: string

  /** ID of the paired audio/video clip (for linked video + audio clips). */
  linkedClipId?: string
}

export interface HistoryEntry {
  tracks: Track[]
  clips: TimelineClip[]
}
