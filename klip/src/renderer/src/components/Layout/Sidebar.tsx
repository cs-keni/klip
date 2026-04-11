import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Music, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import MediaBin from '@/components/MediaBin/MediaBin'

type Tab = 'media' | 'music'

export default function Sidebar(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('media')

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex shrink-0 border-b border-[var(--border-subtle)]">
        <SidebarTab
          active={activeTab === 'media'}
          onClick={() => setActiveTab('media')}
          icon={<Film size={13} />}
          label="Media"
        />
        <SidebarTab
          active={activeTab === 'music'}
          onClick={() => setActiveTab('music')}
          icon={<Music size={13} />}
          label="Music"
        />
      </div>

      {/* Tab content with crossfade */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'media' ? (
            <TabPane key="media">
              <MediaBin />
            </TabPane>
          ) : (
            <TabPane key="music">
              <EmptyState
                icon={<Music size={22} className="text-[var(--text-muted)]" />}
                title="Music Library"
                description="Add royalty-free tracks to your library"
                action={{ label: 'Add Music', icon: <Upload size={13} />, onClick: () => {} }}
              />
            </TabPane>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SidebarTab({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium',
        'transition-colors duration-100 border-b-2 -mb-[1px]',
        active
          ? 'text-[var(--accent-bright)] border-[var(--accent)]'
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function TabPane({ children }: { children: ReactNode }): JSX.Element {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode
  title: string
  description: string
  action?: { label: string; icon?: ReactNode; onClick: () => void }
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center min-h-[200px]">
      <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)] transition-colors duration-100 active:scale-[0.97]"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  )
}
