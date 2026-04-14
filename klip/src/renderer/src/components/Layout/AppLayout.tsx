import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useMediaStore } from '@/stores/mediaStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useUIStore } from '@/stores/uiStore'
import { useProxyEvents } from '@/hooks/useProxyEvents'
import Sidebar from './Sidebar'
import PreviewPanel from './PreviewPanel'
import TimelinePanel from './TimelinePanel'
import TopToolbar from './TopToolbar'
import ResizeHandle from './ResizeHandle'
import ExportDialog from '@/components/Export/ExportDialog'
import SettingsDialog from '@/components/Settings/SettingsDialog'
import ProjectSettingsModal from '@/components/Settings/ProjectSettingsModal'
import SourceClipViewer from '@/components/MediaBin/SourceClipViewer'
import CommandPalette from '@/components/CommandPalette/CommandPalette'
import TutorialOverlay from '@/components/Tutorial/TutorialOverlay'
import type { TimelineClip, TextSettings } from '@/types/timeline'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 264

const TIMELINE_MIN = 120
const TIMELINE_MAX = 520
const TIMELINE_DEFAULT = 220

const DEFAULT_TEXT_SETTINGS: TextSettings = {
  content:         'New Text',
  fontSize:        48,
  fontFamily:      'Arial',
  fontColor:       '#ffffff',
  bgColor:         'transparent',
  bold:            false,
  italic:          false,
  alignment:       'center',
  positionX:       0.5,
  positionY:       0.8,
  animationPreset: 'none'
}

export default function AppLayout(): JSX.Element {
  const [sidebarWidth, setSidebarWidth]     = useState(SIDEBAR_DEFAULT)
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT)
  const [showShortcuts, setShowShortcuts]   = useState(false)
  const { checkMissingFiles } = useMediaStore()

  const { tracks, playheadTime, addClip } = useTimelineStore()

  const {
    showExport, showSettings, showProjectSettings,
    setShowExport, setShowSettings, setShowProjectSettings
  } = useUIStore()

  // Mount proxy IPC event listeners and check disk for existing proxies
  useProxyEvents()

  // On launch, verify that all persisted file paths still exist on disk
  useEffect(() => { checkMissingFiles() }, [checkMissingFiles])

  const resizeSidebar = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + delta)))
  }, [])

  const resizeTimeline = useCallback((delta: number) => {
    setTimelineHeight((h) => Math.max(TIMELINE_MIN, Math.min(TIMELINE_MAX, h - delta)))
  }, [])

  // Add a text clip to the overlay track at the current playhead
  const handleAddTextClip = useCallback(() => {
    const overlayTrack = tracks.find((t) => t.type === 'overlay')
    if (!overlayTrack) return
    const id = crypto.randomUUID()
    const clip: TimelineClip = {
      id,
      mediaClipId:  id,
      trackId:      overlayTrack.id,
      startTime:    playheadTime,
      duration:     5,
      trimStart:    0,
      type:         'text',
      name:         'Text',
      thumbnail:    null,
      textSettings: { ...DEFAULT_TEXT_SETTINGS }
    }
    addClip(clip)
  }, [tracks, playheadTime, addClip])

  // Allow the command palette to trigger "add text clip" via a custom event
  useEffect(() => {
    const handler = (): void => handleAddTextClip()
    window.addEventListener('klip:add-text-clip', handler)
    return () => window.removeEventListener('klip:add-text-clip', handler)
  }, [handleAddTextClip])

  // ? key opens keyboard cheat sheet
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setShowShortcuts((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      <TopToolbar
        onExportClick={() => setShowExport(true)}
        onAddTextClip={handleAddTextClip}
        onSettingsClick={() => setShowSettings(true)}
        onProjectSettingsClick={() => setShowProjectSettings(true)}
        onHelpClick={() => setShowShortcuts(true)}
      />

      <AnimatePresence>
        {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showShortcuts && (
          <SettingsDialog
            onClose={() => setShowShortcuts(false)}
            initialTab="shortcuts"
          />
        )}
      </AnimatePresence>

      <ProjectSettingsModal
        open={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
      />

      {/* Command palette — portal, always mounted, renders when open */}
      <CommandPalette />

      {/* First-launch walkthrough */}
      <TutorialOverlay />

      <SourceClipViewer />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className="shrink-0 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <Sidebar />
        </div>

        <ResizeHandle direction="horizontal" onResize={resizeSidebar} />

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Preview — takes all space above timeline */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <PreviewPanel />
          </div>

          <ResizeHandle direction="vertical" onResize={resizeTimeline} />

          {/* Timeline — fixed height, resizable */}
          <div
            data-tutorial="timeline-panel"
            className="shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] overflow-hidden"
            style={{ height: timelineHeight }}
          >
            <TimelinePanel />
          </div>
        </div>
      </div>
    </div>
  )
}
