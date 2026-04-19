// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { ipcMain, dialog } from 'electron'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-settings') },
  dialog: { showOpenDialog: vi.fn() },
}))

import { registerSettingsHandlers, readKlipConfig, getCustomFfmpegPath } from '../../main/ipc/settingsHandlers'

const TEST_DIR = '/tmp/klip-test-settings'
const CONFIG_FILE = join(TEST_DIR, 'klip-config.json')
const PROXY_DIR   = join(TEST_DIR, 'klip-proxies')

function getHandle(channel: string): Function {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No handle registered for "${channel}"`)
  return call[1] as Function
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  registerSettingsHandlers()
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  // Remove config and proxy dir so each test starts clean
  try { rmSync(CONFIG_FILE) } catch { /* ok */ }
  try { rmSync(PROXY_DIR, { recursive: true }) } catch { /* ok */ }
})

// ── §5.7 readKlipConfig / getCustomFfmpegPath ─────────────────────────────────

describe('readKlipConfig', () => {
  it('returns {} when no config file exists', () => {
    expect(readKlipConfig()).toEqual({})
  })

  it('returns parsed config when file exists', () => {
    writeFileSync(CONFIG_FILE, JSON.stringify({ customFfmpegPath: '/usr/bin/ffmpeg' }))
    expect(readKlipConfig().customFfmpegPath).toBe('/usr/bin/ffmpeg')
  })
})

describe('getCustomFfmpegPath', () => {
  it('returns null when no config exists', () => {
    expect(getCustomFfmpegPath()).toBeNull()
  })

  it('returns null when configured path does not exist on disk', () => {
    writeFileSync(CONFIG_FILE, JSON.stringify({ customFfmpegPath: '/nonexistent/ffmpeg' }))
    expect(getCustomFfmpegPath()).toBeNull()
  })

  it('returns the path when it is configured and exists', () => {
    // Use a known-existing file (the config file itself) as the "ffmpeg binary"
    writeFileSync(CONFIG_FILE, JSON.stringify({ customFfmpegPath: CONFIG_FILE }))
    expect(getCustomFfmpegPath()).toBe(CONFIG_FILE)
  })
})

// ── §5.7 IPC handlers ─────────────────────────────────────────────────────────

describe('settings:proxy-cache-info handler', () => {
  it('returns { count:0, totalBytes:0 } when proxy directory does not exist', () => {
    const handler = getHandle('settings:proxy-cache-info')
    expect(handler(null)).toEqual({ count: 0, totalBytes: 0 })
  })

  it('returns correct count and totalBytes for proxy directory with 2 .mp4 files', () => {
    mkdirSync(PROXY_DIR, { recursive: true })
    writeFileSync(join(PROXY_DIR, 'a.mp4'), 'AAAA')   // 4 bytes
    writeFileSync(join(PROXY_DIR, 'b.mp4'), 'BBBBBB') // 6 bytes
    writeFileSync(join(PROXY_DIR, 'notes.txt'), 'ignore') // should not count
    const handler = getHandle('settings:proxy-cache-info')
    const result = handler(null) as { count: number; totalBytes: number }
    expect(result.count).toBe(2)
    expect(result.totalBytes).toBe(10)
  })
})

describe('settings:clear-proxy-cache handler', () => {
  it('returns 0 when proxy directory does not exist', () => {
    expect(getHandle('settings:clear-proxy-cache')(null)).toBe(0)
  })

  it('deletes all .mp4 files and returns the deleted count', () => {
    mkdirSync(PROXY_DIR, { recursive: true })
    writeFileSync(join(PROXY_DIR, 'x.mp4'), 'x')
    writeFileSync(join(PROXY_DIR, 'y.mp4'), 'y')
    writeFileSync(join(PROXY_DIR, 'keep.txt'), 'keep')
    const count = getHandle('settings:clear-proxy-cache')(null) as number
    expect(count).toBe(2)
    expect(existsSync(join(PROXY_DIR, 'x.mp4'))).toBe(false)
    expect(existsSync(join(PROXY_DIR, 'keep.txt'))).toBe(true) // non-mp4 untouched
  })
})

describe('settings:get-ffmpeg-path / settings:set-ffmpeg-path handlers', () => {
  it('get returns null when no config has been written', async () => {
    expect(await getHandle('settings:get-ffmpeg-path')(null)).toBeNull()
  })

  it('set writes the path; get returns that value', async () => {
    await getHandle('settings:set-ffmpeg-path')(null, '/usr/local/bin/ffmpeg')
    expect(await getHandle('settings:get-ffmpeg-path')(null)).toBe('/usr/local/bin/ffmpeg')
  })

  it('set(null) clears the path; get returns null', async () => {
    await getHandle('settings:set-ffmpeg-path')(null, '/some/ffmpeg')
    await getHandle('settings:set-ffmpeg-path')(null, null)
    expect(await getHandle('settings:get-ffmpeg-path')(null)).toBeNull()
  })
})
