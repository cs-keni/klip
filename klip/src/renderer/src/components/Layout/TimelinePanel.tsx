import { type ReactNode } from 'react'
import { Lock, Volume2, VolumeX, Music, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'

interface Track {
  id: string
  label: string
  type: 'video' | 'audio' | 'music'
}

const DEFAULT_TRACKS: Track[] = [
  { id: 'video-1', label: 'Video 1', type: 'video' },
  { id: 'audio-1', label: 'Audio 1', type: 'audio' },
  { id: 'music-1', label: 'Music', type: 'music' }
]

const TRACK_COLORS: Record<Track['type'], string> = {
  video: '#60a5fa',  // blue-400
  audio: '#60a5fa',  // blue-400
  music: '#4ade80'   // green-400
}

export default function TimelinePanel(): JSX.Element {
  return (
    <div className="flex flex-col h-full">
      {/* Header row: track controls + time ruler */}
      <div className="flex items-center h-7 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] shrink-0">
        {/* Track header column */}
        <div className="w-[112px] shrink-0 flex items-center px-3 border-r border-[var(--border-subtle)] h-full">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Tracks
          </span>
        </div>
        {/* Time ruler */}
        <div className="flex-1 overflow-hidden h-full flex items-center relative">
          <TimeRuler />
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {DEFAULT_TRACKS.map((track) => (
          <TrackRow key={track.id} track={track} />
        ))}

        {/* Drop hint */}
        <div className="flex pointer-events-none mt-4 mb-2">
          <div className="w-[112px] shrink-0" />
          <p className="text-xs text-[var(--text-muted)] px-4">
            Drag clips from the media bin to start editing
          </p>
        </div>
      </div>
    </div>
  )
}

function TrackRow({ track }: { track: Track }): JSX.Element {
  const color = TRACK_COLORS[track.type]

  return (
    <div className="flex h-11 border-b border-[var(--border-subtle)] group">
      {/* Track header */}
      <div className="w-[112px] shrink-0 flex items-center gap-1.5 px-2 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-[var(--text-secondary)] truncate flex-1 text-left">
          {track.label}
        </span>
        {/* Track actions (visible on row hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
          <Tooltip content="Mute">
            <button className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              {track.type === 'video' ? (
                <Film size={11} />
              ) : (
                <Volume2 size={11} />
              )}
            </button>
          </Tooltip>
          <Tooltip content="Lock track">
            <button className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors">
              <Lock size={10} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Clip lane */}
      <div className="flex-1 bg-[var(--bg-base)] hover:bg-[var(--bg-surface)] transition-colors duration-100" />
    </div>
  )
}

function TimeRuler(): JSX.Element {
  // Placeholder ruler — will be dynamic in Phase 3
  const ticks = Array.from({ length: 20 }, (_, i) => i * 5) // every 5 seconds

  return (
    <div className="flex items-end h-full w-full px-1 gap-0 relative">
      {ticks.map((sec) => (
        <div
          key={sec}
          className="flex flex-col items-start"
          style={{ position: 'absolute', left: sec * 20 }}
        >
          <span className="text-[9px] font-mono text-[var(--text-muted)] leading-none pb-0.5">
            {formatTime(sec)}
          </span>
          <div className="w-[1px] h-2 bg-[var(--border)]" />
        </div>
      ))}
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
