import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { runExport, cancelExport, type ExportJob, getFFmpegPath, buildFFmpegArgs } from '../ffmpegExport'
import { spawn, ChildProcess } from 'child_process'

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

  // ── Quick Render Preview ────────────────────────────────────────────────

  let qpProcess: ChildProcess | null = null

  ipcMain.handle('export:quick-preview', async (_, job: ExportJob) => {
    // Assign a temp output path
    const tmpDir   = app.getPath('temp')
    const outPath  = join(tmpDir, `klip-preview-${Date.now()}.mp4`)
    const draftJob: ExportJob = {
      ...job,
      outputPath:   outPath,
      width:        1280,
      height:       720,
      fps:          30,
      crf:          32,
      x264Preset:   'ultrafast',
      audioBitrate: '128k',
      sampleRate:   44100
    }

    let args: string[]
    try {
      args = buildFFmpegArgs(draftJob)
    } catch (err) {
      mainWindow.webContents.send('export:quick-preview-error', err instanceof Error ? err.message : String(err))
      return
    }

    const ffmpegPath = getFFmpegPath()
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    qpProcess = proc

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      const timeMatch  = text.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      const speedMatch = text.match(/speed=\s*([\d.]+)x/)
      if (timeMatch) {
        const secs     = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3])
        const progress = Math.min(1, draftJob.totalDuration > 0 ? secs / draftJob.totalDuration : 0)
        const speed    = speedMatch ? parseFloat(speedMatch[1]) : 1
        mainWindow.webContents.send('export:quick-preview-progress', { progress, speed: `${speed.toFixed(1)}x` })
      }
    })

    proc.on('close', (code) => {
      qpProcess = null
      if (code === 0) {
        mainWindow.webContents.send('export:quick-preview-done', outPath)
      } else {
        mainWindow.webContents.send('export:quick-preview-error', `FFmpeg exited with code ${code}`)
      }
    })

    proc.on('error', (err) => {
      qpProcess = null
      mainWindow.webContents.send('export:quick-preview-error', err.message)
    })
  })

  ipcMain.on('export:cancel-quick-preview', () => {
    if (qpProcess) { qpProcess.kill('SIGTERM'); qpProcess = null }
  })
}
