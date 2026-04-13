/// <reference types="vite/client" />

interface RecentProject {
  name: string
  path: string
  lastEditedAt: string
}

interface Window {
  api: {
    project: {
      getRecent: () => Promise<RecentProject[]>
      save: (args: { data: unknown; path: string | null }) => Promise<string | null>
      saveAs: (args: { data: unknown }) => Promise<string | null>
      open: (filePath?: string) => Promise<{ data: unknown; path: string } | null>
    }
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
      pickFile: (type: 'video' | 'audio' | 'image') => Promise<string | null>
    }
    export: {
      pickOutputFolder: () => Promise<string | null>
      start: (job: unknown) => Promise<void>
      cancel: () => void
      onProgress: (cb: (p: { progress: number; fps: number; speed: string; etaSecs: number }) => void) => (() => void)
      onDone: (cb: (outputPath: string) => void) => (() => void)
      onError: (cb: (message: string) => void) => (() => void)
      quickPreview: (job: unknown) => void
      cancelQuickPreview: () => void
      onQuickPreviewProgress: (cb: (p: { progress: number; speed: string }) => void) => (() => void)
      onQuickPreviewDone: (cb: (filePath: string) => void) => (() => void)
      onQuickPreviewError: (cb: (message: string) => void) => (() => void)
      saveFrame: (dataUrl: string) => Promise<string | null>
    }
    waveform: {
      extract: (clipId: string, filePath: string) => Promise<number[] | null>
      analyzeLoudness: (filePath: string) => Promise<{ inputI: number } | null>
    }
    proxy: {
      generateProxy: (clipId: string, filePath: string) => void
      cancelProxy: (clipId: string) => void
      cancelAll: () => void
      checkProxy: (clipId: string) => Promise<string | null>
      checkProxiesBatch: (clipIds: string[]) => Promise<Record<string, string | null>>
      onProgress: (cb: (data: { clipId: string; progress: number }) => void) => (() => void)
      onDone: (cb: (data: { clipId: string; proxyPath: string }) => void) => (() => void)
      onError: (cb: (data: { clipId: string; error: string }) => void) => (() => void)
    }
  }
}
