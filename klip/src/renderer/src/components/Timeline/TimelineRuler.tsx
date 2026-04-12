import { useRef, useCallback } from 'react'
import { formatDuration } from '@/lib/mediaUtils'

interface TimelineRulerProps {
  pxPerSec: number
  totalDuration: number
  playheadTime: number
  scrollLeft: number
  onScrub: (time: number) => void
  onScrubStart: () => void
  onScrubEnd: () => void
}

/** Return major/minor tick intervals (in seconds) for the current zoom level. */
function getTickConfig(pxPerSec: number): { major: number; minor: number } {
  if (pxPerSec >= 200) return { major: 1,    minor: 0.5  }
  if (pxPerSec >= 80)  return { major: 2,    minor: 1    }
  if (pxPerSec >= 40)  return { major: 5,    minor: 1    }
  if (pxPerSec >= 15)  return { major: 10,   minor: 5    }
  if (pxPerSec >= 6)   return { major: 30,   minor: 10   }
  if (pxPerSec >= 2.5) return { major: 60,   minor: 30   }
  if (pxPerSec >= 0.8) return { major: 300,  minor: 60   }
  return                      { major: 600,  minor: 300  }
}

export default function TimelineRuler({
  pxPerSec,
  totalDuration,
  playheadTime,
  scrollLeft,
  onScrub,
  onScrubStart,
  onScrubEnd
}: TimelineRulerProps): JSX.Element {
  const rulerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const timeFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!rulerRef.current) return 0
      const rect = rulerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + scrollLeft
      return Math.max(0, x / pxPerSec)
    },
    [pxPerSec, scrollLeft]
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    isDragging.current = true
    onScrubStart()
    onScrub(timeFromEvent(e))

    const onMove = (ev: MouseEvent) => {
      if (isDragging.current) onScrub(timeFromEvent(ev))
    }
    const onUp = () => {
      isDragging.current = false
      onScrubEnd()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const { major, minor } = getTickConfig(pxPerSec)
  const contentWidth = totalDuration * pxPerSec

  // Only render ticks visible in the current viewport
  const viewStart = Math.max(0, Math.floor(scrollLeft / pxPerSec / minor) * minor)
  const viewEnd = Math.min(totalDuration, viewStart + (rulerRef.current?.clientWidth ?? 1600) / pxPerSec + major)

  const ticks: { time: number; isMajor: boolean }[] = []
  for (let t = viewStart; t <= viewEnd; t = +(t + minor).toFixed(6)) {
    ticks.push({ time: t, isMajor: Math.abs(t % major) < 0.001 })
  }

  const playheadLeft = playheadTime * pxPerSec

  return (
    <div
      ref={rulerRef}
      className="relative h-full cursor-col-resize select-none"
      style={{ width: contentWidth }}
      onMouseDown={handleMouseDown}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--bg-elevated)]" />

      {/* Ticks */}
      {ticks.map(({ time, isMajor }) => {
        const left = time * pxPerSec
        return (
          <div
            key={time}
            className="absolute bottom-0 flex flex-col items-start pointer-events-none"
            style={{ left }}
          >
            {isMajor && (
              <span className="text-[9px] font-mono text-[var(--text-muted)] leading-none pl-1 pb-[3px] whitespace-nowrap">
                {formatRulerTime(time)}
              </span>
            )}
            <div
              className={isMajor ? 'w-px bg-[var(--border-strong)]' : 'w-px bg-[var(--border-subtle)]'}
              style={{ height: isMajor ? 10 : 6 }}
            />
          </div>
        )
      })}

      {/* Playhead triangle handle */}
      <div
        className="absolute top-0 pointer-events-none z-10"
        style={{ left: playheadLeft - 5 }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <polygon points="5,0 10,10 0,10" fill="var(--accent-bright)" />
        </svg>
      </div>
    </div>
  )
}

function formatRulerTime(seconds: number): string {
  if (seconds < 60) {
    return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`
  }
  return formatDuration(seconds)
}
