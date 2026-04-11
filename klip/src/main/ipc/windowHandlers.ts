import { ipcMain, BrowserWindow } from 'electron'

export function registerWindowHandlers(window: BrowserWindow): void {
  ipcMain.on('window:minimize', () => window.minimize())

  ipcMain.on('window:maximize', () => {
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.on('window:close', () => window.close())

  ipcMain.handle('window:is-maximized', () => window.isMaximized())
}
