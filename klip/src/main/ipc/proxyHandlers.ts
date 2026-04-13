import { ipcMain, app } from 'electron'
import { BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getFFmpegPath } from '../ffmpegExport'

// ── Active proxy processes: clipId → ChildProcess ──────────────────────────────
const activeProxies = new Map<string, ChildProcess>()

// ── Proxy storage directory ────────────────────────────────────────────────────

function getProxyDir(): string {
  const dir = join(app.getPath('userData'), 'klip-proxies')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getProxyPath(clipId: string): string {
  return join(getProxyDir(), `${clipId}.mp4`)
}

// ── Register all proxy IPC handlers ───────────────────────────────────────────

export function registerProxyHandlers(mainWindow: BrowserWindow): void {

  // Check if a proxy file already exists on disk for a given clipId.
  // Returns the proxy path string, or null if not found.
  ipcMain.handle('media:check-proxy', async (_, clipId: string): Promise<string | null> => {
    const p = getProxyPath(clipId)
    return existsSync(p) ? p : null
  })

  // Batch-check multiple clip IDs at once.
  // Returns Record<clipId, proxyPath | null>
  ipcMain.handle(
    'media:check-proxies-batch',
    async (_, clipIds: string[]): Promise<Record<string, string | null>> => {
      const result: Record<string, string | null> = {}
      for (const id of clipIds) {
        const p = getProxyPath(id)
        result[id] = existsSync(p) ? p : null
      }
      return result
    }
  )

  // Start generating a proxy for the given clip.
  // Fires progress / done / error events back to the renderer.
  ipcMain.on(
    'media:generate-proxy',
    (_, { clipId, filePath }: { clipId: string; filePath: string }) => {
      // Don't start a second job for the same clip
      if (activeProxies.has(clipId)) return

      const proxyPath = getProxyPath(clipId)

      // If a valid proxy already exists, just report done immediately
      if (existsSync(proxyPath)) {
        mainWindow.webContents.send('media:proxy-done', { clipId, proxyPath })
        return
      }

      const ffmpegPath = getFFmpegPath()

      // 480p proxy: scale to 480px tall, keep aspect ratio, CRF 28, ultrafast
      const args = [
        '-i',       filePath,
        '-vf',      'scale=-2:480',
        '-c:v',     'libx264',
        '-preset',  'ultrafast',
        '-crf',     '28',
        '-c:a',     'aac',
        '-b:a',     '128k',
        '-movflags', '+faststart',
        '-y',
        proxyPath
      ]

      let proc: ChildProcess
      try {
        proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (err) {
        mainWindow.webContents.send('media:proxy-error', {
          clipId,
          error: `Failed to spawn FFmpeg: ${(err as Error).message}`
        })
        return
      }

      activeProxies.set(clipId, proc)

      let durationSecs = 0
      let stderr = ''

      proc.stderr?.on('data', (chunk: Buffer | string) => {
        const line = Buffer.isBuffer(chunk) ? chunk.toString() : chunk
        stderr += line

        // Parse total duration on first encounter
        if (!durationSecs) {
          const m = line.match(/Duration:\s+(\d+):(\d+):([\d.]+)/)
          if (m) {
            durationSecs =
              parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])
          }
        }

        // Parse current encode position → progress
        const timeMatch = line.match(/time=(\d+):(\d+):([\d.]+)/)
        if (timeMatch && durationSecs > 0) {
          const current =
            parseInt(timeMatch[1]) * 3600 +
            parseInt(timeMatch[2]) * 60 +
            parseFloat(timeMatch[3])
          const progress = Math.min(1, current / durationSecs)
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('media:proxy-progress', { clipId, progress })
          }
        }
      })

      proc.on('close', (code) => {
        activeProxies.delete(clipId)
        if (mainWindow.isDestroyed()) return

        if (code === 0 && existsSync(proxyPath)) {
          mainWindow.webContents.send('media:proxy-done', { clipId, proxyPath })
        } else if (code !== null) {
          // code === null means the process was killed (cancelled) — no event
          mainWindow.webContents.send('media:proxy-error', {
            clipId,
            error: `FFmpeg exited with code ${code}`
          })
        }
      })

      proc.on('error', (err) => {
        activeProxies.delete(clipId)
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media:proxy-error', {
            clipId,
            error: err.message
          })
        }
      })
    }
  )

  // Cancel a running proxy job
  ipcMain.on('media:cancel-proxy', (_, clipId: string) => {
    const proc = activeProxies.get(clipId)
    if (proc) {
      proc.kill()
      activeProxies.delete(clipId)
    }
  })

  // Cancel ALL running proxy jobs (e.g. on app quit)
  ipcMain.on('media:cancel-all-proxies', () => {
    for (const [, proc] of activeProxies) {
      proc.kill()
    }
    activeProxies.clear()
  })
}
