import { create } from 'zustand'
import type { MediaClip } from '@/types/media'

interface MediaState {
  clips: MediaClip[]
  selectedClipId: string | null

  addClip: (clip: MediaClip) => void
  removeClip: (id: string) => void
  updateClip: (id: string, updates: Partial<MediaClip>) => void
  renameClip: (id: string, name: string) => void
  selectClip: (id: string | null) => void
  markOnTimeline: (id: string, onTimeline: boolean) => void
}

export const useMediaStore = create<MediaState>((set) => ({
  clips: [],
  selectedClipId: null,

  addClip: (clip) =>
    set((state) => ({ clips: [...state.clips, clip] })),

  removeClip: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
    })),

  updateClip: (id, updates) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c))
    })),

  renameClip: (id, name) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, name } : c))
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  markOnTimeline: (id, onTimeline) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, isOnTimeline: onTimeline } : c))
    }))
}))
