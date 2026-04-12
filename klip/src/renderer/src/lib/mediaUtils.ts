/**
 * Convert an absolute file path to a klip:// URL served by the local file
 * protocol handler in the main process.
 *
 * klip://local/<path> returns the file with proper CORS headers and range-request
 * support, so canvas.toDataURL() and video seeking both work correctly.
 */
export function pathToFileUrl(filePath: string): string {
  // Normalise backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')

  // Encode each path segment; preserve drive letters (C:) and empty segments
  const encoded = normalized
    .split('/')
    .map((seg) => (!seg || /^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg)))
    .join('/')

  if (normalized.startsWith('/')) {
    // Unix/WSL path: /mnt/c/... → klip://local//mnt/c/...
    // The extra slash ensures the pathname starts with // so slice(1) gives /mnt/c/...
    return `klip://local/${encoded}`
  }
  // Windows path: C:/Users/... → klip://local/C:/Users/...
  return `klip://local/${encoded}`
}

export function getMediaTypeFromPath(filePath: string): 'video' | 'audio' | 'image' {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image'
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) return 'audio'
  return 'video'
}

/** HH:MM:SS:FF timecode (30 fps frames). */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds)
  const h  = Math.floor(s / 3600)
  const m  = Math.floor((s % 3600) / 60)
  const sc = Math.floor(s % 60)
  const f  = Math.floor((s % 1) * 30)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}:${String(f).padStart(2,'0')}`
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatResolution(width: number, height: number): string {
  if (!width || !height) return ''
  if (height >= 2160) return '4K'
  if (height >= 1440) return '1440p'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  return `${width}×${height}`
}

interface ProcessedMedia {
  duration: number
  width: number
  height: number
  thumbnail: string | null
}

/**
 * Load a media file via the HTML5 video/image/audio element, extract metadata,
 * and render a thumbnail frame to a canvas — all without FFmpeg.
 *
 * Returns a base64 data URL for the thumbnail (null for audio files).
 */
export async function processMediaFile(filePath: string): Promise<ProcessedMedia> {
  const type = getMediaTypeFromPath(filePath)
  const url = pathToFileUrl(filePath)

  if (type === 'image') return processImage(url)
  if (type === 'audio') return processAudio(url)
  return processVideo(url)
}

function processAudio(url: string): Promise<ProcessedMedia> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 10_000)

    audio.onloadedmetadata = () => {
      clearTimeout(timeout)
      resolve({ duration: isFinite(audio.duration) ? audio.duration : 0, width: 0, height: 0, thumbnail: null })
    }
    audio.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Audio load error'))
    }
    audio.src = url
    audio.load()
  })
}

function processImage(url: string): Promise<ProcessedMedia> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // required so canvas.toDataURL() doesn't throw
    const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10_000)

    img.onload = () => {
      clearTimeout(timeout)
      try {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 320 / img.naturalWidth)
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({
          duration: 5, // default still-image display duration
          width: img.naturalWidth,
          height: img.naturalHeight,
          thumbnail: canvas.toDataURL('image/jpeg', 0.75)
        })
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

function processVideo(url: string): Promise<ProcessedMedia> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.crossOrigin = 'anonymous'

    let seeked = false

    const timeout = setTimeout(() => {
      video.src = ''
      reject(new Error('Video load timeout'))
    }, 20_000)

    function drawFrame() {
      if (seeked) return
      seeked = true
      clearTimeout(timeout)
      try {
        const canvas = document.createElement('canvas')
        const w = video.videoWidth || 320
        const h = video.videoHeight || 180
        const scale = 320 / w
        canvas.width = 320
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbnail = canvas.toDataURL('image/jpeg', 0.75)
        const result: ProcessedMedia = {
          // If duration is Infinity (some formats report this initially), use 0
          duration: isFinite(video.duration) ? video.duration : 0,
          width: w,
          height: h,
          thumbnail
        }
        video.src = ''
        resolve(result)
      } catch (e) {
        video.src = ''
        reject(e)
      }
    }

    // Seek once we have data — try loadeddata first, fall back to canplay
    function triggerSeek() {
      const dur = isFinite(video.duration) ? video.duration : 60
      video.currentTime = Math.min(2, dur * 0.05)
    }

    video.onloadeddata = triggerSeek
    video.oncanplay = triggerSeek  // fallback for formats that skip loadeddata
    video.onseeked = drawFrame

    // Some formats (e.g. MKV/VP9) can't seek until more data is buffered.
    // If onseeked never fires after seeking, draw whatever frame is visible.
    video.ontimeupdate = () => {
      if (video.currentTime > 0) drawFrame()
    }

    video.onerror = () => {
      clearTimeout(timeout)
      video.src = ''
      reject(new Error(`Failed to load video: ${url.slice(0, 80)}`))
    }

    video.src = url
  })
}
