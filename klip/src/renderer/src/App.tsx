import { AnimatePresence, motion } from 'framer-motion'
import TitleBar from './components/TitleBar/TitleBar'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'
import AppLayout from './components/Layout/AppLayout'
import { useAppStore } from './stores/appStore'

export default function App(): JSX.Element {
  const view = useAppStore((s) => s.view)

  return (
    <div className="app-root">
      <TitleBar />

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
  )
}
