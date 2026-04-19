/**
 * Phase 8 §8.3 — Timeline editing (18 tests)
 *
 * Covers: drag to timeline, trim, split, delete, undo/redo,
 * copy/paste, multi-select, locked track, close gap.
 */
import { test, expect } from './fixtures'
import {
  goToEditor,
  injectMediaClip,
  injectTimelineClip,
  getTimelineClipCount,
} from './helpers'

test.describe('8.3 Timeline editing', () => {

  test('drag clip from media bin to Video 1 track adds it to the timeline', async ({ window }) => {
    await goToEditor(window)
    await injectMediaClip(window)
    // Wait for the clip card to appear in the media bin
    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })
    const lane = window.locator('[data-testid="track-lane-video"]').first()
    await expect(lane).toBeVisible()
    await window.dragAndDrop(
      '[data-tutorial="media-bin"] [draggable]',
      '[data-testid="track-lane-video"]'
    )
    await window.waitForTimeout(400)
    const count = await getTimelineClipCount(window)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('pressing S splits the selected clip at the playhead', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    // Select the clip
    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().selectClip(id)
    }, clipId)
    // Set playhead mid-clip
    await window.evaluate(() => {
      (window as any).__klipStores.timeline.getState().setPlayheadTime(5)
    })
    const beforeCount = await getTimelineClipCount(window)
    await window.keyboard.press('s')
    await window.waitForTimeout(200)
    const afterCount = await getTimelineClipCount(window)
    expect(afterCount).toBe(beforeCount + 1)
  })

  test('pressing Delete removes the selected clip', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().selectClip(id)
    }, clipId)
    const before = await getTimelineClipCount(window)
    await window.keyboard.press('Delete')
    await window.waitForTimeout(200)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before - 1)
  })

  test('Ctrl+Z undoes the last timeline operation', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    await injectTimelineClip(window, mediaId)
    const before = await getTimelineClipCount(window)
    await window.keyboard.press('Control+z')
    await window.waitForTimeout(200)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before - 1)
  })

  test('Ctrl+Z three times steps back through three operations', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    // Add three clips
    await injectTimelineClip(window, mediaId)
    await injectTimelineClip(window, mediaId)
    await injectTimelineClip(window, mediaId)
    const before = await getTimelineClipCount(window)
    await window.keyboard.press('Control+z')
    await window.keyboard.press('Control+z')
    await window.keyboard.press('Control+z')
    await window.waitForTimeout(300)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before - 3)
  })

  test('Ctrl+Y redoes an undone operation', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    await injectTimelineClip(window, mediaId)
    const before = await getTimelineClipCount(window)
    await window.keyboard.press('Control+z')
    await window.waitForTimeout(150)
    await window.keyboard.press('Control+y')
    await window.waitForTimeout(200)
    const after = await getTimelineClipCount(window)
    expect(after).toBe(before)
  })

  test('Ctrl+C then Ctrl+V pastes a clip with a new id', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id)
      state.copySelectedClips()
    }, clipId)
    await window.keyboard.press('Control+v')
    await window.waitForTimeout(200)
    const count = await getTimelineClipCount(window)
    expect(count).toBe(2)
    // The pasted clip has a different id
    const ids = await window.evaluate(() =>
      (window as any).__klipStores.timeline.getState().clips.map((c: { id: string }) => c.id)
    )
    expect(new Set(ids).size).toBe(2)
  })

  test('Shift+Delete ripple-deletes the selected clip and shifts others left', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    // Two clips back-to-back
    await window.evaluate((mediaId) => {
      const state = (window as any).__klipStores.timeline.getState()
      const track = state.tracks.find((t: { type: string }) => t.type === 'video')
      state.addClip({
        id: 'clip-a', mediaClipId: mediaId, trackId: track.id,
        startTime: 0, duration: 5, trimStart: 0, type: 'video', name: 'a', thumbnail: null,
      })
      state.addClip({
        id: 'clip-b', mediaClipId: mediaId, trackId: track.id,
        startTime: 5, duration: 5, trimStart: 0, type: 'video', name: 'b', thumbnail: null,
      })
      state.selectClip('clip-a')
    }, mediaId)
    await window.keyboard.press('Shift+Delete')
    await window.waitForTimeout(200)
    const clipBStart = await window.evaluate(() => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === 'clip-b')?.startTime
    })
    // clip-b should have shifted to 0
    expect(clipBStart).toBe(0)
  })

  test('multi-select with programmatic toggleClipInSelection adds both clips', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const id1 = await injectTimelineClip(window, mediaId)
    const id2 = await injectTimelineClip(window, mediaId)
    await window.evaluate(({ id1, id2 }) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id1)
      state.toggleClipInSelection(id2)
    }, { id1, id2 })
    const selectedIds = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().selectedClipIds
    )
    expect(selectedIds).toHaveLength(2)
  })

  test('deleting multi-selected clips removes all of them', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const id1 = await injectTimelineClip(window, mediaId)
    const id2 = await injectTimelineClip(window, mediaId)
    await window.evaluate(({ id1, id2 }) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id1)
      state.toggleClipInSelection(id2)
    }, { id1, id2 })
    await window.keyboard.press('Delete')
    await window.waitForTimeout(200)
    const count = await getTimelineClipCount(window)
    expect(count).toBe(0)
  })

  test('Q trims the selected clip end to the playhead', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id)
      state.setPlayheadTime(7)
    }, clipId)
    await window.keyboard.press('q')
    await window.waitForTimeout(200)
    const dur = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.duration
    }, clipId)
    expect(dur).toBeCloseTo(7, 1)
  })

  test('W trims the selected clip start to the playhead', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    await window.evaluate((id) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id)
      state.setPlayheadTime(3)
    }, clipId)
    await window.keyboard.press('w')
    await window.waitForTimeout(200)
    const clip = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.timeline.getState().clips
      return clips.find((c: { id: string }) => c.id === id)
    }, clipId)
    // Start time should have moved forward by 3, duration reduced
    expect(clip.startTime).toBeCloseTo(3, 1)
  })

  test('locked track: drop dispatched to a locked track does not add a clip', async ({ window }) => {
    await goToEditor(window)
    // Lock the video track
    await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      const track = state.tracks.find((t: { type: string }) => t.type === 'video')
      if (track) state.toggleLock(track.id)
    })
    await injectMediaClip(window)
    // Attempt drag — should not add clip because track is locked
    await window.waitForTimeout(100)
    const countBefore = await getTimelineClipCount(window)
    await window.dragAndDrop(
      '[data-tutorial="media-bin"] [draggable]',
      '[data-testid="track-lane-video"]'
    ).catch(() => {})
    await window.waitForTimeout(300)
    const countAfter = await getTimelineClipCount(window)
    expect(countAfter).toBe(countBefore)
  })

  test('muting a track toggles its isMuted flag', async ({ window }) => {
    await goToEditor(window)
    const trackId = await window.evaluate(() => {
      const state = (window as any).__klipStores.timeline.getState()
      return state.tracks.find((t: { type: string }) => t.type === 'video')?.id
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

  test('timeline renders at least 4 track rows', async ({ window }) => {
    await goToEditor(window)
    const lanes = window.locator('[data-testid^="track-lane-"]')
    await expect(lanes).toHaveCount(4)
  })

  test('clicking empty area of timeline deselects clip', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const clipId  = await injectTimelineClip(window, mediaId)
    await window.evaluate((id) => {
      (window as any).__klipStores.timeline.getState().selectClip(id)
    }, clipId)
    // Click the lane (not the clip)
    await window.locator('[data-testid="track-lane-video"]').first().click()
    await window.waitForTimeout(150)
    const selected = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().selectedClipId
    )
    expect(selected).toBeNull()
  })

  test('timeline clip is visible in the DOM after injection', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    await injectTimelineClip(window, mediaId)
    await expect(window.locator('[data-testid="timeline-clip"]').first()).toBeVisible({ timeout: 3_000 })
  })

  test('snap toggle via Ctrl+\\ flips snapEnabled state', async ({ window }) => {
    await goToEditor(window)
    const before = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().snapEnabled
    )
    await window.keyboard.press('Control+\\')
    await window.waitForTimeout(150)
    const after = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().snapEnabled
    )
    expect(after).toBe(!before)
  })

  test('loop toggle via Ctrl+L flips loopEnabled state', async ({ window }) => {
    await goToEditor(window)
    const before = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().loopEnabled
    )
    await window.keyboard.press('Control+l')
    await window.waitForTimeout(150)
    const after = await window.evaluate(
      () => (window as any).__klipStores.timeline.getState().loopEnabled
    )
    expect(after).toBe(!before)
  })

  test('undo after multi-clip deletion restores all clips atomically', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window)
    const id1 = await injectTimelineClip(window, mediaId)
    const id2 = await injectTimelineClip(window, mediaId)
    await window.evaluate(({ id1, id2 }) => {
      const state = (window as any).__klipStores.timeline.getState()
      state.selectClip(id1)
      state.toggleClipInSelection(id2)
    }, { id1, id2 })
    await window.keyboard.press('Delete')
    await window.waitForTimeout(150)
    expect(await getTimelineClipCount(window)).toBe(0)
    await window.keyboard.press('Control+z')
    await window.waitForTimeout(200)
    expect(await getTimelineClipCount(window)).toBe(2)
  })
})
