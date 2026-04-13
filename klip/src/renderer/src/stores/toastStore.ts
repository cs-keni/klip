import { create } from 'zustand'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number  // ms until auto-dismiss
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, type?: ToastType, duration?: number) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message, type = 'info', duration = 3000) =>
    set((s) => ({
      // Keep at most 3 visible — drop the oldest if over limit
      toasts: [
        ...s.toasts.slice(-2),
        { id: crypto.randomUUID(), message, type, duration }
      ]
    })),

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/**
 * Standalone function — can be called from outside React (e.g. projectIO.ts).
 */
export function toast(message: string, type: ToastType = 'info', duration = 3000): void {
  useToastStore.getState().push(message, type, duration)
}
