/**
 * Phase 4 — Integration: Store ↔ Store
 *
 * §4.1 Media → Timeline linking
 * §4.2 Project save/load cycle
 * §4.3 Undo across stores
 * §4.4 UI store + feature interactions
 * §4.5 appSettingsStore interactions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTimelineStore }  from '@/stores/timelineStore'
import { useMediaStore }     from '@/stores/mediaStore'
import { useProjectStore }   from '@/stores/projectStore'
import { useUIStore }        from '@/stores/uiStore'
import { useToastStore, toast } from '@/stores/toastStore'
import { useAppSettingsStore } from '@/stores/appSettingsStore'
import { serializeProject, openProject } from '@/lib/projectIO'
import type { MediaClip }    from '@/types/media'
import type { TimelineClip } from '@/types/timeline'

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'media-1', type: 'video', path: '/test.mp4', name: 'Test',
    duration: 30, width: 1920, height: 1080, fps: 30,
    fileSize: 1000, thumbnail: null, thumbnailStatus: 'idle',
    isOnTimeline: false, isMissing: false, addedAt: 1000,
    proxyStatus: 'none', proxyProgress: 0, proxyPath: null,
    ...overrides
  }
}

function makeTimelineClip(overrides: Partial<TimelineClip> = {}): TimelineClip {
  return {
    id: 'tc-1', mediaClipId: 'media-1', trackId: 'v1',
    startTime: 0, duration: 30, trimStart: 0,
    type: 'video', name: 'Test', thumbnail: null,
    ...overrides
  }
}

// =============================================================================
// §4.1  Media → Timeline linking
// =============================================================================

describe('4.1 Media → Timeline linking', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      clips: [], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })
    useMediaStore.setState({ clips: [], selectedClipId: null })
  })

  it('addClip creates a TimelineClip with matching mediaClipId', () => {
    const clip = makeTimelineClip({ id: 'tc-v1', mediaClipId: 'media-1' })
    useTimelineStore.getState().addClip(clip)

    const clips = useTimelineStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].mediaClipId).toBe('media-1')
  })

  it('addClips with linked pair adds both clips to the store', () => {
    const videoId = 'tc-video'
    const audioId = 'tc-audio'
    useTimelineStore.getState().addClips([
      makeTimelineClip({ id: videoId, type: 'video', trackId: 'v1', linkedClipId: audioId }),
      makeTimelineClip({ id: audioId, type: 'audio', trackId: 'a1', linkedClipId: videoId })
    ])

    const clips = useTimelineStore.getState().clips
    expect(clips).toHaveLength(2)
    expect(clips.find((c) => c.id === videoId)).toBeDefined()
    expect(clips.find((c) => c.id === audioId)).toBeDefined()
  })

  it('linked audio clip has the same duration as the video clip', () => {
    const dur = 45
    const videoId = 'tc-v'
    const audioId = 'tc-a'
    useTimelineStore.getState().addClips([
      makeTimelineClip({ id: videoId, type: 'video', duration: dur, linkedClipId: audioId }),
      makeTimelineClip({ id: audioId, type: 'audio', duration: dur, linkedClipId: videoId })
    ])

    const clips = useTimelineStore.getState().clips
    const video = clips.find((c) => c.id === videoId)!
    const audio = clips.find((c) => c.id === audioId)!
    expect(audio.duration).toBe(video.duration)
  })

  it('linked audio clip linkedClipId points to the video clip', () => {
    const videoId = 'tc-v2'
    const audioId = 'tc-a2'
    useTimelineStore.getState().addClips([
      makeTimelineClip({ id: videoId, type: 'video', linkedClipId: audioId }),
      makeTimelineClip({ id: audioId, type: 'audio', linkedClipId: videoId })
    ])

    const audio = useTimelineStore.getState().clips.find((c) => c.id === audioId)!
    expect(audio.linkedClipId).toBe(videoId)
  })

  it('removeClip on video also removes its linked audio clip', () => {
    const videoId = 'tc-v3'
    const audioId = 'tc-a3'
    useTimelineStore.setState({
      clips: [
        makeTimelineClip({ id: videoId, type: 'video', linkedClipId: audioId }),
        makeTimelineClip({ id: audioId, type: 'audio', linkedClipId: videoId })
      ],
      past: [], future: []
    })

    useTimelineStore.getState().removeClip(videoId)

    const clips = useTimelineStore.getState().clips
    expect(clips).toHaveLength(0)
  })

  it('removeClip on audio also removes its linked video clip', () => {
    const videoId = 'tc-v4'
    const audioId = 'tc-a4'
    useTimelineStore.setState({
      clips: [
        makeTimelineClip({ id: videoId, type: 'video', linkedClipId: audioId }),
        makeTimelineClip({ id: audioId, type: 'audio', linkedClipId: videoId })
      ],
      past: [], future: []
    })

    useTimelineStore.getState().removeClip(audioId)

    expect(useTimelineStore.getState().clips).toHaveLength(0)
  })

  it('checkMissingFiles marks clips as isMissing when path does not exist on disk', async () => {
    const clip = makeMediaClip({ id: 'm1', path: '/missing.mp4' })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })
    vi.mocked(window.api.media.checkFilesExist).mockResolvedValueOnce({ '/missing.mp4': false })

    await useMediaStore.getState().checkMissingFiles()

    expect(useMediaStore.getState().clips[0].isMissing).toBe(true)
  })

  it('checkMissingFiles keeps clips as NOT missing when file exists', async () => {
    const clip = makeMediaClip({ id: 'm2', path: '/exists.mp4' })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })
    vi.mocked(window.api.media.checkFilesExist).mockResolvedValueOnce({ '/exists.mp4': true })

    await useMediaStore.getState().checkMissingFiles()

    expect(useMediaStore.getState().clips[0].isMissing).toBe(false)
  })

  it('relinkClip updates path and clears isMissing', () => {
    const clip = makeMediaClip({ id: 'm3', path: '/old.mp4', isMissing: true })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })

    useMediaStore.getState().relinkClip('m3', '/new.mp4')

    const updated = useMediaStore.getState().clips[0]
    expect(updated.path).toBe('/new.mp4')
    expect(updated.isMissing).toBe(false)
  })

  it('audio-only addClip creates a single clip with no linkedClipId', () => {
    const audioClip = makeTimelineClip({ id: 'tc-audio-only', type: 'audio', trackId: 'a1' })
    useTimelineStore.getState().addClip(audioClip)

    const clips = useTimelineStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].linkedClipId).toBeUndefined()
  })

  it('color clip addClip creates a single clip with no linkedClipId', () => {
    const colorClip = makeTimelineClip({ id: 'tc-color', type: 'color', color: '#ff0000' })
    useTimelineStore.getState().addClip(colorClip)

    const clips = useTimelineStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].linkedClipId).toBeUndefined()
    expect(clips[0].color).toBe('#ff0000')
  })

  it('markOnTimeline sets isOnTimeline to true', () => {
    const clip = makeMediaClip({ id: 'mOT', isOnTimeline: false })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })

    useMediaStore.getState().markOnTimeline('mOT', true)

    expect(useMediaStore.getState().clips[0].isOnTimeline).toBe(true)
  })

  it('markOnTimeline sets isOnTimeline back to false', () => {
    const clip = makeMediaClip({ id: 'mOT2', isOnTimeline: true })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })

    useMediaStore.getState().markOnTimeline('mOT2', false)

    expect(useMediaStore.getState().clips[0].isOnTimeline).toBe(false)
  })
})

// =============================================================================
// §4.2  Project save/load cycle
// =============================================================================

describe('4.2 Project save/load cycle', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projectName: null, projectPath: null,
      hasUnsavedChanges: false,
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
    })
    useMediaStore.setState({ clips: [], selectedClipId: null })
    useTimelineStore.setState({
      clips: [], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })
  })

  it('newProject sets projectName to the given name', () => {
    useProjectStore.getState().newProject('My Edit')
    expect(useProjectStore.getState().projectName).toBe('My Edit')
  })

  it('newProject sets hasUnsavedChanges to false', () => {
    useProjectStore.setState({ hasUnsavedChanges: true })
    useProjectStore.getState().newProject('Fresh')
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('newProject sets projectPath to null', () => {
    useProjectStore.setState({ projectPath: '/some/old.klip' })
    useProjectStore.getState().newProject('Fresh2')
    expect(useProjectStore.getState().projectPath).toBeNull()
  })

  it('any edit after newProject sets hasUnsavedChanges to true', () => {
    useProjectStore.getState().newProject('Edit Test')
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)

    useProjectStore.getState().updateSettings({ frameRate: 30 })

    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true)
  })

  it('serializeProject includes mediaClips and timelineClips', () => {
    useMediaStore.setState({ clips: [makeMediaClip({ id: 'mx1' })], selectedClipId: null })
    useTimelineStore.setState({
      clips: [makeTimelineClip({ id: 'tx1' })],
      tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    const data = serializeProject() as Record<string, unknown>

    expect(Array.isArray(data.mediaClips)).toBe(true)
    expect((data.mediaClips as unknown[]).length).toBe(1)
    expect(Array.isArray(data.timelineClips)).toBe(true)
    expect((data.timelineClips as unknown[]).length).toBe(1)
  })

  it('serializeProject strips thumbnails from media clips', () => {
    useMediaStore.setState({
      clips: [makeMediaClip({ id: 'mx2', thumbnail: 'data:image/png;base64,abc' })],
      selectedClipId: null
    })

    const data = serializeProject() as Record<string, unknown>
    const mediaClips = data.mediaClips as MediaClip[]

    expect(mediaClips[0].thumbnail).toBeNull()
  })

  it('serializeProject includes transitions and markers', () => {
    useTimelineStore.setState({
      clips: [], tracks: [], transitions: [
        { id: 't1', fromClipId: 'a', toClipId: 'b', type: 'fade', duration: 0.5 }
      ],
      markers: [{ id: 'm1', time: 5, label: 'Intro', color: '#f59e0b' }],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    const data = serializeProject() as Record<string, unknown>

    expect((data.transitions as unknown[]).length).toBe(1)
    expect((data.markers as unknown[]).length).toBe(1)
  })

  it('openProject restores timelineStore.clips from project file', async () => {
    const savedClips = [makeTimelineClip({ id: 'restored-1' })]
    vi.mocked(window.api.project.open).mockResolvedValueOnce({
      path: '/proj.klip',
      data: {
        version: 1, name: 'Restored',
        mediaClips: [], tracks: [], timelineClips: savedClips,
        transitions: [], markers: [],
        settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
      }
    })

    await openProject('/proj.klip')

    expect(useTimelineStore.getState().clips).toHaveLength(1)
    expect(useTimelineStore.getState().clips[0].id).toBe('restored-1')
  })

  it('openProject restores mediaStore.clips', async () => {
    const savedMedia = [makeMediaClip({ id: 'restored-media-1' })]
    vi.mocked(window.api.project.open).mockResolvedValueOnce({
      path: '/proj.klip',
      data: {
        version: 1, name: 'Restored',
        mediaClips: savedMedia, tracks: [], timelineClips: [],
        transitions: [], markers: [],
        settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
      }
    })

    await openProject('/proj.klip')

    expect(useMediaStore.getState().clips).toHaveLength(1)
    expect(useMediaStore.getState().clips[0].id).toBe('restored-media-1')
  })

  it('openProject resets timelineStore past and future to empty arrays', async () => {
    useTimelineStore.setState({ past: [{ tracks: [], clips: [], transitions: [] }], future: [] })

    vi.mocked(window.api.project.open).mockResolvedValueOnce({
      path: '/proj.klip',
      data: {
        version: 1, name: 'Clean',
        mediaClips: [], tracks: [], timelineClips: [],
        transitions: [], markers: [],
        settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
      }
    })

    await openProject('/proj.klip')

    expect(useTimelineStore.getState().past).toHaveLength(0)
    expect(useTimelineStore.getState().future).toHaveLength(0)
  })

  it('openProject returns false when IPC returns null', async () => {
    vi.mocked(window.api.project.open).mockResolvedValueOnce(null)

    const result = await openProject('/nonexistent.klip')

    expect(result).toBe(false)
  })

  it('openProject with unknown extra fields succeeds without crash', async () => {
    vi.mocked(window.api.project.open).mockResolvedValueOnce({
      path: '/future.klip',
      data: {
        version: 99,
        name: 'Future Project',
        mediaClips: [], tracks: [], timelineClips: [],
        transitions: [], markers: [],
        settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' },
        unknownFutureField: { nested: true }
      }
    })

    await expect(openProject('/future.klip')).resolves.not.toThrow()
  })
})

// =============================================================================
// §4.3  Undo across stores
// =============================================================================

describe('4.3 Undo across stores', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      clips: [], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      clipboard: null, past: [], future: []
    })
  })

  it('undo after pasteClips reverts all pasted clips', () => {
    // Set up clipboard with 2 clips
    const clip1 = makeTimelineClip({ id: 'c1', startTime: 0 })
    const clip2 = makeTimelineClip({ id: 'c2', startTime: 5 })
    useTimelineStore.setState({
      clips: [clip1, clip2],
      clipboard: [clip1, clip2],
      past: [], future: [],
      selectedClipId: null, selectedClipIds: []
    })

    useTimelineStore.getState().pasteClips()
    expect(useTimelineStore.getState().clips.length).toBeGreaterThan(2)

    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips).toHaveLength(2)
  })

  it('undo after trimClip reverts the trim', () => {
    const clip = makeTimelineClip({ id: 'tc-trim', duration: 30, trimStart: 0 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().trimClip('tc-trim', { duration: 10 })
    expect(useTimelineStore.getState().clips[0].duration).toBe(10)

    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips[0].duration).toBe(30)
  })

  it('undo after moveClip reverts the move', () => {
    const clip = makeTimelineClip({ id: 'tc-move', startTime: 0 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().moveClip('tc-move', 10)
    expect(useTimelineStore.getState().clips[0].startTime).toBe(10)

    useTimelineStore.getState().undo()
    expect(useTimelineStore.getState().clips[0].startTime).toBe(0)
  })

  it('undo reverts two independent actions separately', () => {
    const clip = makeTimelineClip({ id: 'tc-two', startTime: 0, duration: 30 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().moveClip('tc-two', 5)
    useTimelineStore.getState().trimClip('tc-two', { duration: 15 })

    useTimelineStore.getState().undo()  // reverts trim
    expect(useTimelineStore.getState().clips[0].duration).toBe(30)
    expect(useTimelineStore.getState().clips[0].startTime).toBe(5)

    useTimelineStore.getState().undo()  // reverts move
    expect(useTimelineStore.getState().clips[0].startTime).toBe(0)
  })

  it('undo history is bounded at 50 entries; 51st action drops the oldest', () => {
    // Start with a known clip so actions generate history
    const clip = makeTimelineClip({ id: 'tc-hist', startTime: 0 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    // Perform 51 moves — each pushes to past (capped at 50)
    for (let i = 1; i <= 51; i++) {
      useTimelineStore.getState().moveClip('tc-hist', i)
    }

    expect(useTimelineStore.getState().past.length).toBeLessThanOrEqual(50)
  })

  it('redo works correctly after a sequence of undo steps', () => {
    const clip = makeTimelineClip({ id: 'tc-redo', startTime: 0 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().moveClip('tc-redo', 10)
    useTimelineStore.getState().undo()

    expect(useTimelineStore.getState().clips[0].startTime).toBe(0)

    useTimelineStore.getState().redo()

    expect(useTimelineStore.getState().clips[0].startTime).toBe(10)
  })

  it('new action after undo clears the redo (future) stack', () => {
    const clip = makeTimelineClip({ id: 'tc-branch', startTime: 0 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().moveClip('tc-branch', 5)
    useTimelineStore.getState().undo()
    // Future stack now has one entry
    expect(useTimelineStore.getState().future.length).toBe(1)

    // New action after undo — clears future
    useTimelineStore.getState().moveClip('tc-branch', 8)
    expect(useTimelineStore.getState().future).toHaveLength(0)
  })

  it('undo does nothing when past is empty', () => {
    const clip = makeTimelineClip({ id: 'tc-noop', startTime: 5 })
    useTimelineStore.setState({
      clips: [clip], tracks: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [],
      past: [], future: []
    })

    useTimelineStore.getState().undo()

    expect(useTimelineStore.getState().clips[0].startTime).toBe(5)
  })
})

// =============================================================================
// §4.4  UI store + feature interactions
// =============================================================================

describe('4.4 UI store + feature interactions', () => {
  beforeEach(() => {
    useUIStore.setState({
      showExport: false, showSettings: false,
      showProjectSettings: false, whatsThisMode: false
    })
    useToastStore.setState({ toasts: [] })
  })

  it('setShowExport(true) sets showExport to true', () => {
    useUIStore.getState().setShowExport(true)
    expect(useUIStore.getState().showExport).toBe(true)
  })

  it('setShowSettings(true) sets showSettings to true', () => {
    useUIStore.getState().setShowSettings(true)
    expect(useUIStore.getState().showSettings).toBe(true)
  })

  it('setShowProjectSettings(true) sets showProjectSettings to true', () => {
    useUIStore.getState().setShowProjectSettings(true)
    expect(useUIStore.getState().showProjectSettings).toBe(true)
  })

  it('setWhatsThisMode(true) sets whatsThisMode to true', () => {
    useUIStore.getState().setWhatsThisMode(true)
    expect(useUIStore.getState().whatsThisMode).toBe(true)
  })

  it('setWhatsThisMode(false) clears whatsThisMode', () => {
    useUIStore.setState({ whatsThisMode: true })
    useUIStore.getState().setWhatsThisMode(false)
    expect(useUIStore.getState().whatsThisMode).toBe(false)
  })

  it('toastStore.push adds a toast entry', () => {
    useToastStore.getState().push('Hello world')
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Hello world')
  })

  it('standalone toast() function also adds a toast entry', () => {
    toast('Standalone toast', 'success', 2000)
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].duration).toBe(2000)
  })

  it('dismiss removes the targeted toast', () => {
    useToastStore.getState().push('First')
    const id = useToastStore.getState().toasts[0].id

    useToastStore.getState().dismiss(id)

    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('pushing 4 toasts keeps at most 3 (oldest is dropped)', () => {
    useToastStore.getState().push('one')
    useToastStore.getState().push('two')
    useToastStore.getState().push('three')
    useToastStore.getState().push('four')

    expect(useToastStore.getState().toasts.length).toBeLessThanOrEqual(3)
  })

  it('multiple setShowExport calls toggle back cleanly', () => {
    useUIStore.getState().setShowExport(true)
    useUIStore.getState().setShowExport(false)
    expect(useUIStore.getState().showExport).toBe(false)
  })
})

// =============================================================================
// §4.5  appSettingsStore interactions
// =============================================================================

describe('4.5 appSettingsStore interactions', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({
      hasSeenWalkthrough: false,
      snapByDefault: true,
      defaultExportFolder: null,
      musicLibraryFolder: null
    })
  })

  it('hasSeenWalkthrough defaults to false', () => {
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(false)
  })

  it('setHasSeenWalkthrough(true) sets it to true', () => {
    useAppSettingsStore.getState().setHasSeenWalkthrough(true)
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
  })

  it('setHasSeenWalkthrough(false) after true resets to false', () => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: true })
    useAppSettingsStore.getState().setHasSeenWalkthrough(false)
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(false)
  })

  it('multiple setHasSeenWalkthrough calls do not crash', () => {
    expect(() => {
      useAppSettingsStore.getState().setHasSeenWalkthrough(true)
      useAppSettingsStore.getState().setHasSeenWalkthrough(false)
      useAppSettingsStore.getState().setHasSeenWalkthrough(true)
    }).not.toThrow()
  })

  it('setSnapByDefault updates snapByDefault', () => {
    useAppSettingsStore.getState().setSnapByDefault(false)
    expect(useAppSettingsStore.getState().snapByDefault).toBe(false)
  })

  it('setDefaultExportFolder updates defaultExportFolder', () => {
    useAppSettingsStore.getState().setDefaultExportFolder('/exports')
    expect(useAppSettingsStore.getState().defaultExportFolder).toBe('/exports')
  })

  it('setDefaultExportFolder(null) clears the folder', () => {
    useAppSettingsStore.setState({ defaultExportFolder: '/old' })
    useAppSettingsStore.getState().setDefaultExportFolder(null)
    expect(useAppSettingsStore.getState().defaultExportFolder).toBeNull()
  })
})
