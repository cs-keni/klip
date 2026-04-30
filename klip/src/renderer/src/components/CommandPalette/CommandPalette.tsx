import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Save, FolderOpen, Download, Undo2, Redo2, Scissors,
  Trash2, Copy, Clipboard, Play, Repeat, Magnet, Type,
  Settings, ChevronRight, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useAppStore } from '@/stores/appStore'
import { saveProject, saveProjectAs, openProject, createNewProject } from '@/lib/projectIO'
import { type ReactNode } from 'react'

// ── Command definition ─────────────────────────────────────────────────────────

interface CommandDef {
  id: string
  label: string
  category: string
  shortcut?: string[]
  icon?: ReactNode
  action: () => void
}

// ── Fuzzy scoring ──────────────────────────────────────────────────────────────

function score(label: string, query: string): number {
  if (!query) return 1
  const l = label.toLowerCase()
  const q = query.toLowerCase()
  if (l === q) return 100
  if (l.startsWith(q)) return 80
  if (l.includes(q)) return 60
  // Check all query chars appear in order (fuzzy)
  let qi = 0
  for (const ch of l) {
    if (ch === q[qi]) qi++
    if (qi === q.length) return 30
  }
  return 0
}

// ── Command palette hook ───────────────────────────────────────────────────────

function useCommands(closeAndRun: (fn: () => void) => void): CommandDef[] {
  return useMemo<CommandDef[]>(() => [
    // ── File ────────────────────────────────────────────────────────────────
    {
      id: 'file.save',
      label: 'Save Project',
      category: 'File',
      shortcut: ['Ctrl', 'S'],
      icon: <Save size={13} />,
      action: () => closeAndRun(() => saveProject())
    },
    {
      id: 'file.save-as',
      label: 'Save Project As…',
      category: 'File',
      shortcut: ['Ctrl', 'Shift', 'S'],
      icon: <Save size={13} />,
      action: () => closeAndRun(() => saveProjectAs())
    },
    {
      id: 'file.open',
      label: 'Open Project…',
      category: 'File',
      icon: <FolderOpen size={13} />,
      action: () => closeAndRun(() => openProject())
    },
    {
      id: 'file.close',
      label: 'Close Project',
      category: 'File',
      icon: <LogOut size={13} />,
      action: () => closeAndRun(() => {
        const { hasUnsavedChanges } = useProjectStore.getState()
        if (hasUnsavedChanges) {
          const ok = window.confirm('You have unsaved changes. Close anyway?')
          if (!ok) return
        }
        createNewProject()
        useAppStore.getState().setView('welcome')
      })
    },
    {
      id: 'file.export',
      label: 'Export Video…',
      category: 'File',
      icon: <Download size={13} />,
      action: () => closeAndRun(() => useUIStore.getState().setShowExport(true))
    },

    // ── Edit ─────────────────────────────────────────────────────────────────
    {
      id: 'edit.undo',
      label: 'Undo',
      category: 'Edit',
      shortcut: ['Ctrl', 'Z'],
      icon: <Undo2 size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().undo())
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      category: 'Edit',
      shortcut: ['Ctrl', 'Shift', 'Z'],
      icon: <Redo2 size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().redo())
    },
    {
      id: 'edit.copy',
      label: 'Copy Selected Clip',
      category: 'Edit',
      shortcut: ['Ctrl', 'C'],
      icon: <Copy size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().copySelectedClips())
    },
    {
      id: 'edit.paste',
      label: 'Paste Clip',
      category: 'Edit',
      shortcut: ['Ctrl', 'V'],
      icon: <Clipboard size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().pasteClips())
    },
    {
      id: 'edit.split',
      label: 'Split Clip at Playhead',
      category: 'Edit',
      shortcut: ['S'],
      icon: <Scissors size={13} />,
      action: () => closeAndRun(() => {
        const s = useTimelineStore.getState()
        if (s.selectedClipId) s.splitClip(s.selectedClipId)
      })
    },
    {
      id: 'edit.delete',
      label: 'Delete Selected Clip',
      category: 'Edit',
      shortcut: ['Delete'],
      icon: <Trash2 size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().removeSelectedClips())
    },
    {
      id: 'edit.ripple-delete',
      label: 'Ripple Delete Selected Clip',
      category: 'Edit',
      shortcut: ['Shift', 'Delete'],
      icon: <Trash2 size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().rippleDeleteSelected())
    },

    // ── Playback ─────────────────────────────────────────────────────────────
    {
      id: 'playback.toggle',
      label: 'Play / Pause',
      category: 'Playback',
      shortcut: ['Space'],
      icon: <Play size={13} />,
      action: () => closeAndRun(() => {
        const s = useTimelineStore.getState()
        s.setIsPlaying(!s.isPlaying)
      })
    },
    {
      id: 'playback.loop',
      label: 'Toggle Loop',
      category: 'Playback',
      shortcut: ['Ctrl', 'L'],
      icon: <Repeat size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().toggleLoop())
    },

    // ── Timeline ─────────────────────────────────────────────────────────────
    {
      id: 'timeline.snap',
      label: 'Toggle Snap to Edges',
      category: 'Timeline',
      shortcut: ['Ctrl', '\\'],
      icon: <Magnet size={13} />,
      action: () => closeAndRun(() => useTimelineStore.getState().toggleSnap())
    },
    {
      id: 'timeline.add-text',
      label: 'Add Text Overlay',
      category: 'Timeline',
      shortcut: ['T'],
      icon: <Type size={13} />,
      action: () => {
        closeAndRun(() => {
          // Dispatch a custom event that AppLayout listens to for adding text clips
          window.dispatchEvent(new CustomEvent('klip:add-text-clip'))
        })
      }
    },

    // ── View ─────────────────────────────────────────────────────────────────
    {
      id: 'view.settings',
      label: 'Open Settings',
      category: 'View',
      icon: <Settings size={13} />,
      action: () => closeAndRun(() => useUIStore.getState().setShowSettings(true))
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [closeAndRun])
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CommandPalette(): JSX.Element {
  const { isOpen, close } = useCommandPaletteStore()

  return createPortal(
    <AnimatePresence>
      {isOpen && <PaletteModal onClose={close} />}
    </AnimatePresence>,
    document.body
  )
}

