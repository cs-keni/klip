import { type MotionValue } from 'framer-motion'

/**
 * Module-level registry that maps clip IDs to their Framer Motion leftMV values.
 *
 * Lives outside React so updating it never causes re-renders.
 * Used by TimelineClipView to coordinate 60fps multi-clip drag:
 *   - Each selected clip self-registers when it becomes selected
 *   - The clip being dragged calls applyDelta() to move all registered clips
 *   - No prop-drilling or cross-component refs required
 */

interface RegistryEntry {
  leftMV: MotionValue<number>
  /** Committed startTime at the moment the drag began (set via snapshotOrigStarts). */
  origStart: number
}

const registry = new Map<string, RegistryEntry>()

export const dragRegistry = {
  /**
   * Called by TimelineClipView in a useEffect whenever isSelected → true
   * or clip.startTime changes (so origStart stays fresh between drags).
   */
  register(id: string, leftMV: MotionValue<number>, origStart: number): void {
    registry.set(id, { leftMV, origStart })
  },

  unregister(id: string): void {
    registry.delete(id)
  },

  /**
   * Snapshot the origStart of every clip in ids at drag-begin.
   * Call this once at the start of a drag; pass the result to applyDelta.
   */
  snapshotOrigStarts(ids: string[]): Map<string, number> {
    const snap = new Map<string, number>()
    for (const id of ids) {
      const entry = registry.get(id)
      if (entry) snap.set(id, entry.origStart)
    }
    return snap
  },

  /**
   * Apply a time delta to every clip in the snapshot, updating each leftMV
   * directly. Safe to call at 60fps — no React state touched.
   */
  applyDelta(origStarts: Map<string, number>, deltaTime: number, pxPerSec: number): void {
    for (const [id, origStart] of origStarts) {
      const entry = registry.get(id)
      if (entry) {
        entry.leftMV.set(Math.max(0, origStart + deltaTime) * pxPerSec)
      }
    }
  }
}
