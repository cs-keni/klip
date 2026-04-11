import { useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

export default function ResizeHandle({ direction, onResize }: ResizeHandleProps): JSX.Element {
  const dragging = useRef(false)
  const lastPos = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY

      const onMove = (ev: MouseEvent): void => {
        if (!dragging.current) return
        const pos = direction === 'horizontal' ? ev.clientX : ev.clientY
        onResize(pos - lastPos.current)
        lastPos.current = pos
      }

      const onUp = (): void => {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [direction, onResize]
  )

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        'group relative shrink-0 transition-colors duration-150',
        'bg-[var(--border-subtle)] hover:bg-[var(--accent)]',
        isHorizontal ? 'w-[1px] cursor-col-resize' : 'h-[1px] cursor-row-resize'
      )}
    >
      {/* Wider invisible grab area */}
      <div
        className={cn(
          'absolute z-10',
          isHorizontal ? 'inset-y-0 -left-1.5 -right-1.5' : 'inset-x-0 -top-1.5 -bottom-1.5'
        )}
      />
    </div>
  )
}
