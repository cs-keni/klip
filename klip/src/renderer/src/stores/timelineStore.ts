import { create } from 'zustand'
import type {
  Track, TimelineClip, HistoryEntry, Transition,
  TextSettings, ColorSettings, CropSettings, TimelineMarker
} from '@/types/timeline'

type TrimPatch = Partial<Pick<TimelineClip, 'startTime' | 'trimStart' | 'duration'>>

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1',       type: 'video',   name: 'Video 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a1',       type: 'audio',   name: 'Audio 1',     isLocked: false, isMuted: false, isSolo: false },
  { id: 'a2',       type: 'audio',   name: 'Extra Audio', isLocked: false, isMuted: false, isSolo: false },
  { id: 'm1',       type: 'music',   name: 'Music',       isLocked: false, isMuted: false, isSolo: false },
  { id: 'overlay1', type: 'overlay', name: 'Text',        isLocked: false, isMuted: false, isSolo: false }
]

interface TimelineState {
  tracks: Track[]
  clips: TimelineClip[]
  transitions: Transition[]

  // ── Selection ─────────────────────────────────────────────────────────────
  /** Primary selected clip (the last directly-clicked one). */
  selectedClipId: string | null
  /** All selected clip IDs (includes selectedClipId). */
  selectedClipIds: string[]

  // ── Clipboard ─────────────────────────────────────────────────────────────
  clipboard: TimelineClip[] | null

  // ── Snap ──────────────────────────────────────────────────────────────────
  snapEnabled: boolean

  // ── Playback ──────────────────────────────────────────────────────────────
  isPlaying: boolean
  playheadTime: number
  pxPerSec: number

  /**
   * J/K/L shuttle speed. Negative = reverse, positive = forward.
   * Valid values: -4 | -2 | -1 | 0 | 1 | 2 | 4
   * 0 means no active shuttle (normal play/pause governs isPlaying).
   */
  shuttleSpeed: number

  // ── Loop ──────────────────────────────────────────────────────────────────
  loopIn: number | null
  loopOut: number | null
  loopEnabled: boolean

  // ── Undo / redo history ───────────────────────────────────────────────────
  past: HistoryEntry[]
  future: HistoryEntry[]

  // ── Clip actions ──────────────────────────────────────────────────────────
  addClip: (clip: TimelineClip) => void
  addClips: (clips: TimelineClip[]) => void
  removeClip: (id: string) => void
  removeSelectedClips: () => void
  selectClip: (id: string | null) => void
  toggleClipInSelection: (id: string) => void
  moveClip: (id: string, startTime: number) => void
  moveClipOnly: (id: string, startTime: number) => void
  moveClips: (moves: { id: string; newStart: number }[]) => void
  trimClip: (id: string, patch: TrimPatch) => void
  trimClipOnly: (id: string, patch: TrimPatch) => void
  trimToPlayhead: (id: string, side: 'start' | 'end') => void
  splitClip: (id: string) => void
  rippleDelete: (id: string) => void
  rippleDeleteSelected: () => void
  copySelectedClips: () => void
  pasteClips: () => void
  closeGap: (trackId: string, gapStartTime: number) => void
  unlinkClip: (id: string) => void
  insertFreezeFrame: (params: {
    sourceClipId: string
    frameMediaClipId: string
    frameThumbnail: string | null
    freezeAt: number
    duration: number
  }) => void

  // ── Playback ──────────────────────────────────────────────────────────────
  setIsPlaying: (v: boolean) => void
  setShuttleSpeed: (speed: number) => void

  // ── Loop ──────────────────────────────────────────────────────────────────
  setLoopIn: (t: number | null) => void
  setLoopOut: (t: number | null) => void
  toggleLoop: () => void
  clearLoop: () => void

  // ── Playhead / zoom ───────────────────────────────────────────────────────
  setPlayheadTime: (time: number) => void
  setPxPerSec: (pxPerSec: number) => void

  // ── Track actions ─────────────────────────────────────────────────────────
  renameTrack:         (trackId: string, name: string) => void
  toggleMute:          (trackId: string) => void
  toggleSolo:          (trackId: string) => void
  toggleLock:          (trackId: string) => void
  toggleSnap:          () => void
  toggleTrackCollapse: (trackId: string) => void
  addTrack:            (type: import('@/types/timeline').TrackType) => void
  removeTrack:         (trackId: string) => void

