import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import MediaBin from '@/components/MediaBin/MediaBin'
import MusicLibrary from '@/components/MediaBin/MusicLibrary'

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
          dataHelp="import-drag-drop"
        />
        <SidebarTab
          active={activeTab === 'music'}
          onClick={() => setActiveTab('music')}
          icon={<Music size={13} />}
          label="Music"
          dataTutorial="music-tab"
          dataHelp="music-library"
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
              <MusicLibrary />
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
  label,
  dataTutorial,
  dataHelp
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  dataTutorial?: string
  dataHelp?: string
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      data-tutorial={dataTutorial}
      data-help={dataHelp}
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

