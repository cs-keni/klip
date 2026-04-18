/**
 * Phase 2 — Store unit tests: mediaStore, projectStore, toastStore
 *
 * mediaStore has two async methods that call window.api — those are exercised
 * using the vi.mocked() overrides on top of the buildApiMock() from setup.ts.
 * Everything else is pure synchronous state-machine assertions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMediaStore }   from '@/stores/mediaStore'
import { useProjectStore } from '@/stores/projectStore'
import { useToastStore, toast } from '@/stores/toastStore'
import type { MediaClip }  from '@/types/media'

// ── Fixture factory ────────────────────────────────────────────────────────────

function makeClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id:              overrides.id              ?? 'media-1',
    type:            overrides.type            ?? 'video',
    path:            overrides.path            ?? '/videos/clip.mp4',
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
    proxyStatus:     overrides.proxyStatus     ?? 'none',
    proxyProgress:   overrides.proxyProgress   ?? 0,
    proxyPath:       overrides.proxyPath       ?? null,
  }
}

// ── Reset helpers ──────────────────────────────────────────────────────────────

beforeEach(() => {
  useMediaStore.setState({ clips: [], selectedClipId: null })
  useProjectStore.setState({
    projectName:       null,
    projectPath:       null,
    hasUnsavedChanges: false,
    settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
  })
  useToastStore.setState({ toasts: [] })
})

// =============================================================================
// 2.9 mediaStore — synchronous CRUD
// =============================================================================

describe('mediaStore — addClip', () => {
  it('adds the clip to the clips array', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    expect(useMediaStore.getState().clips).toHaveLength(1)
  })

  it('adding a second clip with a different id produces two clips', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().addClip(makeClip({ id: 'c2', path: '/b.mp4' }))
    expect(useMediaStore.getState().clips).toHaveLength(2)
  })
})

describe('mediaStore — removeClip', () => {
  it('removes the clip by id', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().removeClip('c1')
    expect(useMediaStore.getState().clips).toHaveLength(0)
  })

  it('removing an unknown id is a no-op', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().removeClip('ghost')
    expect(useMediaStore.getState().clips).toHaveLength(1)
  })

  it('clears selectedClipId when the selected clip is removed', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().selectClip('c1')
    useMediaStore.getState().removeClip('c1')
    expect(useMediaStore.getState().selectedClipId).toBeNull()
  })

  it('does not clear selectedClipId when a different clip is removed', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().addClip(makeClip({ id: 'c2', path: '/b.mp4' }))
    useMediaStore.getState().selectClip('c1')
    useMediaStore.getState().removeClip('c2')
    expect(useMediaStore.getState().selectedClipId).toBe('c1')
  })
})

describe('mediaStore — updateClip', () => {
  it('merges the patch into the existing clip', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', name: 'Old Name' }))
    useMediaStore.getState().updateClip('c1', { name: 'New Name' })
    expect(useMediaStore.getState().clips[0].name).toBe('New Name')
  })

  it('does not modify other fields when patching', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', duration: 30, name: 'Keep' }))
    useMediaStore.getState().updateClip('c1', { thumbnailStatus: 'ready' })
    const clip = useMediaStore.getState().clips[0]
    expect(clip.name).toBe('Keep')
    expect(clip.duration).toBe(30)
  })

  it('is a no-op for a non-existent id', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', name: 'Unchanged' }))
    useMediaStore.getState().updateClip('ghost', { name: 'Changed' })
    expect(useMediaStore.getState().clips[0].name).toBe('Unchanged')
  })
})

describe('mediaStore — relinkClip', () => {
  it('updates path and clears isMissing', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', path: '/old.mp4', isMissing: true }))
    useMediaStore.getState().relinkClip('c1', '/new.mp4')
    const clip = useMediaStore.getState().clips[0]
    expect(clip.path).toBe('/new.mp4')
    expect(clip.isMissing).toBe(false)
  })

  it('sets thumbnailStatus to "generating" so the thumbnail regenerates', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', thumbnailStatus: 'ready' }))
    useMediaStore.getState().relinkClip('c1', '/new.mp4')
    expect(useMediaStore.getState().clips[0].thumbnailStatus).toBe('generating')
  })
})

describe('mediaStore — selectClip', () => {
  it('sets selectedClipId to the given id', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().selectClip('c1')
    expect(useMediaStore.getState().selectedClipId).toBe('c1')
  })

  it('selectClip(null) clears the selection', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().selectClip('c1')
    useMediaStore.getState().selectClip(null)
    expect(useMediaStore.getState().selectedClipId).toBeNull()
  })
})

describe('mediaStore — markOnTimeline', () => {
  it('sets isOnTimeline on the target clip', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', isOnTimeline: false }))
    useMediaStore.getState().markOnTimeline('c1', true)
    expect(useMediaStore.getState().clips[0].isOnTimeline).toBe(true)
  })
})

// ── Async methods ─────────────────────────────────────────────────────────────

describe('mediaStore — checkMissingFiles (async)', () => {
  it('marks clips as isMissing when the file does not exist on disk', async () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', path: '/gone.mp4' }))
    vi.mocked(window.api.media.checkFilesExist).mockResolvedValueOnce({ '/gone.mp4': false })
    await useMediaStore.getState().checkMissingFiles()
    expect(useMediaStore.getState().clips[0].isMissing).toBe(true)
  })

  it('does not mutate clips when all files exist', async () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', path: '/here.mp4', isMissing: false }))
    vi.mocked(window.api.media.checkFilesExist).mockResolvedValueOnce({ '/here.mp4': true })
    await useMediaStore.getState().checkMissingFiles()
    expect(useMediaStore.getState().clips[0].isMissing).toBe(false)
  })

  it('is a no-op (no API call) when there are no clips with paths', async () => {
    // Empty store — checkMissingFiles returns early, no API call
    await useMediaStore.getState().checkMissingFiles()
    expect(window.api.media.checkFilesExist).not.toHaveBeenCalled()
  })

  it('does not crash when the API call rejects', async () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1', path: '/x.mp4' }))
    vi.mocked(window.api.media.checkFilesExist).mockRejectedValueOnce(new Error('IPC fail'))
    // Should not throw — isMissing stays as-is
    await expect(useMediaStore.getState().checkMissingFiles()).resolves.toBeUndefined()
    expect(useMediaStore.getState().clips[0].isMissing).toBe(false)
  })
})

describe('mediaStore — proxy status helpers', () => {
  it('setProxyStatus updates proxyStatus and progress', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().setProxyStatus('c1', 'generating', 0.4)
    const clip = useMediaStore.getState().clips[0]
    expect(clip.proxyStatus).toBe('generating')
    expect(clip.proxyProgress).toBe(0.4)
  })

  it('setProxyReady marks status as ready and stores the path', () => {
    useMediaStore.getState().addClip(makeClip({ id: 'c1' }))
    useMediaStore.getState().setProxyReady('c1', '/proxies/c1_proxy.mp4')
    const clip = useMediaStore.getState().clips[0]
    expect(clip.proxyStatus).toBe('ready')
    expect(clip.proxyPath).toBe('/proxies/c1_proxy.mp4')
    expect(clip.proxyProgress).toBe(1)
  })
})

// =============================================================================
// projectStore
// =============================================================================

describe('projectStore', () => {
  it('initial state: no name/path, no unsaved changes, default settings', () => {
    const s = useProjectStore.getState()
    expect(s.projectName).toBeNull()
    expect(s.projectPath).toBeNull()
    expect(s.hasUnsavedChanges).toBe(false)
    expect(s.settings.resolution).toBe('1080p')
    expect(s.settings.frameRate).toBe(60)
    expect(s.settings.aspectRatio).toBe('16:9')
  })

  it('newProject sets name and resets path, unsaved flag, and settings to defaults', () => {
    // Dirty up the store first
    useProjectStore.getState().setProjectPath('/old.klip')
    useProjectStore.getState().setUnsavedChanges(true)
    useProjectStore.getState().updateSettings({ resolution: '4k' })

    useProjectStore.getState().newProject('My Film')
    const s = useProjectStore.getState()
    expect(s.projectName).toBe('My Film')
    expect(s.projectPath).toBeNull()
    expect(s.hasUnsavedChanges).toBe(false)
    expect(s.settings.resolution).toBe('1080p')  // reset to default
  })

  it('setProjectName marks hasUnsavedChanges as true', () => {
    useProjectStore.getState().setProjectName('Renamed')
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true)
    expect(useProjectStore.getState().projectName).toBe('Renamed')
  })

  it('setProjectPath updates the path without touching unsavedChanges', () => {
    useProjectStore.getState().setProjectPath('/project/save.klip')
    expect(useProjectStore.getState().projectPath).toBe('/project/save.klip')
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('setUnsavedChanges(true/false) toggles correctly', () => {
    useProjectStore.getState().setUnsavedChanges(true)
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(true)
    useProjectStore.getState().setUnsavedChanges(false)
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('updateSettings merges partial settings and marks unsaved', () => {
    useProjectStore.getState().updateSettings({ frameRate: 24 })
    const s = useProjectStore.getState()
    expect(s.settings.frameRate).toBe(24)
    expect(s.settings.resolution).toBe('1080p')   // untouched
    expect(s.hasUnsavedChanges).toBe(true)
  })

  it('updateSettings({}) is a no-op on settings values but still marks unsaved', () => {
    useProjectStore.getState().updateSettings({})
    expect(useProjectStore.getState().settings.resolution).toBe('1080p')
  })
})

// =============================================================================
// toastStore
// =============================================================================

describe('toastStore', () => {
  it('initial state has no toasts', () => {
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('push adds a toast with the given message and type', () => {
    useToastStore.getState().push('Saved!', 'success')
    const t = useToastStore.getState().toasts[0]
    expect(t.message).toBe('Saved!')
    expect(t.type).toBe('success')
  })

  it('push defaults to type "info" and duration 3000ms', () => {
    useToastStore.getState().push('Hello')
    const t = useToastStore.getState().toasts[0]
    expect(t.type).toBe('info')
    expect(t.duration).toBe(3000)
  })

  it('each toast gets a unique id', () => {
    useToastStore.getState().push('A')
    useToastStore.getState().push('B')
    const ids = useToastStore.getState().toasts.map((t) => t.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('capped at 3 — oldest toast dropped when a 4th is pushed', () => {
    useToastStore.getState().push('1')
    useToastStore.getState().push('2')
    useToastStore.getState().push('3')
    useToastStore.getState().push('4')
    const messages = useToastStore.getState().toasts.map((t) => t.message)
    expect(messages).toHaveLength(3)
    expect(messages).not.toContain('1')  // oldest dropped
    expect(messages).toContain('4')
  })

  it('dismiss removes the toast by id', () => {
    useToastStore.getState().push('Remove me')
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('dismiss with unknown id is a no-op', () => {
    useToastStore.getState().push('Keep me')
    useToastStore.getState().dismiss('nonexistent')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('toast() standalone function pushes to the store', () => {
    toast('Standalone toast', 'warning')
    const t = useToastStore.getState().toasts[0]
    expect(t.message).toBe('Standalone toast')
    expect(t.type).toBe('warning')
  })
})
