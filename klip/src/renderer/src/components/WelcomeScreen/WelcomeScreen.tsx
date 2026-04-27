import { type ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, FolderOpen, Clock, ChevronRight, Film } from 'lucide-react'
import klipIcon from '@/assets/icon.ico'
import { useAppStore } from '@/stores/appStore'
import { openProject, createNewProject } from '@/lib/projectIO'

interface RecentEntry {
  name: string
  path: string
  lastEditedAt: string
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoString).toLocaleDateString()
}

export default function WelcomeScreen(): JSX.Element {
  const setView = useAppStore((s) => s.setView)
  const [recentProjects, setRecentProjects] = useState<RecentEntry[]>([])

  useEffect(() => {
    window.api.project.getRecent().then(setRecentProjects).catch(() => {})
  }, [])

  function handleNewProject(): void {
    createNewProject()
    setView('editor')
  }

  async function handleOpenProject(): Promise<void> {
    await openProject()
  }

  async function handleOpenRecent(path: string): Promise<void> {
    await openProject(path)
  }

  return (
    <div className="relative h-full flex flex-col items-center justify-center bg-[var(--bg-base)] overflow-hidden">
      {/* Subtle radial glow behind the logo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 42%, rgba(124, 58, 237, 0.07) 0%, transparent 70%)'
        }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 w-full max-w-lg px-6"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-4">
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.04, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.35)) drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
          >
            <img src={klipIcon} width={72} height={72} alt="Klip" style={{ imageRendering: 'auto', display: 'block' }} />
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
          >
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
              Klip
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-2">
              Edit your videos. No subscriptions.
            </p>
          </motion.div>
        </div>

        {/* Action cards */}
        <motion.div
          className="flex gap-3 w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.14, ease: 'easeOut' }}
        >
          <ActionCard
            icon={<Plus size={18} />}
            title="New Project"
            description="Start a fresh edit"
            onClick={handleNewProject}
            primary
          />
          <ActionCard
            icon={<FolderOpen size={18} />}
            title="Open Project"
            description="Continue where you left off"
            onClick={handleOpenProject}
          />
        </motion.div>

        {/* Recent projects */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-[var(--text-muted)]" />
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              Recent
            </span>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] py-7 flex flex-col items-center gap-2">
              <Film size={18} className="text-[var(--text-disabled)]" />
              <p className="text-[var(--text-muted)] text-xs">No recent projects</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {recentProjects.map((project, i) => (
                <RecentRow
                  key={project.path}
                  index={i}
                  name={project.name}
                  path={project.path}
                  lastEditedAt={project.lastEditedAt}
                  onOpen={handleOpenRecent}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  primary = false
}: {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  primary?: boolean
}): JSX.Element {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      onClick={onClick}
      className={[
        'flex-1 flex flex-col gap-3 p-5 rounded-xl border text-left transition-colors duration-150',
        primary
          ? 'bg-[var(--accent)] border-[var(--accent-light)] hover:bg-[var(--accent-light)]'
          : 'bg-[var(--bg-elevated)] border-[var(--border)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]'
      ].join(' ')}
    >
      <div
        className={[
          'w-9 h-9 rounded-lg flex items-center justify-center',
          primary ? 'bg-white/20' : 'bg-[var(--bg-surface)]'
        ].join(' ')}
      >
        <span className={primary ? 'text-white' : 'text-[var(--accent-bright)]'}>
          {icon}
        </span>
      </div>
      <div>
        <p
          className={[
            'text-sm font-semibold',
            primary ? 'text-white' : 'text-[var(--text-primary)]'
          ].join(' ')}
        >
          {title}
        </p>
        <p
          className={[
            'text-xs mt-0.5',
            primary ? 'text-white/65' : 'text-[var(--text-muted)]'
          ].join(' ')}
        >
          {description}
        </p>
      </div>
    </motion.button>
  )
}

function RecentRow({
  index,
  name,
  path,
  lastEditedAt,
  onOpen
}: {
  index: number
  name: string
  path: string
  lastEditedAt: string
  onOpen: (path: string) => void
}): JSX.Element {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: 0.22 + index * 0.04, ease: 'easeOut' }}
      whileHover={{ backgroundColor: 'var(--bg-elevated)' }}
      onClick={() => onOpen(path)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full group"
    >
      <div className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] shrink-0 flex items-center justify-center group-hover:border-[var(--accent)] transition-colors duration-150">
        <Film size={13} className="text-[var(--text-muted)] group-hover:text-[var(--accent-bright)] transition-colors duration-150" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate font-medium">{name}</p>
        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
          {formatRelativeTime(lastEditedAt)}
          <span className="mx-1 opacity-40">·</span>
          <span className="opacity-60">{path}</span>
        </p>
      </div>
      <ChevronRight size={13} className="text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
    </motion.button>
  )
}

