import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { join, dirname, relative, resolve, isAbsolute } from 'path'

const RECENT_FILE    = join(app.getPath('userData'), 'recent-projects.json')
const AUTOSAVE_FILE  = join(app.getPath('userData'), 'klip-autosave.klip')
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

// ── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Rewrite absolute media paths to paths relative to the project file.
 * Empty paths (color clips) and already-relative paths are left alone.
 * This makes projects portable: move the folder and all relative paths still resolve.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function relativizePaths(data: any, projectDir: string): any {
  if (!Array.isArray(data.mediaClips)) return data
  return {
    ...data,
    mediaClips: data.mediaClips.map((clip: any) => {
      if (!clip.path || !isAbsolute(clip.path)) return clip
      return { ...clip, path: relative(projectDir, clip.path) }
    })
  }
}

/**
 * Resolve relative media paths back to absolute paths using the project file's
 * directory as the base. Already-absolute paths are untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolvePaths(data: any, projectDir: string): any {
  if (!Array.isArray(data.mediaClips)) return data
  return {
    ...data,
    mediaClips: data.mediaClips.map((clip: any) => {
      if (!clip.path || isAbsolute(clip.path)) return clip
      return { ...clip, path: resolve(projectDir, clip.path) }
    })
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
        const projectDir = dirname(savePath)
        const portable = relativizePaths(data, projectDir)
        await mkdir(projectDir, { recursive: true })
        await writeFile(savePath, JSON.stringify(portable, null, 2), 'utf-8')
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
      const projectDir = dirname(savePath)
      const portable = relativizePaths(data, projectDir)
      await mkdir(projectDir, { recursive: true })
      await writeFile(savePath, JSON.stringify(portable, null, 2), 'utf-8')
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

  // ── Autosave (temp recovery file) ─────────────────────────────────────────
  ipcMain.handle('project:autosave', async (_, data: unknown) => {
    try {
      await writeFile(AUTOSAVE_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // Non-fatal — autosave is best-effort
    }
  })

  ipcMain.handle('project:check-autosave', async () => {
    try {
      const raw = await readFile(AUTOSAVE_FILE, 'utf-8')
      const data = JSON.parse(raw)
      return { data }
    } catch {
      return null
    }
  })

  ipcMain.handle('project:clear-autosave', async () => {
    try {
      await unlink(AUTOSAVE_FILE)
    } catch {
      // File may not exist — that's fine
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
      const parsed = JSON.parse(raw)
      const data = resolvePaths(parsed, dirname(openPath))
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
