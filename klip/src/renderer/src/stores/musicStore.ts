import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MusicTrack {
  id: string
  title: string
  artist: string
  duration: number
  filePath: string
  tags: string[]
  addedAt: number
}

interface MusicState {
  tracks: MusicTrack[]
  searchQuery: string

  setSearchQuery: (q: string) => void
  addTracks:  (tracks: MusicTrack[]) => void
  removeTrack: (id: string) => void
  updateTrack: (id: string, updates: Partial<Pick<MusicTrack, 'title' | 'artist' | 'tags'>>) => void
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set) => ({
      tracks: [],
      searchQuery: '',

      setSearchQuery: (q) => set({ searchQuery: q }),

      addTracks: (newTracks) =>
        set((s) => {
          const existingPaths = new Set(s.tracks.map((t) => t.filePath))
          const toAdd = newTracks.filter((t) => !existingPaths.has(t.filePath))
          return { tracks: [...s.tracks, ...toAdd] }
        }),

      removeTrack: (id) =>
        set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),

      updateTrack: (id, updates) =>
        set((s) => ({
          tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        }))
    }),
    {
      name: 'klip-music-library',
      partialize: (s) => ({ tracks: s.tracks })
    }
  )
)
