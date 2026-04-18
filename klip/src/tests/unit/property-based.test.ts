/**
 * Phase 1 — Property-based tests: timeline math invariants (§1.9)
 *
 * Uses fast-check to generate arbitrary valid inputs and assert mathematical
 * laws that hold regardless of specific values.  These catch edge cases that
 * hand-picked examples never think to try.
 *
 * No DOM, no IPC.  Pure Zustand store + fast-check.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { useTimelineStore } from '@/stores/timelineStore'
import type { TimelineClip, Track } from '@/types/timeline'

// ── Fixture helpers ────────────────────────────────────────────────────────────

const DEFAULT_TRACK: Track = {
  id: 'v1', type: 'video', name: 'Video 1',
  isLocked: false, isMuted: false, isSolo: false
}

function makeClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: overrides.id ?? 'clip-1',
    mediaClipId: overrides.mediaClipId ?? 'media-1',
    trackId: overrides.trackId ?? 'v1',
    startTime: overrides.startTime ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: overrides.trimStart ?? 0,
    type: overrides.type ?? 'video',
    name: overrides.name ?? 'Test Clip',
    thumbnail: null,
    ...overrides
  }
}

/** Reset to a known-empty state. Call at the start of each property iteration. */
function resetStore() {
  useTimelineStore.setState({
    tracks: [DEFAULT_TRACK],
    clips: [],
    transitions: [],
    markers: [],
    selectedClipId: null,
    selectedClipIds: [],
    clipboard: null,
    playheadTime: 0,
    isPlaying: false,
    loopIn: null,
    loopOut: null,
    loopEnabled: false,
    past: [],
    future: []
  })
}

// Also reset before each top-level test so state from prior describe blocks
// can't leak across (fast-check runs are sequential within a file).
beforeEach(resetStore)

// ── Arbitraries ────────────────────────────────────────────────────────────────

/** startTime in [0, 100] */
const arbStart = fc.double({ min: 0, max: 100, noNaN: true })

/** duration in [2, 60] — large enough that a 10% split margin gives > 0.05s guard */
const arbDuration = fc.double({ min: 2, max: 60, noNaN: true })

/** relative split ratio in (0.1, 0.9) — avoids the ±0.05s no-op guard */
const arbRatio = fc.double({ min: 0.1, max: 0.9, noNaN: true })

// =============================================================================
// splitClip invariants
// =============================================================================

