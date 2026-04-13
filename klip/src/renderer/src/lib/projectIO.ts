/**
 * projectIO — serialize / deserialize project state and call IPC.
 * These are plain functions (not hooks) so they can be called from anywhere.
 */

import { useProjectStore } from '@/stores/projectStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useAppStore } from '@/stores/appStore'
import type { Track } from '@/types/timeline'

// ── Default timeline state ───────────────────────────────────────────────────

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1',       type: 'video',   name: 'Video 1', isLocked: false, isMuted: false, isSolo: false },
  { id: 'a1',       type: 'audio',   name: 'Audio 1', isLocked: false, isMuted: false, isSolo: false },
  { id: 'm1',       type: 'music',   name: 'Music',   isLocked: false, isMuted: false, isSolo: false },
  { id: 'overlay1', type: 'overlay', name: 'Text',    isLocked: false, isMuted: false, isSolo: false }
]

// ── Serialization ────────────────────────────────────────────────────────────

export function serializeProject(): object {
  const { projectName, settings } = useProjectStore.getState()
  const { clips: mediaClips } = useMediaStore.getState()
  const { tracks, clips: timelineClips, transitions } = useTimelineStore.getState()

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
    mediaClips: strippedMediaClips,
    tracks,
    timelineClips: strippedTimelineClips,
    transitions
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
  return true
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
  return true
}
