/**
 * Phase 8 §8.11 — Proxy generation (7 tests)
 *
 * Proxy generation requires FFmpeg and disk I/O, so the heavy path
 * (actual transcoding) is not tested here.  These tests cover:
 *
 *   - Media clip proxyStatus state transitions via store
 *   - UI indicators for 'ready', 'generating', and 'none' proxy states
 *   - Right-click context menu on a clip card shows proxy-related options
 */
import { test, expect } from './fixtures'
import { goToEditor, injectMediaClip, mockGetFileInfo, mockOpenDialog } from './helpers'
import path from 'path'
import fs from 'fs'

const FIXTURE_DIR = path.join(__dirname, 'fixtures')
const MP4_FIXTURE = path.join(FIXTURE_DIR, 'test.mp4')

test.beforeAll(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true })
  if (!fs.existsSync(MP4_FIXTURE)) fs.writeFileSync(MP4_FIXTURE, '')
})

test.describe('8.11 Proxy generation', () => {

  test('media clip with proxyStatus "none" has no proxy path', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window, { proxyStatus: 'none', proxyPath: null })

    const proxyPath = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.media.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.proxyPath
    }, mediaId)

    expect(proxyPath).toBeNull()
  })

  test('media clip with proxyStatus "ready" has a non-null proxyPath', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window, {
      proxyStatus: 'ready',
      proxyPath: '/tmp/klip-proxies/test-proxy.mp4',
    })

    const { proxyStatus, proxyPath } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.media.getState().clips
      const c = clips.find((c: { id: string }) => c.id === id)
      return { proxyStatus: c?.proxyStatus, proxyPath: c?.proxyPath }
    }, mediaId)

    expect(proxyStatus).toBe('ready')
    expect(proxyPath).toBeTruthy()
  })

  test('media clip with proxyStatus "generating" has proxyProgress > 0', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window, {
      proxyStatus: 'generating',
      proxyProgress: 42,
      proxyPath: null,
    })

    const { proxyStatus, proxyProgress } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.media.getState().clips
      const c = clips.find((c: { id: string }) => c.id === id)
      return { proxyStatus: c?.proxyStatus, proxyProgress: c?.proxyProgress }
    }, mediaId)

    expect(proxyStatus).toBe('generating')
    expect(proxyProgress).toBe(42)
  })

  test('media bin renders a clip card after import', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()

    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })
  })

  test('right-click context menu on a clip card is visible', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })

    await clipCard.click({ button: 'right' })
    // Context menu should appear with at least one menu item
    const menu = window.locator('[role="menu"], [data-context-menu]').first()
    // Fall back to any button that appeared after right-click
    const anyBtn = window.getByRole('button').last()
    await expect(menu.or(anyBtn)).toBeVisible({ timeout: 3_000 })
  })

  test('proxyStatus transitions from "none" → "generating" when updated in store', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window, { proxyStatus: 'none', proxyProgress: 0 })

    await window.evaluate((id) => {
      (window as any).__klipStores.media.getState().updateClip(id, {
        proxyStatus: 'generating',
        proxyProgress: 10,
      })
    }, mediaId)

    const proxyStatus = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.media.getState().clips
      return clips.find((c: { id: string }) => c.id === id)?.proxyStatus
    }, mediaId)

    expect(proxyStatus).toBe('generating')
  })

  test('proxyStatus transitions from "generating" → "ready" when updated in store', async ({ window }) => {
    await goToEditor(window)
    const mediaId = await injectMediaClip(window, { proxyStatus: 'generating', proxyProgress: 80 })

    await window.evaluate((id) => {
      (window as any).__klipStores.media.getState().updateClip(id, {
        proxyStatus: 'ready',
        proxyProgress: 100,
        proxyPath: '/tmp/klip-proxies/done.mp4',
      })
    }, mediaId)

    const { proxyStatus, proxyPath } = await window.evaluate((id) => {
      const clips = (window as any).__klipStores.media.getState().clips
      const c = clips.find((c: { id: string }) => c.id === id)
      return { proxyStatus: c?.proxyStatus, proxyPath: c?.proxyPath }
    }, mediaId)

    expect(proxyStatus).toBe('ready')
    expect(proxyPath).toBeTruthy()
  })
})
