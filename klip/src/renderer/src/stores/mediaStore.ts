import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MediaClip, ProxyStatus } from '@/types/media'

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

  /** Update proxy status and optionally progress for a clip. */
  setProxyStatus: (id: string, status: ProxyStatus, progress?: number) => void

  /** Mark a clip's proxy as ready with the given path. */
  setProxyReady: (id: string, proxyPath: string) => void

  /**
   * Batch-check disk for existing proxy files for all video clips.
   * Updates proxyPath + proxyStatus = 'ready' for any that exist.
   * Resets status to 'none' for any that were 'ready' but the file is now gone.
   */
  checkExistingProxies: () => Promise<void>
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
      },

      setProxyStatus: (id, status, progress) =>
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === id
              ? { ...c, proxyStatus: status, proxyProgress: progress ?? c.proxyProgress }
              : c
          )
        })),

      setProxyReady: (id, proxyPath) =>
        set((state) => ({
          clips: state.clips.map((c) =>
            c.id === id
              ? { ...c, proxyStatus: 'ready' as ProxyStatus, proxyPath, proxyProgress: 1 }
              : c
          )
        })),

      checkExistingProxies: async () => {
        const { clips } = get()
        const videoClips = clips.filter((c) => c.type === 'video')
        if (videoClips.length === 0) return
        try {
          const ids = videoClips.map((c) => c.id)
          const results = await window.api.proxy.checkProxiesBatch(ids)
          set((state) => ({
            clips: state.clips.map((c) => {
              if (c.type !== 'video') return c
              const found = results[c.id]
              if (found) {
                return { ...c, proxyPath: found, proxyStatus: 'ready' as ProxyStatus, proxyProgress: 1 }
              }
              // If we thought it was ready but the file is gone, reset
              if (c.proxyStatus === 'ready') {
                return { ...c, proxyPath: null, proxyStatus: 'none' as ProxyStatus, proxyProgress: 0 }
              }
              return c
            })
          }))
        } catch {
          // Silently fail
        }
      }
    }),
    {
      name: 'klip-media-bin',
      // Only persist the clips array — UI state (selectedClipId) resets on launch
      partialize: (state) => ({ clips: state.clips }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Clips stuck mid-generation when the app was closed → reset their status
        state.clips = state.clips.map((c) => ({
          ...c,
          thumbnailStatus: c.thumbnailStatus === 'generating' ? 'error' as const : c.thumbnailStatus,
          // Proxy that was still generating when the app closed → reset to none
          proxyStatus: c.proxyStatus === 'generating' ? 'none' as ProxyStatus : (c.proxyStatus ?? 'none'),
          proxyProgress: c.proxyStatus === 'generating' ? 0 : (c.proxyProgress ?? 0)
        }))
      }
    }
  )
)
