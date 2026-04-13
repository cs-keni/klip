import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderOpen, Sliders, Download, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore, type Resolution, type FrameRate, type AspectRatio } from '@/stores/projectStore'
import { useAppSettingsStore } from '@/stores/appSettingsStore'

// ── Tab definitions ────────────────────────────────────────────────────────────

type Tab = 'project' | 'export' | 'shortcuts'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'project',   label: 'Project',   icon: <Sliders size={14} /> },
  { id: 'export',    label: 'Export',    icon: <Download size={14} /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> }
]

// ── Keyboard shortcut reference data ──────────────────────────────────────────

const SHORTCUT_GROUPS: { heading: string; rows: { label: string; keys: string[] }[] }[] = [
  {
    heading: 'Playback',
    rows: [
      { label: 'Play / Pause',      keys: ['Space'] },
      { label: 'Play forward',      keys: ['L'] },
      { label: 'Pause',             keys: ['K'] },
      { label: 'Seek back 10 s',   keys: ['J'] },
      { label: 'Step back 1 frame', keys: ['←'] },
      { label: 'Step forward 1 frame', keys: ['→'] }
    ]
  },
  {
    heading: 'Timeline',
    rows: [
      { label: 'Split clip at playhead',    keys: ['S'] },
      { label: 'Delete selected',           keys: ['Delete'] },
      { label: 'Ripple delete selected',    keys: ['Shift', 'Delete'] },
      { label: 'Trim end to playhead',      keys: ['Q'] },
      { label: 'Trim start to playhead',    keys: ['W'] },
      { label: 'Zoom to fit',              keys: ['\\'] },
      { label: 'Toggle snap',              keys: ['Ctrl', '\\'] }
    ]
  },
  {
    heading: 'Editing',
    rows: [
      { label: 'Undo',    keys: ['Ctrl', 'Z'] },
      { label: 'Redo',    keys: ['Ctrl', 'Shift', 'Z'] },
      { label: 'Copy',    keys: ['Ctrl', 'C'] },
      { label: 'Paste',   keys: ['Ctrl', 'V'] },
      { label: 'Save',    keys: ['Ctrl', 'S'] },
      { label: 'Save As', keys: ['Ctrl', 'Shift', 'S'] }
    ]
  },
  {
    heading: 'Loop',
    rows: [
      { label: 'Set loop in',    keys: ['I'] },
      { label: 'Set loop out',   keys: ['O'] },
      { label: 'Toggle loop',    keys: ['Ctrl', 'L'] },
      { label: 'Clear loop',     keys: ['Esc'] }
    ]
  },
  {
    heading: 'Source Viewer',
    rows: [
      { label: 'Play / Pause',     keys: ['Space'] },
      { label: 'Set in-point',     keys: ['I'] },
      { label: 'Set out-point',    keys: ['O'] },
      { label: 'Step back 1 frame', keys: ['←'] },
      { label: 'Step forward 1 frame', keys: ['→'] },
      { label: 'Close',            keys: ['Esc'] }
    ]
  }
]

// ── Main component ─────────────────────────────────────────────────────────────

interface SettingsDialogProps {
  onClose: () => void
}

export default function SettingsDialog({ onClose }: SettingsDialogProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('project')

  const dialog = (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 flex w-[620px] max-h-[80vh] rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Left nav */}
        <div className="w-[160px] shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-base)] py-4 px-2 gap-0.5">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest px-2 mb-2">
            Settings
          </p>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all duration-100',
                activeTab === tab.id
                  ? 'bg-[var(--accent-dim)] text-[var(--accent-bright)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              )}
            >
              <span className="opacity-80">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border-subtle)] shrink-0">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-100"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === 'project' && (
                <TabPane key="project"><ProjectTab /></TabPane>
              )}
              {activeTab === 'export' && (
                <TabPane key="export"><ExportTab /></TabPane>
              )}
              {activeTab === 'shortcuts' && (
                <TabPane key="shortcuts"><ShortcutsTab /></TabPane>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(dialog, document.body)
}

// ── Tab pane wrapper ───────────────────────────────────────────────────────────

function TabPane({ children }: { children: ReactNode }): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -6 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      {children}
    </motion.div>
  )
}

// ── Project tab ────────────────────────────────────────────────────────────────

function ProjectTab(): JSX.Element {
  const { settings, updateSettings } = useProjectStore()

  return (
    <>
      <SettingRow
        label="Resolution"
        description="Output canvas size for preview and export"
      >
        <SegmentedControl<Resolution>
          value={settings.resolution}
          onChange={(v) => updateSettings({ resolution: v })}
          options={[
            { value: '1080p', label: '1080p' },
            { value: '1440p', label: '1440p' },
            { value: '4k',    label: '4K' }
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Frame Rate"
        description="Frames per second for the project timeline"
      >
        <SegmentedControl<FrameRate>
          value={settings.frameRate}
          onChange={(v) => updateSettings({ frameRate: v })}
          options={[
            { value: 24, label: '24 fps' },
            { value: 30, label: '30 fps' },
            { value: 60, label: '60 fps' }
          ]}
        />
      </SettingRow>

      <SettingRow
        label="Aspect Ratio"
        description="Canvas shape for the preview and export"
      >
        <SegmentedControl<AspectRatio>
          value={settings.aspectRatio}
          onChange={(v) => updateSettings({ aspectRatio: v })}
          options={[
            { value: '16:9', label: '16 : 9' },
            { value: '9:16', label: '9 : 16' },
            { value: '1:1',  label: '1 : 1' }
          ]}
        />
      </SettingRow>

      <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3.5 py-2.5">
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Project settings affect the current project. Resolution and frame rate are used when
          exporting — you can always override them in the Export dialog.
        </p>
      </div>
    </>
  )
}

// ── Export tab ─────────────────────────────────────────────────────────────────

function ExportTab(): JSX.Element {
  const { defaultExportFolder, setDefaultExportFolder } = useAppSettingsStore()

  async function handlePickFolder(): Promise<void> {
    const folder = await window.api.export.pickOutputFolder()
    if (folder) setDefaultExportFolder(folder)
  }

  return (
    <>
      <SettingRow
        label="Default Output Folder"
        description="Pre-filled in the Export dialog. You can change it per-export."
      >
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-xs text-[var(--text-muted)] truncate">
            {defaultExportFolder ?? (
              <span className="text-[var(--text-disabled)]">Not set — will prompt each time</span>
            )}
          </div>
          <button
            onClick={handlePickFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-100 shrink-0 active:scale-[0.97]"
          >
            <FolderOpen size={12} />
            Browse…
          </button>
          {defaultExportFolder && (
            <button
              onClick={() => setDefaultExportFolder(null)}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--destructive)] hover:bg-red-950/30 transition-colors duration-100"
              title="Clear default folder"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </SettingRow>
    </>
  )
}

// ── Shortcuts tab ──────────────────────────────────────────────────────────────

function ShortcutsTab(): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.heading}>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
            {group.heading}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--bg-elevated)] transition-colors duration-75 group"
              >
                <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors duration-75">
                  {row.label}
                </span>
                <div className="flex items-center gap-1">
                  {row.keys.map((key, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)] leading-none">
                        {key}
                      </kbd>
                      {i < row.keys.length - 1 && (
                        <span className="text-[10px] text-[var(--text-disabled)]">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Reusable primitives ────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
        {description && (
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}): JSX.Element {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
            value === opt.value
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