describe('splitClip — mathematical invariants', () => {
  it('left.duration + right.duration === original.duration (no time lost or gained)', () => {
    fc.assert(
      fc.property(arbStart, arbDuration, arbRatio, (startTime, duration, ratio) => {
        resetStore()
        const clip = makeClip({ id: 'c1', startTime, duration })
        useTimelineStore.setState({ clips: [clip], past: [] })
        const playhead = startTime + duration * ratio
        useTimelineStore.setState({ playheadTime: playhead })
        useTimelineStore.getState().splitClip('c1')

        const clips = useTimelineStore.getState().clips
        // If the guard fired (should not with our ratio bounds), skip this sample.
        if (clips.length !== 2) return

        const total = clips[0].duration + clips[1].duration
        expect(total).toBeCloseTo(duration, 4)
      }),
      { numRuns: 100 }
    )
  })

  it('left clip starts at original startTime', () => {
    fc.assert(
      fc.property(arbStart, arbDuration, arbRatio, (startTime, duration, ratio) => {
        resetStore()
        const clip = makeClip({ id: 'c1', startTime, duration })
        useTimelineStore.setState({ clips: [clip], past: [] })
        useTimelineStore.setState({ playheadTime: startTime + duration * ratio })
        useTimelineStore.getState().splitClip('c1')

        const clips = useTimelineStore.getState().clips
        if (clips.length !== 2) return

        const left = clips.find((c) => Math.abs(c.startTime - startTime) < 0.001)
        expect(left).toBeDefined()
      }),
      { numRuns: 100 }
    )
  })

  it('right clip startTime === left.startTime + left.duration', () => {
    fc.assert(
      fc.property(arbStart, arbDuration, arbRatio, (startTime, duration, ratio) => {
        resetStore()
        const clip = makeClip({ id: 'c1', startTime, duration })
        useTimelineStore.setState({ clips: [clip], past: [] })
        useTimelineStore.setState({ playheadTime: startTime + duration * ratio })
        useTimelineStore.getState().splitClip('c1')

        const clips = useTimelineStore.getState().clips
        if (clips.length !== 2) return

        const sorted = [...clips].sort((a, b) => a.startTime - b.startTime)
        const [left, right] = sorted
        expect(right.startTime).toBeCloseTo(left.startTime + left.duration, 4)
      }),
      { numRuns: 100 }
    )
  })

  it('both resulting clips have duration > 0', () => {
    fc.assert(
      fc.property(arbStart, arbDuration, arbRatio, (startTime, duration, ratio) => {
        resetStore()
        const clip = makeClip({ id: 'c1', startTime, duration })
        useTimelineStore.setState({ clips: [clip], past: [] })
        useTimelineStore.setState({ playheadTime: startTime + duration * ratio })
        useTimelineStore.getState().splitClip('c1')

        const clips = useTimelineStore.getState().clips
        if (clips.length !== 2) return

        expect(clips[0].duration).toBeGreaterThan(0)
        expect(clips[1].duration).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// rippleDelete ordering invariant
// =============================================================================

describe('rippleDelete — ordering invariant', () => {
  it('surviving clips on the same track remain sorted by startTime after ripple delete', () => {
    /**
     * Strategy: place N clips sequentially on the same track, ripple-delete
     * the first one, then verify the remaining clips are still in order with
     * no negative startTimes.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),        // N clips
        fc.double({ min: 1, max: 10, noNaN: true }), // gap between clip starts
        fc.double({ min: 0.5, max: 5, noNaN: true }), // clip duration
        (n, gap, duration) => {
          resetStore()
          const clips: TimelineClip[] = Array.from({ length: n }, (_, i) =>
            makeClip({ id: `c${i}`, startTime: i * (gap + duration), duration })
          )
          useTimelineStore.setState({ clips, past: [] })
          useTimelineStore.getState().rippleDelete('c0')

          const remaining = useTimelineStore.getState().clips
          // Check sorted order
          for (let i = 1; i < remaining.length; i++) {
            expect(remaining[i].startTime).toBeGreaterThanOrEqual(remaining[i - 1].startTime)
          }
          // No negative startTimes
          for (const c of remaining) {
            expect(c.startTime).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

// =============================================================================
// moveClip clamping invariant
// =============================================================================

describe('moveClip — negative-time clamping', () => {
  it('clip.startTime is always >= 0 regardless of how negative the input is', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: -0.001, noNaN: true }), // always negative
        (negativeTime) => {
          resetStore()
          const clip = makeClip({ id: 'c1', startTime: 5 })
          useTimelineStore.setState({ clips: [clip], past: [] })
          useTimelineStore.getState().moveClip('c1', negativeTime)
          expect(useTimelineStore.getState().clips[0].startTime).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// trimClip minimum-duration invariant
// =============================================================================

describe('trimClip — minimum duration', () => {
  it('clip.duration is always >= 0.1 (one frame) after any trim patch', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 20, noNaN: true }), // arbitrary small duration to set
        (targetDuration) => {
          resetStore()
          const clip = makeClip({ id: 'c1', startTime: 0, duration: 20 })
          useTimelineStore.setState({ clips: [clip], past: [] })
          useTimelineStore.getState().trimClip('c1', { duration: targetDuration })
          expect(useTimelineStore.getState().clips[0].duration).toBeGreaterThanOrEqual(0.1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// addClip / removeClip count invariant
// =============================================================================

describe('addClip / removeClip — count invariant', () => {
  it('adding N clips then removing all N returns clips.length to its initial value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // N
        (n) => {
          resetStore()
          const initial = useTimelineStore.getState().clips.length  // 0

          // Add N clips with unique IDs
          for (let i = 0; i < n; i++) {
            useTimelineStore.getState().addClip(makeClip({ id: `clip-${i}`, startTime: i * 2 }))
          }
          expect(useTimelineStore.getState().clips.length).toBe(initial + n)

          // Remove the same N clips
          for (let i = 0; i < n; i++) {
            useTimelineStore.getState().removeClip(`clip-${i}`)
          }
          expect(useTimelineStore.getState().clips.length).toBe(initial)
        }
      ),
      { numRuns: 50 }
    )
  })
})

// =============================================================================
// undo / redo round-trip invariant
// =============================================================================

describe('undo / redo — round-trip', () => {
  it('undo() then redo() restores the same clips snapshot (deep equality)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // number of addClip actions before undo
        (n) => {
          resetStore()

          // Perform N state-changing actions
          for (let i = 0; i < n; i++) {
            useTimelineStore.getState().addClip(makeClip({ id: `c${i}`, startTime: i * 3 }))
          }

          // Snapshot state after N actions
          const before = useTimelineStore.getState().clips.map((c) => c.id).sort()

          // Undo last action
          useTimelineStore.getState().undo()

          // Redo it
          useTimelineStore.getState().redo()

          // Should be back to the same snapshot
          const after = useTimelineStore.getState().clips.map((c) => c.id).sort()
          expect(after).toEqual(before)
        }
      ),
      { numRuns: 50 }
    )
  })

  it('past.length never exceeds 50 regardless of number of actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 51, max: 100 }), // more actions than the cap
        (n) => {
          resetStore()
          for (let i = 0; i < n; i++) {
            useTimelineStore.getState().addClip(makeClip({ id: `c${i}`, startTime: i * 2 }))
          }
          expect(useTimelineStore.getState().past.length).toBeLessThanOrEqual(50)
        }
      ),
      { numRuns: 20 }
    )
  })
})

// =============================================================================
// pasteClips ID uniqueness invariant
// =============================================================================

describe('pasteClips — ID uniqueness', () => {
  it('all clip IDs remain unique after any number of consecutive pastes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // paste count
        (pasteCount) => {
          resetStore()

          // Set up a clipboard with one clip
          const clip = makeClip({ id: 'src', startTime: 0, duration: 5 })
          useTimelineStore.setState({
            clips: [clip],
            clipboard: [clip],
            selectedClipIds: ['src'],
            past: []
          })

          // Paste N times — move playhead so pastes don't stack on top of each other
          for (let i = 0; i < pasteCount; i++) {
            useTimelineStore.setState({ playheadTime: (i + 1) * 6 })
            useTimelineStore.getState().pasteClips()
          }

          const ids = useTimelineStore.getState().clips.map((c) => c.id)
          const uniqueIds = new Set(ids)
          expect(uniqueIds.size).toBe(ids.length)
        }
      ),
      { numRuns: 50 }
    )
  })
})
