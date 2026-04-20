/**
 * Phase 8 §8.10 — Color grade & digital zoom (10 tests)
 *
 * Covers: setColorSettings (brightness/contrast/saturation),
 * setColorSettings(undefined) to clear, setCropSettings (zoom/pan),
 * setCropSettings(undefined) to clear, and setClipSpeed.
 */
import { test, expect } from './fixtures'
import { goToEditor, injectMediaClip, injectTimelineClip } from './helpers'

test.describe('8.10 Color grade & digital zoom', () => {

  test('setColorSettings stores brightness on the clip', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setColorSettings(id, {
        brightness: 0.4, contrast: 0, saturation: 0,
      })
    }, clipId)

    const brightness = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.colorSettings?.brightness
    }, clipId)

    expect(brightness).toBeCloseTo(0.4, 5)
  })

  test('setColorSettings stores contrast and saturation', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setColorSettings(id, {
        brightness: 0, contrast: 0.3, saturation: -0.5,
      })
    }, clipId)

    const { contrast, saturation } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      const cs = clips.find((c: { id: string }) => c.id === id)?.colorSettings
      return { contrast: cs?.contrast, saturation: cs?.saturation }
    }, clipId)

    expect(contrast).toBeCloseTo(0.3, 5)
    expect(saturation).toBeCloseTo(-0.5, 5)
  })

  test('setColorSettings(undefined) clears color settings', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      const store = (window as any).__klipStores.timeline.getState()
      store.setColorSettings(id, { brightness: 0.5, contrast: 0, saturation: 0 })
      store.setColorSettings(id, undefined)
    }, clipId)

    const colorSettings = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.colorSettings
    }, clipId)

    expect(colorSettings).toBeUndefined()
  })

  test('setCropSettings stores zoom level', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setCropSettings(id, {
        zoom: 2.0, panX: 0, panY: 0,
      })
    }, clipId)

    const zoom = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.cropSettings?.zoom
    }, clipId)

    expect(zoom).toBe(2.0)
  })

  test('setCropSettings stores panX and panY', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setCropSettings(id, {
        zoom: 1.5, panX: 0.25, panY: -0.1,
      })
    }, clipId)

    const { panX, panY } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      const cs = clips.find((c: { id: string }) => c.id === id)?.cropSettings
      return { panX: cs?.panX, panY: cs?.panY }
    }, clipId)

    expect(panX).toBeCloseTo(0.25, 5)
    expect(panY).toBeCloseTo(-0.1, 5)
  })

  test('setCropSettings(undefined) clears crop settings', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      const store = (window as any).__klipStores.timeline.getState()
      store.setCropSettings(id, { zoom: 2.0, panX: 0, panY: 0 })
      store.setCropSettings(id, undefined)
    }, clipId)

    const cropSettings = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.cropSettings
    }, clipId)

    expect(cropSettings).toBeUndefined()
  })

  test('setClipSpeed stores a slow-motion value (0.25x)', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipSpeed(id, 0.25)
    }, clipId)

    const speed = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.speed
    }, clipId)

    expect(speed).toBeCloseTo(0.25, 5)
  })

  test('setClipSpeed stores a fast-forward value (4x)', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipSpeed(id, 4)
    }, clipId)

    const speed = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.speed
    }, clipId)

    expect(speed).toBe(4)
  })

  test('setClipSpeed clamps below 0.1 to 0.1', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipSpeed(id, 0)
    }, clipId)

    const speed = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.speed
    }, clipId)

    expect(speed).toBeGreaterThanOrEqual(0.1)
  })

  test('setClipSpeed clamps above 16 to 16', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipSpeed(id, 100)
    }, clipId)

    const speed = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.speed
    }, clipId)

    expect(speed).toBeLessThanOrEqual(16)
  })
})
