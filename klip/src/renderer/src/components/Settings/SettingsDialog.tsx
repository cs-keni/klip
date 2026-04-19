import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, FolderOpen, Sliders, Keyboard, AppWindow, Layers, Wrench,
  HardDrive, Trash2, CheckCircle2, AlertCircle, RotateCcw,
  HelpCircle, Search, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore, type Resolution, type FrameRate, type AspectRatio } from '@/stores/projectStore'
import { useAppSettingsStore } from '@/stores/appSettingsStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { toast } from '@/stores/toastStore'
import { HELP_ENTRIES, CATEGORY_LABELS, type HelpCategory, type HelpEntry } from '@/lib/helpContent'

// ── Tab definitions ────────────────────────────────────────────────────────────

type Tab = 'project' | 'app' | 'timeline' | 'advanced' | 'shortcuts' | 'help'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'project',   label: 'Project',   icon: <Sliders size={14} /> },
  { id: 'app',       label: 'App',       icon: <AppWindow size={14} /> },
  { id: 'timeline',  label: 'Timeline',  icon: <Layers size={14} /> },
  { id: 'advanced',  label: 'Advanced',  icon: <Wrench size={14} /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
  { id: 'help',      label: 'Help',      icon: <HelpCircle size={14} /> }
]

// ── Keyboard shortcut reference data ──────────────────────────────────────────

const SHORTCUT_GROUPS: { heading: string; rows: { label: string; keys: string[] }[] }[] = [
  {
    heading: 'Playback',
    rows: [
      { label: 'Play / Pause',             keys: ['Space'] },
      { label: 'Play forward (shuttle)',    keys: ['L'] },
      { label: 'Pause',                    keys: ['K'] },
      { label: 'Seek back 10 s',           keys: ['J'] },
      { label: 'Step back 1 frame',        keys: ['←'] },
      { label: 'Step forward 1 frame',     keys: ['→'] }
    ]
  },
  {
    heading: 'Timeline',
    rows: [
      { label: 'Split clip at playhead',   keys: ['S'] },
      { label: 'Delete selected',          keys: ['Delete'] },
      { label: 'Ripple delete selected',   keys: ['Shift', 'Delete'] },
      { label: 'Trim end to playhead',     keys: ['Q'] },
      { label: 'Trim start to playhead',   keys: ['W'] },
      { label: 'Drop marker at playhead',  keys: ['M'] },
      { label: 'Next edit point',          keys: ['↓'] },
      { label: 'Previous edit point',      keys: ['↑'] },
      { label: 'Zoom to fit',              keys: ['\\'] },
      { label: 'Toggle snap',              keys: ['Ctrl', '\\'] }
    ]
  },
  {
    heading: 'Editing',
    rows: [
      { label: 'Undo',                     keys: ['Ctrl', 'Z'] },
      { label: 'Redo',                     keys: ['Ctrl', 'Shift', 'Z'] },
      { label: 'Copy',                     keys: ['Ctrl', 'C'] },
      { label: 'Paste',                    keys: ['Ctrl', 'V'] },
      { label: 'Save',                     keys: ['Ctrl', 'S'] },
      { label: 'Save As',                  keys: ['Ctrl', 'Shift', 'S'] },
      { label: 'Command Palette',          keys: ['Ctrl', 'K'] }
    ]
  },
  {
    heading: 'Loop',
    rows: [
      { label: 'Set loop in',              keys: ['I'] },
      { label: 'Set loop out',             keys: ['O'] },
      { label: 'Toggle loop',              keys: ['Ctrl', 'L'] },
      { label: 'Clear loop',               keys: ['Esc'] }
    ]
  },
  {
    heading: 'Source Viewer',
    rows: [
      { label: 'Play / Pause',             keys: ['Space'] },
      { label: 'Set in-point',             keys: ['I'] },
      { label: 'Set out-point',            keys: ['O'] },
      { label: 'Step back 1 frame',        keys: ['←'] },
      { label: 'Step forward 1 frame',     keys: ['→'] },
      { label: 'Close',                    keys: ['Esc'] }
    ]
  }
]

// ── Main component ─────────────────────────────────────────────────────────────

interface SettingsDialogProps {
  onClose: () => void
  initialTab?: Tab
  initialHelpSearch?: string
}

export default function SettingsDialog({ onClose, initialTab, initialHelpSearch }: SettingsDialogProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'project')

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
        className="relative z-10 flex w-[700px] max-h-[82vh] rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
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
              aria-label="Close settings"
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors duration-100"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === 'project'   && <TabPane key="project"><ProjectTab /></TabPane>}
              {activeTab === 'app'       && <TabPane key="app"><AppTab /></TabPane>}
              {activeTab === 'timeline'  && <TabPane key="timeline"><TimelineTab /></TabPane>}
              {activeTab === 'advanced'  && <TabPane key="advanced"><AdvancedTab /></TabPane>}
              {activeTab === 'shortcuts' && <TabPane key="shortcuts"><ShortcutsTab /></TabPane>}
              {activeTab === 'help'      && <TabPane key="help"><HelpTab initialSearch={initialHelpSearch} /></TabPane>}
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

