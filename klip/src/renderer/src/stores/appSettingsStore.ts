import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppSettings {
  /** Default folder for export output. Null = prompt every time. */
  defaultExportFolder: string | null
}

interface AppSettingsState extends AppSettings {
  setDefaultExportFolder: (folder: string | null) => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      defaultExportFolder: null,

      setDefaultExportFolder: (folder) => set({ defaultExportFolder: folder })
    }),
    {
      name: 'klip-app-settings'
    }
  )
)
