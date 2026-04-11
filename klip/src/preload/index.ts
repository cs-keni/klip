import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  window: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChanged: (callback: (isMaximized: boolean) => void): void => {
      ipcRenderer.on('window:maximized-changed', (_event, value: boolean) => callback(value))
    },
    removeMaximizedListener: (): void => {
      ipcRenderer.removeAllListeners('window:maximized-changed')
    }
  },

  media: {
    /** Open the native file picker; returns selected file paths (may be empty). */
    openDialog: (): Promise<string[]> => ipcRenderer.invoke('media:open-dialog'),

    /** Get file metadata (currently: file size in bytes). */
    getFileInfo: (filePath: string): Promise<{ size: number }> =>
      ipcRenderer.invoke('media:get-file-info', filePath),

    /** Check whether each path in the list exists on disk. */
    checkFilesExist: (filePaths: string[]): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke('media:check-files-exist', filePaths),

    /** Reveal a file in Windows Explorer / macOS Finder. */
    revealInExplorer: (filePath: string): void =>
      ipcRenderer.send('media:reveal-in-explorer', filePath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback for non-isolated context)
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
