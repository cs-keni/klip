/**
 * Pub/sub for the copy-confirmation flash animation.
 *
 * Timeline.tsx calls flashCopy(ids) immediately after Ctrl+C.
 * Each TimelineClipView subscribes and briefly lights up when its id is included.
 */

type Listener = (ids: string[]) => void
const listeners = new Set<Listener>()

export function flashCopy(ids: string[]): void {
  if (ids.length === 0) return
  listeners.forEach((fn) => fn(ids))
}

export function subscribeCopyFlash(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
