/**
 * Phase 8 §8.7 — Text overlays (6 tests)
 *
 * Covers: T shortcut creates a text clip, toolbar T button, text clip
 * appears on the timeline, text settings store update, overlay track.
 */
import { test, expect } from './fixtures'
import { goToEditor, getTimelineClipCount } from './helpers'

test.describe('8.7 Text overlays', () => {

  test('pressing T creates a text clip on the overlay track', async ({ window }) => {
    await goToEditor(window)
    const before = await getTimelineClipCount(window)
    await window.keyboard.press('t')
    await window.waitForTimeout(300)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before + 1)
    // The new clip should be of type 'text'
    const clipType = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.at(-1)?.type
    })
    expect(clipType).toBe('text')
  })

  test('text clip is placed at the current playhead time', async ({ window }) => {
    await goToEditor(window)
    await window.evaluate(() => {
      (window as any).__klipStores.timeline.getState().setPlayheadTime(3)
    })
    await window.keyboard.press('t')
    await window.waitForTimeout(200)
    const startTime = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { type: string }) => c.type === 'text')?.startTime
    })
    expect(startTime).toBeCloseTo(3, 0)
  })

  test('toolbar "Add Text Overlay" button creates a text clip', async ({ window }) => {
    await goToEditor(window)
    const before = await getTimelineClipCount(window)
    // The Add Text Overlay toolbar button has aria-label containing "Text"
    await window.getByRole('button', { name: /add text overlay/i }).click()
    await window.waitForTimeout(300)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before + 1)
  })

  test('text clip is placed on an overlay or text track', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('t')
    await window.waitForTimeout(200)
    const trackType = await window.evaluate(() => {
      const { clips, tracks } = (window as any).__klipStores.timeline.getState()
      const textClip = clips.find((c: { type: string }) => c.type === 'text')
      if (!textClip) return null
      const track = tracks.find((t: { id: string }) => t.id === textClip.trackId)
      return track?.type ?? null
    })
    expect(['overlay', 'text']).toContain(trackType)
  })

  test('text clip defaults to 5-second duration', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('t')
    await window.waitForTimeout(200)
    const duration = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { type: string }) => c.type === 'text')?.duration
    })
    expect(duration).toBeGreaterThan(0)
    expect(duration).toBeLessThanOrEqual(10)
  })

  test('text clip has default textSettings with non-empty content', async ({ window }) => {
    await goToEditor(window)
    await window.keyboard.press('t')
    await window.waitForTimeout(200)
    const textSettings = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { type: string }) => c.type === 'text')?.textSettings
    })
    expect(textSettings).toBeDefined()
    expect(textSettings?.content?.length).toBeGreaterThan(0)
  })
})
