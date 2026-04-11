import { ipcMain, dialog, shell } from 'electron'
import { stat } from 'fs/promises'

export function registerMediaHandlers(): void {
  // Open native file picker for media import
  ipcMain.handle('media:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Media',
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mkv', 'mov', 'avi', 'png', 'jpg', 'jpeg', 'webp']
        },
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi'] },
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  // Get file metadata (size) from disk
  ipcMain.handle('media:get-file-info', async (_, filePath: string) => {
    try {
      const info = await stat(filePath)
      return { size: info.size }
    } catch {
      return { size: 0 }
    }
  })

  // Check whether a list of file paths still exist on disk
  ipcMain.handle('media:check-files-exist', async (_, filePaths: string[]) => {
    const results: Record<string, boolean> = {}
    for (const fp of filePaths) {
      try {
        await stat(fp)
        results[fp] = true
      } catch {
        results[fp] = false
      }
    }
    return results
  })

  // Reveal a file in Windows Explorer / macOS Finder
  ipcMain.on('media:reveal-in-explorer', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}
