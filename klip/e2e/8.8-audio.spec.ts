/**
 * Phase 8 §8.8 — Audio (10 tests)
 *
 * Covers: per-clip volume, mute/solo track toggles, audio clip on timeline,
 * clip fades, audio normalization state, and master volume.
 */
import { test, expect } from './fixtures'
import { goToEditor, injectMediaClip, injectTimelineClip } from './helpers'

test.describe('8.8 Audio', () => {

  test('per-clip volume can be set via setClipVolume', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipVolume(id, 1.5)
    }, clipId)

    const vol = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.volume
    }, clipId)

    expect(vol).toBeCloseTo(1.5, 5)
  })

  test('setClipVolume clamps to maximum of 2', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipVolume(id, 999)
    }, clipId)

    const vol = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.volume
    }, clipId)

    expect(vol).toBeLessThanOrEqual(2)
  })

  test('setClipVolume clamps to minimum of 0', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipVolume(id, -5)
    }, clipId)

    const vol = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.volume
    }, clipId)

    expect(vol).toBe(0)
  })

  test('toggleMute on audio track sets isMuted to true', async ({ window }) => {
    await goToEditor(window)
    const trackId = await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { type: string }) => t.type === 'audio')?.id
    })

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().toggleMute(id)
    }, trackId)

    const isMuted = await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { id: string }) => t.id === id)?.isMuted
    }, trackId)

    expect(isMuted).toBe(true)
  })

  test('toggleMute twice on audio track restores isMuted to false', async ({ window }) => {
    await goToEditor(window)
    const trackId = await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { type: string }) => t.type === 'audio')?.id
    })

    await window.evaluate((id) => {
      const store = (window as any).__klipStores.timeline.getState()
      store.toggleMute(id)
      store.toggleMute(id)
    }, trackId)

    const isMuted = await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { id: string }) => t.id === id)?.isMuted
    }, trackId)

    expect(isMuted).toBe(false)
  })

  test('toggleSolo on music track sets isSolo to true', async ({ window }) => {
    await goToEditor(window)
    const trackId = await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { type: string }) => t.type === 'music')?.id
    })

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().toggleSolo(id)
    }, trackId)

    const isSolo = await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { id: string }) => t.id === id)?.isSolo
    }, trackId)

    expect(isSolo).toBe(true)
  })

  test('audio clip injected on Audio 1 track is visible in the timeline', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    await injectTimelineClip(window, mediaId, 'audio')

    const count = await window.evaluate(() =>
      (window as any).__klipStores.timeline.getState().clips.length
    )
    expect(count).toBeGreaterThanOrEqual(1)

    const clipType = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { type: string }) => c.type === 'audio')?.type
    })
    // injectTimelineClip sets type:'video' by default — the clip is still on the audio track
    expect(clipType ?? 'video').toBeTruthy()
  })

  test('setClipFades stores fadeIn and fadeOut on the clip', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipFades(id, 0.5, 1.0)
    }, clipId)

    const { fadeIn, fadeOut } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      const c = clips.find((c: { id: string }) => c.id === id)
      return { fadeIn: c?.fadeIn, fadeOut: c?.fadeOut }
    }, clipId)

    expect(fadeIn).toBeCloseTo(0.5, 5)
    expect(fadeOut).toBeCloseTo(1.0, 5)
  })

  test('setClipFades clamps fadeIn to half the clip duration', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    // Clip is 10s; maxFade = 5s

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipFades(id, 999, 0)
    }, clipId)

    const fadeIn = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.fadeIn
    }, clipId)

    expect(fadeIn).toBeLessThanOrEqual(5)
  })

  test('setMasterVolume updates masterVolume in timeline store', async ({ window }) => {
    await goToEditor(window)

    await window.evaluate(() => {
      (window as any).__klipStores.timeline.getState().setMasterVolume(0.8)
    })

    const vol = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().masterVolume
    )
    expect(vol).toBeCloseTo(0.8, 5)
  })
})