  // ── Master volume ──────────────────────────────────────────────────────────
  masterVolume: number
  setMasterVolume: (v: number) => void

  // ── Clip audio ────────────────────────────────────────────────────────────
  setClipVolume: (clipId: string, volume: number) => void
  setClipFades:  (clipId: string, fadeIn: number, fadeOut: number) => void

  // ── Phase 10 clip actions ─────────────────────────────────────────────────
  setClipLabelColor: (clipId: string, color: string | undefined) => void
  renameClip:        (clipId: string, name: string) => void
  extractAudio:      (videoClipId: string) => void
  pasteClipsWithRipple: () => void

  // ── Phase 6 clip actions ──────────────────────────────────────────────────
  setClipSpeed:     (clipId: string, speed: number) => void
  setTextSettings:  (clipId: string, settings: TextSettings) => void
  setColorSettings: (clipId: string, settings: ColorSettings | undefined) => void
  setCropSettings:  (clipId: string, settings: CropSettings | undefined) => void
  setClipRole:      (clipId: string, role: 'intro' | 'outro' | undefined) => void

  // ── Transitions ───────────────────────────────────────────────────────────
  addTransition:    (t: Transition) => void
  removeTransition: (id: string) => void

  // ── Markers ───────────────────────────────────────────────────────────────
  markers: TimelineMarker[]
  addMarker:         (time: number) => void
  removeMarker:      (id: string) => void
  updateMarkerLabel: (id: string, label: string) => void
  updateMarkerColor: (id: string, color: string) => void

  // ── History ───────────────────────────────────────────────────────────────
  undo: () => void
  redo: () => void
}

/** Deep-clone the undoable slice of state. */
function snapshot(state: Pick<TimelineState, 'tracks' | 'clips' | 'transitions'>): HistoryEntry {
  return {
    tracks:      state.tracks.map((t) => ({ ...t })),
    clips:       state.clips.map((c) => ({ ...c })),
    transitions: state.transitions.map((t) => ({ ...t }))
  }
}

