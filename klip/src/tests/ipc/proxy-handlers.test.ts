// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-proxy') },
  BrowserWindow: vi.fn(),
}))

vi.mock('child_process', () => ({ spawn: vi.fn() }))

import { registerProxyHandlers } from '../../main/ipc/proxyHandlers'

const TEST_DIR  = '/tmp/klip-test-proxy'
const PROXY_DIR = join(TEST_DIR, 'klip-proxies')

const mockWindow = { webContents: { send: vi.fn() } }

function getHandle(channel: string): Function {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No handle for "${channel}"`)
  return call[1] as Function
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  registerProxyHandlers(mockWindow as unknown as BrowserWindow)
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  try { rmSync(PROXY_DIR, { recursive: true }) } catch { /* ok */ }
})

// ── §5.6 media:check-proxy ────────────────────────────────────────────────────

describe('media:check-proxy', () => {
  it('returns null when no proxy file exists for the given clipId', async () => {
    const result = await getHandle('media:check-proxy')(null, 'clip-no-proxy')
    expect(result).toBeNull()
  })

  it('returns the proxy path when the file exists on disk', async () => {
    mkdirSync(PROXY_DIR, { recursive: true })
    const proxyPath = join(PROXY_DIR, 'clip-has-proxy.mp4')
    writeFileSync(proxyPath, 'fake proxy data')

    const result = await getHandle('media:check-proxy')(null, 'clip-has-proxy')
    expect(result).toBe(proxyPath)
  })
})

// ── §5.6 media:check-proxies-batch ───────────────────────────────────────────

describe('media:check-proxies-batch', () => {
  it('returns a Record<clipId, path|null> for each requested id', async () => {
    mkdirSync(PROXY_DIR, { recursive: true })
    writeFileSync(join(PROXY_DIR, 'clip-a.mp4'), 'proxy-a')

    const result = await getHandle('media:check-proxies-batch')(null, ['clip-a', 'clip-b']) as Record<string, string | null>
    expect(result['clip-a']).toBe(join(PROXY_DIR, 'clip-a.mp4'))
    expect(result['clip-b']).toBeNull()
  })

  it('returns an empty object for an empty input array', async () => {
    expect(await getHandle('media:check-proxies-batch')(null, [])).toEqual({})
  })
})
