/**
 * Phase 1 — Unit: projectIO.ts (§1.6)
 *
 * Tests serializeProject() directly (reads from Zustand stores) and the full
 * serialize → deserialize round-trip via openProject() (which calls the
 * private deserializeProject internally, with window.api.project.open mocked).
 *
 * No file system, no IPC beyond the mocked window.api surface.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { serializeProject, openProject, restoreAutosave } from '@/lib/projectIO'
import { useProjectStore }  from '@/stores/projectStore'
import { useMediaStore }    from '@/stores/mediaStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useAppStore }      from '@/stores/appStore'
import type { MediaClip }   from '@/types/media'
import type { TimelineClip, Track, Transition, TimelineMarker } from '@/types/timeline'

// ── Fixture factories ──────────────────────────────────────────────────────────

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'm1', type: 'video', path: '/clip.mp4', name: 'Clip',
    duration: 10, width: 1920, height: 1080, fps: 30,
    fileSize: 1_000_000,
    thumbnail: 'data:image/jpeg;base64,abc123',   // should be stripped on serialize
    thumbnailStatus: 'ready',
    isOnTimeline: true, isMissing: false, addedAt: 1000,
    proxyStatus: 'none', proxyProgress: 0, proxyPath: null,
    ...overrides
  }
}

function makeTimelineClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'tc1', mediaClipId: 'm1', trackId: 'v1',
    startTime: 0, duration: 10, trimStart: 0,
    type: 'video', name: 'Clip', thumbnail: 'data:image/jpeg;base64,abc',
    ...overrides
  }
}

// ── Store reset ────────────────────────────────────────────────────────────────

beforeEach(() => {
  useProjectStore.setState({
    projectName: null, projectPath: null,
    hasUnsavedChanges: false,
    settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
  })
  useMediaStore.setState({ clips: [], selectedClipId: null })
  useTimelineStore.setState({
    tracks: [],
    clips: [],
    transitions: [],
    markers: [],
    selectedClipId: null,
    selectedClipIds: [],
    clipboard: null,
    playheadTime: 0,
    isPlaying: false,
    loopIn: null,
    loopOut: null,
    loopEnabled: false,
    past: [],
    future: []
  })
  useAppStore.setState({ view: 'welcome' })
})

// =============================================================================
// serializeProject()
// =============================================================================

describe('serializeProject', () => {
  it('returns a JSON-serializable object (no circular refs, no functions)', () => {
    expect(() => JSON.stringify(serializeProject())).not.toThrow()
  })

  it('includes a version field', () => {
    const data = serializeProject() as Record<string, unknown>
    expect(data.version).toBeDefined()
  })

  it('includes a savedAt ISO timestamp', () => {
    const data = serializeProject() as Record<string, unknown>
    expect(typeof data.savedAt).toBe('string')
    expect(new Date(data.savedAt as string).getTime()).not.toBeNaN()
  })

  it('includes settings from projectStore', () => {
    useProjectStore.setState({ settings: { resolution: '4k', frameRate: 30, aspectRatio: '16:9' } })
    const data = serializeProject() as Record<string, unknown>
    expect((data.settings as Record<string, unknown>).resolution).toBe('4k')
    expect((data.settings as Record<string, unknown>).frameRate).toBe(30)
  })

  it('strips base64 thumbnails from media clips (thumbnails are regenerable)', () => {
    useMediaStore.setState({ clips: [makeMediaClip()], selectedClipId: null })
    const data = serializeProject() as Record<string, unknown>
    const mediaClips = data.mediaClips as Array<Record<string, unknown>>
    expect(mediaClips[0].thumbnail).toBeNull()
  })

  it('resets thumbnailStatus to "idle" when stripping thumbnails', () => {
    useMediaStore.setState({ clips: [makeMediaClip({ thumbnailStatus: 'ready' })], selectedClipId: null })
    const data = serializeProject() as Record<string, unknown>
    const mediaClips = data.mediaClips as Array<Record<string, unknown>>
    expect(mediaClips[0].thumbnailStatus).toBe('idle')
  })

  it('strips thumbnail from timeline clips too', () => {
    useTimelineStore.setState({ clips: [makeTimelineClip()], tracks: [], transitions: [], markers: [], past: [], future: [] })
    const data = serializeProject() as Record<string, unknown>
    const timelineClips = data.timelineClips as Array<Record<string, unknown>>
    expect(timelineClips[0].thumbnail).toBeNull()
  })

  it('empty project (no clips) serializes without error', () => {
    const data = serializeProject() as Record<string, unknown>
    expect(data.mediaClips).toEqual([])
    expect(data.timelineClips).toEqual([])
  })

  it('includes tracks, transitions, and markers arrays', () => {
    const data = serializeProject() as Record<string, unknown>
    expect(Array.isArray(data.tracks)).toBe(true)
    expect(Array.isArray(data.transitions)).toBe(true)
    expect(Array.isArray(data.markers)).toBe(true)
  })
})

// =============================================================================
// Full round-trip via openProject()
// =============================================================================

describe('openProject — deserialises state into stores', () => {
  it('restores projectName and settings from the project file', async () => {
    const projectData = {
      version: 1, name: 'My Film', savedAt: new Date().toISOString(),
      settings: { resolution: '1440p', frameRate: 24, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/my-film.klip' })
    await openProject('/my-film.klip')
    const s = useProjectStore.getState()
    expect(s.projectName).toBe('My Film')
    expect(s.projectPath).toBe('/my-film.klip')
    expect(s.settings.resolution).toBe('1440p')
    expect(s.settings.frameRate).toBe(24)
  })

  it('restores media clips', async () => {
    const clip = makeMediaClip({ id: 'mc1', thumbnail: null, thumbnailStatus: 'idle' })
    const projectData = {
      version: 1, name: 'Test', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [clip], tracks: [], timelineClips: [], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject('/t.klip')
    expect(useMediaStore.getState().clips).toHaveLength(1)
    expect(useMediaStore.getState().clips[0].id).toBe('mc1')
  })

  it('restores timeline clips and tracks', async () => {
    const tracks: Track[] = [
      { id: 'v1', type: 'video', name: 'Video 1', isLocked: false, isMuted: false, isSolo: false }
    ]
    const clip = makeTimelineClip({ id: 'tc1', thumbnail: null })
    const projectData = {
      version: 1, name: 'Test', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks, timelineClips: [clip], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject('/t.klip')
    const ts = useTimelineStore.getState()
    expect(ts.tracks).toHaveLength(1)
    expect(ts.clips).toHaveLength(1)
    expect(ts.clips[0].id).toBe('tc1')
  })

  it('restores transitions', async () => {
    const transition: Transition = {
      id: 'tr1', fromClipId: 'a', toClipId: 'b', type: 'fade', duration: 0.5
    }
    const projectData = {
      version: 1, name: 'T', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [transition], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject()
    expect(useTimelineStore.getState().transitions).toHaveLength(1)
    expect(useTimelineStore.getState().transitions[0].type).toBe('fade')
  })

  it('restores markers', async () => {
    const marker: TimelineMarker = { id: 'mk1', time: 10, label: 'Scene 2', color: '#f59e0b' }
    const projectData = {
      version: 1, name: 'T', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [], markers: [marker]
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject()
    expect(useTimelineStore.getState().markers).toHaveLength(1)
    expect(useTimelineStore.getState().markers[0].label).toBe('Scene 2')
  })

  it('resets undo/redo history on open (past and future are empty)', async () => {
    const projectData = {
      version: 1, name: 'T', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject()
    const ts = useTimelineStore.getState()
    expect(ts.past).toHaveLength(0)
    expect(ts.future).toHaveLength(0)
  })

  it('openProject returns false when the API returns null (dialog cancelled)', async () => {
    vi.mocked(window.api.project.open).mockResolvedValueOnce(null)
    const result = await openProject()
    expect(result).toBe(false)
  })

  it('missing optional field (no markers) does not crash', async () => {
    const projectData = {
      version: 1, name: 'Old', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: []
      // markers intentionally absent
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await expect(openProject()).resolves.toBe(true)
    expect(useTimelineStore.getState().markers).toEqual([])
  })

  it('clip textSettings (nested object) survives the round-trip', async () => {
    const textClip = makeTimelineClip({
      id: 'tc-text', type: 'text', thumbnail: null,
      textSettings: {
        content: 'Hello World', fontSize: 48, fontFamily: 'Arial',
        fontColor: '#ffffff', bgColor: 'transparent',
        bold: true, italic: false, alignment: 'center',
        positionX: 0.5, positionY: 0.8, animationPreset: 'fade-in'
      }
    })
    const projectData = {
      version: 1, name: 'T', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [textClip], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject()
    const restored = useTimelineStore.getState().clips[0]
    expect(restored.textSettings?.content).toBe('Hello World')
    expect(restored.textSettings?.animationPreset).toBe('fade-in')
  })

  it('clip colorSettings and cropSettings survive the round-trip', async () => {
    const videoClip = makeTimelineClip({
      id: 'tc-v', thumbnail: null,
      colorSettings: { brightness: 0.2, contrast: -0.1, saturation: 0.5 },
      cropSettings: { zoom: 2.0, panX: 0.3, panY: -0.1 }
    })
    const projectData = {
      version: 1, name: 'T', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [videoClip], transitions: [], markers: []
    }
    vi.mocked(window.api.project.open).mockResolvedValueOnce({ data: projectData, path: '/t.klip' })
    await openProject()
    const restored = useTimelineStore.getState().clips[0]
    expect(restored.colorSettings?.brightness).toBe(0.2)
    expect(restored.cropSettings?.zoom).toBe(2.0)
  })
})

// =============================================================================
// restoreAutosave()
// =============================================================================

describe('restoreAutosave', () => {
  it('returns false when no autosave exists (API returns null)', async () => {
    vi.mocked(window.api.project.checkAutosave).mockResolvedValueOnce(null)
    const result = await restoreAutosave()
    expect(result).toBe(false)
  })

  it('returns true and restores state when autosave exists', async () => {
    const autosaveData = {
      version: 1, name: 'Recovered', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [], markers: [],
      _projectPath: '/recovered.klip'
    }
    vi.mocked(window.api.project.checkAutosave).mockResolvedValueOnce({ data: autosaveData })
    const result = await restoreAutosave()
    expect(result).toBe(true)
    expect(useProjectStore.getState().projectName).toBe('Recovered')
  })

  it('marks hasUnsavedChanges=true after autosave restore (it is a recovery, not a clean save)', async () => {
    const autosaveData = {
      version: 1, name: 'R', savedAt: new Date().toISOString(),
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
      mediaClips: [], tracks: [], timelineClips: [], transitions: [], markers: []
    }
    vi.mocked(window.api.project.checkAutosave).mockResolvedValueOnce({ data: autosaveData })
    await restoreAutosave()
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true)
  })
})
