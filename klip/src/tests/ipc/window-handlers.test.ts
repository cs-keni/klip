// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))

import { registerWindowHandlers } from '../../main/ipc/windowHandlers'

const mockWindow = {
  minimize:    vi.fn(),
  maximize:    vi.fn(),
  unmaximize:  vi.fn(),
  close:       vi.fn(),
  isMaximized: vi.fn().mockReturnValue(false),
  webContents: { send: vi.fn() },
}

function getOnHandler(channel: string): Function {
  const call = vi.mocked(ipcMain.on).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No on-handler for "${channel}"`)
  return call[1] as Function
}

function getHandle(channel: string): Function {
  const call = vi.mocked(ipcMain.handle).mock.calls.find(c => c[0] === channel)
  if (!call) throw new Error(`No handle registered for "${channel}"`)
  return call[1] as Function
}

beforeAll(() => {
  registerWindowHandlers(mockWindow as unknown as BrowserWindow)
})

// ── §5.5 windowHandlers ───────────────────────────────────────────────────────

describe('window:minimize', () => {
  it('calls window.minimize()', () => {
    getOnHandler('window:minimize')(null)
    expect(mockWindow.minimize).toHaveBeenCalledOnce()
  })
})

describe('window:maximize', () => {
  it('calls window.maximize() when not currently maximized', () => {
    mockWindow.isMaximized.mockReturnValueOnce(false)
    getOnHandler('window:maximize')(null)
    expect(mockWindow.maximize).toHaveBeenCalled()
    expect(mockWindow.unmaximize).not.toHaveBeenCalled()
  })

  it('calls window.unmaximize() when already maximized', () => {
    mockWindow.maximize.mockClear()
    mockWindow.unmaximize.mockClear()
    mockWindow.isMaximized.mockReturnValueOnce(true)
    getOnHandler('window:maximize')(null)
    expect(mockWindow.unmaximize).toHaveBeenCalled()
    expect(mockWindow.maximize).not.toHaveBeenCalled()
  })
})

describe('window:close', () => {
  it('calls window.close()', () => {
    getOnHandler('window:close')(null)
    expect(mockWindow.close).toHaveBeenCalledOnce()
  })
})

describe('window:is-maximized', () => {
  it('returns false when the window is not maximized', () => {
    mockWindow.isMaximized.mockReturnValueOnce(false)
    expect(getHandle('window:is-maximized')(null)).toBe(false)
  })

  it('returns true when the window is maximized', () => {
    mockWindow.isMaximized.mockReturnValueOnce(true)
    expect(getHandle('window:is-maximized')(null)).toBe(true)
  })
})
