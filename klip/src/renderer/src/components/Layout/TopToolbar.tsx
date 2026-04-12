import { type ReactNode } from 'react'
import { MousePointer2, Scissors, Undo2, Redo2, ZoomOut, ZoomIn, Save, Settings, HelpCircle, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

interface TopToolbarProps {
  onExportClick: () => void
}

export default function TopToolbar({ onExportClick }: TopToolbarProps): JSX.Element {
  return (
    <div className="flex items-center h-[42px] px-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] gap-1 shrink-0">

      {/* Tool selection */}
      <ToolGroup>
        <ToolBtn icon={<MousePointer2 size={14} />} label="Select  V" active />
        <ToolBtn icon={<Scissors size={14} />} label="Razor / Split  S" />
      </ToolGroup>

      <ToolDivider />

      {/* History */}
      <ToolGroup>
        <ToolBtn icon={<Undo2 size={14} />} label="Undo  Ctrl+Z" />
        <ToolBtn icon={<Redo2 size={14} />} label="Redo  Ctrl+Shift+Z" />
      </ToolGroup>

      <ToolDivider />

      {/* Timeline zoom */}
      <ToolGroup>
        <ToolBtn icon={<ZoomOut size={14} />} label="Zoom Out  -" />
        <ToolBtn icon={<ZoomIn size={14} />} label="Zoom In  +" />
      </ToolGroup>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Export CTA */}
      <Tooltip content="Export video">
        <button
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
        <ToolBtn icon={<Save size={14} />} label="Save  Ctrl+S" />
        <ToolBtn icon={<Settings size={14} />} label="Settings" />
        <ToolBtn icon={<HelpCircle size={14} />} label="Help  Shift+?" />
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
  disabled = false
}: {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
}): JSX.Element {
  return (
    <Tooltip content={label}>
      <button
        disabled={disabled}
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
