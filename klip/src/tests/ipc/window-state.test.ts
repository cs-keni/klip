// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-test-windowstate') },
}))

import { loadWindowState, saveWindowState } from '../../main/windowState'

const TEST_DIR = '/tmp/klip-test-windowstate'
const STATE_FILE = join(TEST_DIR, 'window-state.json')

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  try { rmSync(STATE_FILE) } catch { /* ok if not present */ }
})

// ── §5.10 loadWindowState ──────────────────────────────────────────────────────

describe('loadWindowState', () => {
  it('returns defaults { width:1440, height:900, isMaximized:false } when no file exists', () => {
    const state = loadWindowState()
    expect(state).toEqual({ width: 1440, height: 900, isMaximized: false })
  })

  it('merges saved values over defaults (missing fields use defaults)', () => {
    writeFileSync(STATE_FILE, JSON.stringify({ width: 1920, height: 1080 }))
    const state = loadWindowState()
    expect(state.width).toBe(1920)
    expect(state.height).toBe(1080)
    expect(state.isMaximized).toBe(false) // default applied
  })

  it('loads isMaximized:true when saved as true', () => {
    writeFileSync(STATE_FILE, JSON.stringify({ width: 1440, height: 900, isMaximized: true }))
    expect(loadWindowState().isMaximized).toBe(true)
  })

  it('returns defaults when the file contains corrupt JSON', () => {
    writeFileSync(STATE_FILE, '{ not valid json <<<')
    expect(loadWindowState()).toEqual({ width: 1440, height: 900, isMaximized: false })
  })
})

// ── §5.10 saveWindowState ──────────────────────────────────────────────────────

describe('saveWindowState', () => {
  it('round-trips through saveWindowState → loadWindowState', () => {
    const saved = { width: 2560, height: 1440, isMaximized: true }
    saveWindowState(saved)
    expect(loadWindowState()).toMatchObject(saved)
  })
})
