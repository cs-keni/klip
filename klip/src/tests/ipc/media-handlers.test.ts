// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { ipcMain, dialog, shell } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-media') },
  dialog: { showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
}))

import { registerMediaHandlers } from '../../main/ipc/mediaHandlers'

const TEST_DIR = '/tmp/klip-test-media'

function getHandle(channel: string): Function {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No handle for "${channel}"`)
  return call[1] as Function
}

function getOnHandler(channel: string): Function {
  const call = vi.mocked(ipcMain.on).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No on-handler for "${channel}"`)
  return call[1] as Function
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  registerMediaHandlers()
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  vi.mocked(dialog.showOpenDialog).mockReset()
  vi.mocked(shell.showItemInFolder).mockReset()
})

// ── §5.1 media:open-dialog ────────────────────────────────────────────────────

describe('media:open-dialog', () => {
  it('returns empty array when dialog is cancelled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as Electron.OpenDialogReturnValue)
    expect(await getHandle('media:open-dialog')(null)).toEqual([])
  })

  it('returns selected file paths when dialog confirms', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/media/video.mp4', '/media/audio.mp3'],
    } as Electron.OpenDialogReturnValue)
    const result = await getHandle('media:open-dialog')(null)
    expect(result).toEqual(['/media/video.mp4', '/media/audio.mp3'])
  })

  it('passes defaultPath option to dialog when provided', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as Electron.OpenDialogReturnValue)
    await getHandle('media:open-dialog')(null, { defaultPath: '/home/user/videos' })
    expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: '/home/user/videos' })
    )
  })
})

// ── §5.1 media:get-file-info ──────────────────────────────────────────────────

describe('media:get-file-info', () => {
  it('returns { size } in bytes for an existing file', async () => {
    const testFile = join(TEST_DIR, 'sample.txt')
    writeFileSync(testFile, '12345') // 5 bytes
    const info = await getHandle('media:get-file-info')(null, testFile) as { size: number }
    expect(info.size).toBe(5)
  })

  it('returns { size: 0 } for a non-existent path (graceful fallback)', async () => {
    const info = await getHandle('media:get-file-info')(null, '/no/such/file.mp4') as { size: number }
    expect(info.size).toBe(0)
  })
})

// ── §5.1 media:check-files-exist ─────────────────────────────────────────────

describe('media:check-files-exist', () => {
  it('returns true for existing paths and false for missing paths', async () => {
    const existing = join(TEST_DIR, 'exists.mp4')
    writeFileSync(existing, 'data')
    const result = await getHandle('media:check-files-exist')(null, [
      existing,
      '/tmp/klip-test-media/no-such-file.mp4',
    ]) as Record<string, boolean>
    expect(result[existing]).toBe(true)
    expect(result['/tmp/klip-test-media/no-such-file.mp4']).toBe(false)
  })

  it('returns an empty object for an empty input array', async () => {
    expect(await getHandle('media:check-files-exist')(null, [])).toEqual({})
  })
})

// ── §5.1 media:reveal-in-explorer ────────────────────────────────────────────

describe('media:reveal-in-explorer', () => {
  it('calls shell.showItemInFolder with the given path', () => {
    getOnHandler('media:reveal-in-explorer')(null, '/media/video.mp4')
    expect(vi.mocked(shell.showItemInFolder)).toHaveBeenCalledWith('/media/video.mp4')
  })
})

// ── §5.1 media:pick-file ─────────────────────────────────────────────────────

describe('media:pick-file', () => {
  it('returns null when the dialog is cancelled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as Electron.OpenDialogReturnValue)
    expect(await getHandle('media:pick-file')(null, 'video')).toBeNull()
  })

  it('filters dialog to video extensions when type is "video"', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as Electron.OpenDialogReturnValue)
    await getHandle('media:pick-file')(null, 'video')
    const opts = vi.mocked(dialog.showOpenDialog).mock.calls[0][0]
    const videoFilter = (opts as { filters: Electron.FileFilter[] }).filters.find(f => f.name === 'Video Files')
    expect(videoFilter?.extensions).toContain('mp4')
  })

  it('filters dialog to audio extensions when type is "audio"', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] } as Electron.OpenDialogReturnValue)
    await getHandle('media:pick-file')(null, 'audio')
    const opts = vi.mocked(dialog.showOpenDialog).mock.calls[0][0]
    const audioFilter = (opts as { filters: Electron.FileFilter[] }).filters.find(f => f.name === 'Audio Files')
    expect(audioFilter?.extensions).toContain('mp3')
  })

  it('returns the chosen file path on confirmation', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/media/clip.mp4'],
    } as Electron.OpenDialogReturnValue)
    expect(await getHandle('media:pick-file')(null, 'video')).toBe('/media/clip.mp4')
  })
})
