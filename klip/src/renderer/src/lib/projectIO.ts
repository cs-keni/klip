/**
 * projectIO — serialize / deserialize project state and call IPC.
 * These are plain functions (not hooks) so they can be called from anywhere.
 */

import { useProjectStore } from '@/stores/projectStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useAppStore } from '@/stores/appStore'
import { toast } from '@/stores/toastStore'
import type { Track } from '@/types/timeline'

// ── Default timeline state ───────────────────────────────────────────────────

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1',       type: 'video',   name: 'Video 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a1',       type: 'audio',   name: 'Audio 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a2',       type: 'audio',   name: 'Extra Audio', isLocked: false, isMuted: false, isSolo: false },
  { id: 'm1',       type: 'music',   name: 'Music',       isLocked: false, isMuted: false, isSolo: false },
  { id: 'overlay1', type: 'overlay', name: 'Text',        isLocked: false, isMuted: false, isSolo: false }
]

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeProject(): object {
  const { projectName, projectPath, settings } = useProjectStore.getState()
  const { clips: mediaClips } = useMediaStore.getState()
  const { tracks, clips: timelineClips, transitions, markers, masterVolume, playheadTime } = useTimelineStore.getState()

  // Strip base64 thumbnails — they can be multiple MB and are fully regenerable
  // from source media when the project is reopened. thumbnailStatus resets to
  // 'idle' so the app knows to re-generate on next open.
  const strippedMediaClips = mediaClips.map((c) => ({
    ...c,
    thumbnail: null,
    thumbnailStatus: 'idle' as const
  }))

  // Strip timeline clip thumbnails too (they mirror the media clip thumbnails)
  const strippedTimelineClips = timelineClips.map((c) => ({
    ...c,
    thumbnail: null
  }))

  return {
    version: 1,
    name: projectName ?? 'Untitled Project',
    savedAt: new Date().toISOString(),
    settings,
    masterVolume,
    playheadTime,
    mediaClips: strippedMediaClips,
    tracks,
    timelineClips: strippedTimelineClips,
    transitions,
    markers: markers ?? [],
    _projectPath: projectPath  // used by autosave recovery to restore the file path
  }
}

// ── Deserialization ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deserializeProject(data: any, path: string): void {
  // Restore project store
  useProjectStore.setState({
    projectName: data.name ?? 'Untitled Project',
    projectPath: path,
    hasUnsavedChanges: false,
    settings: data.settings ?? { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
  })

  // Restore media store (reset selection UI state)
  useMediaStore.setState({
    clips: data.mediaClips ?? [],
    selectedClipId: null
  })

  // Restore timeline store (reset all playback / selection / history state)
  useTimelineStore.setState({
    tracks: data.tracks ?? DEFAULT_TRACKS,
    clips: data.timelineClips ?? [],
    transitions: data.transitions ?? [],
    markers: data.markers ?? [],
    masterVolume: typeof data.masterVolume === 'number' ? data.masterVolume : 1,
    selectedClipId: null,
    selectedClipIds: [],
    clipboard: null,
    playheadTime: typeof data.playheadTime === 'number' ? data.playheadTime : 0,
    isPlaying: false,
    loopIn: null,
    loopOut: null,
    loopEnabled: false,
    past: [],
    future: []
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Save the project to its current path, or show a Save dialog if unsaved.
 * Returns true if the save succeeded.
 */
export async function saveProject(): Promise<boolean> {
  const data = serializeProject()
  const currentPath = useProjectStore.getState().projectPath

  const savedPath = await window.api.project.save({ data, path: currentPath })
  if (!savedPath) return false

  useProjectStore.setState({ projectPath: savedPath, hasUnsavedChanges: false })
  void window.api.project.clearAutosave()
  toast('Project saved', 'success', 2000)
  return true
}

/**
 * Always show a Save As dialog.
 * Returns true if the save succeeded.
 */
export async function saveProjectAs(): Promise<boolean> {
  const data = serializeProject()
  const savedPath = await window.api.project.saveAs({ data })
  if (!savedPath) return false

  useProjectStore.setState({ projectPath: savedPath, hasUnsavedChanges: false })
  void window.api.project.clearAutosave()
  toast('Project saved', 'success', 2000)
  return true
}

/**
 * Restore a project from the autosave temp file.
 * Returns true if an autosave was found and restored.
 */
export async function restoreAutosave(): Promise<boolean> {
  const result = await window.api.project.checkAutosave()
  if (!result) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any
  deserializeProject(data, data._projectPath ?? null)

  // Mark as having unsaved changes (this is a recovery, not a clean save)
  useProjectStore.setState({ hasUnsavedChanges: true })

  useAppStore.getState().setView('editor')
  void window.api.project.clearAutosave()

  const { checkMissingFiles, checkExistingProxies } = useMediaStore.getState()
  void checkMissingFiles()
  void checkExistingProxies()

  return true
}

/**
 * Reset all stores to a clean empty state for a new project.
 * Clears undo history, loop range, media bin, and timeline.
 */
export function createNewProject(): void {
  useProjectStore.getState().newProject('Untitled Project')

  useMediaStore.setState({
    clips: [],
    selectedClipId: null
  })

  useTimelineStore.setState({
    tracks: DEFAULT_TRACKS,
    clips: [],
    transitions: [],
    markers: [],
    masterVolume: 1,
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
}

/**
 * Open a project from a given path, or show an Open dialog.
 * Returns true if a project was opened.
 */
export async function openProject(filePath?: string): Promise<boolean> {
  const result = await window.api.project.open(filePath)
  if (!result) return false

  deserializeProject(result.data, result.path)
  useAppStore.getState().setView('editor')

  // Run file-health checks after the store is populated
  // (These are async and non-blocking — the editor opens immediately)
  const { checkMissingFiles, checkExistingProxies } = useMediaStore.getState()
  void checkMissingFiles()
  void checkExistingProxies()

  return true
}
