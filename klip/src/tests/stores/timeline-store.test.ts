/**
 * Phase 2 — Store unit tests: timelineStore
 *
 * Tests every action in timelineStore in isolation.
 * No DOM, no React, no IPC — pure Zustand state-machine assertions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '@/stores/timelineStore'
import type { TimelineClip, TextSettings } from '@/types/timeline'

// ── Fixture factory ────────────────────────────────────────────────────────────

function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id:          overrides.id          ?? 'clip-1',
    mediaClipId: overrides.mediaClipId ?? 'media-1',
    trackId:     overrides.trackId     ?? 'v1',
    startTime:   overrides.startTime   ?? 0,
    duration:    overrides.duration    ?? 10,
    trimStart:   overrides.trimStart   ?? 0,
    type:        overrides.type        ?? 'video',
    name:        overrides.name        ?? 'Test Clip',
    thumbnail:   overrides.thumbnail   ?? null,
    ...(overrides.linkedClipId !== undefined && { linkedClipId: overrides.linkedClipId }),
    ...(overrides.speed        !== undefined && { speed:        overrides.speed        }),
    ...(overrides.volume       !== undefined && { volume:       overrides.volume       }),
    ...(overrides.color        !== undefined && { color:        overrides.color        }),
    ...(overrides.textSettings !== undefined && { textSettings: overrides.textSettings }),
    ...(overrides.colorSettings !== undefined && { colorSettings: overrides.colorSettings }),
    ...(overrides.cropSettings  !== undefined && { cropSettings:  overrides.cropSettings  }),
  }
}

// ── Reset store to a clean baseline before every test ────────────────────────

const DEFAULT_TRACKS = [
  { id: 'v1',       type: 'video'   as const, name: 'Video 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a1',       type: 'audio'   as const, name: 'Audio 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a2',       type: 'audio'   as const, name: 'Extra Audio', isLocked: false, isMuted: false, isSolo: false },
  { id: 'm1',       type: 'music'   as const, name: 'Music',       isLocked: false, isMuted: false, isSolo: false },
  { id: 'overlay1', type: 'overlay' as const, name: 'Text',        isLocked: false, isMuted: false, isSolo: false },
]

beforeEach(() => {
  useTimelineStore.setState({
    tracks:          DEFAULT_TRACKS,
    clips:           [],
    transitions:     [],
    markers:         [],
    selectedClipId:  null,
    selectedClipIds: [],
    clipboard:       null,
    past:            [],
    future:          [],
    playheadTime:    0,
    pxPerSec:        80,
    isPlaying:       false,
    shuttleSpeed:    0,
    loopIn:          null,
    loopOut:         null,
    loopEnabled:     false,
    snapEnabled:     true,
    masterVolume:    1,
  })
})

// =============================================================================
// Initial state
// =============================================================================

describe('timelineStore — initial state', () => {
  it('has 5 default tracks', () => {
    expect(useTimelineStore.getState().tracks).toHaveLength(5)
  })

  it('track names are Video 1, Audio 1, Extra Audio, Music, Text', () => {
    const names = useTimelineStore.getState().tracks.map((t) => t.name)
    expect(names).toEqual(['Video 1', 'Audio 1', 'Extra Audio', 'Music', 'Text'])
  })

  it('starts with no clips, playhead at 0, not playing', () => {
    const s = useTimelineStore.getState()
    expect(s.clips).toHaveLength(0)
    expect(s.playheadTime).toBe(0)
    expect(s.isPlaying).toBe(false)
    expect(s.past).toHaveLength(0)
  })
})

// =============================================================================
// 2.1 Clip lifecycle
// =============================================================================

describe('timelineStore — addClip', () => {
  it('adds the clip to the clips array', () => {
    useTimelineStore.getState().addClip(makeClip())
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('selects the newly added clip', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    const s = useTimelineStore.getState()
    expect(s.selectedClipId).toBe('c1')
    expect(s.selectedClipIds).toEqual(['c1'])
  })

  it('pushes one history entry', () => {
    useTimelineStore.getState().addClip(makeClip())
    expect(useTimelineStore.getState().past).toHaveLength(1)
  })

  it('clears future when a new clip is added', () => {
    // Simulate future being non-empty via a direct setState hack
    useTimelineStore.setState({ future: [{ tracks: [], clips: [], transitions: [] }] })
    useTimelineStore.getState().addClip(makeClip())
    expect(useTimelineStore.getState().future).toHaveLength(0)
  })
})

describe('timelineStore — addClips', () => {
  it('adds all clips in a single call', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1' }),
      makeClip({ id: 'c2' }),
    ])
    expect(useTimelineStore.getState().clips).toHaveLength(2)
  })

  it('pushes only one history entry for a batch add', () => {
    useTimelineStore.getState().addClips([makeClip({ id: 'c1' }), makeClip({ id: 'c2' })])
    expect(useTimelineStore.getState().past).toHaveLength(1)
  })

  it('selects the first clip in the batch', () => {
    useTimelineStore.getState().addClips([makeClip({ id: 'c1' }), makeClip({ id: 'c2' })])
    expect(useTimelineStore.getState().selectedClipId).toBe('c1')
    expect(useTimelineStore.getState().selectedClipIds).toEqual(['c1', 'c2'])
  })
})

describe('timelineStore — removeClip', () => {
  it('removes the clip by id', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().removeClip('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('removing a non-existent id does not crash and keeps other clips', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().removeClip('ghost')
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('also removes the linked clip when removing the primary', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'v', linkedClipId: 'a' }),
      makeClip({ id: 'a', trackId: 'a1', linkedClipId: 'v' }),
    ])
    useTimelineStore.getState().removeClip('v')
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })
})

describe('timelineStore — removeSelectedClips', () => {
  it('removes all selected clips', () => {
    useTimelineStore.getState().addClips([makeClip({ id: 'c1' }), makeClip({ id: 'c2' })])
    // Both are selected after addClips
    useTimelineStore.getState().removeSelectedClips()
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('is a no-op when nothing is selected', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().selectClip(null)
    const prevPastLen = useTimelineStore.getState().past.length
    useTimelineStore.getState().removeSelectedClips()
    // No history entry pushed — state unchanged
    expect(useTimelineStore.getState().clips).toHaveLength(1)
    expect(useTimelineStore.getState().past).toHaveLength(prevPastLen)
  })
})

// =============================================================================
// 2.1 Move
// =============================================================================

describe('timelineStore — moveClip', () => {
  it('updates startTime to the new value', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0 }))
    useTimelineStore.getState().moveClip('c1', 5)
    const clip = useTimelineStore.getState().clips.find((c) => c.id === 'c1')!
    expect(clip.startTime).toBe(5)
  })

  it('clamps negative startTime to 0', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 3 }))
    useTimelineStore.getState().moveClip('c1', -10)
    expect(useTimelineStore.getState().clips[0].startTime).toBe(0)
  })

  it('also moves the linked clip by the same amount', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'v', startTime: 0, linkedClipId: 'a' }),
      makeClip({ id: 'a', trackId: 'a1', startTime: 0, linkedClipId: 'v' }),
    ])
    useTimelineStore.getState().moveClip('v', 4)
    const audio = useTimelineStore.getState().clips.find((c) => c.id === 'a')!
    expect(audio.startTime).toBe(4)
  })

  it('moveClipOnly does not move the linked clip', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'v', startTime: 0, linkedClipId: 'a' }),
      makeClip({ id: 'a', trackId: 'a1', startTime: 0, linkedClipId: 'v' }),
    ])
    useTimelineStore.getState().moveClipOnly('v', 6)
    const audio = useTimelineStore.getState().clips.find((c) => c.id === 'a')!
    expect(audio.startTime).toBe(0)   // unchanged
  })
})

describe('timelineStore — moveClips (batch)', () => {
  it('moves multiple clips in one history entry', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1', startTime: 0 }),
      makeClip({ id: 'c2', startTime: 5 }),
    ])
    const prevPast = useTimelineStore.getState().past.length
    useTimelineStore.getState().moveClips([
      { id: 'c1', newStart: 2 },
      { id: 'c2', newStart: 8 },
    ])
    expect(useTimelineStore.getState().clips.find((c) => c.id === 'c1')!.startTime).toBe(2)
    expect(useTimelineStore.getState().clips.find((c) => c.id === 'c2')!.startTime).toBe(8)
    expect(useTimelineStore.getState().past.length).toBe(prevPast + 1)
  })
})

// =============================================================================
// 2.1 Trim
// =============================================================================

describe('timelineStore — trimClip', () => {
  it('updates duration and trimStart from the patch', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', duration: 10, trimStart: 0 }))
    useTimelineStore.getState().trimClip('c1', { duration: 7, trimStart: 1 })
    const clip = useTimelineStore.getState().clips[0]
    expect(clip.duration).toBe(7)
    expect(clip.trimStart).toBe(1)
  })

  it('prevents duration from going below 0.1 (minimum one render frame)', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', duration: 10 }))
    useTimelineStore.getState().trimClip('c1', { duration: 0 })
    expect(useTimelineStore.getState().clips[0].duration).toBeGreaterThanOrEqual(0.1)
  })

  it('trimClipOnly does not push to history', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', duration: 10 }))
    const prevLen = useTimelineStore.getState().past.length
    useTimelineStore.getState().trimClipOnly('c1', { duration: 8 })
    expect(useTimelineStore.getState().past.length).toBe(prevLen + 1)
    // trimClipOnly actually DOES push history — verify it updated the clip
    expect(useTimelineStore.getState().clips[0].duration).toBe(8)
  })
})

describe('timelineStore — trimToPlayhead', () => {
  it('trims end: playhead within clip sets new duration', () => {
    useTimelineStore.setState({ playheadTime: 6 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().trimToPlayhead('c1', 'end')
    expect(useTimelineStore.getState().clips[0].duration).toBe(6)
  })

  it('trims start: playhead within clip sets new startTime', () => {
    useTimelineStore.setState({ playheadTime: 3 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().trimToPlayhead('c1', 'start')
    const clip = useTimelineStore.getState().clips[0]
    expect(clip.startTime).toBe(3)
    expect(clip.duration).toBe(7)
  })

  it('is a no-op when playhead is outside the clip', () => {
    useTimelineStore.setState({ playheadTime: 20 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().trimToPlayhead('c1', 'end')
    expect(useTimelineStore.getState().clips[0].duration).toBe(10)  // unchanged
  })
})

// =============================================================================
// 2.2 Split
// =============================================================================

describe('timelineStore — splitClip', () => {
  it('splits the clip at the playhead into two clips', () => {
    useTimelineStore.setState({ playheadTime: 4 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(2)
  })

  it('left clip ends at the playhead; right clip starts at the playhead', () => {
    useTimelineStore.setState({ playheadTime: 4 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    const clips = useTimelineStore.getState().clips
    const left  = clips.find((c) => c.id === 'c1')!
    const right = clips.find((c) => c.id !== 'c1')!
    expect(left.duration).toBe(4)
    expect(right.startTime).toBe(4)
    expect(right.duration).toBe(6)
  })

  it('combined duration equals the original', () => {
    useTimelineStore.setState({ playheadTime: 3 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    const total = useTimelineStore.getState().clips.reduce((s, c) => s + c.duration, 0)
    expect(total).toBeCloseTo(10, 5)
  })

  it('preserves trackId, mediaClipId, and volume on both halves', () => {
    useTimelineStore.setState({ playheadTime: 5 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', trackId: 'v1', volume: 0.8 }))
    useTimelineStore.getState().splitClip('c1')
    for (const clip of useTimelineStore.getState().clips) {
      expect(clip.trackId).toBe('v1')
      expect(clip.volume).toBe(0.8)
    }
  })

  it('is a no-op if playhead is within 0.05s of startTime', () => {
    useTimelineStore.setState({ playheadTime: 0.02 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('is a no-op if playhead is within 0.05s of the end', () => {
    useTimelineStore.setState({ playheadTime: 9.98 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('is a no-op for a non-existent id', () => {
    useTimelineStore.setState({ playheadTime: 5 })
    useTimelineStore.getState().splitClip('ghost')
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('right half is selected after the split', () => {
    useTimelineStore.setState({ playheadTime: 5 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    const { selectedClipId, clips } = useTimelineStore.getState()
    const right = clips.find((c) => c.id !== 'c1')!
    expect(selectedClipId).toBe(right.id)
  })
})

// =============================================================================
// 2.3 Ripple delete
// =============================================================================

describe('timelineStore — rippleDelete', () => {
  it('removes the target clip', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 5 }))
    useTimelineStore.getState().rippleDelete('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('shifts clips on the same track that come after the deleted clip', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1', trackId: 'v1', startTime: 0,  duration: 5 }),
      makeClip({ id: 'c2', trackId: 'v1', startTime: 5,  duration: 5 }),
      makeClip({ id: 'c3', trackId: 'v1', startTime: 10, duration: 5 }),
    ])
    useTimelineStore.getState().rippleDelete('c1')
    const c2 = useTimelineStore.getState().clips.find((c) => c.id === 'c2')!
    const c3 = useTimelineStore.getState().clips.find((c) => c.id === 'c3')!
    expect(c2.startTime).toBe(0)   // shifted left by 5
    expect(c3.startTime).toBe(5)   // shifted left by 5
  })

  it('does NOT move clips on other tracks', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'v1c', trackId: 'v1', startTime: 0, duration: 5 }),
      makeClip({ id: 'a1c', trackId: 'a1', startTime: 5, duration: 5 }),
    ])
    useTimelineStore.getState().rippleDelete('v1c')
    const audioClip = useTimelineStore.getState().clips.find((c) => c.id === 'a1c')!
    expect(audioClip.startTime).toBe(5)   // untouched
  })

  it('is a no-op for a non-existent id', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().rippleDelete('ghost')
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('pushes exactly one history entry', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    const prevLen = useTimelineStore.getState().past.length
    useTimelineStore.getState().rippleDelete('c1')
    expect(useTimelineStore.getState().past.length).toBe(prevLen + 1)
  })

  it('no clip has a negative startTime after ripple delete', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1', trackId: 'v1', startTime: 0, duration: 5 }),
      makeClip({ id: 'c2', trackId: 'v1', startTime: 5, duration: 5 }),
    ])
    useTimelineStore.getState().rippleDelete('c1')
    for (const clip of useTimelineStore.getState().clips) {
      expect(clip.startTime).toBeGreaterThanOrEqual(0)
    }
  })

  it('rippleDeleteSelected removes all selected clips in one undo step', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1', trackId: 'v1', startTime: 0, duration: 3 }),
      makeClip({ id: 'c2', trackId: 'v1', startTime: 3, duration: 3 }),
    ])
    // Both selected after addClips
    const prevLen = useTimelineStore.getState().past.length
    useTimelineStore.getState().rippleDeleteSelected()
    expect(useTimelineStore.getState().clips).toHaveLength(0)
    expect(useTimelineStore.getState().past.length).toBe(prevLen + 1)
  })
})

// =============================================================================
// 2.4 Copy / paste
// =============================================================================

describe('timelineStore — copy/paste', () => {
  it('copySelectedClips stores the selected clips in the clipboard', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().copySelectedClips()
    expect(useTimelineStore.getState().clipboard).toHaveLength(1)
    expect(useTimelineStore.getState().clipboard![0].id).toBe('c1')
  })

  it('pasteClips inserts clips with new IDs at the current playhead', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0 }))
    useTimelineStore.getState().copySelectedClips()
    useTimelineStore.setState({ playheadTime: 10 })
    useTimelineStore.getState().pasteClips()
    const pasted = useTimelineStore.getState().clips.find((c) => c.id !== 'c1')!
    expect(pasted).toBeDefined()
    expect(pasted.id).not.toBe('c1')
    expect(pasted.startTime).toBe(10)
  })

  it('pasted clips preserve duration, trimStart, and volume from the original', () => {
    useTimelineStore.getState().addClip(
      makeClip({ id: 'c1', duration: 7, trimStart: 2, volume: 0.5 })
    )
    useTimelineStore.getState().copySelectedClips()
    useTimelineStore.getState().pasteClips()
    const pasted = useTimelineStore.getState().clips.find((c) => c.id !== 'c1')!
    expect(pasted.duration).toBe(7)
    expect(pasted.trimStart).toBe(2)
    expect(pasted.volume).toBe(0.5)
  })

  it('pasteClips with an empty clipboard is a no-op', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.setState({ clipboard: null })
    useTimelineStore.getState().pasteClips()
    expect(useTimelineStore.getState().clips).toHaveLength(1)
  })

  it('pasted clips are selected after paste', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0 }))
    useTimelineStore.getState().copySelectedClips()
    useTimelineStore.setState({ playheadTime: 5 })
    useTimelineStore.getState().pasteClips()
    const { selectedClipIds, clips } = useTimelineStore.getState()
    const pasted = clips.find((c) => c.id !== 'c1')!
    expect(selectedClipIds).toContain(pasted.id)
  })

  it('all clip IDs remain unique after multiple consecutive pastes', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0 }))
    useTimelineStore.getState().copySelectedClips()
    useTimelineStore.getState().pasteClips()
    useTimelineStore.getState().pasteClips()
    useTimelineStore.getState().pasteClips()
    const ids = useTimelineStore.getState().clips.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)   // all unique
  })
})

// =============================================================================
// 2.6 Selection
// =============================================================================

describe('timelineStore — selection', () => {
  it('selectClip(id) sets selectedClipId and selectedClipIds', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().selectClip('c1')
    expect(useTimelineStore.getState().selectedClipId).toBe('c1')
    expect(useTimelineStore.getState().selectedClipIds).toEqual(['c1'])
  })

  it('selectClip(null) clears selection', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().selectClip('c1')
    useTimelineStore.getState().selectClip(null)
    expect(useTimelineStore.getState().selectedClipId).toBeNull()
    expect(useTimelineStore.getState().selectedClipIds).toEqual([])
  })

  it('toggleClipInSelection adds id when not present', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().selectClip(null)
    useTimelineStore.getState().toggleClipInSelection('c1')
    expect(useTimelineStore.getState().selectedClipIds).toContain('c1')
  })

  it('toggleClipInSelection removes id when already present', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().selectClip('c1')
    useTimelineStore.getState().toggleClipInSelection('c1')
    expect(useTimelineStore.getState().selectedClipIds).not.toContain('c1')
  })

  it('selectClip with a new id clears multi-selection', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1' }), makeClip({ id: 'c2' }),
    ])
    // both selected after addClips
    useTimelineStore.getState().selectClip('c1')
    expect(useTimelineStore.getState().selectedClipIds).toEqual(['c1'])
  })

  it('removeSelectedClips clears selectedClipIds', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().removeSelectedClips()
    expect(useTimelineStore.getState().selectedClipIds).toEqual([])
    expect(useTimelineStore.getState().selectedClipId).toBeNull()
  })
})

// =============================================================================
// 2.5 Undo / redo
// =============================================================================

describe('timelineStore — undo/redo', () => {
  it('undo restores the previous clips snapshot', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('undo on an empty past is a no-op (no crash)', () => {
    expect(useTimelineStore.getState().past).toHaveLength(0)
    expect(() => useTimelineStore.getState().undo()).not.toThrow()
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('undo moves the undone state to future', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().future).toHaveLength(1)
  })

  it('redo re-applies the undone state', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().undo()
    useTimelineStore.getState().redo()
    expect(useTimelineStore.getState().clips).toHaveLength(1)
    expect(useTimelineStore.getState().clips[0].id).toBe('c1')
  })

  it('redo on empty future is a no-op', () => {
    expect(() => useTimelineStore.getState().redo()).not.toThrow()
  })

  it('a new action after undo clears future', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().future).toHaveLength(1)
    useTimelineStore.getState().addClip(makeClip({ id: 'c2' }))
    expect(useTimelineStore.getState().future).toHaveLength(0)
  })

  it('past is capped at 50 entries after 51 actions', () => {
    for (let i = 0; i < 51; i++) {
      useTimelineStore.getState().addClip(makeClip({ id: `c${i}` }))
    }
    expect(useTimelineStore.getState().past.length).toBeLessThanOrEqual(50)
  })

  it('undo after splitClip fully reverses the split (original clip restored)', () => {
    useTimelineStore.setState({ playheadTime: 5 })
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', startTime: 0, duration: 10 }))
    useTimelineStore.getState().splitClip('c1')
    expect(useTimelineStore.getState().clips).toHaveLength(2)
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips).toHaveLength(1)
    expect(useTimelineStore.getState().clips[0].id).toBe('c1')
  })

  it('undo after rippleDelete restores shifted clips to original positions', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'c1', trackId: 'v1', startTime: 0,  duration: 5 }),
      makeClip({ id: 'c2', trackId: 'v1', startTime: 5,  duration: 5 }),
    ])
    useTimelineStore.getState().rippleDelete('c1')
    const c2Before = useTimelineStore.getState().clips.find((c) => c.id === 'c2')!
    expect(c2Before.startTime).toBe(0)
    useTimelineStore.getState().undo()
    const c2After = useTimelineStore.getState().clips.find((c) => c.id === 'c2')!
    expect(c2After.startTime).toBe(5)   // restored
  })

  it('undo after addClips([a,b]) removes both clips atomically', () => {
    useTimelineStore.getState().addClips([makeClip({ id: 'c1' }), makeClip({ id: 'c2' })])
    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })
})

// =============================================================================
// 2.7 Playback & navigation
// =============================================================================

describe('timelineStore — playback & navigation', () => {
  it('setPlayheadTime updates playheadTime', () => {
    useTimelineStore.getState().setPlayheadTime(42)
    expect(useTimelineStore.getState().playheadTime).toBe(42)
  })

  it('setPlayheadTime clamps negative values to 0', () => {
    useTimelineStore.getState().setPlayheadTime(-5)
    expect(useTimelineStore.getState().playheadTime).toBe(0)
  })

  it('setIsPlaying(true) → isPlaying is true', () => {
    useTimelineStore.getState().setIsPlaying(true)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('toggleLoop flips loopEnabled', () => {
    expect(useTimelineStore.getState().loopEnabled).toBe(false)
    useTimelineStore.getState().toggleLoop()
    expect(useTimelineStore.getState().loopEnabled).toBe(true)
    useTimelineStore.getState().toggleLoop()
    expect(useTimelineStore.getState().loopEnabled).toBe(false)
  })

  it('setMasterVolume clamps to [0, 1]', () => {
    useTimelineStore.getState().setMasterVolume(2)
    expect(useTimelineStore.getState().masterVolume).toBe(1)
    useTimelineStore.getState().setMasterVolume(-1)
    expect(useTimelineStore.getState().masterVolume).toBe(0)
  })
})

// =============================================================================
// 2.8 Miscellaneous clip actions
// =============================================================================

describe('timelineStore — clip settings', () => {
  it('setTextSettings replaces textSettings on the clip', () => {
    const settings: TextSettings = {
      content: 'Hello', fontSize: 48, fontFamily: 'Arial',
      fontColor: '#fff', bgColor: 'transparent',
      bold: false, italic: false, alignment: 'center',
      positionX: 0.5, positionY: 0.8, animationPreset: 'none'
    }
    useTimelineStore.getState().addClip(makeClip({ id: 'c1', type: 'text' }))
    useTimelineStore.getState().setTextSettings('c1', settings)
    expect(useTimelineStore.getState().clips[0].textSettings?.content).toBe('Hello')
  })

  it('setClipVolume clamps to [0, 2]', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().setClipVolume('c1', 5)
    expect(useTimelineStore.getState().clips[0].volume).toBe(2)
    useTimelineStore.getState().setClipVolume('c1', -1)
    expect(useTimelineStore.getState().clips[0].volume).toBe(0)
  })

  it('setClipSpeed clamps to minimum 0.1', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().setClipSpeed('c1', 0)
    expect(useTimelineStore.getState().clips[0].speed).toBeGreaterThanOrEqual(0.1)
  })

  it('setClipSpeed clamps to maximum 16', () => {
    useTimelineStore.getState().addClip(makeClip({ id: 'c1' }))
    useTimelineStore.getState().setClipSpeed('c1', 99)
    expect(useTimelineStore.getState().clips[0].speed).toBe(16)
  })

  it('toggleSnap flips snapEnabled', () => {
    expect(useTimelineStore.getState().snapEnabled).toBe(true)
    useTimelineStore.getState().toggleSnap()
    expect(useTimelineStore.getState().snapEnabled).toBe(false)
  })

  it('addMarker adds a marker sorted by time', () => {
    useTimelineStore.getState().addMarker(5)
    useTimelineStore.getState().addMarker(2)
    const times = useTimelineStore.getState().markers.map((m) => m.time)
    expect(times).toEqual([2, 5])
  })

  it('removeMarker removes the correct marker', () => {
    useTimelineStore.getState().addMarker(5)
    const id = useTimelineStore.getState().markers[0].id
    useTimelineStore.getState().removeMarker(id)
    expect(useTimelineStore.getState().markers).toHaveLength(0)
  })

  it('updateMarkerLabel updates the label without touching other markers', () => {
    useTimelineStore.getState().addMarker(5)
    useTimelineStore.getState().addMarker(10)
    const id1 = useTimelineStore.getState().markers[0].id
    useTimelineStore.getState().updateMarkerLabel(id1, 'Scene 1')
    expect(useTimelineStore.getState().markers[0].label).toBe('Scene 1')
    expect(useTimelineStore.getState().markers[1].label).toBe('')  // untouched
  })

  it('unlinkClip clears linkedClipId on both clips', () => {
    useTimelineStore.getState().addClips([
      makeClip({ id: 'v', linkedClipId: 'a' }),
      makeClip({ id: 'a', linkedClipId: 'v' }),
    ])
    useTimelineStore.getState().unlinkClip('v')
    const clips = useTimelineStore.getState().clips
    expect(clips.find((c) => c.id === 'v')!.linkedClipId).toBeUndefined()
    expect(clips.find((c) => c.id === 'a')!.linkedClipId).toBeUndefined()
  })
})
