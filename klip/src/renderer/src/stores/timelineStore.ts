import { create } from 'zustand'
import type { Track, TimelineClip, HistoryEntry } from '@/types/timeline'

type TrimPatch = Partial<Pick<TimelineClip, 'startTime' | 'trimStart' | 'duration'>>

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1', type: 'video', name: 'Video 1', isLocked: false, isMuted: false },
  { id: 'a1', type: 'audio', name: 'Audio 1', isLocked: false, isMuted: false },
  { id: 'm1', type: 'music', name: 'Music',   isLocked: false, isMuted: false }
]

interface TimelineState {
  tracks: Track[]
  clips: TimelineClip[]
  selectedClipId: string | null
  playheadTime: number
  pxPerSec: number

  // Undo / redo history (snapshots of tracks + clips)
  past: HistoryEntry[]
  future: HistoryEntry[]

  // ── Clip actions ──────────────────────────────────────────────────────────
  addClip: (clip: TimelineClip) => void
  removeClip: (id: string) => void
  selectClip: (id: string | null) => void
  moveClip: (id: string, startTime: number) => void
  trimClip: (id: string, patch: TrimPatch) => void
  splitClip: (id: string) => void
  rippleDelete: (id: string) => void

  // ── Playhead / zoom ───────────────────────────────────────────────────────
  setPlayheadTime: (time: number) => void
  setPxPerSec: (pxPerSec: number) => void

  // ── Track actions ─────────────────────────────────────────────────────────
  renameTrack: (trackId: string, name: string) => void

  // ── History ───────────────────────────────────────────────────────────────
  undo: () => void
  redo: () => void
}

/** Deep-clone only the undoable slice of state. */
function snapshot(state: Pick<TimelineState, 'tracks' | 'clips'>): HistoryEntry {
  return {
    tracks: state.tracks.map((t) => ({ ...t })),
    clips: state.clips.map((c) => ({ ...c }))
  }
}

export const useTimelineStore = create<TimelineState>((set) => ({
  tracks: DEFAULT_TRACKS,
  clips: [],
  selectedClipId: null,
  playheadTime: 0,
  pxPerSec: 80,
  past: [],
  future: [],

  // ── Clips ────────────────────────────────────────────────────────────────

  addClip: (clip) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: [...s.clips, clip],
      selectedClipId: clip.id
    })),

  removeClip: (id) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.filter((c) => c.id !== id),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  moveClip: (id, startTime) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) =>
        c.id === id ? { ...c, startTime: Math.max(0, startTime) } : c
      )
    })),

  trimClip: (id, patch) =>
    set((s) => ({
      past: [...s.past.slice(-49), snapshot(s)],
      future: [],
      clips: s.clips.map((c) => {
        if (c.id !== id) return c
        const next = { ...c, ...patch }
        // Clamp so nothing goes negative
        next.startTime = Math.max(0, next.startTime ?? c.startTime)
        next.trimStart = Math.max(0, next.trimStart ?? c.trimStart)
        next.duration = Math.max(0.1, next.duration ?? c.duration)
        return next
      })
    })),

  splitClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const splitOffset = s.playheadTime - clip.startTime
      if (splitOffset <= 0.05 || splitOffset >= clip.duration - 0.05) return s

      const left: TimelineClip = { ...clip, duration: splitOffset }
      const right: TimelineClip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: s.playheadTime,
        trimStart: clip.trimStart + splitOffset,
        duration: clip.duration - splitOffset
      }

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        selectedClipId: right.id,
        clips: s.clips.flatMap((c) => (c.id === id ? [left, right] : [c]))
      }
    }),

  rippleDelete: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const gapEnd = clip.startTime + clip.duration
      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
        clips: s.clips
          .filter((c) => c.id !== id)
          .map((c) =>
            c.trackId === clip.trackId && c.startTime >= gapEnd - 0.001
              ? { ...c, startTime: c.startTime - clip.duration }
              : c
          )
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

  // ── History ──────────────────────────────────────────────────────────────

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]
      return {
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future.slice(0, 49)],
        tracks: prev.tracks,
        clips: prev.clips
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
        clips: next.clips
      }
    })
}))
