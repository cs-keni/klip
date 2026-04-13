import { ipcMain, app, dialog } from 'electron'
import { existsSync, readdirSync, statSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ── Persisted config ───────────────────────────────────────────────────────────

interface KlipConfig {
  customFfmpegPath?: string | null
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'klip-config.json')
}

export function readKlipConfig(): KlipConfig {
  try {
    return JSON.parse(readFileSync(getConfigPath(), 'utf8')) as KlipConfig
  } catch {
    return {}
  }
}

function writeKlipConfig(patch: Partial<KlipConfig>): void {
  writeFileSync(getConfigPath(), JSON.stringify({ ...readKlipConfig(), ...patch }, null, 2))
}

/**
 * Returns the custom FFmpeg binary path if the user has configured one and it
 * still exists on disk. Called by getFFmpegPath() in ffmpegExport.ts.
 */
export function getCustomFfmpegPath(): string | null {
  const p = readKlipConfig().customFfmpegPath
  return p && existsSync(p) ? p : null
}

// ── IPC handlers ───────────────────────────────────────────────────────────────

export function registerSettingsHandlers(): void {

  // Get proxy cache disk usage (count + total bytes)
  ipcMain.handle('settings:proxy-cache-info', (): { count: number; totalBytes: number } => {
    const dir = join(app.getPath('userData'), 'klip-proxies')
    if (!existsSync(dir)) return { count: 0, totalBytes: 0 }
    const files = readdirSync(dir).filter((f) => f.endsWith('.mp4'))
    let totalBytes = 0
    for (const f of files) {
      try { totalBytes += statSync(join(dir, f)).size } catch { /* skip locked/missing */ }
    }
    return { count: files.length, totalBytes }
  })

  // Delete all proxy files; returns the number deleted
  ipcMain.handle('settings:clear-proxy-cache', (): number => {
    const dir = join(app.getPath('userData'), 'klip-proxies')
    if (!existsSync(dir)) return 0
    const files = readdirSync(dir).filter((f) => f.endsWith('.mp4'))
    for (const f of files) {
      try { unlinkSync(join(dir, f)) } catch { /* skip */ }
    }
    return files.length
  })

  // Return the currently stored custom FFmpeg path (may be null)
  ipcMain.handle('settings:get-ffmpeg-path', (): string | null => {
    return readKlipConfig().customFfmpegPath ?? null
  })

  // Save (or clear) the custom FFmpeg path
  ipcMain.handle('settings:set-ffmpeg-path', (_, path: string | null): void => {
    writeKlipConfig({ customFfmpegPath: path ?? null })
  })

  // Show a file picker to select a custom FFmpeg binary
  ipcMain.handle('settings:pick-ffmpeg-binary', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select FFmpeg binary',
      filters: [
        { name: 'Executables', extensions: ['exe', ''] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}
