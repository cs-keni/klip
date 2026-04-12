import { ipcMain, dialog, BrowserWindow } from 'electron'
import { runExport, cancelExport, type ExportJob } from '../ffmpegExport'

export function registerExportHandlers(mainWindow: BrowserWindow): void {
  // Open a folder picker so the user chooses where to save
  ipcMain.handle('export:pick-output-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose Output Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  // Start an export job; progress/done/error are pushed back via events
  ipcMain.handle('export:start', async (_, job: ExportJob) => {
    runExport(
      job,
      (progress) => mainWindow.webContents.send('export:progress', progress),
      (outputPath) => mainWindow.webContents.send('export:done', outputPath),
      (message) => mainWindow.webContents.send('export:error', message)
    )
  })

  // Cancel the running export
  ipcMain.on('export:cancel', () => {
    cancelExport()
  })
}
