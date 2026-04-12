import { create } from 'zustand'
import type { MediaClip } from '@/types/media'

interface SourceViewerState {
  isOpen: boolean
  clip: MediaClip | null
  /** Per-clip in-points (trimStart when placed) — persisted within the session. */
  inPoints: Record<string, number>
  /** Per-clip out-points — persisted within the session. */
  outPoints: Record<string, number>

  openClip: (clip: MediaClip) => void
  closeViewer: () => void
  setInPoint:  (clipId: string, time: number) => void
  setOutPoint: (clipId: string, time: number) => void
}

export const useSourceViewerStore = create<SourceViewerState>((set) => ({
  isOpen:    false,
  clip:      null,
  inPoints:  {},
  outPoints: {},

  openClip: (clip) => set({ isOpen: true, clip }),
  closeViewer: ()  => set({ isOpen: false, clip: null }),

  setInPoint: (clipId, time) =>
    set((s) => ({ inPoints: { ...s.inPoints, [clipId]: time } })),

  setOutPoint: (clipId, time) =>
    set((s) => ({ outPoints: { ...s.outPoints, [clipId]: time } }))
}))
