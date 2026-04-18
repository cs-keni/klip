/**
 * Phase 1 — Unit: mediaUtils.ts (§1.1)
 *
 * Pure synchronous formatting helpers and path/type utilities.
 * No DOM, no stores, no IPC.
 */
import { describe, it, expect } from 'vitest'
import {
  formatTimecode,
  formatDuration,
  formatFileSize,
  formatResolution,
  pathToFileUrl,
  getMediaTypeFromPath
} from '@/lib/mediaUtils'

// =============================================================================
// formatTimecode — HH:MM:SS:FF at 30 fps
// =============================================================================

describe('formatTimecode', () => {
  it('0 → "00:00:00:00"', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00')
  })

  it('1 → "00:00:01:00"', () => {
    expect(formatTimecode(1)).toBe('00:00:01:00')
  })

  it('1.5 → "00:00:01:15" (30 fps: 0.5 s = 15 frames)', () => {
    expect(formatTimecode(1.5)).toBe('00:00:01:15')
  })

  it('60 → "00:01:00:00"', () => {
    expect(formatTimecode(60)).toBe('00:01:00:00')
  })

  it('3600 → "01:00:00:00"', () => {
    expect(formatTimecode(3600)).toBe('01:00:00:00')
  })

  it('h=1 m=1 s=1 f=15 → "01:01:01:15" (0.5s = 15 frames, exactly representable)', () => {
    // 0.5 is exactly representable in IEEE 754 so (s % 1) * 30 = 15.0 precisely.
    expect(formatTimecode(3600 + 60 + 1 + 0.5)).toBe('01:01:01:15')
  })

  it('negative input is clamped to zero', () => {
    expect(formatTimecode(-5)).toBe('00:00:00:00')
    expect(formatTimecode(-0.001)).toBe('00:00:00:00')
  })

  it('NaN does not crash (returns a string)', () => {
    expect(() => formatTimecode(NaN)).not.toThrow()
    expect(typeof formatTimecode(NaN)).toBe('string')
  })

  it('Infinity does not crash (returns a string)', () => {
    expect(() => formatTimecode(Infinity)).not.toThrow()
    expect(typeof formatTimecode(Infinity)).toBe('string')
  })

  it('frame count fills two digits', () => {
    // 29 frames = 29/30 ≈ 0.9667 s fraction
    expect(formatTimecode(29 / 30)).toBe('00:00:00:29')
  })
})

// =============================================================================
// formatDuration — M:SS or H:MM:SS
// =============================================================================

