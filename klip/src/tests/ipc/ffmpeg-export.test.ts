// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-ffmpeg') },
}))

// Prevent ffmpeg-static require from throwing in test environment
vi.mock('ffmpeg-static', () => '/usr/bin/ffmpeg')

import { buildFFmpegArgs } from '../../main/ffmpegExport'
import type { ExportJob, ExportClip } from '../../main/ffmpegExport'

// ── Minimal factory helpers ───────────────────────────────────────────────────

function makeJob(overrides?: Partial<ExportJob>): ExportJob {
  return {
    outputPath: '/tmp/out.mp4',
    width: 1920, height: 1080, fps: 30, crf: 18, x264Preset: 'medium',
    audioBitrate: '192k', sampleRate: 48000,
    totalDuration: 5,
    videoTrackId: 'v1',
    audioTrackIds: ['a1'],
    overlayTrackId: 'overlay',
    clips: [],
    transitions: [],
    mediaPaths: {},
    mediaTypes: {},
    mediaColors: {},
    trackMutes: {},
    trackSolos: [],
    ...overrides,
  }
}

function makeClip(overrides?: Partial<ExportClip>): ExportClip {
  return {
    id: 'c1', mediaClipId: 'mc1', trackId: 'v1', clipType: 'video',
    startTime: 0, trimStart: 0, duration: 5, volume: 1,
    ...overrides,
  }
}

// ── §5.9 buildFFmpegArgs ──────────────────────────────────────────────────────

describe('buildFFmpegArgs', () => {
  it('throws when there are no video track clips', () => {
    expect(() => buildFFmpegArgs(makeJob({ clips: [] }))).toThrow()
  })

  it('produces -i input and core codec flags for a single video clip', () => {
    const job = makeJob({
      clips: [makeClip()],
      mediaPaths: { mc1: '/fake/video.mp4' },
    })
    const args = buildFFmpegArgs(job)
    expect(args).toContain('-i')
    expect(args).toContain('/fake/video.mp4')
    expect(args).toContain('-c:v')
    expect(args).toContain('libx264')
    expect(args).toContain('-crf')
    expect(args).toContain('18')
    expect(args).toContain('-preset')
    expect(args).toContain('medium')
    expect(args[args.length - 1]).toBe('/tmp/out.mp4')
  })

  it('includes eq= filter when colorSettings brightness is non-zero', () => {
    const job = makeJob({
      clips: [makeClip({ colorSettings: { brightness: 0.2, contrast: 0, saturation: 0 } })],
      mediaPaths: { mc1: '/fake/video.mp4' },
    })
    const filterComplex = buildFFmpegArgs(job).join(' ')
    expect(filterComplex).toContain('eq=brightness=0.200')
  })

  it('includes crop= filter when cropSettings zoom > 1', () => {
    const job = makeJob({
      clips: [makeClip({ cropSettings: { zoom: 1.5, panX: 0, panY: 0 } })],
      mediaPaths: { mc1: '/fake/video.mp4' },
    })
    const filterComplex = buildFFmpegArgs(job).join(' ')
    expect(filterComplex).toContain('crop=')
  })

  it('includes setpts speed filter when clip speed is not 1', () => {
    const job = makeJob({
      clips: [makeClip({ speed: 2 })],
      mediaPaths: { mc1: '/fake/video.mp4' },
    })
    const filterComplex = buildFFmpegArgs(job).join(' ')
    expect(filterComplex).toContain('setpts=(PTS-STARTPTS)*(1/')
    expect(filterComplex).toContain('atempo=')
  })

  it('includes drawtext= filter for text overlay clips', () => {
    const textClip: ExportClip = {
      id: 'tc1', mediaClipId: 'tmc1', trackId: 'overlay', clipType: 'text',
      startTime: 0, trimStart: 0, duration: 5, volume: 1,
      textSettings: {
        content: 'Hello World',
        fontSize: 48, fontFamily: 'Arial', fontColor: '#ffffff',
        bgColor: 'transparent', bold: false, italic: false,
        alignment: 'center', positionX: 0.5, positionY: 0.5,
        animationPreset: 'none',
      },
    }
    const videoClip = makeClip()
    const job = makeJob({
      clips: [videoClip, textClip],
      mediaPaths: { mc1: '/fake/video.mp4', tmc1: '' },
    })
    const filterComplex = buildFFmpegArgs(job).join(' ')
    expect(filterComplex).toContain('drawtext=')
    expect(filterComplex).toContain('Hello World')
  })

  it('includes fade filter for a transition between two clips', () => {
    const c1 = makeClip({ id: 'c1', startTime: 0, duration: 3 })
    const c2 = makeClip({ id: 'c2', startTime: 3, duration: 3 })
    const job = makeJob({
      totalDuration: 6,
      clips: [c1, c2],
      mediaPaths: { mc1: '/fake/video.mp4' },
      transitions: [{ fromClipId: 'c1', toClipId: 'c2', type: 'fade', duration: 1.0 }],
    })
    const filterComplex = buildFFmpegArgs(job).join(' ')
    expect(filterComplex).toContain('fade=t=out')
    expect(filterComplex).toContain('fade=t=in')
  })

  it('produces a color= filter source for color clips (no -i input needed)', () => {
    const colorClip = makeClip({ clipType: 'color', mediaClipId: 'cc1' })
    const job = makeJob({
      clips: [colorClip],
      mediaPaths: {},
      mediaColors: { cc1: '#ff0000' },
    })
    const argsStr = buildFFmpegArgs(job).join(' ')
    expect(argsStr).toContain('color=0xff0000')
    // No file input needed for pure color clips
    expect(argsStr).not.toContain('/fake/')
  })

  it('output path with spaces is a single positional arg (no shell splitting)', () => {
    const job = makeJob({
      outputPath: '/tmp/my output/video file.mp4',
      clips: [makeClip()],
      mediaPaths: { mc1: '/fake/video.mp4' },
    })
    const args = buildFFmpegArgs(job)
    expect(args[args.length - 1]).toBe('/tmp/my output/video file.mp4')
  })
})
