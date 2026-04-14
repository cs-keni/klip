import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar/TitleBar'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'
import AppLayout from './components/Layout/AppLayout'
import Toaster from './components/ui/Toaster'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAppStore } from './stores/appStore'
import { useProjectIO } from './hooks/useProjectIO'
import { restoreAutosave } from './lib/projectIO'

export default function App(): JSX.Element {
  const view = useAppStore((s) => s.view)
  const [showRecovery, setShowRecovery] = useState(false)
  useProjectIO()

  // Check for an autosave on startup — offer crash recovery
  useEffect(() => {
    window.api.project.checkAutosave().then((result) => {
      if (result) setShowRecovery(true)
    }).catch(() => {})
  }, [])

  async function handleRestore(): Promise<void> {
    setShowRecovery(false)
    await restoreAutosave()
  }

  async function handleDiscard(): Promise<void> {
    setShowRecovery(false)
    await window.api.project.clearAutosave()
  }

  return (
    <ErrorBoundary>
    <div className="app-root">
      <TitleBar />

      {/* Crash recovery dialog */}
      <AnimatePresence>
        {showRecovery && (
          <motion.div
            key="recovery"
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative z-10 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-2xl flex flex-col gap-4"
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.34, 1.1, 0.64, 1] }}
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-[var(--text-primary)] font-semibold text-sm">Unsaved work found</h2>
                <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                  Klip found an autosave from a previous session. Would you like to restore it?
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleDiscard}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors duration-100"
                >
                  Discard
                </button>
                <button
                  onClick={handleRestore}
                  className="px-3 py-1.5 rounded-lg text-xs bg-[var(--accent)] text-white hover:bg-[var(--accent-light)] transition-colors duration-100"
                >
                  Restore
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster />

      <AnimatePresence mode="wait" initial={false}>
        {view === 'welcome' ? (
          <motion.div
            key="welcome"
            className="flex-1 min-h-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <WelcomeScreen />
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            className="flex-1 min-h-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <AppLayout />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  )
}
