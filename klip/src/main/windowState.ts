import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

const DEFAULT_STATE: WindowState = {
  width: 1440,
  height: 900,
  isMaximized: false
}

function getStatePath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    const path = getStatePath()
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'))
      return { ...DEFAULT_STATE, ...data }
    }
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_STATE }
}

export function saveWindowState(state: WindowState): void {
  try {
    writeFileSync(getStatePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Non-fatal
  }
}
