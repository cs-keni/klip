import { type ReactNode } from 'react'
import { MousePointer2, Scissors, Undo2, Redo2, ZoomOut, ZoomIn, Save, Settings, HelpCircle, Play, Type, Clapperboard, MessageCircleQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { saveProject } from '@/lib/projectIO'
import { useTimelineStore } from '@/stores/timelineStore'
import { useProjectStore } from '@/stores/projectStore'

const MIN_PX_PER_SEC = 2
const MAX_PX_PER_SEC = 1000

interface TopToolbarProps {
  onExportClick: () => void
  onAddTextClip: () => void
  onSettingsClick: () => void
  onProjectSettingsClick: () => void
  onHelpClick: () => void
  onWhatsThisClick: () => void
  whatsThisActive: boolean
}

const RESOLUTION_LABEL: Record<string, string> = {
  '1080p': '1080p',
  '1440p': '1440p',
  '4k':    '4K'
}

export default function TopToolbar({
  onExportClick,
  onAddTextClip,
  onSettingsClick,
  onProjectSettingsClick,
  onHelpClick,
  onWhatsThisClick,
  whatsThisActive
}: TopToolbarProps): JSX.Element {
  const { undo, redo, past, future, pxPerSec, setPxPerSec } = useTimelineStore()
  const { settings } = useProjectStore()

  return (
    <div className="flex items-center h-[42px] px-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] gap-1 shrink-0">

      {/* Tool selection */}
      <ToolGroup>
        <ToolBtn icon={<MousePointer2 size={14} />} label="Select  V" active dataHelp="multi-select" />
        <ToolBtn icon={<Scissors size={14} />} label="Razor / Split  S" dataHelp="split-clip" />
      </ToolGroup>

      <ToolDivider />

      {/* Overlay tools */}
      <ToolGroup>
        <ToolBtn
          icon={<Type size={14} />}
          label="Add Text Overlay  T"
          onClick={onAddTextClip}
          dataHelp="text-overlays"
        />
      </ToolGroup>

      <ToolDivider />

      {/* History */}
      <ToolGroup>
        <ToolBtn icon={<Undo2 size={14} />} label={past.length === 0 ? 'Nothing to undo (Ctrl+Z)' : 'Undo  Ctrl+Z'} onClick={undo} disabled={past.length === 0} dataHelp="undo-redo" />
        <ToolBtn icon={<Redo2 size={14} />} label={future.length === 0 ? 'Nothing to redo (Ctrl+Shift+Z)' : 'Redo  Ctrl+Shift+Z'} onClick={redo} disabled={future.length === 0} dataHelp="undo-redo" />
      </ToolGroup>

      <ToolDivider />

      {/* Timeline zoom */}
      <ToolGroup>
        <ToolBtn icon={<ZoomOut size={14} />} label="Zoom Out  -" onClick={() => setPxPerSec(Math.max(MIN_PX_PER_SEC, pxPerSec * 0.75))} dataHelp="zoom-fit" />
        <ToolBtn icon={<ZoomIn size={14} />} label="Zoom In  +" onClick={() => setPxPerSec(Math.min(MAX_PX_PER_SEC, pxPerSec * 1.35))} dataHelp="zoom-fit" />
      </ToolGroup>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Project settings pill */}
      <Tooltip content="Project settings — resolution, frame rate, aspect ratio">
        <button
          data-help="project-settings"
          onClick={onProjectSettingsClick}
          className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)] transition-all duration-150 active:scale-[0.96] shrink-0 group"
        >
          <Clapperboard size={11} className="text-[var(--accent)] shrink-0" />
          <span className="text-[11px] font-medium tabular-nums">
            {RESOLUTION_LABEL[settings.resolution]} · {settings.frameRate} fps
          </span>
        </button>
      </Tooltip>

      <ToolDivider />

      {/* Export CTA */}
      <Tooltip content="Export video">
        <button
          data-tutorial="export-btn"
          data-help="export-btn"
          onClick={onExportClick}
          className="flex items-center gap-1.5 px-3 h-7 rounded text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100 active:scale-[0.96] shrink-0"
        >
          <Play size={11} />
          Export
        </button>
      </Tooltip>

      <ToolDivider />

      {/* Utility */}
      <ToolGroup>
        <ToolBtn icon={<Save size={14} />} label="Save  Ctrl+S" onClick={saveProject} dataHelp="auto-save" />
        <ToolBtn icon={<Settings size={14} />} label="Settings" onClick={onSettingsClick} dataHelp="settings" />
        <ToolBtn icon={<HelpCircle size={14} />} label="Keyboard shortcuts  ?" onClick={onHelpClick} dataHelp="keyboard-shortcuts" />
        <Tooltip content={whatsThisActive ? 'Exit What\'s This mode  Esc' : 'What\'s This? — hover any element to learn what it does'}>
          <button
            onClick={onWhatsThisClick}
            aria-label={whatsThisActive ? 'Exit What\'s This mode' : 'What\'s This?'}
            aria-pressed={whatsThisActive}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded transition-all duration-100 active:scale-[0.93]',
              whatsThisActive
                ? 'bg-[var(--accent)] text-white shadow-sm ring-2 ring-[var(--accent)]/30'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]'
            )}
          >
            <MessageCircleQuestion size={14} />
          </button>
        </Tooltip>
      </ToolGroup>
    </div>
  )
}

function ToolGroup({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function ToolBtn({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
  dataHelp
}: {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  dataHelp?: string
}): JSX.Element {
  return (
    <Tooltip content={label}>
      <button
        disabled={disabled}
        onClick={onClick}
        data-help={dataHelp}
        aria-label={label}
        className={cn(
          'flex items-center justify-center w-7 h-7 rounded transition-all duration-100 active:scale-[0.93]',
          'disabled:opacity-35 disabled:pointer-events-none',
          active
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]'
        )}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

function ToolDivider(): JSX.Element {
  return <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1.5 shrink-0" />
}
