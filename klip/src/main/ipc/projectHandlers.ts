import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'

const RECENT_FILE = join(app.getPath('userData'), 'recent-projects.json')
const MAX_RECENT = 10

export interface RecentProject {
  name: string
  path: string
  lastEditedAt: string
}

async function readRecent(): Promise<RecentProject[]> {
  try {
    const raw = await readFile(RECENT_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function pushRecent(entry: RecentProject): Promise<void> {
  const list = await readRecent()
  const filtered = list.filter((r) => r.path !== entry.path)
  const updated = [entry, ...filtered].slice(0, MAX_RECENT)
  try {
    await writeFile(RECENT_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  } catch {
    // Non-fatal — recent list is best-effort
  }
}

export function registerProjectHandlers(): void {
  // ── Get recent projects ────────────────────────────────────────────────────
  ipcMain.handle('project:get-recent', async () => {
    return readRecent()
  })

  // ── Save project (to existing path, or show dialog) ───────────────────────
  ipcMain.handle(
    'project:save',
    async (_, { data, path: filePath }: { data: unknown; path: string | null }) => {
      let savePath = filePath

      if (!savePath) {
        const result = await dialog.showSaveDialog({
          title: 'Save Project',
          defaultPath: 'Untitled.klip',
          filters: [{ name: 'Klip Project', extensions: ['klip'] }]
        })
        if (result.canceled || !result.filePath) return null
        savePath = result.filePath
      }

      try {
        await mkdir(dirname(savePath), { recursive: true })
        await writeFile(savePath, JSON.stringify(data, null, 2), 'utf-8')
        const d = data as { name?: string }
        await pushRecent({
          name: d.name ?? 'Untitled Project',
          path: savePath,
          lastEditedAt: new Date().toISOString()
        })
        return savePath
      } catch {
        return null
      }
    }
  )

  // ── Save As (always show dialog) ───────────────────────────────────────────
  ipcMain.handle('project:save-as', async (_, { data }: { data: unknown }) => {
    const result = await dialog.showSaveDialog({
      title: 'Save Project As',
      defaultPath: 'Untitled.klip',
      filters: [{ name: 'Klip Project', extensions: ['klip'] }]
    })
    if (result.canceled || !result.filePath) return null

    const savePath = result.filePath
    try {
      await mkdir(dirname(savePath), { recursive: true })
      await writeFile(savePath, JSON.stringify(data, null, 2), 'utf-8')
      const d = data as { name?: string }
      await pushRecent({
        name: d.name ?? 'Untitled Project',
        path: savePath,
        lastEditedAt: new Date().toISOString()
      })
      return savePath
    } catch {
      return null
    }
  })

  // ── Open project (from path or dialog) ────────────────────────────────────
  ipcMain.handle('project:open', async (_, filePath?: string) => {
    let openPath = filePath

    if (!openPath) {
      const result = await dialog.showOpenDialog({
        title: 'Open Project',
        filters: [{ name: 'Klip Project', extensions: ['klip'] }],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) return null
      openPath = result.filePaths[0]
    }

    try {
      const raw = await readFile(openPath, 'utf-8')
      const data = JSON.parse(raw)
      await pushRecent({
        name: data.name ?? 'Untitled Project',
        path: openPath,
        lastEditedAt: new Date().toISOString()
      })
      return { data, path: openPath }
    } catch {
      return null
    }
  })
}