// ── Modal inner ───────────────────────────────────────────────────────────────

function PaletteModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [query, setQuery]           = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // Close-then-run helper — ensures palette closes before the action fires
  const closeAndRun = useCallback((fn: () => void) => {
    onClose()
    // Tiny delay so the close animation begins before the action fires
    setTimeout(fn, 80)
  }, [onClose])

  const allCommands = useCommands(closeAndRun)

  // Filter + sort by score
  const filtered = useMemo(() => {
    return allCommands
      .map((cmd) => ({ cmd, s: score(cmd.label + ' ' + cmd.category, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.cmd)
  }, [allCommands, query])

  // Group by category (preserving order of first appearance)
  const grouped = useMemo(() => {
    const categories: string[] = []
    const byCategory: Record<string, CommandDef[]> = {}
    for (const cmd of filtered) {
      if (!byCategory[cmd.category]) {
        byCategory[cmd.category] = []
        categories.push(cmd.category)
      }
      byCategory[cmd.category].push(cmd)
    }
    return { categories, byCategory }
  }, [filtered])

  // Reset selection when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Focus the input on open
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      filtered[activeIndex]?.action()
      return
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[18vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 w-[560px] max-h-[420px] flex flex-col rounded-xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        initial={{ scale: 0.97, opacity: 0, y: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: -8 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
          <Search size={15} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command…"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
          />
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-muted)]">
              Esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="text-sm text-[var(--text-muted)]">No commands found</p>
              <p className="text-xs text-[var(--text-disabled)]">Try a different search term</p>
            </div>
          ) : (
            // Render grouped (only when no search query) or flat
            query
              ? filtered.map((cmd, i) => (
                  <CommandItem
                    key={cmd.id}
                    cmd={cmd}
                    isActive={i === activeIndex}
                    onHover={() => setActiveIndex(i)}
                    onClick={cmd.action}
                  />
                ))
              : grouped.categories.map((category) => (
                  <div key={category}>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
                      {category}
                    </p>
                    {grouped.byCategory[category].map((cmd) => {
                      const globalIndex = filtered.indexOf(cmd)
                      return (
                        <CommandItem
                          key={cmd.id}
                          cmd={cmd}
                          isActive={globalIndex === activeIndex}
                          onHover={() => setActiveIndex(globalIndex)}
                          onClick={cmd.action}
                        />
                      )
                    })}
                  </div>
                ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border-subtle)] shrink-0 bg-[var(--bg-surface)]">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono">↑↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <kbd className="px-1 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono">↵</kbd>
            <span>run</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-base)] border border-[var(--border)] font-mono text-[9px]">Esc</kbd>
            <span>close</span>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] text-[var(--text-disabled)]">{filtered.length} command{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Command item ───────────────────────────────────────────────────────────────

function CommandItem({
  cmd,
  isActive,
  onHover,
  onClick
}: {
  cmd: CommandDef
  isActive: boolean
  onHover: () => void
  onClick: () => void
}): JSX.Element {
  return (
    <button
      data-active={isActive}
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75 group',
        isActive
          ? 'bg-[var(--accent-dim)] text-[var(--accent-bright)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
      )}
    >
      {/* Icon */}
      <span className={cn(
        'shrink-0 transition-colors duration-75',
        isActive ? 'text-[var(--accent-bright)]' : 'text-[var(--text-muted)]'
      )}>
        {cmd.icon ?? <ChevronRight size={13} />}
      </span>

      {/* Label */}
      <span className="flex-1 text-xs font-medium truncate">{cmd.label}</span>

      {/* Shortcut badges */}
      {cmd.shortcut && (
        <div className="flex items-center gap-1 shrink-0">
          {cmd.shortcut.map((key, i) => (
            <span key={i} className="flex items-center gap-1">
              <kbd className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-mono border leading-none',
                isActive
                  ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent-bright)]'
                  : 'bg-[var(--bg-base)] border-[var(--border)] text-[var(--text-muted)]'
              )}>
                {key}
              </kbd>
              {i < cmd.shortcut!.length - 1 && (
                <span className="text-[10px] text-[var(--text-disabled)]">+</span>
              )}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