// ── App tab ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function AppTab(): JSX.Element {
  const { defaultExportFolder, setDefaultExportFolder, musicLibraryFolder, setMusicLibraryFolder, setHasSeenWalkthrough } = useAppSettingsStore()
  const [cacheInfo, setCacheInfo] = useState<{ count: number; totalBytes: number } | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    window.api.settings.proxyCacheInfo().then(setCacheInfo)
  }, [])

  async function handlePickFolder(): Promise<void> {
    const folder = await window.api.export.pickOutputFolder()
    if (folder) setDefaultExportFolder(folder)
  }

  async function handlePickMusicFolder(): Promise<void> {
    const folder = await window.api.export.pickOutputFolder()
    if (folder) setMusicLibraryFolder(folder)
  }

  async function handleClearCache(): Promise<void> {
    setClearing(true)
    const count = await window.api.settings.clearProxyCache()
    setCacheInfo({ count: 0, totalBytes: 0 })
    setClearing(false)
    toast(
      count > 0
        ? `Cleared ${count} proxy file${count !== 1 ? 's' : ''}`
        : 'No proxy files to clear',
      'success'
    )
  }

  return (
    <>
      {/* Default export folder */}
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

      {/* Music library folder */}
      <SettingRow
        label="Music Library Folder"
        description="The import dialog opens here when adding tracks to the music library."
      >
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)] text-xs text-[var(--text-muted)] truncate">
            {musicLibraryFolder ?? (
              <span className="text-[var(--text-disabled)]">Not set — opens system default location</span>
            )}
          </div>
          <button
            onClick={handlePickMusicFolder}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-100 shrink-0 active:scale-[0.97]"
          >
            <FolderOpen size={12} />
            Browse…
          </button>
          {musicLibraryFolder && (
            <button
              onClick={() => setMusicLibraryFolder(null)}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--destructive)] hover:bg-red-950/30 transition-colors duration-100"
              title="Clear music library folder"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </SettingRow>

      {/* Proxy cache management */}
      <SettingRow
        label="Proxy Cache"
        description="Low-res preview files generated to speed up timeline playback. Safe to clear — they'll regenerate automatically on next import."
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)]">
            <HardDrive size={12} className="text-[var(--text-muted)] shrink-0" />
            <span className="text-xs text-[var(--text-secondary)]">
              {cacheInfo == null
                ? 'Calculating…'
                : cacheInfo.count === 0
                  ? 'No proxy files on disk'
                  : `${cacheInfo.count} file${cacheInfo.count !== 1 ? 's' : ''} · ${formatBytes(cacheInfo.totalBytes)}`
              }
            </span>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearing || cacheInfo == null || cacheInfo.count === 0}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 transition-all duration-100 active:scale-[0.97]',
              'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
              'hover:border-red-800 hover:bg-red-950/40 hover:text-red-400',
              'disabled:opacity-40 disabled:pointer-events-none'
            )}
          >
            <Trash2 size={12} />
            {clearing ? 'Clearing…' : 'Clear Cache'}
          </button>
        </div>
      </SettingRow>

      {/* Onboarding */}
      <SettingRow
        label="Onboarding"
        description="Replay the first-launch walkthrough at any time."
      >
        <button
          onClick={() => setHasSeenWalkthrough(false)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-100 active:scale-[0.97]"
        >
          <RotateCcw size={12} />
          Restart Tutorial
        </button>
      </SettingRow>

      {/* Theme (read-only for now) */}
      <SettingRow
        label="Theme"
        description="Interface color scheme"
      >
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
          <div className="flex-1 py-1.5 rounded-md text-xs font-medium text-center bg-[var(--accent)] text-white shadow-sm">
            Dark
          </div>
          <div className="flex-1 py-1.5 rounded-md text-xs font-medium text-center text-[var(--text-disabled)] cursor-not-allowed">
            Light
          </div>
          <div className="flex-1 py-1.5 rounded-md text-xs font-medium text-center text-[var(--text-disabled)] cursor-not-allowed">
            System
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">Light and System themes coming in a future update.</p>
      </SettingRow>
    </>
  )
}

// ── Timeline tab ───────────────────────────────────────────────────────────────

