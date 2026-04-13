import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  /** Default folder for export output. Null = prompt every time. */
  defaultExportFolder: string | null
  /** Whether snap-to-clip-edges is on by default for new sessions. */
  snapByDefault: boolean
}

interface AppSettingsState extends AppSettings {
  setDefaultExportFolder: (folder: string | null) => void
  setSnapByDefault: (v: boolean) => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      defaultExportFolder: null,
      snapByDefault:       true,

      setDefaultExportFolder: (folder) => set({ defaultExportFolder: folder }),
      setSnapByDefault:       (v)      => set({ snapByDefault: v })
    }),
    {
      name: 'klip-app-settings'
    }
  )
)
