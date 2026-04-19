import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useMediaStore }    from './stores/mediaStore'
import { useTimelineStore } from './stores/timelineStore'
import { useAppStore }      from './stores/appStore'
import { useProjectStore }  from './stores/projectStore'
import { useUIStore }       from './stores/uiStore'

// Expose Zustand stores for Playwright E2E test automation.
// Safe for a desktop Electron app — no web-security concern.
;(window as unknown as Record<string, unknown>).__klipStores = {
  media:    useMediaStore,
  timeline: useTimelineStore,
  app:      useAppStore,
  project:  useProjectStore,
  ui:       useUIStore,
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
