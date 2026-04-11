import { create } from 'zustand'

type View = 'welcome' | 'editor'

interface AppState {
  view: View
  setView: (view: View) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'welcome',
  setView: (view) => set({ view })
}))
