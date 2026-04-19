// @vitest-environment node
/**
 * Phase 10 — Security Tests
 *
 * Electron-specific attack surface checks. Split into two groups:
 *
 *   Static analysis — read source files as text and assert security-critical
 *   patterns are present (or absent). These catch configuration drift without
 *   needing to boot Electron.
 *
 *   Functional — import pure helpers and assert they correctly allow or reject
 *   inputs that an attacker could supply.
 *
 * Run before every public release: `npx vitest run src/tests/security`
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

// ── Path helpers ──────────────────────────────────────────────────────────────
// This file lives at src/tests/security/security.test.ts
// Going up two directories reaches src/
const SRC = join(__dirname, '..', '..')

function src(...parts: string[]): string {
  return join(SRC, ...parts)
}

// =============================================================================
// §10.1 — BrowserWindow configuration (static analysis)
// =============================================================================

describe('10.1 — BrowserWindow webPreferences', () => {

  let mainSource: string

  beforeAll(() => {
    mainSource = readFileSync(src('main', 'index.ts'), 'utf-8')
  })

  it('contextIsolation: true is set in BrowserWindow webPreferences', () => {
    // Prevents renderer JS from accessing Node globals; required for preload isolation.
    expect(mainSource).toMatch(/contextIsolation\s*:\s*true/)
  })

  it('nodeIntegration is not set to true (defaults to false)', () => {
    // nodeIntegration: true would expose the full Node.js API in the renderer — never safe.
    expect(mainSource).not.toMatch(/nodeIntegration\s*:\s*true/)
  })

  it('webSecurity: false has a defensive comment explaining the klip:// protocol justification', () => {
    // webSecurity: false is required only so the renderer can load local media via the
    // klip:// custom protocol without cross-origin tainting.  The comment must be present
    // so future reviewers understand the intent and don't silently widen scope.
    expect(mainSource).toMatch(/webSecurity\s*:\s*false/)
    // Comment must explain the limited scope (klip:// or local media)
    expect(mainSource).toMatch(/klip:\/\/|local media|local file/)
  })

})

// =============================================================================
// §10.2 — Preload surface (static analysis)
// =============================================================================

describe('10.2 — Preload surface', () => {

  let preloadSource: string

  beforeAll(() => {
    preloadSource = readFileSync(src('preload', 'index.ts'), 'utf-8')
  })

  it('contextBridge never exposes raw ipcRenderer to the renderer', () => {
    // Exposing the raw ipcRenderer object would let renderer JS send arbitrary
    // IPC messages — bypassing every handler-level access control.
    const exposeCalls = preloadSource.match(/exposeInMainWorld\(['"`]([^'"`,]+)['"`]/g) ?? []
    const exposedNames = exposeCalls.map((m) => m.match(/['"`]([^'"`,]+)['"`]/)![1])
    expect(exposedNames).not.toContain('ipcRenderer')
  })

  it('setWindowOpenHandler validates URLs before calling shell.openExternal', () => {
    // Without URL validation, a page could trigger shell.openExternal('file:///etc/passwd')
    // or shell.openExternal('javascript:...') which execute arbitrary code outside the sandbox.
    const handlerSource = readFileSync(src('main', 'index.ts'), 'utf-8')
    // The handler must call the validator before openExternal
    const handlerBlock = handlerSource.match(/setWindowOpenHandler[\s\S]*?return \{ action: 'deny' \}/)?.[0] ?? ''
    expect(handlerBlock).toMatch(/isAllowedExternalUrl/)
    // isAllowedExternalUrl must appear BEFORE shell.openExternal in the handler
    const validatorPos  = handlerBlock.indexOf('isAllowedExternalUrl')
    const openExternalPos = handlerBlock.indexOf('shell.openExternal')
    expect(validatorPos).toBeLessThan(openExternalPos)
  })

})

// =============================================================================
// §10.3 — URL filtering (functional)
// =============================================================================

// isAllowedExternalUrl is a pure function — import directly (no Electron needed)
import { isAllowedExternalUrl } from '../../main/security'

describe('10.3 — isAllowedExternalUrl', () => {

  it('allows https:// and http:// URLs', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(true)
    expect(isAllowedExternalUrl('https://example.com/path?q=1#hash')).toBe(true)
    expect(isAllowedExternalUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedExternalUrl('http://192.168.1.1/page')).toBe(true)
  })

  it('blocks file://, javascript:, data:, and malformed strings', () => {
    // Each of these could be used to access local files, execute JS, or load
    // embedded HTML — none should ever reach shell.openExternal.
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('file://C:/Users/sensitive/document.txt')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('data:text/html,<h1>phish</h1>')).toBe(false)
    expect(isAllowedExternalUrl('ftp://ftp.example.com/file')).toBe(false)
    expect(isAllowedExternalUrl('')).toBe(false)
    expect(isAllowedExternalUrl('not a url at all')).toBe(false)
  })

})

// =============================================================================
// §10.4 — Export path safety (functional)
// =============================================================================

import { isExportPathSafe } from '../../main/security'

describe('10.4 — isExportPathSafe', () => {

  it('rejects relative paths and directory traversal payloads', () => {
    // Relative path — renderer could escape any expected output folder.
    expect(isExportPathSafe('../../../evil.mp4')).toBe(false)
    expect(isExportPathSafe('relative/output.mp4')).toBe(false)
    expect(isExportPathSafe('')).toBe(false)

    // Absolute path with traversal segments — could write outside chosen dir.
    expect(isExportPathSafe('/var/data/../../../etc/passwd')).toBe(false)
    expect(isExportPathSafe('/home/user/videos/../../secrets/key.pem')).toBe(false)
  })

  it('accepts legitimate absolute output paths', () => {
    expect(isExportPathSafe('/home/user/Videos/my-edit.mp4')).toBe(true)
    expect(isExportPathSafe('/tmp/output.mp4')).toBe(true)
    expect(isExportPathSafe('/media/external-drive/exports/final.mp4')).toBe(true)
  })

})

// =============================================================================
// §10.5 — FFmpeg path: custom path only used when file exists
// =============================================================================

// String literal required — vi.mock is hoisted before const initializers run
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/klip-security-test-ffmpeg') },
}))

const FFMPEG_TEST_DIR = '/tmp/klip-security-test-ffmpeg'

vi.mock('ffmpeg-static', () => '/usr/local/bin/ffmpeg-bundled')

import { getFFmpegPath } from '../../main/ffmpegExport'

describe('10.5 — getFFmpegPath: custom path validation', () => {

  beforeAll(() => {
    mkdirSync(FFMPEG_TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(FFMPEG_TEST_DIR, { recursive: true, force: true })
  })

  it('does not return a custom FFmpeg path that does not exist on disk', () => {
    // Write a config file pointing to a non-existent binary.
    // The function must NOT return this path — accepting it blindly would let
    // a compromised config file redirect FFmpeg to an arbitrary executable.
    const configPath = join(FFMPEG_TEST_DIR, 'klip-config.json')
    writeFileSync(configPath, JSON.stringify({
      customFfmpegPath: '/nonexistent/path/to/evil-ffmpeg.exe'
    }))

    const result = getFFmpegPath()
    expect(result).not.toBe('/nonexistent/path/to/evil-ffmpeg.exe')
  })

})

// =============================================================================
// §10.6 — Autosave path is inside userData, not OS temp
// =============================================================================

describe('10.6 — Autosave path isolation (static analysis)', () => {

  it('AUTOSAVE_FILE is constructed from app.getPath("userData"), not os.tmpdir()', () => {
    const handlerSource = readFileSync(src('main', 'ipc', 'projectHandlers.ts'), 'utf-8')

    // Must use app.getPath('userData') — not os.tmpdir(), app.getPath('temp'), or /tmp
    expect(handlerSource).toMatch(/app\.getPath\(['"]userData['"]\)/)

    // Must NOT use the OS temp directory for the autosave file
    expect(handlerSource).not.toMatch(/os\.tmpdir\(\)|app\.getPath\(['"]temp['"]\)|[^a-z]\/tmp\//)
  })

})

// =============================================================================
// §10.7 — No console.log of project data in main-process handlers
// =============================================================================

describe('10.7 — No console.log leaking project file contents', () => {

  it('main-process IPC handlers do not call console.log (only console.error allowed)', () => {
    // console.log in production main-process code risks writing project paths,
    // file contents, or autosave data to stdout where it could be captured.
    const handlerFiles = [
      src('main', 'ipc', 'projectHandlers.ts'),
      src('main', 'ipc', 'exportHandlers.ts'),
      src('main', 'ipc', 'mediaHandlers.ts'),
    ]

    for (const filePath of handlerFiles) {
      const content = readFileSync(filePath, 'utf-8')
      // Strip single-line comments so `// console.log(...)` doesn't trigger
      const stripped = content.replace(/\/\/[^\n]*/g, '')
      expect(stripped, `${filePath} contains console.log`).not.toMatch(/console\.log\s*\(/)
    }
  })

})
