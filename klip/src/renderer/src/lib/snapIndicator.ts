/**
 * Lightweight pub/sub bus for the snap indicator line.
 *
 * TimelineClipView writes the snapped timeline time (in seconds) whenever
 * a drag is within snap threshold of a point. Timeline subscribes and
 * renders a vertical hairline at that position.
 *
 * Using a module-level bus avoids prop-drilling through TrackRow and keeps
 * the hot drag path free of extra React state.
 */

type Listener = (time: number | null) => void
const listeners = new Set<Listener>()

export function setSnapTime(t: number | null): void {
  listeners.forEach((fn) => fn(t))
}

export function subscribeSnapTime(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
