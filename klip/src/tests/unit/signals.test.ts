/**
 * Phase 1 — Unit: signal utilities + dragRegistry (§1.4, §1.5)
 *
 * snapIndicator.ts  — lightweight pub/sub for snap time
 * rippleSignal.ts   — timestamp-based ripple coordination signal
 * copyFlash.ts      — pub/sub for copy-confirmation flash
 * dragRegistry.ts   — clip MotionValue registry for 60fps multi-clip drag
 *
 * No DOM, no stores, no IPC.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setSnapTime, subscribeSnapTime }     from '@/lib/snapIndicator'
import { markRipple, wasRecentRipple }        from '@/lib/rippleSignal'
import { flashCopy, subscribeCopyFlash }      from '@/lib/copyFlash'
import { dragRegistry }                       from '@/lib/dragRegistry'
import type { MotionValue }                   from 'framer-motion'

// ── Minimal MotionValue stub (only .set / .get are used by dragRegistry) ──────

function makeMV(initial = 0): MotionValue<number> {
  let v = initial
  return {
    get: () => v,
    set: (n: number) => { v = n }
  } as unknown as MotionValue<number>
}

// =============================================================================
// 1.4a snapIndicator
// =============================================================================

describe('snapIndicator', () => {
  // Track unsubscribe functions so tests always clean up listeners.
  const unsubs: Array<() => void> = []

  afterEach(() => {
    unsubs.splice(0).forEach((u) => u())
  })

  it('subscribeSnapTime callback is called with the emitted value', () => {
    const received: Array<number | null> = []
    unsubs.push(subscribeSnapTime((t) => received.push(t)))
    setSnapTime(42)
    expect(received).toEqual([42])
  })

  it('multiple subscribers all receive the same event', () => {
    const a: Array<number | null> = []
    const b: Array<number | null> = []
    unsubs.push(subscribeSnapTime((t) => a.push(t)))
    unsubs.push(subscribeSnapTime((t) => b.push(t)))
    setSnapTime(10)
    expect(a).toEqual([10])
    expect(b).toEqual([10])
  })

  it('unsubscribe function stops future callbacks', () => {
    const received: Array<number | null> = []
    const unsub = subscribeSnapTime((t) => received.push(t))
    setSnapTime(1)
    unsub()
    setSnapTime(2)
    expect(received).toEqual([1])           // only the pre-unsub value
  })

  it('unsubscribing twice does not throw', () => {
    const unsub = subscribeSnapTime(() => {})
    expect(() => { unsub(); unsub() }).not.toThrow()
  })

  it('setSnapTime(null) fires with null (snap hidden)', () => {
    const received: Array<number | null> = []
    unsubs.push(subscribeSnapTime((t) => received.push(t)))
    setSnapTime(null)
    expect(received).toEqual([null])
  })
})

// =============================================================================
// 1.4b rippleSignal
// =============================================================================

describe('rippleSignal', () => {
  it('wasRecentRipple() returns false before any markRipple call', () => {
    // Reset by setting lastRippleAt far in the past via fake timer.
    // Since the module uses Date.now() we advance time to make any prior
    // markRipple calls expire.
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)  // push any prior markRipple() > 500ms ago
    expect(wasRecentRipple()).toBe(false)
    vi.useRealTimers()
  })

  it('wasRecentRipple() returns true immediately after markRipple()', () => {
    markRipple()
    expect(wasRecentRipple()).toBe(true)
  })

  it('wasRecentRipple() returns false after 500ms have elapsed', () => {
    vi.useFakeTimers()
    markRipple()
    vi.advanceTimersByTime(501)
    expect(wasRecentRipple()).toBe(false)
    vi.useRealTimers()
  })

  it('calling markRipple() multiple times resets the 500ms window', () => {
    vi.useFakeTimers()
    markRipple()
    vi.advanceTimersByTime(400)
    markRipple()   // reset the clock
    vi.advanceTimersByTime(400)
    expect(wasRecentRipple()).toBe(true)   // 400ms since last markRipple
    vi.useRealTimers()
  })
})

// =============================================================================
// 1.4c copyFlash
// =============================================================================

describe('copyFlash', () => {
  const unsubs: Array<() => void> = []

  afterEach(() => {
    unsubs.splice(0).forEach((u) => u())
  })

  it('subscribeCopyFlash callback is called with the emitted ids', () => {
    const received: string[][] = []
    unsubs.push(subscribeCopyFlash((ids) => received.push(ids)))
    flashCopy(['clip-1', 'clip-2'])
    expect(received).toEqual([['clip-1', 'clip-2']])
  })

  it('multiple subscribers all receive the same event', () => {
    const a: string[][] = []
    const b: string[][] = []
    unsubs.push(subscribeCopyFlash((ids) => a.push(ids)))
    unsubs.push(subscribeCopyFlash((ids) => b.push(ids)))
    flashCopy(['x'])
    expect(a).toEqual([['x']])
    expect(b).toEqual([['x']])
  })

  it('unsubscribe stops future flash callbacks', () => {
    const received: string[][] = []
    const unsub = subscribeCopyFlash((ids) => received.push(ids))
    flashCopy(['a'])
    unsub()
    flashCopy(['b'])
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(['a'])
  })

  it('flashCopy([]) is a no-op — callbacks are not called for empty arrays', () => {
    const received: string[][] = []
    unsubs.push(subscribeCopyFlash((ids) => received.push(ids)))
    flashCopy([])
    expect(received).toHaveLength(0)
  })
})

// =============================================================================
// 1.5 dragRegistry
// =============================================================================

describe('dragRegistry', () => {
  // Clean up any registered clips after each test.
  beforeEach(() => {
    dragRegistry.unregister('clip-a')
    dragRegistry.unregister('clip-b')
    dragRegistry.unregister('clip-c')
  })

  it('register + snapshotOrigStarts returns the origStart that was registered', () => {
    const mv = makeMV(0)
    dragRegistry.register('clip-a', mv, 5.0)
    const snap = dragRegistry.snapshotOrigStarts(['clip-a'])
    expect(snap.get('clip-a')).toBe(5.0)
  })

  it('unregister removes the entry — snapshotOrigStarts returns an empty map', () => {
    const mv = makeMV(0)
    dragRegistry.register('clip-a', mv, 3.0)
    dragRegistry.unregister('clip-a')
    const snap = dragRegistry.snapshotOrigStarts(['clip-a'])
    expect(snap.has('clip-a')).toBe(false)
  })

  it('unregistering an id that was never registered does not throw', () => {
    expect(() => dragRegistry.unregister('never-registered')).not.toThrow()
  })

  it('snapshotOrigStarts for a missing id returns an empty map entry', () => {
    const snap = dragRegistry.snapshotOrigStarts(['nonexistent'])
    expect(snap.has('nonexistent')).toBe(false)
  })

  it('applyDelta updates the MotionValue to (origStart + delta) * pxPerSec', () => {
    const mv = makeMV(0)
    dragRegistry.register('clip-a', mv, 2.0)
    const snap = dragRegistry.snapshotOrigStarts(['clip-a'])
    dragRegistry.applyDelta(snap, 3.0, 100) // move +3s at 100 px/s
    expect(mv.get()).toBe(500) // (2.0 + 3.0) * 100
  })

  it('applyDelta clamps negative results to 0', () => {
    const mv = makeMV(200)
    dragRegistry.register('clip-a', mv, 1.0)
    const snap = dragRegistry.snapshotOrigStarts(['clip-a'])
    dragRegistry.applyDelta(snap, -10.0, 100) // would be (1.0 - 10.0) * 100 = -900
    expect(mv.get()).toBe(0)
  })

  it('second register call for the same id overwrites origStart', () => {
    const mv = makeMV(0)
    dragRegistry.register('clip-a', mv, 1.0)
    dragRegistry.register('clip-a', mv, 9.0)
    const snap = dragRegistry.snapshotOrigStarts(['clip-a'])
    expect(snap.get('clip-a')).toBe(9.0)
  })

  it('round-trips a complex nested object as payload — register with arbitrary origStart', () => {
    const mv = makeMV(0)
    const arbitraryStart = 12_345.678
    dragRegistry.register('clip-c', mv, arbitraryStart)
    const snap = dragRegistry.snapshotOrigStarts(['clip-c'])
    expect(snap.get('clip-c')).toBe(arbitraryStart)
  })
})
