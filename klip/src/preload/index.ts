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

  project: {
    /** Get the list of recently opened/saved projects. */
    getRecent: (): Promise<{ name: string; path: string; lastEditedAt: string }[]> =>
      ipcRenderer.invoke('project:get-recent'),

    /** Save to an existing path, or show a Save dialog if path is null. Returns the saved path or null if cancelled. */
    save: (args: { data: unknown; path: string | null }): Promise<string | null> =>
      ipcRenderer.invoke('project:save', args),

    /** Always show a Save As dialog. Returns the saved path or null if cancelled. */
    saveAs: (args: { data: unknown }): Promise<string | null> =>
      ipcRenderer.invoke('project:save-as', args),

    /** Open a project from a given path, or show an Open dialog. Returns { data, path } or null. */
    open: (filePath?: string): Promise<{ data: unknown; path: string } | null> =>
      ipcRenderer.invoke('project:open', filePath)
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
    },

    /** Start a Quick Render Preview (draft quality, temp file). */
    quickPreview: (job: unknown): void => {
      ipcRenderer.invoke('export:quick-preview', job)
    },

    /** Cancel a running quick preview render. */
    cancelQuickPreview: (): void =>
      ipcRenderer.send('export:cancel-quick-preview'),

    /** Subscribe to quick preview progress. Returns unsubscribe function. */
    onQuickPreviewProgress: (cb: (p: { progress: number; speed: string }) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as { progress: number; speed: string })
      ipcRenderer.on('export:quick-preview-progress', handler)
      return () => ipcRenderer.removeListener('export:quick-preview-progress', handler)
    },

    /** Subscribe to quick preview done. Returns unsubscribe function. */
    onQuickPreviewDone: (cb: (filePath: string) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as string)
      ipcRenderer.on('export:quick-preview-done', handler)
      return () => ipcRenderer.removeListener('export:quick-preview-done', handler)
    },

    /** Subscribe to quick preview error. Returns unsubscribe function. */
    onQuickPreviewError: (cb: (message: string) => void): (() => void) => {
      const handler = (_: unknown, p: unknown) => cb(p as string)
      ipcRenderer.on('export:quick-preview-error', handler)
      return () => ipcRenderer.removeListener('export:quick-preview-error', handler)
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
