import type { Page, ElectronApplication } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// ── Navigation ────────────────────────────────────────────────────────────────

/** Click "New Project" and wait for the editor toolbar to appear. */
export async function goToEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /new project/i }).click()
  await page.waitForSelector('[data-tutorial="export-btn"]', { timeout: 10_000 })
}

// ── API mocks (renderer process) ─────────────────────────────────────────────

/** Override openDialog to return a fixed set of paths (avoids native dialog). */
export async function mockOpenDialog(page: Page, paths: string[]): Promise<void> {
  await page.evaluate((ps) => {
    ;(window as any).api.media.openDialog = async () => ps
  }, paths)
}

/** Override project.save and project.saveAs to resolve immediately. */
export async function mockProjectSave(page: Page, filePath = '/tmp/e2e-test.klip'): Promise<void> {
  await page.evaluate((fp) => {
    ;(window as any).api.project.save   = async () => fp
    ;(window as any).api.project.saveAs = async () => fp
  }, filePath)
}

/** Override media.getFileInfo to return fake metadata for a given path. */
export async function mockGetFileInfo(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as any).api.media.getFileInfo = async (_path: string) => ({
      duration: 10,
      width: 1920,
      height: 1080,
      fps: 30,
      size: 1024 * 1024,
    })
    ;(window as any).api.media.extractFrame = async () => null
  })
}

// ── State injection (via __klipStores) ────────────────────────────────────────

/** Add a MediaClip directly to the media store. Returns the clip id. */
export async function injectMediaClip(
  page: Page,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  return page.evaluate((o) => {
    const stores = (window as any).__klipStores
    const id = crypto.randomUUID()
    const clip = {
      id,
      type: 'video',
      path: '/tmp/e2e-clip.mp4',
      name: 'e2e-clip.mp4',
      duration: 10,
      width: 1920,
      height: 1080,
      fps: 30,
      fileSize: 1_000_000,
      thumbnail: null,
      thumbnailStatus: 'idle',
      isOnTimeline: false,
      isMissing: false,
      addedAt: Date.now(),
      ...o,
    }
    stores.media.getState().addClip(clip)
    return id
  }, overrides)
}

/** Add a TimelineClip to the first track of the given type. Returns clip id. */
export async function injectTimelineClip(
  page: Page,
  mediaClipId: string,
  trackType = 'video'
): Promise<string> {
  return page.evaluate(
    ({ mediaClipId, trackType }) => {
      const stores = (window as any).__klipStores
      const state  = stores.timeline.getState()
      const track  = state.tracks.find((t: { type: string }) => t.type === trackType)
      if (!track) throw new Error(`No "${trackType}" track found`)
      const id = crypto.randomUUID()
      state.addClip({
        id,
        mediaClipId,
        trackId:   track.id,
        startTime: 0,
        duration:  10,
        trimStart: 0,
        type:      'video',
        name:      'e2e-clip.mp4',
        thumbnail: null,
      })
      return id
    },
    { mediaClipId, trackType }
  )
}

// ── Store queries ─────────────────────────────────────────────────────────────

export async function getTimelineClipCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as any).__klipStores.timeline.getState().clips.length
  )
}

export async function getMediaClipCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as any).__klipStores.media.getState().clips.length
  )
}

/** Returns the text content of the project-name element (or '' if absent). */
export async function getProjectName(page: Page): Promise<string> {
  const el = page.locator('[data-testid="project-name"]')
  return (await el.textContent()) ?? ''
}

// ── Crash-recovery setup ──────────────────────────────────────────────────────

const FAKE_PROJECT = JSON.stringify({
  projectName: 'Recovered Project',
  settings:    { resolution: '1080p', frameRate: 30, aspectRatio: '16:9' },
  tracks:      [],
  clips:       [],
})

/**
 * Write a fake autosave file to Electron's userData directory so the
 * crash-recovery dialog appears when the renderer loads.
 *
 * Must be called BEFORE the window is shown (i.e., inside a `beforeAll` that
 * runs before the `window` fixture).
 */
export async function writeFakeAutosave(electronApp: ElectronApplication): Promise<string> {
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const autosavePath = path.join(userData, 'klip-autosave.klip')
  fs.writeFileSync(autosavePath, FAKE_PROJECT, 'utf-8')
  return autosavePath
}

/** Remove the autosave file (call in afterAll to keep test state clean). */
export async function clearFakeAutosave(electronApp: ElectronApplication): Promise<void> {
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const autosavePath = path.join(userData, 'klip-autosave.klip')
  if (fs.existsSync(autosavePath)) fs.unlinkSync(autosavePath)
}