describe('formatDuration', () => {
  it('0 → "0:00"', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('59 → "0:59"', () => {
    expect(formatDuration(59)).toBe('0:59')
  })

  it('60 → "1:00"', () => {
    expect(formatDuration(60)).toBe('1:00')
  })

  it('3599 → "59:59"', () => {
    expect(formatDuration(3599)).toBe('59:59')
  })

  it('3600 → "1:00:00" (hours shown when ≥ 1 hour)', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('3661 → "1:01:01"', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('negative input returns "0:00"', () => {
    expect(formatDuration(-1)).toBe('0:00')
  })

  it('NaN returns "0:00"', () => {
    expect(formatDuration(NaN)).toBe('0:00')
  })

  it('Infinity returns "0:00"', () => {
    expect(formatDuration(Infinity)).toBe('0:00')
  })
})

// =============================================================================
// formatFileSize — KB / MB / GB
// =============================================================================

describe('formatFileSize', () => {
  it('0 → "" (empty — no display for zero)', () => {
    expect(formatFileSize(0)).toBe('')
  })

  it('negative → "" (empty)', () => {
    expect(formatFileSize(-500)).toBe('')
  })

  it('1023 bytes → shows "KB"', () => {
    expect(formatFileSize(1023)).toMatch(/KB/)
  })

  it('1 048 576 bytes (1 MiB) → "1.0 MB"', () => {
    expect(formatFileSize(1_048_576)).toBe('1.0 MB')
  })

  it('10 MiB → "10.0 MB"', () => {
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB')
  })

  it('1 073 741 824 bytes (1 GiB) → "1.00 GB"', () => {
    expect(formatFileSize(1_073_741_824)).toBe('1.00 GB')
  })
})

// =============================================================================
// formatResolution — named presets + fallback
// =============================================================================

describe('formatResolution', () => {
  it('1920×1080 → "1080p"', () => {
    expect(formatResolution(1920, 1080)).toBe('1080p')
  })

  it('2560×1440 → "1440p"', () => {
    expect(formatResolution(2560, 1440)).toBe('1440p')
  })

  it('3840×2160 → "4K"', () => {
    expect(formatResolution(3840, 2160)).toBe('4K')
  })

  it('1280×720 → "720p"', () => {
    expect(formatResolution(1280, 720)).toBe('720p')
  })

  it('640×480 → "640×480" (below 720p — raw dimensions)', () => {
    expect(formatResolution(640, 480)).toBe('640×480')
  })

  it('0×0 → "" (audio-only / no resolution)', () => {
    expect(formatResolution(0, 0)).toBe('')
  })
})

// =============================================================================
// pathToFileUrl — Windows paths → klip://local/
// =============================================================================

describe('pathToFileUrl', () => {
  it('Windows backslash path produces klip://local/ URL', () => {
    const result = pathToFileUrl('C:\\Users\\test\\video.mp4')
    expect(result).toBe('klip://local/C:/Users/test/video.mp4')
  })

  it('backslashes are normalised to forward slashes', () => {
    const result = pathToFileUrl('D:\\footage\\clip.mp4')
    expect(result).not.toContain('\\')
  })

  it('spaces are percent-encoded as %20', () => {
    const result = pathToFileUrl('C:\\My Documents\\video.mp4')
    expect(result).toContain('My%20Documents')
    expect(result).not.toContain('My Documents')
  })

  it('Unicode characters in filename are percent-encoded', () => {
    const result = pathToFileUrl('C:\\clips\\日本語.mp4')
    expect(result).not.toContain('日本語')
    expect(result).toContain('klip://local/')
  })

  it('drive letter C: is preserved (not encoded as C%3A)', () => {
    const result = pathToFileUrl('C:\\video.mp4')
    expect(result).toContain('C:')
    expect(result).not.toContain('C%3A')
  })

  it('UNC path \\\\server\\share\\file.mp4 does not crash', () => {
    expect(() => pathToFileUrl('\\\\server\\share\\file.mp4')).not.toThrow()
  })

  it('Unix/WSL path produces a klip://local/ URL', () => {
    const result = pathToFileUrl('/mnt/c/Users/test/clip.mp4')
    expect(result.startsWith('klip://local/')).toBe(true)
    expect(result).toContain('mnt/c/Users/test/clip.mp4')
  })
})

// =============================================================================
// getMediaTypeFromPath — extension-based detection
// =============================================================================

describe('getMediaTypeFromPath', () => {
  // Video formats
  it.each(['.mp4', '.mov', '.mkv', '.avi', '.webm'])('%s → "video"', (ext) => {
    expect(getMediaTypeFromPath(`clip${ext}`)).toBe('video')
  })

  // Audio formats
  it.each(['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a'])('%s → "audio"', (ext) => {
    expect(getMediaTypeFromPath(`track${ext}`)).toBe('audio')
  })

  // Image formats
  it.each(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'])('%s → "image"', (ext) => {
    expect(getMediaTypeFromPath(`photo${ext}`)).toBe('image')
  })

  it('unknown extension falls back to "video"', () => {
    expect(getMediaTypeFromPath('file.xyz')).toBe('video')
  })

  it('path with no extension falls back to "video"', () => {
    expect(getMediaTypeFromPath('no_extension')).toBe('video')
  })

  it('extension comparison is case-insensitive (.MP4 → "video")', () => {
    expect(getMediaTypeFromPath('CLIP.MP4')).toBe('video')
  })

  it('extension comparison is case-insensitive (.PNG → "image")', () => {
    expect(getMediaTypeFromPath('PHOTO.PNG')).toBe('image')
  })
})
