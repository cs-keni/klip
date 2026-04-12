import { useState, useCallback, useEffect } from 'react'
import { useMediaStore } from '@/stores/mediaStore'
import Sidebar from './Sidebar'
import PreviewPanel from './PreviewPanel'
import TimelinePanel from './TimelinePanel'
import TopToolbar from './TopToolbar'
import ResizeHandle from './ResizeHandle'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 264

const TIMELINE_MIN = 120
const TIMELINE_MAX = 520
const TIMELINE_DEFAULT = 220

export default function AppLayout(): JSX.Element {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_DEFAULT)
  const { checkMissingFiles } = useMediaStore()

  // On launch, verify that all persisted file paths still exist on disk
  useEffect(() => { checkMissingFiles() }, [checkMissingFiles])

  const resizeSidebar = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + delta)))
  }, [])

  const resizeTimeline = useCallback((delta: number) => {
    // Dragging down = smaller timeline, up = bigger timeline
    setTimelineHeight((h) => Math.max(TIMELINE_MIN, Math.min(TIMELINE_MAX, h - delta)))
  }, [])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-base)]">
      <TopToolbar />

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
