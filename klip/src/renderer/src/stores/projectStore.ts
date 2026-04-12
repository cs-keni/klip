import { create } from 'zustand'

export type Resolution = '1080p' | '1440p' | '4k'
export type FrameRate = 24 | 30 | 60
export type AspectRatio = '16:9' | '9:16' | '1:1'

export interface ProjectSettings {
  resolution: Resolution
  frameRate: FrameRate
  aspectRatio: AspectRatio
}

interface ProjectState {
  projectName: string | null
  projectPath: string | null
  hasUnsavedChanges: boolean
  settings: ProjectSettings
  // Actions
  newProject: (name: string) => void
  setProjectName: (name: string) => void
  setProjectPath: (path: string) => void
  setUnsavedChanges: (value: boolean) => void
  updateSettings: (partial: Partial<ProjectSettings>) => void
}

const DEFAULT_SETTINGS: ProjectSettings = {
  resolution: '1080p',
  frameRate: 60,
  aspectRatio: '16:9'
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectName: null,
  projectPath: null,
  hasUnsavedChanges: false,
  settings: { ...DEFAULT_SETTINGS },

  newProject: (name) =>
    set({
      projectName: name,
      projectPath: null,
      hasUnsavedChanges: false,
      settings: { ...DEFAULT_SETTINGS }
    }),

  setProjectName: (name) => set({ projectName: name, hasUnsavedChanges: true }),

  setProjectPath: (path) => set({ projectPath: path }),

  setUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
      hasUnsavedChanges: true
    }))
}))
