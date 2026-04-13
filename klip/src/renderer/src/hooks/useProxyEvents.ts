import { useEffect } from 'react'
import { useMediaStore } from '@/stores/mediaStore'

/**
 * Mounts once at the AppLayout level.
 * Listens to proxy IPC events (progress / done / error) and updates the
 * media store accordingly.  Also runs a one-time disk check on mount to
 * pick up any proxies that were generated in a previous session.
 */
export function useProxyEvents(): void {
  const { setProxyStatus, setProxyReady, checkExistingProxies } = useMediaStore()

  // One-time check: find proxies that already exist on disk
  useEffect(() => {
    checkExistingProxies()
  }, [checkExistingProxies])

  // Wire IPC events → store updates
  useEffect(() => {
    const unsubProgress = window.api.proxy.onProgress(({ clipId, progress }) => {
      setProxyStatus(clipId, 'generating', progress)
    })

    const unsubDone = window.api.proxy.onDone(({ clipId, proxyPath }) => {
      setProxyReady(clipId, proxyPath)
    })

    const unsubError = window.api.proxy.onError(({ clipId }) => {
      setProxyStatus(clipId, 'error', 0)
    })

    return () => {
      unsubProgress()
      unsubDone()
      unsubError()
    }
  }, [setProxyStatus, setProxyReady])
}
