// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { ipcMain, dialog } from 'electron'
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'

// app.getPath is called at module level in projectHandlers — mock before import
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-project') },
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
}))

import { registerProjectHandlers } from '../../main/ipc/projectHandlers'

const TEST_DIR      = '/tmp/klip-test-project'
const AUTOSAVE_FILE = join(TEST_DIR, 'klip-autosave.klip')
const RECENT_FILE   = join(TEST_DIR, 'recent-projects.json')

function getHandle(channel: string): Function {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No handle registered for "${channel}"`)
  return call[1] as Function
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  registerProjectHandlers()
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  try { rmSync(AUTOSAVE_FILE) } catch { /* ok */ }
  try { rmSync(RECENT_FILE) } catch { /* ok */ }
  vi.mocked(dialog.showSaveDialog).mockReset()
  vi.mocked(dialog.showOpenDialog).mockReset()
})

// ── §5.2 Autosave ─────────────────────────────────────────────────────────────

describe('project:autosave', () => {
  it('writes project data to the autosave path', async () => {
    const data = { name: 'My Video', clips: [{ id: 'c1' }] }
    await getHandle('project:autosave')(null, data)
    const written = JSON.parse(readFileSync(AUTOSAVE_FILE, 'utf-8'))
    expect(written.name).toBe('My Video')
    expect(written.clips).toHaveLength(1)
  })
})

describe('project:check-autosave', () => {
  it('returns { data } when the autosave file exists', async () => {
    writeFileSync(AUTOSAVE_FILE, JSON.stringify({ name: 'Recovered', clips: [] }))
    const result = await getHandle('project:check-autosave')(null)
    expect(result).not.toBeNull()
    expect((result as { data: unknown }).data).toMatchObject({ name: 'Recovered' })
  })

  it('returns null when no autosave file exists', async () => {
    expect(await getHandle('project:check-autosave')(null)).toBeNull()
  })
})

describe('project:clear-autosave', () => {
  it('deletes the autosave file; subsequent check-autosave returns null', async () => {
    writeFileSync(AUTOSAVE_FILE, JSON.stringify({ name: 'draft' }))
    await getHandle('project:clear-autosave')(null)
    expect(existsSync(AUTOSAVE_FILE)).toBe(false)
    expect(await getHandle('project:check-autosave')(null)).toBeNull()
  })
})

// ── §5.2 project:save ─────────────────────────────────────────────────────────

describe('project:save', () => {
  it('writes a valid JSON file to the specified path', async () => {
    const outPath = join(TEST_DIR, 'test-project.klip')
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath: outPath } as Electron.SaveDialogReturnValue)
    const data = { name: 'Saved', mediaClips: [], clips: [] }
    const savedPath = await getHandle('project:save')(null, { data, path: null })
    expect(savedPath).toBe(outPath)
    const json = JSON.parse(readFileSync(outPath, 'utf-8'))
    expect(json.name).toBe('Saved')
  })

  it('returns null when the save dialog is cancelled', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true } as Electron.SaveDialogReturnValue)
    const result = await getHandle('project:save')(null, { data: {}, path: null })
    expect(result).toBeNull()
  })

  it('saves to the given path without showing a dialog when path is provided', async () => {
    const outPath = join(TEST_DIR, 'direct-save.klip')
    const data = { name: 'Direct', mediaClips: [] }
    const savedPath = await getHandle('project:save')(null, { data, path: outPath })
    expect(savedPath).toBe(outPath)
    expect(vi.mocked(dialog.showSaveDialog)).not.toHaveBeenCalled()
    expect(existsSync(outPath)).toBe(true)
  })

  it('relativizes absolute media paths relative to the project file', async () => {
    const outPath = join(TEST_DIR, 'portable', 'project.klip')
    mkdirSync(dirname(outPath), { recursive: true })
    const data = {
      name: 'Portable',
      mediaClips: [{ id: 'mc1', path: join(TEST_DIR, 'portable', 'video.mp4') }],
    }
    await getHandle('project:save')(null, { data, path: outPath })
    const json = JSON.parse(readFileSync(outPath, 'utf-8'))
    // Path relative to project dir: 'video.mp4' (not absolute)
    expect(json.mediaClips[0].path).toBe('video.mp4')
  })
})

// ── §5.2 project:open ─────────────────────────────────────────────────────────

describe('project:open', () => {
  it('reads and resolves media paths from an existing .klip file', async () => {
    const projectDir = join(TEST_DIR, 'open-test')
    mkdirSync(projectDir, { recursive: true })
    const projectFile = join(projectDir, 'proj.klip')
    const storedData = {
      name: 'Opened',
      mediaClips: [{ id: 'mc1', path: 'clips/video.mp4' }],
    }
    writeFileSync(projectFile, JSON.stringify(storedData))

    const result = await getHandle('project:open')(null, projectFile) as { data: unknown; path: string }
    expect(result).not.toBeNull()
    expect(result.path).toBe(projectFile)
    const data = result.data as { name: string; mediaClips: { path: string }[] }
    expect(data.name).toBe('Opened')
    // Relative path should be resolved to absolute
    expect(data.mediaClips[0].path).toBe(join(projectDir, 'clips', 'video.mp4'))
  })

  it('returns null for a non-existent file path', async () => {
    const result = await getHandle('project:open')(null, '/no/such/file.klip')
    expect(result).toBeNull()
  })

  it('returns null for a corrupted (non-JSON) file', async () => {
    const badFile = join(TEST_DIR, 'bad.klip')
    writeFileSync(badFile, 'NOT JSON <<<')
    expect(await getHandle('project:open')(null, badFile)).toBeNull()
  })
})

// ── §5.2 project:get-recent ───────────────────────────────────────────────────

describe('project:get-recent', () => {
  it('returns [] when no recents file exists', async () => {
    expect(await getHandle('project:get-recent')(null)).toEqual([])
  })

  it('returns persisted entries after a save', async () => {
    const outPath = join(TEST_DIR, 'saved.klip')
    await getHandle('project:save')(null, { data: { name: 'RecentTest', mediaClips: [] }, path: outPath })
    const recents = await getHandle('project:get-recent')(null) as { name: string }[]
    expect(recents.some(r => r.name === 'RecentTest')).toBe(true)
  })
})
