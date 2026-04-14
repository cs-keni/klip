import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Search, Play, Pause, Trash2, Music, Tag, X, Plus, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/tooltip'
import { useMusicStore, type MusicTrack } from '@/stores/musicStore'
import { useMediaStore } from '@/stores/mediaStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { pathToFileUrl, formatDuration, processMediaFile } from '@/lib/mediaUtils'
import type { TimelineClip } from '@/types/timeline'
import type { MediaClip } from '@/types/media'

// Only allow audio files
const AUDIO_EXTENSIONS = /\.(mp3|wav|aac|flac|ogg|m4a)$/i

export default function MusicLibrary(): JSX.Element {
  const { tracks, searchQuery, setSearchQuery, addTracks, removeTrack, updateTrack } =
    useMusicStore()

  const [playingId, setPlayingId] = useState<string | null>(null)
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  // ── Filtered tracks ──────────────────────────────────────────────────────

  const q = searchQuery.toLowerCase()
  const filtered = tracks.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
  )

  // ── Import ───────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    const paths = await window.api.media.openDialog()
    const audioPaths = paths.filter((p) => AUDIO_EXTENSIONS.test(p))
    if (audioPaths.length === 0) return

    const newTracks: MusicTrack[] = await Promise.all(
      audioPaths.map(async (filePath) => {
        let dur = 0
        try {
          const info = await processMediaFile(filePath)
          dur = info.duration
        } catch {}

        const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
        const nameNoExt = fileName.replace(/\.[^.]+$/, '')

        // Simple heuristic: "Artist - Title" pattern
        const dashIdx = nameNoExt.indexOf(' - ')
        const artist = dashIdx > 0 ? nameNoExt.slice(0, dashIdx).trim() : 'Unknown Artist'
        const title  = dashIdx > 0 ? nameNoExt.slice(dashIdx + 3).trim() : nameNoExt

        return {
          id:       crypto.randomUUID(),
          title,
          artist,
          duration: dur,
          filePath,
          tags:     [],
          addedAt:  Date.now()
        }
      })
    )

    addTracks(newTracks)
  }, [addTracks])

  // ── Drag-and-drop import ─────────────────────────────────────────────────

  const [dragOver, setDragOver] = useState(false)
  const dragCountRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    setDragOver(true)
  }, [])
  const handleDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDragOver(false) }
  }, [])
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => (f as File & { path: string }).path)
      .filter((p) => AUDIO_EXTENSIONS.test(p))
    if (paths.length === 0) return
    const newTracks: MusicTrack[] = await Promise.all(
      paths.map(async (filePath) => {
        let dur = 0
        try { const info = await processMediaFile(filePath); dur = info.duration } catch {}
        const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
        const nameNoExt = fileName.replace(/\.[^.]+$/, '')
        const dashIdx = nameNoExt.indexOf(' - ')
        const artist = dashIdx > 0 ? nameNoExt.slice(0, dashIdx).trim() : 'Unknown Artist'
        const title  = dashIdx > 0 ? nameNoExt.slice(dashIdx + 3).trim() : nameNoExt
        return { id: crypto.randomUUID(), title, artist, duration: dur, filePath, tags: [], addedAt: Date.now() }
      })
    )
    addTracks(newTracks)
  }, [addTracks])

  // ── Playback ─────────────────────────────────────────────────────────────

  const handlePlay = useCallback((track: MusicTrack) => {
    const audio = audioRef.current
    if (!audio) return

    if (playingId === track.id) {
      audio.pause()
      setPlayingId(null)
      return
    }

    const url = pathToFileUrl(track.filePath)
    audio.src = url
    audio.load()
    audio.play().catch(() => {})
    setPlayingId(track.id)
  }, [playingId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnd = () => setPlayingId(null)
    audio.addEventListener('ended', onEnd)
    return () => audio.removeEventListener('ended', onEnd)
  }, [])

  // Stop on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  // ── Tags editor ──────────────────────────────────────────────────────────

  const handleAddTag = useCallback((trackId: string) => {
    const raw = tagInput.trim().toLowerCase()
    if (!raw) return
    const track = tracks.find((t) => t.id === trackId)
    if (!track) return
    if (!track.tags.includes(raw)) {
      updateTrack(trackId, { tags: [...track.tags, raw] })
    }
    setTagInput('')
  }, [tagInput, tracks, updateTrack])

  const handleRemoveTag = useCallback((trackId: string, tag: string) => {
    const track = tracks.find((t) => t.id === trackId)
    if (!track) return
    updateTrack(trackId, { tags: track.tags.filter((tg) => tg !== tag) })
  }, [tracks, updateTrack])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden audio for preview */}
      <audio ref={audioRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Music Library
          {tracks.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--text-disabled)]">
              {tracks.length}
            </span>
          )}
        </span>
        <button
          onClick={handleImport}
          title="Add Music"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent)] hover:text-white transition-colors active:scale-[0.96]"
        >
          <Upload size={11} />
          Add
        </button>
      </div>

      {/* Search */}
      {tracks.length > 0 && (
        <div className="px-3 py-2 shrink-0 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, artist, tag…"
              className="w-full pl-6 pr-2 py-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--accent-light)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
            />
          </div>
        </div>
      )}

      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
              <Music size={20} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[var(--accent-bright)]">Drop to add</p>
            <p className="text-xs text-[var(--text-muted)]">MP3, WAV, FLAC, AAC…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track list */}
      <div
        className={cn(
          'flex-1 min-h-0 overflow-y-auto',
          dragOver && 'ring-2 ring-inset ring-[var(--accent)] bg-[var(--accent-glow)]'
        )}
      >
        {filtered.length === 0 ? (
          <EmptyState onImport={handleImport} hasSearch={!!searchQuery} />
        ) : (
          <div className="py-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isPlaying={playingId === track.id}
                  isEditingTags={editingTagsId === track.id}
                  tagInput={tagInput}
                  onPlay={() => handlePlay(track)}
                  onRemove={() => {
                    if (playingId === track.id) { audioRef.current?.pause(); setPlayingId(null) }
                    removeTrack(track.id)
                  }}
                  onEditTags={() => {
                    setEditingTagsId(editingTagsId === track.id ? null : track.id)
                    setTagInput('')
                  }}
                  onTagInputChange={setTagInput}
                  onAddTag={() => handleAddTag(track.id)}
                  onRemoveTag={(tag) => handleRemoveTag(track.id, tag)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TrackRow ───────────────────────────────────────────────────────────────────

interface TrackRowProps {
  track: MusicTrack
  isPlaying: boolean
  isEditingTags: boolean
  tagInput: string
  onPlay: () => void
  onRemove: () => void
  onEditTags: () => void
  onTagInputChange: (v: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
}

function TrackRow({
  track, isPlaying, isEditingTags,
  tagInput, onPlay, onRemove, onEditTags,
  onTagInputChange, onAddTag, onRemoveTag
}: TrackRowProps): JSX.Element {
  const { clips: mediaClips, addClip: addMediaClip } = useMediaStore()
  const { tracks, clips: tlClips, addClip: addTlClip, playheadTime } = useTimelineStore()

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // ── Drag to timeline ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/klip-music', JSON.stringify({
      id:       track.id,
      filePath: track.filePath,
      title:    track.title,
      duration: track.duration
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }, [track])

  // ── Add to Timeline (button) ──────────────────────────────────────────────

  const handleAddToTimeline = useCallback(() => {
    const musicTrack = tracks.find((t) => t.type === 'music')
    if (!musicTrack || musicTrack.isLocked) return

    // Find or create a MediaClip for this file path
    let mediaClip = mediaClips.find((c) => c.path === track.filePath)
    if (!mediaClip) {
      const newMedia: MediaClip = {
        id:              crypto.randomUUID(),
        type:            'audio',
        path:            track.filePath,
        name:            track.title,
        duration:        track.duration,
        width:           0, height: 0, fps: 0, fileSize: 0,
        thumbnail:       null,
        thumbnailStatus: 'idle',
        isOnTimeline:    false,
        isMissing:       false,
        addedAt:         Date.now()
      }
      addMediaClip(newMedia)
      mediaClip = newMedia
    }

    // Place at end of music track or playhead
    const trackEnd = tlClips
      .filter((c) => c.trackId === musicTrack.id)
      .reduce((mx, c) => Math.max(mx, c.startTime + c.duration), 0)
    const startTime = Math.max(playheadTime, trackEnd)

    const newClip: TimelineClip = {
      id:          crypto.randomUUID(),
      mediaClipId: mediaClip.id,
      trackId:     musicTrack.id,
      startTime,
      duration:    track.duration > 0 ? track.duration : 180,
      trimStart:   0,
      type:        'audio',
      name:        track.title,
      thumbnail:   null
    }
    addTlClip(newClip)
  }, [track, tracks, mediaClips, tlClips, playheadTime, addMediaClip, addTlClip])

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing"
      onContextMenu={(e) => {
        e.preventDefault()
        setCtxMenu({ x: e.clientX, y: e.clientY })
      }}
    >
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="group/row border-b border-[var(--border-subtle)] last:border-b-0"
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Play button */}
        <button
          onClick={onPlay}
          className={cn(
            'shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all duration-100',
            isPlaying
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-glow)]'
          )}
        >
          {isPlaying ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate leading-tight">
            {track.title}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] truncate leading-tight">
            {track.artist}
          </p>
          {/* Tags */}
          {track.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {track.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1 py-px text-[9px] rounded bg-[var(--bg-overlay)] text-[var(--text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Duration */}
        <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
          {track.duration > 0 ? formatDuration(track.duration) : '–'}
        </span>

        {/* Actions (appear on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
          <Tooltip content="Edit tags">
            <button
              onClick={onEditTags}
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded transition-colors',
                isEditingTags
                  ? 'text-[var(--accent-bright)] bg-[var(--accent-glow)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'
              )}
            >
              <Tag size={10} />
            </button>
          </Tooltip>
          <Tooltip content="Add to music track">
            <button
              onClick={handleAddToTimeline}
              className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-muted)] hover:text-[var(--accent-bright)] hover:bg-[var(--accent-glow)] transition-colors"
            >
              <AddIcon />
            </button>
          </Tooltip>
          <Tooltip content="Remove from library">
            <button
              onClick={onRemove}
              className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Tag editor */}
      <AnimatePresence>
        {isEditingTags && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1">
                {track.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-overlay)] text-[var(--text-secondary)]"
                  >
                    {tag}
                    <button
                      onClick={() => onRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  autoFocus
                  value={tagInput}
                  onChange={(e) => onTagInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onAddTag() }
                    if (e.key === 'Escape') { e.preventDefault(); onEditTags() }
                  }}
                  placeholder="Type a tag, press Enter"
                  className="flex-1 px-2 py-1 text-[11px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--accent-light)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
                />
                <button
                  onClick={onAddTag}
                  className="px-2 py-1 text-[11px] rounded bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent)] hover:text-white transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* ── Context menu ──────────────────────────────────────────────────────── */}
    <AnimatePresence>
      {ctxMenu && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[998]"
            onPointerDown={() => setCtxMenu(null)}
          />
          <motion.div
            className="fixed z-[999] min-w-[168px] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
          >
            <div className="py-1">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                onClick={() => { onPlay(); setCtxMenu(null) }}
              >
                {isPlaying ? <Pause size={12} className="text-[var(--accent-bright)]" /> : <Play size={12} className="ml-0.5 text-[var(--accent-bright)]" />}
                {isPlaying ? 'Stop Preview' : 'Play Preview'}
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                onClick={() => { handleAddToTimeline(); setCtxMenu(null) }}
              >
                <Plus size={12} className="text-[var(--text-muted)]" />
                Add to Timeline
              </button>
              <div className="my-1 border-t border-[var(--border-subtle)]" />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                onClick={() => { window.api.media.revealInExplorer(track.filePath); setCtxMenu(null) }}
              >
                <FolderOpen size={12} className="text-[var(--text-muted)]" />
                Reveal in Explorer
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => { onRemove(); setCtxMenu(null) }}
              >
                <Trash2 size={12} />
                Remove from Library
              </button>
            </div>
          </motion.div>
        </>,
        document.body
      )}
    </AnimatePresence>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onImport, hasSearch }: { onImport: () => void; hasSearch: boolean }): JSX.Element {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">No results</p>
        <p className="text-xs text-[var(--text-muted)]">Try a different search</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center min-h-[200px]">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center">
        <Music size={24} className="text-[var(--text-muted)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">No music yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
          Add royalty-free tracks or drag audio files here
        </p>
      </div>
      <button
        onClick={onImport}
        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-[var(--accent-dim)] text-[var(--accent-bright)] hover:bg-[var(--accent)] hover:text-white transition-colors active:scale-[0.97]"
      >
        <Upload size={12} />
        Add Music
      </button>
    </div>
  )
}

function AddIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
