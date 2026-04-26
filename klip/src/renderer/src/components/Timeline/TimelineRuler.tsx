import { useRef, useCallback, useState } from 'react'
import { formatDuration } from '@/lib/mediaUtils'
import type { TimelineMarker } from '@/types/timeline'

interface TimelineRulerProps {
  pxPerSec: number
  totalDuration: number
  playheadTime: number
  scrollLeft: number
  onScrub: (time: number) => void
  onScrubStart: () => void
  onScrubEnd: () => void
  markers?: TimelineMarker[]
  onRemoveMarker?: (id: string) => void
  onUpdateMarkerLabel?: (id: string, label: string) => void
  onUpdateMarkerColor?: (id: string, color: string) => void
  format?: 'seconds' | 'timecode'
}

const MARKER_COLORS = ['#f59e0b', '#ef4444', '#22c55e', '#22d3ee', '#a855f7', '#ffffff']

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
  onScrubEnd,
  markers = [],
  onRemoveMarker,
  onUpdateMarkerLabel,
  onUpdateMarkerColor,
  format = 'seconds'
}: TimelineRulerProps): JSX.Element {
  const rulerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

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
                {formatRulerTime(time, format)}
              </span>
            )}
            <div
              className={isMajor ? 'w-px bg-[var(--border-strong)]' : 'w-px bg-[var(--border-subtle)]'}
              style={{ height: isMajor ? 10 : 6 }}
            />
          </div>
        )
      })}

      {/* Markers */}
      {markers.map((marker) => {
        const left = marker.time * pxPerSec
        const isEditing = editingMarkerId === marker.id

        return (
          <div
            key={marker.id}
            className="absolute bottom-0 z-20 group"
            style={{ left }}
          >
            {/* Downward-pointing pin */}
            <div
              className="relative cursor-pointer"
              title={marker.label || `Marker at ${formatRulerTime(marker.time)} — double-click to rename, right-click to delete`}
              onClick={(e) => {
                e.stopPropagation()
                onScrub(marker.time)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemoveMarker?.(marker.id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingMarkerId(marker.id)
                setEditingLabel(marker.label)
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="-translate-x-[5px]">
                <polygon points="5,10 0,0 10,0" fill={marker.color} />
              </svg>
              {/* Label */}
              {marker.label && !isEditing && (
                <span
                  className="absolute bottom-[10px] left-1/2 -translate-x-1/2 text-[9px] font-medium whitespace-nowrap pointer-events-none px-1 rounded"
                  style={{ color: marker.color, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {marker.label}
                </span>
              )}
            </div>

            {/* Inline label editor + color picker */}
            {isEditing && (
              <div
                className="absolute bottom-[12px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onBlur={() => {
                    onUpdateMarkerLabel?.(marker.id, editingLabel.trim())
                    setEditingMarkerId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateMarkerLabel?.(marker.id, editingLabel.trim())
                      setEditingMarkerId(null)
                    }
                    if (e.key === 'Escape') setEditingMarkerId(null)
                    e.stopPropagation()
                  }}
                  className="w-24 text-[9px] px-1 py-0.5 rounded border border-[var(--accent)] bg-[var(--bg-base)] text-[var(--text-primary)] outline-none"
                />
                <div className="flex gap-1 bg-[var(--bg-overlay)] border border-[var(--border)] rounded px-1.5 py-1">
                  {MARKER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onUpdateMarkerColor?.(marker.id, c)}
                      className="w-3 h-3 rounded-full border-2 transition-transform hover:scale-125"
                      style={{
                        background: c,
                        borderColor: marker.color === c ? 'white' : 'transparent'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
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

function formatRulerTime(seconds: number, format: 'seconds' | 'timecode'): string {
  if (format === 'timecode') {
    const s  = Math.max(0, seconds)
    const h  = Math.floor(s / 3600)
    const m  = Math.floor((s % 3600) / 60)
    const sc = Math.floor(s % 60)
    const f  = Math.floor((s % 1) * 30)
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}:${String(f).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}:${String(f).padStart(2, '0')}`
  }
  if (seconds < 60) {
    return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`
  }
  return formatDuration(seconds)
}
