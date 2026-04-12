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
  },

  export: {
    /** Open a folder picker; returns the chosen folder path or null if cancelled. */
    pickOutputFolder: (): Promise<string | null> =>
      ipcRenderer.invoke('export:pick-output-folder'),

    /** Start an export job. Progress/done/error arrive via onProgress/onDone/onError. */
    start: (job: unknown): Promise<void> =>
      ipcRenderer.invoke('export:start', job),

    /** Cancel the running export. */
    cancel: (): void => ipcRenderer.send('export:cancel'),

    /** Subscribe to progress updates. Returns an unsubscribe function. */
    onProgress: (cb: (p: { progress: number; fps: number; speed: string; etaSecs: number }) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as { progress: number; fps: number; speed: string; etaSecs: number })
      ipcRenderer.on('export:progress', handler)
      return () => ipcRenderer.removeListener('export:progress', handler)
    },

    /** Subscribe to completion event. Returns an unsubscribe function. */
    onDone: (cb: (outputPath: string) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as string)
      ipcRenderer.on('export:done', handler)
      return () => ipcRenderer.removeListener('export:done', handler)
    },

    /** Subscribe to error event. Returns an unsubscribe function. */
    onError: (cb: (message: string) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as string)
      ipcRenderer.on('export:error', handler)
      return () => ipcRenderer.removeListener('export:error', handler)
    }
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
