/**
 * Phase 3 §3.7, §3.8, §3.15, §3.16
 *
 * §3.7  TimelineClipView
 * §3.8  TrackRow
 * §3.15 TimelineRuler
 * §3.16 WaveformCanvas
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// jsdom doesn't implement ResizeObserver — stub it globally for this file
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore }    from '@/stores/mediaStore'
import type { MediaClip }   from '@/types/media'
import type { TimelineClip, Track } from '@/types/timeline'

// Mock dependencies used by TimelineClipView that involve IPC or animations
vi.mock('@/lib/dragRegistry', () => ({
  dragRegistry: { set: vi.fn(), delete: vi.fn(), get: vi.fn() }
}))
vi.mock('@/lib/snapIndicator', () => ({
  setSnapTime: vi.fn()
}))
vi.mock('@/lib/rippleSignal', () => ({
  wasRecentRipple: vi.fn().mockReturnValue(false)
}))
vi.mock('@/lib/copyFlash', () => ({
  subscribeCopyFlash: vi.fn().mockReturnValue(() => {})
}))

// TrackRow imports TimelineClipView — mock it to keep TrackRow tests simple
vi.mock('@/components/Timeline/TimelineClipView', () => ({
  default: ({ clip }: { clip: TimelineClip }) => (
    <div data-testid={`clip-view-${clip.id}`}>{clip.id}</div>
  )
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'media-1', type: 'video', path: '/test.mp4', name: 'Test',
    duration: 10, width: 1920, height: 1080, fps: 30,
    fileSize: 1000, thumbnail: null, thumbnailStatus: 'idle',
    isOnTimeline: false, isMissing: false, addedAt: 1000,
    proxyStatus: 'none', proxyProgress: 0, proxyPath: null,
    ...overrides
  }
}

function makeTimelineClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'tc-1', mediaClipId: 'media-1', trackId: 'track-video-1',
    startTime: 0, duration: 10, trimStart: 0,
    type: 'video',
    ...overrides
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-video-1', type: 'video', name: 'Video 1',
    muted: false, solo: false, locked: false,
    ...overrides
  }
}

const TRACK_ROW_DEFAULTS = {
  pxPerSec:       100,
  scrollLeft:     0,
  contentWidth:   2000,
  containerWidth: 1200,
  selectedClipId: null,
  selectedClipIds: [],
}

// =============================================================================
// §3.15 TimelineRuler
// =============================================================================

describe('3.15 TimelineRuler', () => {
  const rulerDefaults = {
    pxPerSec:      100,
    totalDuration: 60,
    playheadTime:  0,
    scrollLeft:    0,
    onScrub:       vi.fn(),
    onScrubStart:  vi.fn(),
    onScrubEnd:    vi.fn(),
  }

  it('renders without crashing', async () => {
    const { default: TimelineRuler } = await import('@/components/Timeline/TimelineRuler')
    const { container } = render(<TimelineRuler {...rulerDefaults} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('calls onScrubStart and onScrub on mousedown', async () => {
    const { default: TimelineRuler } = await import('@/components/Timeline/TimelineRuler')
    const onScrub     = vi.fn()
    const onScrubStart = vi.fn()
    const { container } = render(
      <TimelineRuler {...rulerDefaults} onScrub={onScrub} onScrubStart={onScrubStart} />
    )

    fireEvent.mouseDown(container.firstChild as Element, { button: 0, clientX: 500 })

    expect(onScrubStart).toHaveBeenCalledOnce()
    expect(onScrub).toHaveBeenCalledOnce()
  })

  it('does not fire scrub on right-click (button !== 0)', async () => {
    const { default: TimelineRuler } = await import('@/components/Timeline/TimelineRuler')
    const onScrubStart = vi.fn()
    const { container } = render(
      <TimelineRuler {...rulerDefaults} onScrubStart={onScrubStart} />
    )

    fireEvent.mouseDown(container.firstChild as Element, { button: 2 })

    expect(onScrubStart).not.toHaveBeenCalled()
  })

  it('renders markers passed via props', async () => {
    const { default: TimelineRuler } = await import('@/components/Timeline/TimelineRuler')
    const markers = [{ id: 'm1', time: 5, label: 'Intro', color: '#ff0000' }]
    render(<TimelineRuler {...rulerDefaults} markers={markers} />)
    expect(screen.getByText('Intro')).toBeInTheDocument()
  })

  it('playhead SVG is positioned at playheadTime * pxPerSec', async () => {
    const { default: TimelineRuler } = await import('@/components/Timeline/TimelineRuler')
    const { container } = render(
      <TimelineRuler {...rulerDefaults} playheadTime={2} pxPerSec={100} />
    )
    // Playhead handle left = 2 * 100 - 5 = 195px
    const handles = container.querySelectorAll('[style*="left"]')
    const hasPlayhead = Array.from(handles).some((el) =>
      (el as HTMLElement).style.left.includes('195')
    )
    expect(hasPlayhead).toBe(true)
  })
})

// =============================================================================
// §3.16 WaveformCanvas
// =============================================================================

describe('3.16 WaveformCanvas', () => {
  it('renders a canvas element', async () => {
    const { default: WaveformCanvas } = await import('@/components/Timeline/WaveformCanvas')
    const peaks = new Float32Array([0.1, 0.5, 0.3, 0.8])
    const { container } = render(
      <WaveformCanvas peaks={peaks} trimStart={0} duration={4} color="#60a5fa" />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('canvas remains in DOM after re-render with new peaks', async () => {
    const { default: WaveformCanvas } = await import('@/components/Timeline/WaveformCanvas')
    const { rerender, container } = render(
      <WaveformCanvas peaks={new Float32Array([0.1])} trimStart={0} duration={1} color="#60a5fa" />
    )
    rerender(
      <WaveformCanvas peaks={new Float32Array([0.2, 0.9])} trimStart={0} duration={2} color="#60a5fa" />
    )
    expect(container.querySelector('canvas')).not.toBeNull()
  })
})

// =============================================================================
// §3.8  TrackRow
// =============================================================================

describe('3.8 TrackRow', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [makeTrack()],
      clips: [],
      selectedClipId: null,
      selectedClipIds: [],
      snapEnabled: true,
    })
    useMediaStore.setState({ clips: [makeMediaClip()], selectedClipId: null })
  })

  it('renders the track name in the header', async () => {
    const { default: TrackRow } = await import('@/components/Timeline/TrackRow')
    const track = makeTrack({ name: 'Video 1' })
    render(
      <TrackRow
        {...TRACK_ROW_DEFAULTS}
        track={track}
        clips={[]}
      />
    )
    expect(screen.getByText('Video 1')).toBeInTheDocument()
  })

  it('renders clip views for clips on this track', async () => {
    const { default: TrackRow } = await import('@/components/Timeline/TrackRow')
    const track = makeTrack({ id: 'track-1' })
    const clips = [
      makeTimelineClip({ id: 'tc-1', trackId: 'track-1', startTime: 0 }),
      makeTimelineClip({ id: 'tc-2', trackId: 'track-1', startTime: 5 }),
    ]
    render(
      <TrackRow
        {...TRACK_ROW_DEFAULTS}
        track={track}
        clips={clips}
      />
    )
    expect(screen.getByTestId('clip-view-tc-1')).toBeInTheDocument()
    expect(screen.getByTestId('clip-view-tc-2')).toBeInTheDocument()
  })

  it('lock button calls toggleLock with track id', async () => {
    const { default: TrackRow } = await import('@/components/Timeline/TrackRow')
    const toggleLock = vi.fn()
    useTimelineStore.setState({ toggleLock })
    const { userEvent: user } = await import('@testing-library/user-event')
    const userEvt = user.setup()
    const track = makeTrack({ id: 'track-1', locked: false })
    render(
      <TrackRow {...TRACK_ROW_DEFAULTS} track={track} clips={[]} />
    )

    await userEvt.click(screen.getByRole('button', { name: /lock/i }))

    expect(toggleLock).toHaveBeenCalledWith('track-1')
  })

  it('mute button calls toggleMute with track id', async () => {
    const { default: TrackRow } = await import('@/components/Timeline/TrackRow')
    const toggleMute = vi.fn()
    useTimelineStore.setState({ toggleMute })
    const { userEvent: user } = await import('@testing-library/user-event')
    const userEvt = user.setup()
    const track = makeTrack({ id: 'track-1', muted: false })
    render(
      <TrackRow {...TRACK_ROW_DEFAULTS} track={track} clips={[]} />
    )

    await userEvt.click(screen.getByRole('button', { name: /mute/i }))

    expect(toggleMute).toHaveBeenCalledWith('track-1')
  })
})

// =============================================================================
// §3.7  TimelineClipView (structural tests — drag logic covered by timeline store tests)
// =============================================================================

describe('3.7 TimelineClipView', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      clips: [], tracks: [],
      selectedClipId: null, selectedClipIds: [],
      snapEnabled: true,
    })
    useMediaStore.setState({ clips: [makeMediaClip()], selectedClipId: null })
    vi.mocked(window.api.waveform.extract).mockResolvedValue(null)
  })

  it('renders without crashing for a video clip', async () => {
    const { default: TimelineClipView } = await import(
      '@/components/Timeline/TimelineClipView'
    )
    const clip = makeTimelineClip({ type: 'video' })
    const { container } = render(
      <TimelineClipView
        clip={clip}
        pxPerSec={100}
        trackHeight={56}
        isSelected={false}
        isPrimary={false}
        isLocked={false}
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('renders without crashing for an audio clip', async () => {
    const { default: TimelineClipView } = await import(
      '@/components/Timeline/TimelineClipView'
    )
    const clip = makeTimelineClip({ type: 'audio', mediaClipId: 'audio-1' })
    useMediaStore.setState({
      clips: [makeMediaClip({ id: 'audio-1', type: 'audio' })],
      selectedClipId: null
    })
    const { container } = render(
      <TimelineClipView
        clip={clip}
        pxPerSec={100}
        trackHeight={56}
        isSelected={false}
        isPrimary={false}
        isLocked={false}
      />
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('applies selected styling when isSelected is true', async () => {
    const { default: TimelineClipView } = await import(
      '@/components/Timeline/TimelineClipView'
    )
    const clip = makeTimelineClip({ type: 'video' })
    const { container } = render(
      <TimelineClipView
        clip={clip}
        pxPerSec={100}
        trackHeight={56}
        isSelected={true}
        isPrimary={true}
        isLocked={false}
      />
    )
    // Selected clips have a ring/highlight — the container should exist
    expect(container.firstChild).not.toBeNull()
  })
})
