/**
 * Phase 8 §8.4 — Playback (8 tests)
 *
 * Covers: Space play/pause, JKL shuttle keys, loop in/out,
 * master volume, and playhead movement.
 */
import { test, expect } from './fixtures'
import { goToEditor, injectMediaClip, injectTimelineClip } from './helpers'

test.describe('8.4 Playback', () => {

  test('Space key starts playback (isPlaying becomes true)', async ({ window }) => {
    await goToEditor(window)
    await injectMediaClip(window).then((id) => injectTimelineClip(window, id))
    await window.keyboard.press('Space')
    await window.waitForTimeout(150)
    const isPlaying = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().isPlaying
    )
    expect(isPlaying).toBe(true)
  })

  test('Space key a second time pauses playback', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('Space')
    await window.waitForTimeout(100)
    await window.keyboard.press('Space')
    await window.waitForTimeout(100)
    const isPlaying = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().isPlaying
    )
    expect(isPlaying).toBe(false)
  })

  test('L key plays forward; second L doubles shuttle speed', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('l')
    await window.waitForTimeout(100)
    const speed1 = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().shuttleSpeed
    )
    await window.keyboard.press('l')
    await window.waitForTimeout(100)
    const speed2 = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().shuttleSpeed
    )
    expect(speed1).toBeGreaterThan(0)
    expect(speed2).toBeGreaterThan(speed1)
  })

  test('J key plays in reverse (shuttleSpeed negative)', async ({ window }) => {
    await goToEditor(window)
    await window.evaluate(() => {
      (window as any).__klipStores.timeline.getState().setPlayheadTime(5)
    })
    await window.keyboard.press('j')
    await window.waitForTimeout(100)
    const speed = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().shuttleSpeed
    )
    expect(speed).toBeLessThan(0)
  })

  test('K key stops playback (isPlaying false, shuttleSpeed resets)', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('Space')
    await window.waitForTimeout(100)
    await window.keyboard.press('k')
    await window.waitForTimeout(150)
    const { isPlaying, shuttleSpeed } = await window.evaluate(() => {
      const s = (window as any).__klipStores.timeline.getState()
      return { isPlaying: s.isPlaying, shuttleSpeed: s.shuttleSpeed }
    })
    expect(isPlaying).toBe(false)
    expect(shuttleSpeed).toBe(1)
  })

  test('setting loopIn / loopOut enables loop range', async ({ window }) => {
    await goToEditor(window)
    await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      state.setLoopIn(2)
      state.setLoopOut(8)
    })
    const { loopIn, loopOut } = await window.evaluate(() => {
      const s = (window as any).__klipStores.timeline.getState()
      return { loopIn: s.loopIn, loopOut: s.loopOut }
    })
    expect(loopIn).toBe(2)
    expect(loopOut).toBe(8)
  })

  test('setMasterVolume clamps to [0, 2]', async ({ window }) => {
    await goToEditor(window)
    await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      state.setMasterVolume(5)
    })
    const vol = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().masterVolume
    )
    expect(vol).toBeLessThanOrEqual(2)
  })

  test('setPlayheadTime updates playhead position', async ({ window }) => {
    await goToEditor(window)
    await window.evaluate(() => {
      (window as any).__klipStores.timeline.getState().setPlayheadTime(12.5)
    })
    const t = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().playheadTime
    )
    expect(t).toBeCloseTo(12.5, 1)
  })
})
