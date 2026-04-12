import { create } from 'zustand'
import type {
  Track, TimelineClip, HistoryEntry, Transition,
  TextSettings, ColorSettings, CropSettings
} from '@/types/timeline'

type TrimPatch = Partial<Pick<TimelineClip, 'startTime' | 'trimStart' | 'duration'>>

const DEFAULT_TRACKS: Track[] = [
  { id: 'v1',      type: 'video',   name: 'Video 1', isLocked: false, isMuted: false, isSolo: false },
  { id: 'a1',      type: 'audio',   name: 'Audio 1', isLocked: false, isMuted: false, isSolo: false },
  { id: 'm1',      type: 'music',   name: 'Music',   isLocked: false, isMuted: false, isSolo: false },
  { id: 'overlay1',type: 'overlay', name: 'Text',    isLocked: false, isMuted: false, isSolo: false }
]

interface TimelineState {
  tracks: Track[]
  clips: TimelineClip[]
  transitions: Transition[]
  selectedClipId: string | null
  playheadTime: number
  pxPerSec: number

  // Undo / redo history
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

  // ── Playback ──────────────────────────────────────────────────────────────
  isPlaying: boolean
  setIsPlaying: (v: boolean) => void

  // ── Playhead / zoom ───────────────────────────────────────────────────────
  setPlayheadTime: (time: number) => void
  setPxPerSec: (pxPerSec: number) => void

  // ── Track actions ─────────────────────────────────────────────────────────
  renameTrack: (trackId: string, name: string) => void
  toggleMute:  (trackId: string) => void
  toggleSolo:  (trackId: string) => void

  // ── Clip audio ────────────────────────────────────────────────────────────
  setClipVolume: (clipId: string, volume: number) => void

  // ── Phase 6 clip actions ──────────────────────────────────────────────────
  setClipSpeed:     (clipId: string, speed: number) => void
  setTextSettings:  (clipId: string, settings: TextSettings) => void
  setColorSettings: (clipId: string, settings: ColorSettings | undefined) => void
  setCropSettings:  (clipId: string, settings: CropSettings | undefined) => void

  // ── Transitions ───────────────────────────────────────────────────────────
  addTransition:    (t: Transition) => void
  removeTransition: (id: string) => void

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
  selectedClipId: null,
  playheadTime:   0,
  pxPerSec:       80,
  isPlaying:      false,
  past:           [],
  future:         [],

  setIsPlaying: (v) => set({ isPlaying: v }),

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
      transitions: s.transitions.filter((t) => t.fromClipId !== id && t.toClipId !== id),
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
        next.startTime = Math.max(0, next.startTime ?? c.startTime)
        next.trimStart = Math.max(0, next.trimStart ?? c.trimStart)
        next.duration  = Math.max(0.1, next.duration ?? c.duration)
        return next
      })
    })),

  splitClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id)
      if (!clip) return s
      const splitOffset = s.playheadTime - clip.startTime
      if (splitOffset <= 0.05 || splitOffset >= clip.duration - 0.05) return s

      const left: TimelineClip  = { ...clip, duration: splitOffset }
      const right: TimelineClip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: s.playheadTime,
        trimStart: clip.trimStart + splitOffset * (clip.speed ?? 1),
        duration:  clip.duration - splitOffset
      }

      // Re-point any transition that crosses the split
      const newTransitions = s.transitions.map((t) => {
        if (t.fromClipId === clip.id) return { ...t, fromClipId: right.id }
        return t
      })

      return {
        past: [...s.past.slice(-49), snapshot(s)],
        future: [],
        selectedClipId: right.id,
        clips: s.clips.flatMap((c) => (c.id === id ? [left, right] : [c])),
        transitions: newTransitions
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
          ),
        transitions: s.transitions.filter((t) => t.fromClipId !== id && t.toClipId !== id)
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

  // ── Clip audio ────────────────────────────────────────────────────────────

  setClipVolume: (clipId, volume) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, volume: Math.max(0, Math.min(1, volume)) } : c
      )
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

  // ── Transitions ───────────────────────────────────────────────────────────

  addTransition: (t) =>
    set((s) => {
      // Replace any existing transition between the same pair
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
