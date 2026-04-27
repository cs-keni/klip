/**
 * Vitest global test setup.
 *
 * Runs once before every test file.  Provides:
 *   - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 *   - A complete window.api mock that mirrors every method in preload/index.ts
 *   - Per-test reset: fresh mock instances + localStorage cleared
 *   - console.error silenced by default (spy available per-test if needed)
 */
import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach, expect } from 'vitest'
import { toHaveNoViolations } from 'jest-axe'

// Extend expect with jest-axe's custom matcher (works in both jsdom and node envs)
expect.extend(toHaveNoViolations)

// ── window.api mock factory ────────────────────────────────────────────────────
// Mirrors the full surface of src/preload/index.ts.
// Tests that care about specific return values should override via:
//   vi.mocked(window.api.project.getRecent).mockResolvedValueOnce([...])

function buildApiMock() {
  return {
    window: {
      minimize:                vi.fn(),
      maximize:                vi.fn(),
      close:                   vi.fn(),
      isMaximized:             vi.fn().mockResolvedValue(false),
      onMaximizedChanged:      vi.fn(),
      removeMaximizedListener: vi.fn(),
    },
    media: {
      openDialog:       vi.fn().mockResolvedValue([]),
      getFileInfo:      vi.fn().mockResolvedValue({ size: 0 }),
      checkFilesExist:  vi.fn().mockResolvedValue({}),
      revealInExplorer: vi.fn(),
      pickFile:         vi.fn().mockResolvedValue(null),
      extractFrame:     vi.fn().mockResolvedValue(null),
    },
    project: {
      getRecent:     vi.fn().mockResolvedValue([]),
      save:          vi.fn().mockResolvedValue(null),
      saveAs:        vi.fn().mockResolvedValue(null),
      open:          vi.fn().mockResolvedValue(null),
      autosave:      vi.fn().mockResolvedValue(undefined),
      checkAutosave: vi.fn().mockResolvedValue(null),   // null = no autosave = no recovery dialog
      clearAutosave: vi.fn().mockResolvedValue(undefined),
    },
    export: {
      pickOutputFolder:       vi.fn().mockResolvedValue(null),
      start:                  vi.fn().mockResolvedValue(undefined),
      cancel:                 vi.fn(),
      onProgress:             vi.fn().mockReturnValue(() => {}),
      onDone:                 vi.fn().mockReturnValue(() => {}),
      onError:                vi.fn().mockReturnValue(() => {}),
      quickPreview:           vi.fn(),
      cancelQuickPreview:     vi.fn(),
      onQuickPreviewProgress: vi.fn().mockReturnValue(() => {}),
      onQuickPreviewDone:     vi.fn().mockReturnValue(() => {}),
      onQuickPreviewError:    vi.fn().mockReturnValue(() => {}),
      saveFrame:              vi.fn().mockResolvedValue(null),
    },
    waveform: {
      extract:         vi.fn().mockResolvedValue(null),
      analyzeLoudness: vi.fn().mockResolvedValue(null),
    },
    settings: {
      proxyCacheInfo:   vi.fn().mockResolvedValue({ count: 0, totalBytes: 0 }),
      clearProxyCache:  vi.fn().mockResolvedValue(0),
      getFfmpegPath:    vi.fn().mockResolvedValue(null),
      setFfmpegPath:    vi.fn().mockResolvedValue(undefined),
      pickFfmpegBinary: vi.fn().mockResolvedValue(null),
    },
    proxy: {
      generateProxy:     vi.fn(),
      cancelProxy:       vi.fn(),
      cancelAll:         vi.fn(),
      checkProxy:        vi.fn().mockResolvedValue(null),
      checkProxiesBatch: vi.fn().mockResolvedValue({}),
      onProgress:        vi.fn().mockReturnValue(() => {}),
      onDone:            vi.fn().mockReturnValue(() => {}),
      onError:           vi.fn().mockReturnValue(() => {}),
    },
  }
}

// Assign a fresh mock before each test so call history never leaks between tests.
// Guard: these globals don't exist in the Node (IPC) test environment.
if (typeof window !== 'undefined') {
  beforeEach(() => {
    ;(window as unknown as Record<string, unknown>).api = buildApiMock()
    // Wipe Zustand persist data so store hydration always starts from defaults.
    localStorage.clear()
  })

  // ── clipboard ────────────────────────────────────────────────────────────────
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  })

  // ── DOM method stubs ──────────────────────────────────────────────────────────
  // jsdom does not implement scrollIntoView — stub it so components that call it
  // (e.g. the CommandPalette active-item scroller) don't throw in tests.
  Element.prototype.scrollIntoView = vi.fn()

  // jsdom does not implement ResizeObserver — stub it so components that use it
  // (e.g. PreviewPanel's canvas height measurement) don't throw in tests.
  if (!('ResizeObserver' in window)) {
    ;(window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}

// ── console.error silencer ─────────────────────────────────────────────────────
// React logs caught ErrorBoundary errors and act() warnings to console.error.
// Silence by default; individual tests can spy on it if they care.
let _origError: typeof console.error

beforeEach(() => {
  _origError = console.error
  console.error = vi.fn()
})

afterEach(() => {
  console.error = _origError
})
