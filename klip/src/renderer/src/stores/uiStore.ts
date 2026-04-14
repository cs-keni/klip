import { create } from 'zustand'

/**
 * Global UI modal visibility — kept in a store so the command palette and
 * other non-component code can open/close dialogs without prop-drilling.
 */
interface UIState {
  showExport:             boolean
  showSettings:           boolean
  showProjectSettings:    boolean
  /** When true, hovering any element with data-help="id" shows a rich tooltip */
  whatsThisMode:          boolean
  setShowExport:          (v: boolean) => void
  setShowSettings:        (v: boolean) => void
  setShowProjectSettings: (v: boolean) => void
  setWhatsThisMode:       (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  showExport:             false,
  showSettings:           false,
  showProjectSettings:    false,
  whatsThisMode:          false,
  setShowExport:          (v) => set({ showExport: v }),
  setShowSettings:        (v) => set({ showSettings: v }),
  setShowProjectSettings: (v) => set({ showProjectSettings: v }),
  setWhatsThisMode:       (v) => set({ whatsThisMode: v })
}))
