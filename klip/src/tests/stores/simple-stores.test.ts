/**
 * Phase 2 — Store unit tests: simple stores
 *
 * Covers: appStore, uiStore, commandPaletteStore, appSettingsStore,
 *         musicStore, sourceViewerStore
 *
 * No DOM, no React, no IPC.  Pure Zustand state-machine assertions.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore }             from '@/stores/appStore'
import { useUIStore }              from '@/stores/uiStore'
import { useCommandPaletteStore }  from '@/stores/commandPaletteStore'
import { useAppSettingsStore }     from '@/stores/appSettingsStore'
import { useMusicStore }           from '@/stores/musicStore'
import { useSourceViewerStore }    from '@/stores/sourceViewerStore'
import type { MusicTrack }         from '@/stores/musicStore'
import type { MediaClip }          from '@/types/media'

// ── Fixture factories ─────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id:       overrides.id       ?? 'track-1',
    title:    overrides.title    ?? 'Chill Vibes',
    artist:   overrides.artist   ?? 'Artist A',
    duration: overrides.duration ?? 180,
    filePath: overrides.filePath ?? '/music/chill.mp3',
    tags:     overrides.tags     ?? [],
    addedAt:  overrides.addedAt  ?? 1000,
  }
}

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id:              overrides.id              ?? 'media-1',
    type:            overrides.type            ?? 'video',
    path:            overrides.path            ?? '/test/clip.mp4',
    name:            overrides.name            ?? 'Test Clip',
    duration:        overrides.duration        ?? 60,
    width:           overrides.width           ?? 1920,
    height:          overrides.height          ?? 1080,
    fps:             overrides.fps             ?? 30,
    fileSize:        overrides.fileSize        ?? 100_000,
    thumbnail:       overrides.thumbnail       ?? null,
    thumbnailStatus: overrides.thumbnailStatus ?? 'idle',
    isOnTimeline:    overrides.isOnTimeline    ?? false,
    isMissing:       overrides.isMissing       ?? false,
    addedAt:         overrides.addedAt         ?? 1000,
  }
}

// ── Reset helpers ──────────────────────────────────────────────────────────────

beforeEach(() => {
  useAppStore.setState({ view: 'welcome' })
  useUIStore.setState({
    showExport: false, showSettings: false,
    showProjectSettings: false, whatsThisMode: false
  })
  useCommandPaletteStore.setState({ isOpen: false })
  useAppSettingsStore.setState({
    defaultExportFolder: null,
    snapByDefault:       true,
    musicLibraryFolder:  null,
    hasSeenWalkthrough:  false
  })
  useMusicStore.setState({ tracks: [], searchQuery: '' })
  useSourceViewerStore.setState({
    isOpen: false, clip: null, inPoints: {}, outPoints: {}
  })
})

// =============================================================================
// 2.13 appStore
// =============================================================================

describe('appStore', () => {
  it('initial view is "welcome"', () => {
    expect(useAppStore.getState().view).toBe('welcome')
  })

  it('setView("editor") transitions to editor', () => {
    useAppStore.getState().setView('editor')
    expect(useAppStore.getState().view).toBe('editor')
  })

  it('setView("welcome") transitions back to welcome', () => {
    useAppStore.getState().setView('editor')
    useAppStore.getState().setView('welcome')
    expect(useAppStore.getState().view).toBe('welcome')
  })
})

// =============================================================================
// 2.14 uiStore
// =============================================================================

describe('uiStore', () => {
  it('all flags start as false', () => {
    const s = useUIStore.getState()
    expect(s.showExport).toBe(false)
    expect(s.showSettings).toBe(false)
    expect(s.showProjectSettings).toBe(false)
    expect(s.whatsThisMode).toBe(false)
  })

  it('setShowExport(true) → showExport is true', () => {
    useUIStore.getState().setShowExport(true)
    expect(useUIStore.getState().showExport).toBe(true)
  })

  it('setShowSettings(true) → showSettings is true', () => {
    useUIStore.getState().setShowSettings(true)
    expect(useUIStore.getState().showSettings).toBe(true)
  })

  it('setShowProjectSettings(true) → showProjectSettings is true', () => {
    useUIStore.getState().setShowProjectSettings(true)
    expect(useUIStore.getState().showProjectSettings).toBe(true)
  })

  it('setWhatsThisMode(true) → whatsThisMode is true', () => {
    useUIStore.getState().setWhatsThisMode(true)
    expect(useUIStore.getState().whatsThisMode).toBe(true)
  })

  it('each setter is independent — toggling one does not affect others', () => {
    useUIStore.getState().setShowExport(true)
    const s = useUIStore.getState()
    expect(s.showSettings).toBe(false)
    expect(s.showProjectSettings).toBe(false)
    expect(s.whatsThisMode).toBe(false)
  })
})

// =============================================================================
// 2.11 commandPaletteStore
// =============================================================================

describe('commandPaletteStore', () => {
  it('initial isOpen is false', () => {
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('open() → isOpen is true', () => {
    useCommandPaletteStore.getState().open()
    expect(useCommandPaletteStore.getState().isOpen).toBe(true)
  })

  it('close() after open() → isOpen is false', () => {
    useCommandPaletteStore.getState().open()
    useCommandPaletteStore.getState().close()
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('toggle() alternates isOpen on successive calls', () => {
    const { toggle } = useCommandPaletteStore.getState()
    toggle()
    expect(useCommandPaletteStore.getState().isOpen).toBe(true)
    toggle()
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
    toggle()
    expect(useCommandPaletteStore.getState().isOpen).toBe(true)
  })
})

// =============================================================================
// appSettingsStore
// =============================================================================

describe('appSettingsStore', () => {
  it('initial state: all nulls and false', () => {
    const s = useAppSettingsStore.getState()
    expect(s.defaultExportFolder).toBeNull()
    expect(s.musicLibraryFolder).toBeNull()
    expect(s.hasSeenWalkthrough).toBe(false)
    expect(s.snapByDefault).toBe(true)
  })

  it('setDefaultExportFolder sets the folder path', () => {
    useAppSettingsStore.getState().setDefaultExportFolder('/exports')
    expect(useAppSettingsStore.getState().defaultExportFolder).toBe('/exports')
  })

  it('setDefaultExportFolder(null) resets to null', () => {
    useAppSettingsStore.getState().setDefaultExportFolder('/exports')
    useAppSettingsStore.getState().setDefaultExportFolder(null)
    expect(useAppSettingsStore.getState().defaultExportFolder).toBeNull()
  })

  it('setSnapByDefault(false) updates correctly', () => {
    useAppSettingsStore.getState().setSnapByDefault(false)
    expect(useAppSettingsStore.getState().snapByDefault).toBe(false)
  })

  it('setMusicLibraryFolder sets the folder', () => {
    useAppSettingsStore.getState().setMusicLibraryFolder('/music')
    expect(useAppSettingsStore.getState().musicLibraryFolder).toBe('/music')
  })

  it('setHasSeenWalkthrough(true) marks walkthrough complete', () => {
    useAppSettingsStore.getState().setHasSeenWalkthrough(true)
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
  })
})

// =============================================================================
// 2.10 musicStore
// =============================================================================

describe('musicStore', () => {
  it('initial state: empty tracks and empty searchQuery', () => {
    const s = useMusicStore.getState()
    expect(s.tracks).toHaveLength(0)
    expect(s.searchQuery).toBe('')
  })

  it('addTracks([a, b]) adds both tracks', () => {
    const a = makeTrack({ id: 't1', filePath: '/a.mp3' })
    const b = makeTrack({ id: 't2', filePath: '/b.mp3' })
    useMusicStore.getState().addTracks([a, b])
    expect(useMusicStore.getState().tracks).toHaveLength(2)
  })

  it('addTracks skips entries with a duplicate filePath', () => {
    const t = makeTrack({ filePath: '/dup.mp3' })
    useMusicStore.getState().addTracks([t])
    useMusicStore.getState().addTracks([t])        // same filePath
    expect(useMusicStore.getState().tracks).toHaveLength(1)
  })

  it('addTracks with an entirely-duplicate batch adds nothing', () => {
    const t = makeTrack({ filePath: '/x.mp3' })
    useMusicStore.getState().addTracks([t])
    useMusicStore.getState().addTracks([t])
    expect(useMusicStore.getState().tracks).toHaveLength(1)
  })

  it('removeTrack removes the correct track', () => {
    const a = makeTrack({ id: 't1', filePath: '/a.mp3' })
    const b = makeTrack({ id: 't2', filePath: '/b.mp3' })
    useMusicStore.getState().addTracks([a, b])
    useMusicStore.getState().removeTrack('t1')
    const ids = useMusicStore.getState().tracks.map((t) => t.id)
    expect(ids).toEqual(['t2'])
  })

  it('removeTrack with unknown id is a no-op', () => {
    const t = makeTrack({ id: 't1', filePath: '/a.mp3' })
    useMusicStore.getState().addTracks([t])
    useMusicStore.getState().removeTrack('nonexistent')
    expect(useMusicStore.getState().tracks).toHaveLength(1)
  })

  it('updateTrack merges the patch without touching other fields', () => {
    const t = makeTrack({ id: 't1', filePath: '/a.mp3', title: 'Old', artist: 'X' })
    useMusicStore.getState().addTracks([t])
    useMusicStore.getState().updateTrack('t1', { title: 'New' })
    const updated = useMusicStore.getState().tracks[0]
    expect(updated.title).toBe('New')
    expect(updated.artist).toBe('X')          // untouched
    expect(updated.filePath).toBe('/a.mp3')   // untouched
  })

  it('setSearchQuery updates searchQuery', () => {
    useMusicStore.getState().setSearchQuery('chill')
    expect(useMusicStore.getState().searchQuery).toBe('chill')
  })
})

// =============================================================================
// 2.12 sourceViewerStore
// =============================================================================

describe('sourceViewerStore', () => {
  it('initial state: closed, no clip, empty in/out points', () => {
    const s = useSourceViewerStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.clip).toBeNull()
    expect(s.inPoints).toEqual({})
    expect(s.outPoints).toEqual({})
  })

  it('openClip sets isOpen=true and stores the clip', () => {
    const clip = makeMediaClip()
    useSourceViewerStore.getState().openClip(clip)
    const s = useSourceViewerStore.getState()
    expect(s.isOpen).toBe(true)
    expect(s.clip?.id).toBe('media-1')
  })

  it('closeViewer sets isOpen=false and clears clip', () => {
    useSourceViewerStore.getState().openClip(makeMediaClip())
    useSourceViewerStore.getState().closeViewer()
    const s = useSourceViewerStore.getState()
    expect(s.isOpen).toBe(false)
    expect(s.clip).toBeNull()
  })

  it('setInPoint stores the time keyed by clipId', () => {
    useSourceViewerStore.getState().setInPoint('abc', 3.5)
    expect(useSourceViewerStore.getState().inPoints['abc']).toBe(3.5)
  })

  it('setOutPoint stores the time keyed by clipId', () => {
    useSourceViewerStore.getState().setOutPoint('abc', 7.0)
    expect(useSourceViewerStore.getState().outPoints['abc']).toBe(7.0)
  })

  it('in/out points for clip A are not overwritten when setting points for clip B', () => {
    useSourceViewerStore.getState().setInPoint('clipA', 1.0)
    useSourceViewerStore.getState().setInPoint('clipB', 5.0)
    expect(useSourceViewerStore.getState().inPoints['clipA']).toBe(1.0)
    expect(useSourceViewerStore.getState().inPoints['clipB']).toBe(5.0)
  })

  it('openClip for a second clip does not clear existing in/out points', () => {
    useSourceViewerStore.getState().setInPoint('clipA', 2.0)
    useSourceViewerStore.getState().openClip(makeMediaClip({ id: 'clipB' }))
    expect(useSourceViewerStore.getState().inPoints['clipA']).toBe(2.0)
  })

  it('closeViewer does not clear in/out points (session memory preserved)', () => {
    useSourceViewerStore.getState().setInPoint('clipA', 4.0)
    useSourceViewerStore.getState().openClip(makeMediaClip())
    useSourceViewerStore.getState().closeViewer()
    expect(useSourceViewerStore.getState().inPoints['clipA']).toBe(4.0)
  })
})
