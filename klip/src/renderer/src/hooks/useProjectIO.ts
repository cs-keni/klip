import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/stores/projectStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useMediaStore } from '@/stores/mediaStore'
import { saveProject, saveProjectAs, serializeProject } from '@/lib/projectIO'

const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Mount once at the App level.
 * - Marks project dirty when timeline or media state changes.
 * - Registers Ctrl+S / Ctrl+Shift+S keyboard shortcuts.
 * - Auto-saves every 2 minutes when there are unsaved changes and a project path exists.
 */
export function useProjectIO(): void {
  // Track whether the project is "live" (a project name exists), so we don't
  // mark dirty on welcome-screen store initialization.
  const isLiveRef = useRef(false)

  // ── Mark dirty on meaningful store mutations ─────────────────────────────
  useEffect(() => {
    // Wait one tick so initial state hydration doesn't trigger dirty
    const timer = setTimeout(() => {
      isLiveRef.current = true
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Subscribe to timeline data (tracks, clips, transitions, markers) — not playhead/zoom/selection
    const unsubTimeline = useTimelineStore.subscribe((state, prev) => {
      if (!isLiveRef.current) return
      if (
        state.tracks !== prev.tracks ||
        state.clips !== prev.clips ||
        state.transitions !== prev.transitions ||
        state.markers !== prev.markers
      ) {
        useProjectStore.getState().setUnsavedChanges(true)
      }
    })

    // Subscribe to media bin changes
    const unsubMedia = useMediaStore.subscribe((state, prev) => {
      if (!isLiveRef.current) return
      if (state.clips !== prev.clips) {
        useProjectStore.getState().setUnsavedChanges(true)
      }
    })

    return () => {
      unsubTimeline()
      unsubMedia()
    }
  }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return
      e.preventDefault()
      if (e.shiftKey) {
        saveProjectAs()
      } else {
        saveProject()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Auto-save interval ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const { hasUnsavedChanges, projectName } = useProjectStore.getState()
      // Write to autosave temp file whenever there are unsaved changes in an active project.
      // This covers both unsaved new projects and modified existing projects.
      if (hasUnsavedChanges && projectName) {
        const data = serializeProject()
        void window.api.project.autosave(data)
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
