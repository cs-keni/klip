import { ipcMain, dialog, shell, app } from 'electron'
import { stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { getFFmpegPath } from '../ffmpegExport'

export function registerMediaHandlers(): void {
  // Open native file picker for media import
  ipcMain.handle('media:open-dialog', async (_, opts?: { defaultPath?: string }) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Media',
      ...(opts?.defaultPath ? { defaultPath: opts.defaultPath } : {}),
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'png', 'jpg', 'jpeg', 'webp']
        },
        { name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm'] },
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] },
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

  // Extract a single video frame as PNG using FFmpeg.
  // timeSeconds = position in the SOURCE file (trimStart + offset already applied by caller).
  // Returns the absolute output path, or null on failure.
  ipcMain.handle(
    'media:extract-frame',
    async (_, { filePath, timeSeconds, frameId }: { filePath: string; timeSeconds: number; frameId: string }): Promise<string | null> => {
      const framesDir = join(app.getPath('userData'), 'klip-frames')
      if (!existsSync(framesDir)) await mkdir(framesDir, { recursive: true })

      const outPath = join(framesDir, `${frameId}.png`)
      const ffmpegPath = getFFmpegPath()

      return new Promise((resolve) => {
        const proc = spawn(ffmpegPath, [
          '-ss', String(timeSeconds),
          '-i',  filePath,
          '-vframes', '1',
          '-f', 'image2',
          '-y',
          outPath
        ], { stdio: ['ignore', 'pipe', 'pipe'] })

        proc.on('close', (code) => {
          resolve(code === 0 && existsSync(outPath) ? outPath : null)
        })
        proc.on('error', () => resolve(null))
      })
    }
  )

  // Reveal a file in Windows Explorer / macOS Finder
  ipcMain.on('media:reveal-in-explorer', (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // Single-file picker used for relinking missing media
  ipcMain.handle('media:pick-file', async (_, type: 'video' | 'audio' | 'image') => {
    const filters: Electron.FileFilter[] = []
    if (type === 'video') {
      filters.push({ name: 'Video Files', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm'] })
    } else if (type === 'audio') {
      filters.push({ name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'] })
    } else {
      filters.push({ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp'] })
    }
    filters.push({ name: 'All Files', extensions: ['*'] })

    const result = await dialog.showOpenDialog({
      title: 'Relink Media File',
      filters,
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
