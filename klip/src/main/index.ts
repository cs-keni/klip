import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { loadWindowState, saveWindowState } from './windowState'
import { registerWindowHandlers } from './ipc/windowHandlers'
import { registerMediaHandlers } from './ipc/mediaHandlers'
import { registerExportHandlers } from './ipc/exportHandlers'
import { registerProjectHandlers } from './ipc/projectHandlers'
import { registerProxyHandlers } from './ipc/proxyHandlers'
import { registerWaveformHandlers } from './ipc/waveformHandlers'
import { registerSettingsHandlers } from './ipc/settingsHandlers'
import { registerKlipScheme, registerLocalFileProtocol } from './localFileProtocol'
import { isAllowedExternalUrl } from './security'

// Must be called synchronously before app.whenReady()
registerKlipScheme()

function createWindow(): void {
  const state = loadWindowState()

  const mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d0d12',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      // Required so the renderer can load local media files via file:// URLs
      // and draw them onto a canvas without triggering cross-origin tainting.
      // This app never loads remote content, so this is safe.
      webSecurity: false
    }
  })

  // Show window once ready to prevent white flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (state.isMaximized) {
      mainWindow.maximize()
    }
  })

  // Open external links in the browser, not in Electron.
  // Only http/https URLs are allowed — file:// and javascript: are rejected.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // Notify renderer when maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false)
  })

  // Persist window state on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds()
    saveWindowState({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized()
    })
  })

  registerWindowHandlers(mainWindow)
  registerMediaHandlers()
  registerExportHandlers(mainWindow)
  registerProjectHandlers()
  registerProxyHandlers(mainWindow)
  registerWaveformHandlers()
  registerSettingsHandlers()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerLocalFileProtocol()
  electronApp.setAppUserModelId('com.klip.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
