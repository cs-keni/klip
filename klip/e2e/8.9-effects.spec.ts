/**
 * Phase 8 §8.9 — Effects: Transitions & Clip Roles (9 tests)
 *
 * Covers: adding/removing fade and dip-to-black transitions via store,
 * duplicate-transition replacement, transition surviving clip split,
 * and clip role (intro/outro) tagging.
 */
import { test, expect } from './fixtures'
import { goToEditor, injectMediaClip, injectTimelineClip } from './helpers'

test.describe('8.9 Effects — Transitions & Roles', () => {

  test('addTransition stores a "fade" transition between two clips', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)

    await window.evaluate(({ fromId, toId }) => {
      (window as any).__klipStores.timeline.getState().addTransition({
        id: crypto.randomUUID(),
        fromClipId: fromId,
        toClipId: toId,
        type: 'fade',
        duration: 0.5,
      })
    }, { fromId: clipA, toId: clipB })

    const transitions = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions
    )
    expect(transitions).toHaveLength(1)
    expect(transitions[0].type).toBe('fade')
    expect(transitions[0].duration).toBe(0.5)
  })

  test('addTransition stores a "dip-to-black" transition', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)

    await window.evaluate(({ fromId, toId }) => {
      (window as any).__klipStores.timeline.getState().addTransition({
        id: crypto.randomUUID(),
        fromClipId: fromId,
        toClipId: toId,
        type: 'dip-to-black',
        duration: 1.0,
      })
    }, { fromId: clipA, toId: clipB })

    const transitions = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions
    )
    expect(transitions[0].type).toBe('dip-to-black')
  })

  test('adding a second transition for the same clip pair replaces the first', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)

    await window.evaluate(({ fromId, toId }) => {
      const store = (window as any).__klipStores.timeline.getState()
      store.addTransition({ id: 'tr-old', fromClipId: fromId, toClipId: toId, type: 'fade', duration: 0.5 })
      store.addTransition({ id: 'tr-new', fromClipId: fromId, toClipId: toId, type: 'dip-to-black', duration: 2.0 })
    }, { fromId: clipA, toId: clipB })

    const transitions = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions
    )
    expect(transitions).toHaveLength(1)
    expect(transitions[0].type).toBe('dip-to-black')
    expect(transitions[0].duration).toBe(2.0)
  })

  test('removeTransition clears the transition from the store', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)
    const trId    = 'tr-to-remove'

    await window.evaluate(({ fromId, toId, trId }) => {
      (window as any).__klipStores.timeline.getState().addTransition({
        id: trId, fromClipId: fromId, toClipId: toId, type: 'fade', duration: 0.5,
      })
    }, { fromId: clipA, toId: clipB, trId })

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().removeTransition(id)
    }, trId)

    const transitions = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions
    )
    expect(transitions).toHaveLength(0)
  })

  test('deleting a clip also removes its transitions', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)

    await window.evaluate(({ fromId, toId }) => {
      (window as any).__klipStores.timeline.getState().addTransition({
        id: crypto.randomUUID(), fromClipId: fromId, toClipId: toId, type: 'fade', duration: 0.5,
      })
      (window as any).__klipStores.timeline.getState().selectClip(fromId)
    }, { fromId: clipA, toId: clipB })

    await window.keyboard.press('Delete')
    await window.waitForTimeout(200)

    const transitions = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions
    )
    expect(transitions).toHaveLength(0)
  })

  test('transition duration is stored accurately', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipA   = await injectTimelineClip(window, mediaId)
    const clipB   = await injectTimelineClip(window, mediaId)

    await window.evaluate(({ fromId, toId }) => {
      (window as any).__klipStores.timeline.getState().addTransition({
        id: 'tr-dur', fromClipId: fromId, toClipId: toId, type: 'fade', duration: 1.75,
      })
    }, { fromId: clipA, toId: clipB })

    const dur = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().transitions[0].duration
    )
    expect(dur).toBeCloseTo(1.75, 5)
  })

  test('setClipRole marks a clip as "intro"', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipRole(id, 'intro')
    }, clipId)

    const role = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.role
    }, clipId)

    expect(role).toBe('intro')
  })

  test('setClipRole marks a clip as "outro"', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().setClipRole(id, 'outro')
    }, clipId)

    const role = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.role
    }, clipId)

    expect(role).toBe('outro')
  })

  test('setClipRole(undefined) clears the role', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)

    await window.evaluate((id) => {
      const store = (window as any).__klipStores.timeline.getState()
      store.setClipRole(id, 'intro')
      store.setClipRole(id, undefined)
    }, clipId)

    const role = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.role
    }, clipId)

    expect(role).toBeUndefined()
  })
})