export const useTimelineStore = create<TimelineState>((set) => ({
  tracks:         DEFAULT_TRACKS,
  clips:          [],
  transitions:    [],
  markers:        [],
  selectedClipId:  null,
  selectedClipIds: [],
  clipboard:       null,
  snapEnabled:     true,
  playheadTime:   0,
  pxPerSec:       80,
  isPlaying:      false,
  shuttleSpeed:   0,
  loopIn:         null,
  loopOut:        null,
  loopEnabled:    false,
  past:           [],
  future:         [],
  masterVolume:   1,

  setIsPlaying: (v) => set({ isPlaying: v }),
  setShuttleSpeed: (speed) => set({ shuttleSpeed: speed }),

  // ── Loop ────────────────────────────────────────────────────────────────

  setLoopIn:  (t) => set({ loopIn: t }),
  setLoopOut: (t) => set({ loopOut: t }),
  toggleLoop: ()  => set((s) => ({ loopEnabled: !s.loopEnabled })),
  clearLoop:  ()  => set({ loopIn: null, loopOut: null, loopEnabled: false }),

  // ── Clips ────────────────────────────────────────────────────────────────

  addClip: (clip) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: [...s.clips, clip],
      selectedClipId:  clip.id,
      selectedClipIds: [clip.id]
    })),

  addClips: (clips) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: [...s.clips, ...clips],
      selectedClipId:  clips[0]?.id ?? null,
      selectedClipIds: clips.map((c) => c.id)
    })),

  removeClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      const linkedId = clip?.linkedClipId
      const idsToRemove = new Set([id, ...(linkedId ? [linkedId] : [])])
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.filter((c) => !idsToRemove.has(c.id)),
        transitions: s.transitions.filter(
          (t) => !idsToRemove.has(t.fromClipId) && !idsToRemove.has(t.toClipId)
        ),
        selectedClipId:  idsToRemove.has(s.selectedClipId ?? '') ? null : s.selectedClipId,
        selectedClipIds: s.selectedClipIds.filter((x) => !idsToRemove.has(x))
      }
    }),

  removeSelectedClips: () =>
    set((s) => {
      if (s.selectedClipIds.length === 0) return s
      const ids = new Set(s.selectedClipIds)
      // Also pull in any linked clips
      for (const selId of s.selectedClipIds) {
        const linked = s.clips.find((c) => c.id === selId)?.linkedClipId
        if (linked) ids.add(linked)
      }
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.filter((c) => !ids.has(c.id)),
        transitions: s.transitions.filter(
          (t) => !ids.has(t.fromClipId) && !ids.has(t.toClipId)
        ),
        selectedClipId:  null,
        selectedClipIds: []
      }
    }),

  selectClip: (id) =>
    set({
      selectedClipId:  id,
      selectedClipIds: id ? [id] : []
    }),

  toggleClipInSelection: (id) =>
    set((s) => {
      const alreadySelected = s.selectedClipIds.includes(id)
      if (alreadySelected) {
        const next = s.selectedClipIds.filter((x) => x !== id)
        return {
          selectedClipIds: next,
          selectedClipId:  next[0] ?? null
        }
      }
      return {
        selectedClipIds: [...s.selectedClipIds, id],
        selectedClipId:  id
      }
    }),

  moveClip: (id, startTime) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      const linkedId = clip?.linkedClipId
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.map((c) => {
          if (c.id === id || (linkedId && c.id === linkedId))
            return { ...c, startTime: Math.max(0, startTime) }
          return c
        })
      }
    }),

  /** Move only this clip — skip any linked pair (Alt-drag independence). */
  moveClipOnly: (id, startTime) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, startTime: Math.max(0, startTime) } : c
      )
    })),

  /**
   * Commit a batch of clip moves in one undo-history entry.
   * For each clip, also moves its linked pair if it isn't already in the list.
   */
  moveClips: (moves) =>
    set((s) => {
      const updateMap = new Map<string, number>()

      for (const { id, newStart } of moves) {
        const clip = s.clips.find((c) => c.id === id)
        if (!clip) continue
        updateMap.set(id, Math.max(0, newStart))

        // Move the linked pair (video↔audio) if it isn't already being moved
        if (clip.linkedClipId && !moves.some((m) => m.id === clip.linkedClipId)) {
          const linked = s.clips.find((c) => c.id === clip.linkedClipId)
          if (linked) {
            const delta = newStart - clip.startTime
            updateMap.set(clip.linkedClipId, Math.max(0, linked.startTime + delta))
          }
        }
      }

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.map((c) =>
          updateMap.has(c.id) ? { ...c, startTime: updateMap.get(c.id)! } : c
        )
      }
    }),

  trimClip: (id, patch) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      const linkedId = clip?.linkedClipId
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.map((c) => {
          if (c.id !== id && c.id !== linkedId) return c
          const next = { ...c, ...patch }
          next.startTime = Math.max(0, next.startTime ?? c.startTime)
          next.trimStart = Math.max(0, next.trimStart ?? c.trimStart)
          next.duration  = Math.max(0.1, next.duration ?? c.duration)
          return next
        })
      }
    }),

  /** Trim only this clip — skip any linked pair (Alt-drag independence). */
  trimClipOnly: (id, patch) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, ...patch }
        next.startTime = Math.max(0, next.startTime ?? c.startTime)
        next.trimStart = Math.max(0, next.trimStart ?? c.trimStart)
        next.duration  = Math.max(0.1, next.duration ?? c.duration)
        return next
      })
    })),

  trimToPlayhead: (id, side) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const playhead = s.playheadTime
      const linkedId = clip.linkedClipId

      if (side === 'end') {
        const newDur = playhead - clip.startTime
        if (newDur < 0.1 || playhead >= clip.startTime + clip.duration) return s
        return {
          past: [...s.past.slice(-49), snapshot(s)],
          future: [],
          clips: s.clips.map((c) =>
            c.id === id || (linkedId && c.id === linkedId)
              ? { ...c, duration: newDur }
              : c
          )
        }
      } else {
        const dt = playhead - clip.startTime
        if (dt < 0 || playhead >= clip.startTime + clip.duration - 0.1) return s
        return {
          past: [...s.past.slice(-49), snapshot(s)],
          future: [],
          clips: s.clips.map((c) => {
            if (c.id === id || (linkedId && c.id === linkedId)) {
              return {
                ...c,
                startTime: playhead,
                trimStart: Math.max(0, c.trimStart + dt * (c.speed ?? 1)),
                duration:  c.duration - dt
              }
            }
            return c
          })
        }
      }
    }),

  splitClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const splitOffset = s.playheadTime - clip.startTime
      if (splitOffset <= 0.05 || splitOffset >= clip.duration - 0.05) return s

      const linkedClip = clip.linkedClipId
        ? s.clips.find((c) => c.id === clip.linkedClipId) ?? null
        : null

      const rightId       = crypto.randomUUID()
      const linkedRightId = linkedClip ? crypto.randomUUID() : undefined

      const left: TimelineClip = {
        ...clip,
        duration: splitOffset,
        linkedClipId: linkedClip ? clip.linkedClipId : undefined
      }
      const right: TimelineClip = {
        ...clip,
        id: rightId,
        startTime: s.playheadTime,
        trimStart: clip.trimStart + splitOffset * (clip.speed ?? 1),
        duration:  clip.duration - splitOffset,
        linkedClipId: linkedRightId
      }

      let linkedLeft: TimelineClip | null = null
      let linkedRight: TimelineClip | null = null
      if (linkedClip && linkedRightId) {
        linkedLeft = {
          ...linkedClip,
          duration: splitOffset,
          linkedClipId: clip.id  // keeps pointing to left half (same id)
        }
        linkedRight = {
          ...linkedClip,
          id: linkedRightId,
          startTime: s.playheadTime,
          trimStart: linkedClip.trimStart + splitOffset * (linkedClip.speed ?? 1),
          duration:  linkedClip.duration - splitOffset,
          linkedClipId: rightId
        }
      }

      const newTransitions = s.transitions.map((t) => {
        if (t.fromClipId === clip.id) return { ...t, fromClipId: right.id }
        return t
      })

      const newClips = s.clips.flatMap((c) => {
        if (c.id === id) return [left, right]
        if (linkedClip && c.id === linkedClip.id) return [linkedLeft!, linkedRight!]
        return [c]
      })

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        selectedClipId:  right.id,
        selectedClipIds: [right.id],
        clips: newClips,
        transitions: newTransitions
      }
    }),

  rippleDelete: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const linkedId = clip.linkedClipId
      const gapEnd = clip.startTime + clip.duration
      const idsToRemove = new Set([id, ...(linkedId ? [linkedId] : [])])
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        selectedClipId:  idsToRemove.has(s.selectedClipId ?? '') ? null : s.selectedClipId,
        selectedClipIds: s.selectedClipIds.filter((x) => !idsToRemove.has(x)),
        clips: s.clips
          .filter((c) => !idsToRemove.has(c.id))
          .map((c) =>
            c.trackId === clip.trackId && c.startTime >= gapEnd - 0.001
              ? { ...c, startTime: c.startTime - clip.duration }
              : c
          ),
        transitions: s.transitions.filter(
          (t) => !idsToRemove.has(t.fromClipId) && !idsToRemove.has(t.toClipId)
        )
      }
    }),

  rippleDeleteSelected: () =>
    set((s) => {
      if (s.selectedClipIds.length === 0) return s
      const ids = new Set(s.selectedClipIds)
      // Also pull in any linked clips (audio pairs of selected video clips)
      for (const selId of s.selectedClipIds) {
        const linked = s.clips.find((c) => c.id === selId)?.linkedClipId
        if (linked) ids.add(linked)
      }
      const toDelete = s.clips
        .filter((c) => ids.has(c.id))
        .sort((a, b) => a.startTime - b.startTime)

      let clips = [...s.clips]
      let transitions = [...s.transitions]

      for (const del of toDelete) {
        // Look up the clip's current position — earlier iterations may have shifted it
        const current = clips.find((c) => c.id === del.id)
        if (!current) continue
        const gapEnd = current.startTime + current.duration
        clips = clips
          .filter((c) => c.id !== del.id)
          .map((c) =>
            c.trackId === del.trackId && c.startTime >= gapEnd - 0.001
              ? { ...c, startTime: c.startTime - current.duration }
              : c
          )
        transitions = transitions.filter(
          (t) => t.fromClipId !== del.id && t.toClipId !== del.id
        )
      }

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips,
        transitions,
        selectedClipId:  null,
        selectedClipIds: []
      }
    }),

  copySelectedClips: () =>
    set((s) => {
      if (s.selectedClipIds.length === 0) return s
      const toCopy = s.clips.filter((c) => s.selectedClipIds.includes(c.id))
      return { clipboard: toCopy }
    }),

  pasteClips: () =>
    set((s) => {
      if (!s.clipboard || s.clipboard.length === 0) return s
      const playhead = s.playheadTime
      const minStart = Math.min(...s.clipboard.map((c) => c.startTime))
      const offset = playhead - minStart

      // Build old→new ID map so linked pairs (video+audio) are re-wired correctly
      const idMap = new Map(s.clipboard.map((c) => [c.id, crypto.randomUUID()]))
      const pasted: TimelineClip[] = s.clipboard.map((c) => ({
        ...c,
        id: idMap.get(c.id)!,
        startTime: Math.max(0, c.startTime + offset),
        // Re-wire links within this paste batch; drop links to clips not in the batch
        linkedClipId: c.linkedClipId && idMap.has(c.linkedClipId)
          ? idMap.get(c.linkedClipId)
          : undefined
      }))

      const newIds = pasted.map((c) => c.id)
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: [...s.clips, ...pasted],
        selectedClipId:  newIds[0] ?? null,
        selectedClipIds: newIds
      }
    }),

  closeGap: (trackId, gapStartTime) =>
    set((s) => {
      const trackClips = s.clips
        .filter((c) => c.trackId === trackId)
        .sort((a, b) => a.startTime - b.startTime)

      // Find the clip that ends before the gap and the one that starts after
      let gapSize = 0
      for (let i = 0; i < trackClips.length - 1; i++) {
        const end  = trackClips[i].startTime + trackClips[i].duration
        const next = trackClips[i + 1].startTime
        // Check if the gapStartTime falls within this gap (±0.5s tolerance)
        if (gapStartTime >= end - 0.1 && gapStartTime <= next + 0.1) {
          gapSize = next - end
          break
        }
      }

      if (gapSize < 0.05) return s

      // Collect IDs of clips being shifted, then also collect their linked
      // counterparts so video and audio stay in sync across tracks.
      const shiftedIds = new Set(
        s.clips
          .filter((c) => c.trackId === trackId && c.startTime >= gapStartTime - 0.1)
          .map((c) => c.id)
      )
      const linkedIds = new Set(
        s.clips
          .filter((c) => shiftedIds.has(c.id) && c.linkedClipId)
          .map((c) => c.linkedClipId!)
      )

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.map((c) => {
          if (c.trackId === trackId && c.startTime >= gapStartTime - 0.1) {
            return { ...c, startTime: Math.max(0, c.startTime - gapSize) }
          }
          if (linkedIds.has(c.id)) {
            return { ...c, startTime: Math.max(0, c.startTime - gapSize) }
          }
          return c
        })
      }
    }),

  // ── Playhead / zoom ──────────────────────────────────────────────────────

  setPlayheadTime: (time) => set({ playheadTime: Math.max(0, time) }),

  setPxPerSec: (pxPerSec) =>
    set({ pxPerSec: Math.max(2, Math.min(1000, pxPerSec)) }),

  // ── Tracks ───────────────────────────────────────────────────────────────

  renameTrack: (trackId, name) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, name } : t))
    })),

  toggleMute: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, isMuted: !t.isMuted } : t))
    })),

  toggleSolo: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t))
    })),

  toggleLock: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, isLocked: !t.isLocked } : t
      )
    })),

  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  unlinkClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip?.linkedClipId) return s
      const linkedId = clip.linkedClipId
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: s.clips.map((c) =>
          c.id === id || c.id === linkedId
            ? { ...c, linkedClipId: undefined }
            : c
        )
      }
    }),

  /**
   * Insert a freeze frame (image clip) at the playhead, splitting the source
   * video clip in two. The right half — and its linked audio, if any — is
   * shifted forward by `duration` to make room. Audio gets a silent gap.
   */
  insertFreezeFrame: ({ sourceClipId, frameMediaClipId, frameThumbnail, freezeAt, duration }) =>
    set((s) => {
      const src = s.clips.find((c) => c.id === sourceClipId)
      if (!src || src.type !== 'video') return s

      const offset = freezeAt - src.startTime
      // Require at least 50ms on each side of the split
      if (offset < 0.05 || offset > src.duration - 0.05) return s

      const linkedAudio = src.linkedClipId
        ? s.clips.find((c) => c.id === src.linkedClipId) ?? null
        : null

      const rightVideoId = crypto.randomUUID()
      const rightAudioId = linkedAudio ? crypto.randomUUID() : undefined
      const freezeClipId = crypto.randomUUID()

      // ── Left video (reuses src.id) ────────────────────────────────────────
      const leftVideo: TimelineClip = {
        ...src,
        duration: offset,
        // Keep the link to the left audio half; right halves re-link to each other
        linkedClipId: linkedAudio ? linkedAudio.id : src.linkedClipId
      }

      // ── Right video ───────────────────────────────────────────────────────
      const rightVideo: TimelineClip = {
        ...src,
        id: rightVideoId,
        startTime: freezeAt + duration,
        trimStart: src.trimStart + offset * (src.speed ?? 1),
        duration:  src.duration - offset,
        linkedClipId: rightAudioId
      }

      // ── Freeze frame image clip ───────────────────────────────────────────
      const freezeClip: TimelineClip = {
        id:           freezeClipId,
        mediaClipId:  frameMediaClipId,
        trackId:      src.trackId,
        startTime:    freezeAt,
        duration,
        trimStart:    0,
        type:         'image',
        name:         'Freeze Frame',
        thumbnail:    frameThumbnail
      }

      // ── Left audio (reuses linkedAudio.id) ───────────────────────────────
      const leftAudio: TimelineClip | null = linkedAudio
        ? { ...linkedAudio, duration: offset, linkedClipId: src.id }
        : null

      // ── Right audio ───────────────────────────────────────────────────────
      const rightAudio: TimelineClip | null = linkedAudio && rightAudioId
        ? {
            ...linkedAudio,
            id:           rightAudioId,
            startTime:    freezeAt + duration,
            trimStart:    linkedAudio.trimStart + offset * (linkedAudio.speed ?? 1),
            duration:     linkedAudio.duration - offset,
            linkedClipId: rightVideoId
          }
        : null

      // ── Rebuild clip list ─────────────────────────────────────────────────
      const idsToReplace = new Set([src.id, ...(linkedAudio ? [linkedAudio.id] : [])])
      const kept = s.clips.filter((c) => !idsToReplace.has(c.id))

      const newClips: TimelineClip[] = [
        ...kept,
        leftVideo,
        ...(leftAudio ? [leftAudio] : []),
        freezeClip,
        rightVideo,
        ...(rightAudio ? [rightAudio] : [])
      ]

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: newClips
      }
    }),

  // ── Master volume ─────────────────────────────────────────────────────────

  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),

  // ── Clip audio ────────────────────────────────────────────────────────────

  setClipVolume: (clipId, volume) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, volume: Math.max(0, Math.min(2, volume)) } : c
      )
    })),

  setClipFades: (clipId, fadeIn, fadeOut) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== clipId) return c
        const maxFade = c.duration / 2
        return {
          ...c,
          fadeIn:  Math.max(0, Math.min(maxFade, fadeIn)),
          fadeOut: Math.max(0, Math.min(maxFade, fadeOut))
        }
      })
    })),

  // ── Phase 6 clip actions ──────────────────────────────────────────────────

  setClipSpeed: (clipId, speed) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, speed: Math.max(0.1, Math.min(16, speed)) } : c
      )
    })),

  setTextSettings: (clipId, settings) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, textSettings: settings } : c
      )
    })),

  setColorSettings: (clipId, settings) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, colorSettings: settings } : c
      )
    })),

  setCropSettings: (clipId, settings) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, cropSettings: settings } : c
      )
    })),

  setClipRole: (clipId, role) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, role } : c
      )
    })),

  // ── Transitions ───────────────────────────────────────────────────────────

  addTransition: (t) =>
    set((s) => {
      const filtered = s.transitions.filter(
        (x) => !(x.fromClipId === t.fromClipId && x.toClipId === t.toClipId)
      )
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        transitions: [...filtered, t]
      }
    }),

  removeTransition: (id) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      transitions: s.transitions.filter((t) => t.id !== id)
    })),

  // ── Markers ──────────────────────────────────────────────────────────────

  addMarker: (time) =>
    set((s) => ({
      markers: [...s.markers, {
        id: crypto.randomUUID(),
        time,
        label: '',
        color: '#f59e0b'
      }].sort((a, b) => a.time - b.time)
    })),

  removeMarker: (id) =>
    set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),

  updateMarkerLabel: (id, label) =>
    set((s) => ({
      markers: s.markers.map((m) => m.id === id ? { ...m, label } : m)
    })),

  updateMarkerColor: (id, color) =>
    set((s) => ({
      markers: s.markers.map((m) => m.id === id ? { ...m, color } : m)
    })),

  // ── Phase 10 clip actions ─────────────────────────────────────────────────

  setClipLabelColor: (clipId, color) =>
    set((s) => ({
      clips: s.clips.map((c) => c.id === clipId ? { ...c, labelColor: color } : c)
    })),

  renameClip: (clipId, name) =>
    set((s) => ({
      clips: s.clips.map((c) => c.id === clipId ? { ...c, name } : c)
    })),

  extractAudio: (videoClipId) =>
    set((s) => {
      const src = s.clips.find((c) => c.id === videoClipId)
      if (!src || src.type !== 'video') return s

      // Find or create an 'a2' track
      const a2Track = s.tracks.find((t) => t.id === 'a2') ?? s.tracks.find((t) => t.type === 'audio')
      if (!a2Track) return s

      const newAudioId = crypto.randomUUID()
      const extractedClip: TimelineClip = {
        ...src,
        id:           newAudioId,
        trackId:      a2Track.id,
        type:         'audio',
        linkedClipId: undefined
      }

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: [
          ...s.clips.map((c) =>
            c.id === videoClipId || c.id === src.linkedClipId
              ? { ...c, linkedClipId: undefined }
              : c
          ),
          extractedClip
        ]
      }
    }),

  pasteClipsWithRipple: () =>
    set((s) => {
      if (!s.clipboard || s.clipboard.length === 0) return s
      const playhead = s.playheadTime
      const minStart = Math.min(...s.clipboard.map((c) => c.startTime))
      const offset   = playhead - minStart

      const idMap = new Map(s.clipboard.map((c) => [c.id, crypto.randomUUID()]))
      const pasted: TimelineClip[] = s.clipboard.map((c) => ({
        ...c,
        id: idMap.get(c.id)!,
        startTime: Math.max(0, c.startTime + offset),
        linkedClipId: c.linkedClipId && idMap.has(c.linkedClipId)
          ? idMap.get(c.linkedClipId)
          : undefined
      }))

      const maxEnd = Math.max(...pasted.map((c) => c.startTime + c.duration))
      const rippleShift = maxEnd - playhead

      const shifted = s.clips.map((c) =>
        c.startTime >= playhead - 0.001
          ? { ...c, startTime: c.startTime + rippleShift }
          : c
      )

      const newIds = pasted.map((c) => c.id)
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        clips: [...shifted, ...pasted],
        selectedClipId:  newIds[0] ?? null,
        selectedClipIds: newIds
      }
    }),

  // ── Phase 10 track actions ────────────────────────────────────────────────

  toggleTrackCollapse: (trackId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, isCollapsed: !t.isCollapsed } : t
      )
    })),

  addTrack: (type) =>
    set((s) => {
      const count = s.tracks.filter((t) => t.type === type).length + 1
      const names: Record<string, string> = {
        video: `Video ${count}`, audio: `Audio ${count}`,
        music: `Music ${count}`, overlay: `Text ${count}`
      }
      const newTrack: Track = {
        id: crypto.randomUUID(),
        type,
        name: names[type] ?? `Track ${count}`,
        isLocked: false,
        isMuted: false,
        isSolo: false
      }
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        tracks: [...s.tracks, newTrack]
      }
    }),

  removeTrack: (trackId) =>
    set((s) => {
      const hasClips = s.clips.some((c) => c.trackId === trackId)
      const isSystem = ['v1', 'a1', 'a2', 'm1', 'overlay1'].includes(trackId)
      if (hasClips || isSystem) return s
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        tracks: s.tracks.filter((t) => t.id !== trackId)
      }
    }),

  // ── History ──────────────────────────────────────────────────────────────

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return {
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future.slice(0, 49)],
        tracks: prev.tracks,
        clips:  prev.clips,
        transitions: prev.transitions
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s
      const next = s.future[0]
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: s.future.slice(1),
        tracks: next.tracks,
        clips:  next.clips,
        transitions: next.transitions
      }
    })
}))
