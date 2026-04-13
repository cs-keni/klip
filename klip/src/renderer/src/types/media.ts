export type MediaType = 'video' | 'audio' | 'image' | 'color'

export type ThumbnailStatus = 'idle' | 'generating' | 'ready' | 'error'

/** 'none' = no proxy / not started, 'generating' = FFmpeg running, 'ready' = proxy usable */
export type ProxyStatus = 'none' | 'generating' | 'ready' | 'error'

export interface MediaClip {
  id: string
  type: MediaType

  /** Absolute file path. Empty string for color clips. */
  path: string
  name: string

  /** Duration in seconds. For images/color: the display duration on the timeline. */
  duration: number

  /** Source resolution. 0 for color clips. */
  width: number
  height: number

  /** Frames per second. 0 when unknown (we can't detect this without FFprobe in 2a). */
  fps: number

  /** File size in bytes. 0 for color clips. */
  fileSize: number

  /** Base64 data URL generated from canvas. Null for color clips (they use `color` instead). */
  thumbnail: string | null
  thumbnailStatus: ThumbnailStatus

  /** Hex color for type === 'color', e.g. '#1a1a2e'. */
  color?: string

  /** True when this clip has been placed on the timeline at least once. */
  isOnTimeline: boolean

  /** True when the source file can no longer be found on disk. */
  isMissing: boolean

  addedAt: number

  // ── Proxy (Phase 2b) ───────────────────────────────────────────────────────

  /**
   * Absolute path to the low-res proxy file stored in userData/klip-proxies/.
   * Null when no proxy exists yet.
   */
  proxyPath?: string | null

  /** Proxy generation lifecycle state. Defaults to 'none'. */
  proxyStatus?: ProxyStatus

  /** 0–1 generation progress (updated while proxyStatus === 'generating'). */
  proxyProgress?: number
}
