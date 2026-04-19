// @vitest-environment node
/**
 * §5.11 IPC surface / contract tests
 *
 * Parses the preload and all main-process handler files to extract channel names
 * and verifies that renderer ↔ main are aligned — no silent drift after renames.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '../../..')
const PRELOAD_PATH = join(SRC, 'src/preload/index.ts')
const IPC_DIR      = join(SRC, 'src/main/ipc')

// ── Extract channel names via regex ──────────────────────────────────────────

function extractChannels(src: string, pattern: RegExp): Set<string> {
  const channels = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = pattern.exec(src)) !== null) {
    channels.add(m[1])
  }
  return channels
}

const preloadSrc  = readFileSync(PRELOAD_PATH, 'utf-8')
const handlerSrcs = readdirSync(IPC_DIR)
  .filter(f => f.endsWith('.ts'))
  .map(f => readFileSync(join(IPC_DIR, f), 'utf-8'))
  .join('\n')

// Channels the renderer CAN call (invoke or send)
const preloadInvoke = extractChannels(preloadSrc, /ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)
const preloadSend   = extractChannels(preloadSrc, /ipcRenderer\.send\(['"]([^'"]+)['"]/g)
const preloadOn     = extractChannels(preloadSrc, /ipcRenderer\.on\(['"]([^'"]+)['"]/g)
const preloadRemove = extractChannels(preloadSrc, /ipcRenderer\.removeListener\(['"]([^'"]+)['"]/g)

// All channels the renderer references (calls + subscribes)
const preloadChannels = new Set([...preloadInvoke, ...preloadSend, ...preloadOn, ...preloadRemove])

// Channels main registers — \s* handles multi-line calls: ipcMain.handle(\n  'channel'
const mainHandle = extractChannels(handlerSrcs, /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)
const mainOn     = extractChannels(handlerSrcs, /ipcMain\.on\(\s*['"]([^'"]+)['"]/g)
const mainChannels = new Set([...mainHandle, ...mainOn])

// ── §5.11 contract assertions ─────────────────────────────────────────────────

describe('IPC surface contract', () => {
  it('every window.* invoke channel in preload has a matching ipcMain.handle', () => {
    const windowInvokes = [...preloadInvoke].filter(ch => ch.startsWith('window:'))
    for (const ch of windowInvokes) {
      expect(mainHandle.has(ch), `main has no handle for "${ch}"`).toBe(true)
    }
  })

  it('every window.* send channel in preload has a matching ipcMain.on', () => {
    const windowSends = [...preloadSend].filter(ch => ch.startsWith('window:'))
    for (const ch of windowSends) {
      expect(mainOn.has(ch), `main has no on-handler for "${ch}"`).toBe(true)
    }
  })

  it('every media.* invoke channel in preload has a matching ipcMain.handle', () => {
    const mediaInvokes = [...preloadInvoke].filter(ch => ch.startsWith('media:'))
    for (const ch of mediaInvokes) {
      expect(mainHandle.has(ch), `main has no handle for "${ch}"`).toBe(true)
    }
  })

  it('every media.* send channel in preload has a matching ipcMain.on', () => {
    const mediaSends = [...preloadSend].filter(ch => ch.startsWith('media:'))
    for (const ch of mediaSends) {
      expect(mainOn.has(ch), `main has no on-handler for "${ch}"`).toBe(true)
    }
  })

  it('every project.* channel in preload has a matching ipcMain.handle', () => {
    const projectInvokes = [...preloadInvoke].filter(ch => ch.startsWith('project:'))
    for (const ch of projectInvokes) {
      expect(mainHandle.has(ch), `main has no handle for "${ch}"`).toBe(true)
    }
  })

  it('every export.* invoke channel in preload has a matching ipcMain.handle', () => {
    const exportInvokes = [...preloadInvoke].filter(ch => ch.startsWith('export:'))
    for (const ch of exportInvokes) {
      expect(mainHandle.has(ch), `main has no handle for "${ch}"`).toBe(true)
    }
  })

  it('every settings.* channel in preload has a matching ipcMain.handle', () => {
    const settingsInvokes = [...preloadInvoke].filter(ch => ch.startsWith('settings:'))
    for (const ch of settingsInvokes) {
      expect(mainHandle.has(ch), `main has no handle for "${ch}"`).toBe(true)
    }
  })

  it('preload removeListener channels have corresponding ipcRenderer.on subscriptions', () => {
    for (const ch of preloadRemove) {
      expect(preloadOn.has(ch), `preload subscribes to "${ch}" but never unsubscribes — or vice versa`).toBe(true)
    }
  })

  it('channels extracted from preload and from main are non-empty (sanity check)', () => {
    expect(preloadChannels.size).toBeGreaterThan(10)
    expect(mainChannels.size).toBeGreaterThan(10)
  })

  it('all four core channel namespaces are represented in the preload', () => {
    const namespaces = ['window:', 'media:', 'project:', 'export:']
    for (const ns of namespaces) {
      const found = [...preloadChannels].some(ch => ch.startsWith(ns))
      expect(found, `no channels for namespace "${ns}" in preload`).toBe(true)
    }
  })
})
