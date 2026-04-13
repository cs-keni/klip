import { create } from 'zustand'

/**
 * Global UI modal visibility — kept in a store so the command palette and
 * other non-component code can open/close dialogs without prop-drilling.
 */
interface UIState {
  showExport:      boolean
  showSettings:    boolean
  setShowExport:   (v: boolean) => void
  setShowSettings: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  showExport:      false,
  showSettings:    false,
  setShowExport:   (v) => set({ showExport: v }),
  setShowSettings: (v) => set({ showSettings: v })
}))
