/**
 * Phase 3 §3.21–3.23 — Hook Tests
 *
 * §3.21  useProjectIO  — dirty tracking, keyboard shortcuts, auto-save
 * §3.22  useWaveform   — peaks loading, memory cache, error handling
 * §3.23  useProxyEvents — IPC event → mediaStore bridge, cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import { useProjectIO }   from '@/hooks/useProjectIO'
import { useWaveform }    from '@/hooks/useWaveform'
import { useProxyEvents } from '@/hooks/useProxyEvents'
import { saveProject, saveProjectAs } from '@/lib/projectIO'
import { useProjectStore }  from '@/stores/projectStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore }    from '@/stores/mediaStore'
import type { MediaClip }   from '@/types/media'

// Mock the pure IO functions so keyboard shortcut tests never make real IPC calls.
// The factory spreads the actual module so serializeProject (used by autosave) is real.
vi.mock('@/lib/projectIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/projectIO')>()
  return {
    ...actual,
    saveProject:   vi.fn().mockResolvedValue(true),
    saveProjectAs: vi.fn().mockResolvedValue(true),
  }
})

// ── Shared fixture ────────────────────────────────────────────────────────────

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id:              'clip-1',
    type:            'video',
    path:            '/test/clip.mp4',
    name:            'Test Clip',
    duration:        60,
    width:           1920,
    height:          1080,
    fps:             30,
    fileSize:        100_000,
    thumbnail:       null,
    thumbnailStatus: 'idle',
    isOnTimeline:    false,
    isMissing:       false,
    addedAt:         1000,
    proxyStatus:     'none',
    proxyProgress:   0,
    proxyPath:       null,
    ...overrides,
  }
}

// =============================================================================
// §3.21  useProjectIO
// =============================================================================

describe('3.21 useProjectIO', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(saveProject).mockClear()
    vi.mocked(saveProjectAs).mockClear()
    // Start each test with a clean project state
    useProjectStore.setState({
      hasUnsavedChanges: false,
      projectPath:       null,
      projectName:       null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounting does not immediately mark the project dirty', () => {
    renderHook(() => useProjectIO())
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('timeline change after the 500ms liveness guard sets hasUnsavedChanges', () => {
    renderHook(() => useProjectIO())

    // Advance past the isLiveRef guard so the subscribe callback becomes active
    act(() => { vi.advanceTimersByTime(501) })

    // Mutate the timeline (new array reference triggers the subscription)
    act(() => { useTimelineStore.setState({ clips: [] }) })

    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('timeline change within the first 500ms does NOT set hasUnsavedChanges', () => {
    renderHook(() => useProjectIO())

    // Mutate immediately — isLiveRef.current is still false
    act(() => { useTimelineStore.setState({ clips: [] }) })

    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('Ctrl+S dispatches saveProject', () => {
    renderHook(() => useProjectIO())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    })

    expect(saveProject).toHaveBeenCalledOnce()
    expect(saveProjectAs).not.toHaveBeenCalled()
  })

  it('Ctrl+S calls saveProject regardless of whether a project path is set', () => {
    // The hook always calls saveProject on Ctrl+S; saveProject handles path=null
    // internally by passing it to the IPC handler which opens a dialog.
    useProjectStore.setState({ projectPath: null })
    renderHook(() => useProjectIO())

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    })

    expect(saveProject).toHaveBeenCalledOnce()
    expect(saveProjectAs).not.toHaveBeenCalled()
  })

  it('Ctrl+Shift+S always calls saveProjectAs regardless of existing path', () => {
    useProjectStore.setState({ projectPath: '/projects/my-project.klip' })
    renderHook(() => useProjectIO())

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true })
      )
    })

    expect(saveProjectAs).toHaveBeenCalledOnce()
    expect(saveProject).not.toHaveBeenCalled()
  })

  it('auto-save calls window.api.project.autosave when hasUnsavedChanges and projectName are set', () => {
    useProjectStore.setState({ hasUnsavedChanges: true, projectName: 'My Project' })
    renderHook(() => useProjectIO())

    act(() => { vi.advanceTimersByTime(2 * 60 * 1000 + 1) })

    expect(window.api.project.autosave).toHaveBeenCalledOnce()
  })

  it('auto-save does NOT fire when hasUnsavedChanges is false', () => {
    useProjectStore.setState({ hasUnsavedChanges: false, projectName: 'My Project' })
    renderHook(() => useProjectIO())

    act(() => { vi.advanceTimersByTime(2 * 60 * 1000 + 1) })

    expect(window.api.project.autosave).not.toHaveBeenCalled()
  })
})

// =============================================================================
// §3.22  useWaveform
// =============================================================================

describe('3.22 useWaveform', () => {
  it('returns { peaks: null, loading: false } immediately when filePath is null', () => {
    const { result } = renderHook(() => useWaveform(null, 'audio'))
    expect(result.current).toEqual({ peaks: null, loading: false })
  })

  it('returns { peaks: null, loading: true } on initial mount before data loads', () => {
    // Return a promise that never resolves so loading stays true throughout the test
    vi.mocked(window.api.waveform.extract).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() =>
      useWaveform('/test-wf-loading.mp4', 'video', 'clip-loading')
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.peaks).toBeNull()
  })

  it('returns { peaks: Float32Array, loading: false } after a successful extract', async () => {
    vi.mocked(window.api.waveform.extract).mockResolvedValueOnce([0.1, 0.5, 0.3])

    const { result } = renderHook(() =>
      useWaveform('/test-wf-success.mp4', 'video', 'clip-success')
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.peaks).toBeInstanceOf(Float32Array)
    expect(result.current.peaks?.length).toBe(3)
  })

  it('second mount for the same filePath returns cached peaks without re-fetching', async () => {
    const path = '/test-wf-cache.mp4'

    // First render: resolve extract so the module-level peaksCache is populated
    vi.mocked(window.api.waveform.extract).mockResolvedValueOnce([0.2, 0.4, 0.6])
    const { result: r1, unmount } = renderHook(() =>
      useWaveform(path, 'video', 'clip-cache')
    )
    await waitFor(() => expect(r1.current.loading).toBe(false))
    unmount()

    vi.mocked(window.api.waveform.extract).mockClear()

    // Second render: cache hit — extract must NOT be called again
    const { result: r2 } = renderHook(() =>
      useWaveform(path, 'video', 'clip-cache')
    )
    await act(async () => {})

    expect(window.api.waveform.extract).not.toHaveBeenCalled()
    expect(r2.current.peaks).toBeInstanceOf(Float32Array)
    expect(r2.current.loading).toBe(false)
  })

  it('returns { peaks: null, loading: false } when extract returns null (failure)', async () => {
    // Default mock already returns null, but make the intent explicit
    vi.mocked(window.api.waveform.extract).mockResolvedValueOnce(null)

    const { result } = renderHook(() =>
      useWaveform('/test-wf-null.mp4', 'video', 'clip-null')
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.peaks).toBeNull()
  })

  it('changing filePath resets loading to true and triggers a new fetch', async () => {
    // Both paths point to never-resolving extracts so loading stays true
    vi.mocked(window.api.waveform.extract).mockReturnValue(new Promise(() => {}))

    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useWaveform(path, 'video', 'clip-rerender'),
      { initialProps: { path: '/test-wf-change-a.mp4' } }
    )

    expect(result.current.loading).toBe(true)

    // Switch to a different path
    rerender({ path: '/test-wf-change-b.mp4' })
    await act(async () => {})

    expect(result.current.loading).toBe(true)
    expect(result.current.peaks).toBeNull()
    // extract was called for both paths (one pending call each)
    expect(window.api.waveform.extract).toHaveBeenCalledTimes(2)
  })
})

// =============================================================================
// §3.23  useProxyEvents
// =============================================================================

describe('3.23 useProxyEvents', () => {
  beforeEach(() => {
    useMediaStore.setState({
      clips:          [makeMediaClip({ id: 'proxy-clip', type: 'video' })],
      selectedClipId: null,
    })
  })

  it('subscribes to proxy:progress, proxy:done, and proxy:error events on mount', () => {
    renderHook(() => useProxyEvents())

    expect(window.api.proxy.onProgress).toHaveBeenCalledOnce()
    expect(window.api.proxy.onDone).toHaveBeenCalledOnce()
    expect(window.api.proxy.onError).toHaveBeenCalledOnce()
  })

  it('proxy:progress event updates clip proxyStatus and proxyProgress in mediaStore', () => {
    let progressCb!: (ev: { clipId: string; progress: number }) => void
    vi.mocked(window.api.proxy.onProgress).mockImplementation((cb) => {
      progressCb = cb
      return vi.fn()
    })

    renderHook(() => useProxyEvents())

    act(() => { progressCb({ clipId: 'proxy-clip', progress: 0.5 }) })

    const clip = useMediaStore.getState().clips.find((c) => c.id === 'proxy-clip')
    expect(clip?.proxyStatus).toBe('generating')
    expect(clip?.proxyProgress).toBe(0.5)
  })

  it('proxy:done event sets proxyStatus to ready and records proxyPath on the correct clip', () => {
    let doneCb!: (ev: { clipId: string; proxyPath: string }) => void
    vi.mocked(window.api.proxy.onDone).mockImplementation((cb) => {
      doneCb = cb
      return vi.fn()
    })

    renderHook(() => useProxyEvents())

    act(() => { doneCb({ clipId: 'proxy-clip', proxyPath: '/proxies/proxy-clip.mp4' }) })

    const clip = useMediaStore.getState().clips.find((c) => c.id === 'proxy-clip')
    expect(clip?.proxyStatus).toBe('ready')
    expect(clip?.proxyPath).toBe('/proxies/proxy-clip.mp4')
  })

  it('unsubscribes from all three proxy events on unmount', () => {
    const unsubProgress = vi.fn()
    const unsubDone     = vi.fn()
    const unsubError    = vi.fn()

    vi.mocked(window.api.proxy.onProgress).mockReturnValue(unsubProgress)
    vi.mocked(window.api.proxy.onDone).mockReturnValue(unsubDone)
    vi.mocked(window.api.proxy.onError).mockReturnValue(unsubError)

    const { unmount } = renderHook(() => useProxyEvents())
    unmount()

    expect(unsubProgress).toHaveBeenCalledOnce()
    expect(unsubDone).toHaveBeenCalledOnce()
    expect(unsubError).toHaveBeenCalledOnce()
  })
})
