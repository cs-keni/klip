import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

  /** Relink a missing clip to a new file path. Clears isMissing and resets thumbnail. */
  relinkClip: (id: string, newPath: string) => void

  /** Check all file paths against disk and mark isMissing accordingly. */
  checkMissingFiles: () => Promise<void>
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set, get) => ({
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
        })),

      relinkClip: (id, newPath) =>
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === id
              ? {
                  ...c,
                  path: newPath,
                  isMissing: false,
                  thumbnail: null,
                  thumbnailStatus: 'generating' as const
                }
              : c
          )
        })),

      checkMissingFiles: async () => {
        const { clips } = get()
        const paths = clips.filter((c) => c.path).map((c) => c.path)
        if (paths.length === 0) return
        try {
          const results = await window.api.media.checkFilesExist(paths)
          set((state) => ({
            clips: state.clips.map((c) =>
              c.path ? { ...c, isMissing: !results[c.path] } : c
            )
          }))
        } catch {
          // Silently fail — isMissing stays as-is if the check errors
        }
      }
    }),
    {
      name: 'klip-media-bin',
      // Only persist the clips array — UI state (selectedClipId) resets on launch
      partialize: (state) => ({ clips: state.clips }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Clips stuck mid-generation when the app was closed → mark as error
        state.clips = state.clips.map((c) =>
          c.thumbnailStatus === 'generating'
            ? { ...c, thumbnailStatus: 'error' as const }
            : c
        )
      }
    }
  )
)