function TimelineTab(): JSX.Element {
  const { setSnapByDefault } = useAppSettingsStore()
  const { snapEnabled, toggleSnap } = useTimelineStore()

  function handleSnapToggle(v: boolean): void {
    setSnapByDefault(v)
    if (v !== snapEnabled) toggleSnap()
  }

  return (
    <>
      <SettingRow
        label="Snap to Clip Edges"
        description="Clips magnetize to nearby clip edges and the playhead while dragging. Can also be toggled with Ctrl+\\ at any time."
      >
        <Toggle checked={snapEnabled} onChange={handleSnapToggle} />
      </SettingRow>

      <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3.5 py-2.5">
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Snap state changes here also update the current session. This setting is saved as the
          default for all future sessions.
        </p>
      </div>
    </>
  )
}

// ── Advanced tab ───────────────────────────────────────────────────────────────

function AdvancedTab(): JSX.Element {
  const [customPath, setCustomPath] = useState<string | null | undefined>(undefined)
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    window.api.settings.getFfmpegPath().then((p) => {
      setCustomPath(p)
    })
  }, [])

  async function handlePickBinary(): Promise<void> {
    const p = await window.api.settings.pickFfmpegBinary()
    if (!p) return
    await window.api.settings.setFfmpegPath(p)
    setCustomPath(p)
    setTestStatus('idle')
    toast('Custom FFmpeg path saved. Restart the app to apply.', 'success', 5000)
  }

  async function handleClearBinary(): Promise<void> {
    await window.api.settings.setFfmpegPath(null)
    setCustomPath(null)
    setTestStatus('idle')
    toast('Reverted to bundled FFmpeg. Restart to apply.', 'info', 4000)
  }

  const isLoading = customPath === undefined

  return (
    <>
      <SettingRow
        label="Custom FFmpeg Binary"
        description="Override the bundled FFmpeg with a system installation. Useful for newer codec support or hardware acceleration."
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)]">
              {testStatus === 'ok' && <CheckCircle2 size={12} className="text-[var(--success)] shrink-0" />}
              {testStatus === 'fail' && <AlertCircle size={12} className="text-[var(--destructive)] shrink-0" />}
              <span className="text-xs text-[var(--text-muted)] truncate font-mono">
                {isLoading
                  ? 'Loading…'
                  : customPath
                    ? customPath
                    : 'Using bundled FFmpeg (default)'
                }
              </span>
            </div>
            <button
              onClick={handlePickBinary}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors duration-100 shrink-0 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            >
              <FolderOpen size={12} />
              Browse…
            </button>
            {customPath && (
              <button
                onClick={handleClearBinary}
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--destructive)] hover:bg-red-950/30 transition-colors duration-100"
                title="Clear custom path"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </SettingRow>

      <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-3.5 py-2.5">
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--text-secondary)]">Note:</strong> Changes take effect after restarting Klip.
          The custom binary is used for all encoding, proxy generation, and waveform extraction.
          Ensure the selected binary is compatible with your system (x64 Windows).
        </p>
      </div>
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

// ── Help tab ───────────────────────────────────────────────────────────────────

function HelpTab({ initialSearch }: { initialSearch?: string }): JSX.Element {
  const [query, setQuery] = useState(initialSearch ?? '')

  const q = query.trim().toLowerCase()

  // Filter + group entries
  const filtered = q
    ? HELP_ENTRIES.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.shortcut ?? []).some((k) => k.toLowerCase().includes(q))
      )
    : HELP_ENTRIES

  // Group by category preserving declaration order
  const grouped = new Map<HelpCategory, HelpEntry[]>()
  for (const entry of filtered) {
    if (!grouped.has(entry.category)) grouped.set(entry.category, [])
    grouped.get(entry.category)!.push(entry)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search features…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] outline-none focus:border-[var(--accent)]/60 transition-colors duration-100"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-[var(--text-muted)]">No features match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {Array.from(grouped.entries()).map(([category, entries]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="flex flex-col gap-0.5">
                {entries.map((entry) => (
                  <HelpEntryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HelpEntryRow({ entry }: { entry: HelpEntry }): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-150',
        open
          ? 'border-[var(--border)] bg-[var(--bg-elevated)]'
          : 'border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--border-subtle)]'
      )}
    >
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
            {entry.title}
          </span>
          {entry.shortcut && (
            <div className="flex items-center gap-0.5 shrink-0">
              {entry.shortcut.map((key, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)] leading-none">
                    {key}
                  </kbd>
                  {i < entry.shortcut!.length - 1 && (
                    <span className="text-[9px] text-[var(--text-disabled)]">+</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight
          size={12}
          className={cn(
            'shrink-0 text-[var(--text-muted)] transition-transform duration-150',
            open && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded description */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-3 text-[11px] text-[var(--text-muted)] leading-relaxed">
              {entry.description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-overlay)] border border-[var(--border-strong)]'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}
