/// <reference types="vite/client" />

interface Window {
  api: {
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onMaximizedChanged: (callback: (isMaximized: boolean) => void) => void
      removeMaximizedListener: () => void
    }
    media: {
      openDialog: () => Promise<string[]>
      getFileInfo: (filePath: string) => Promise<{ size: number }>
      checkFilesExist: (filePaths: string[]) => Promise<Record<string, boolean>>
      revealInExplorer: (filePath: string) => void
    }
  }
}
