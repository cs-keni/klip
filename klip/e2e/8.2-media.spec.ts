/**
 * Phase 8 §8.2 — Media import (10 tests)
 *
 * Covers: import via dialog, duplicate detection, context menu actions,
 * unsupported format rejection, different media types.
 */
import path from 'path'
import fs from 'fs'
import { test, expect } from './fixtures'
import { goToEditor, mockOpenDialog, mockGetFileInfo, getMediaClipCount } from './helpers'

// Tiny fixture files used so MediaBin processes a real path
const FIXTURE_DIR = path.join(__dirname, 'fixtures')
const MP4_FIXTURE = path.join(FIXTURE_DIR, 'test.mp4')
const PNG_FIXTURE = path.join(FIXTURE_DIR, 'test.png')
const MP3_FIXTURE = path.join(FIXTURE_DIR, 'test.mp3')

test.beforeAll(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true })
  // Create zero-byte placeholder files — enough for path/extension checks
  for (const f of [MP4_FIXTURE, PNG_FIXTURE, MP3_FIXTURE]) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, '')
  }
})

test.describe('8.2 Media import', () => {

  test('import button click opens dialog and adds a video clip card', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    // Clip card (or skeleton) should appear
    await expect(window.locator('[data-tutorial="media-bin"]').locator('.clip-card, [draggable]').first())
      .toBeVisible({ timeout: 5_000 })
    const count = await getMediaClipCount(window)
    expect(count).toBe(1)
  })

  test('importing a .png creates an image clip in the media bin', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [PNG_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(300)
    const count = await getMediaClipCount(window)
    expect(count).toBe(1)
    // Clip type should be image
    const clipType = await window.evaluate(() => {
      const clips = (window as any).__klipStores.media.getState().clips
      return clips[0]?.type
    })
    expect(clipType).toBe('image')
  })

  test('importing a .mp3 creates an audio clip in the media bin', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP3_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(300)
    const count = await getMediaClipCount(window)
    expect(count).toBe(1)
    const clipType = await window.evaluate(() => {
      const clips = (window as any).__klipStores.media.getState().clips
      return clips[0]?.type
    })
    expect(clipType).toBe('audio')
  })

  test('importing an unsupported extension does not add a clip', async ({ window }) => {
    await goToEditor(window)
    await mockOpenDialog(window, ['/tmp/bad-file.xyz'])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(300)
    const count = await getMediaClipCount(window)
    expect(count).toBe(0)
  })

  test('importing the same file twice does not add a duplicate', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(200)
    // Import same file again
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(300)
    const count = await getMediaClipCount(window)
    expect(count).toBe(1)
  })

  test('cancelling the import dialog does not add any clip', async ({ window }) => {
    await goToEditor(window)
    // Cancelled = empty array
    await mockOpenDialog(window, [])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(200)
    const count = await getMediaClipCount(window)
    expect(count).toBe(0)
  })

  test('right-click on a clip card shows a context menu with Rename option', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    // Wait for clip card to appear
    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })
    await clipCard.click({ button: 'right' })
    await expect(window.getByRole('button', { name: /rename/i }).first()).toBeVisible()
  })

  test('right-click → Rename enters inline rename mode', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })
    await clipCard.click({ button: 'right' })
    await window.getByRole('button', { name: /rename/i }).first().click()
    // An input should appear for renaming
    await expect(window.locator('[data-tutorial="media-bin"] input')).toBeVisible()
  })

  test('right-click → Remove removes the clip from the media bin', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    const clipCard = window.locator('[data-tutorial="media-bin"] [draggable]').first()
    await expect(clipCard).toBeVisible({ timeout: 5_000 })
    await clipCard.click({ button: 'right' })
    await window.getByRole('button', { name: /remove/i }).first().click()
    await window.waitForTimeout(300)
    const count = await getMediaClipCount(window)
    expect(count).toBe(0)
  })

  test('importing multiple files at once adds all of them', async ({ window }) => {
    await goToEditor(window)
    await mockGetFileInfo(window)
    await mockOpenDialog(window, [MP4_FIXTURE, PNG_FIXTURE])
    await window.locator('[data-tutorial="import-btn"]').click()
    await window.waitForTimeout(400)
    const count = await getMediaClipCount(window)
    expect(count).toBe(2)
  })
})
