/**
 * Framer Motion test mock.
 *
 * Replaces all `motion.*` elements with their plain HTML equivalents and makes
 * `AnimatePresence` a transparent passthrough.  This gives tests synchronous,
 * animation-free renders where every child is always in the DOM.
 */
import React, { forwardRef } from 'react'

// Props that are framer-motion-specific and must be stripped before forwarding
// to a real DOM element (unknown DOM props cause React warnings).
const FRAMER_PROPS = new Set([
  'initial', 'animate', 'exit', 'variants', 'custom', 'transition',
  'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView',
  'layout', 'layoutId', 'drag', 'dragConstraints', 'dragElastic',
  'dragMomentum', 'dragTransition', 'transformTemplate',
  'onAnimationStart', 'onAnimationComplete', 'onUpdate',
  'onDragStart', 'onDrag', 'onDragEnd',
  'onHoverStart', 'onHoverEnd',
  'onTap', 'onTapStart', 'onTapCancel',
  'onViewportEnter', 'onViewportLeave',
  'viewport', 'layoutScroll', 'layoutRoot',
])

function makeMotionComponent(tag: string) {
  const Component = forwardRef<HTMLElement, Record<string, unknown>>(
    ({ children, ...props }, ref) => {
      const htmlProps: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(props)) {
        if (!FRAMER_PROPS.has(k)) htmlProps[k] = v
      }
      return React.createElement(tag, { ...htmlProps, ref }, children)
    }
  )
  Component.displayName = `motion.${tag}`
  return Component
}

// Proxy so that any `motion.xyz` access returns a stub for that HTML element.
export const motion = new Proxy({} as Record<string, ReturnType<typeof makeMotionComponent>>, {
  get(cache, tag: string) {
    if (!cache[tag]) cache[tag] = makeMotionComponent(tag)
    return cache[tag]
  }
})

// AnimatePresence: always render children; never defer/hide for exit animations.
export function AnimatePresence({ children }: { children?: React.ReactNode }): JSX.Element {
  return <>{children}</>
}

// Stubs for any hooks the app might import directly
export const useMotionValue = (_initial: number) => ({
  get: () => _initial,
  set: () => {},
  on: () => () => {},
})
export const useSpring      = (_v: number) => ({ get: () => _v, set: () => {} })
export const useTransform   = () => ({ get: () => 0 })
export const useAnimation   = () => ({ start: () => Promise.resolve(), stop: () => {} })
export const useScroll      = () => ({ scrollY: { get: () => 0 } })
export const useVelocity    = () => ({ get: () => 0 })
export const useDragControls = () => ({ start: () => {} })

// Imperative animate() API — no-op in tests
export const animate = (_el: unknown, _kf: unknown, _opts?: unknown): unknown => ({
  then: (fn?: () => void) => { fn?.(); return Promise.resolve() },
  stop: () => {},
  complete: () => {}
})
