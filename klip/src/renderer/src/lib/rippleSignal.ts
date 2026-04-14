/**
 * Tiny signal used to coordinate the ripple-delete slide animation.
 *
 * Timeline.tsx calls markRipple() just before dispatching rippleDelete /
 * rippleDeleteSelected. TimelineClipView checks wasRecentRipple() inside the
 * leftMV spring effect and adds a short delay so subsequent clips start
 * sliding only after the deleted clip has begun collapsing — creating a
 * visible "collapse → fill" sequence rather than an instant simultaneous jump.
 */

let lastRippleAt = 0

export function markRipple(): void {
  lastRippleAt = Date.now()
}

/** True if a ripple delete fired within the last 500 ms. */
export function wasRecentRipple(): boolean {
  return Date.now() - lastRippleAt < 500
}
