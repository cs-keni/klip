import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  /** Default folder for export output. Null = prompt every time. */
  defaultExportFolder: string | null
  /** Whether snap-to-clip-edges is on by default for new sessions. */
  snapByDefault: boolean
  /** Root folder for the music library — import dialog opens here. Null = system default. */
  musicLibraryFolder: string | null
  /** Whether the user has completed or skipped the first-launch walkthrough. */
  hasSeenWalkthrough: boolean
}

interface AppSettingsState extends AppSettings {
  setDefaultExportFolder: (folder: string | null) => void
  setSnapByDefault: (v: boolean) => void
  setMusicLibraryFolder: (folder: string | null) => void
  setHasSeenWalkthrough: (v: boolean) => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      defaultExportFolder: null,
      snapByDefault:       true,
      musicLibraryFolder:  null,
      hasSeenWalkthrough:  false,

      setDefaultExportFolder: (folder) => set({ defaultExportFolder: folder }),
      setSnapByDefault:       (v)      => set({ snapByDefault: v }),
      setMusicLibraryFolder:  (folder) => set({ musicLibraryFolder: folder }),
      setHasSeenWalkthrough:  (v)      => set({ hasSeenWalkthrough: v })
    }),
    {
      name: 'klip-app-settings'
    }
  )
)
