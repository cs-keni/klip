# Klip — Development Phases

## Phase 1 — App Shell ✅
- [x] Electron + React + TypeScript + Tailwind + Framer Motion scaffold
- [x] Frameless window with custom titlebar (minimize, maximize, close)
- [x] Three-panel layout: MediaBin | Preview | Timeline
- [x] Theme variables (dark UI)

## Phase 2a — Media Import & Library ✅
- [x] Native file picker (video, audio, image)
- [x] Drag-and-drop import from Windows Explorer
- [x] Duplicate detection
- [x] Canvas-based thumbnail generation via `klip://` custom protocol
- [x] Skeleton loading cards → thumbnail fade-in
- [x] Solid color clip creation (color picker dialog)
- [x] Clip cards: thumbnail, name, duration, resolution, mismatch warning, on-timeline indicator
- [x] Inline rename (from context menu)
- [x] Right-click context menu: Rename, Reveal in Explorer, Remove
- [x] Delete key removes selected clip
- [x] Audio file support (MP3, WAV, AAC, FLAC, OGG, M4A)

## Phase 2b — Media Library Polish (partial)
- [x] Persist media bin across sessions (localStorage via Zustand persist)
- [x] Missing file detection on launch (marks isMissing, no relink UI yet)
- [ ] Relink dialog for missing files
- [ ] Source clip viewer (click clip → shows in preview area)
- [ ] Music library panel (SQLite-backed, scans a folder)
- [ ] Proxy file generation for large 4K sources

## Phase 3a — Timeline Foundation ✅
- [x] Track rows: Video, Audio, Music with sticky headers
- [x] Drag clips from Media Bin → timeline (drop at correct time position)
- [x] Clip rendering: color-coded by type, name + duration label, thumbnail strip
- [x] Click to select clip, click empty space to deselect
- [x] Delete/Backspace to remove selected clip
- [x] Snapshot-based undo/redo (Ctrl+Z / Ctrl+Shift+Z, max 50 entries)
- [x] Timeline ruler with dynamic tick marks
- [x] Scrub playhead by clicking/dragging ruler
- [x] Zoom: Ctrl+scroll, toolbar buttons, zoom-to-fit (\)
- [x] Horizontal scroll (plain scroll or scroll wheel)
- [x] Track rename via right-click context menu
- [x] Keyboard: Delete removes clip, \ fits zoom, Ctrl+Z/Y undo/redo

## Phase 3b — Clip Manipulation ✅
- [x] Drag clips to reposition on timeline (with undo)
- [x] Trim handles: drag left/right edge to trim start/end
- [x] Snap: clip edges and playhead snap to other clip edges (8px threshold)
- [x] Split clip at playhead (S key)
- [ ] Ripple delete: remove clip and close gap — deferred (floating point gap issue)
- [ ] Multi-select: Shift+click; delete/move multiple at once (deferred)

## Phase 4 — Preview Player ✅
- [x] Video playback in the preview panel (play/pause, seek)
- [x] Playhead drives preview (scrub → see frame)
- [x] Play renders timeline in sequence (clip A → clip B), gap advance, image/color clip passthrough
- [x] Keyboard: Space = play/pause, L = play, K = pause, J = seek back 10s, ←/→ = ±1 frame
- [x] Current timecode display synced to playback
- [x] Playhead auto-scrolls timeline during playback
- [x] Progress bar in preview (clickable scrub)
- [x] Fullscreen button (native video fullscreen)

## Phase 5 — Audio
- [ ] Waveform rendering for audio/video clips on timeline
- [ ] Per-clip volume control
- [ ] Per-track mute/solo
- [ ] Audio normalization (detect loudness, suggest gain)

## Phase 6 — Effects & Overlays
- [ ] Crossfade / cut transitions between clips
- [ ] Text overlay (title cards, lower thirds)
- [ ] Digital zoom / crop (pan & scan)
- [ ] Speed ramp (0.25×–4×)
- [ ] Color grade: basic LUT or brightness/contrast/saturation

## Phase 7 — Export
- [ ] Export to MP4 via FFmpeg (bundled)
- [ ] Preset: YouTube 1080p60 / 1440p60
- [ ] Progress bar with estimated time
- [ ] Chapter markers from timeline regions

## Phase 8 — Polish & Settings
- [ ] Tutorial / onboarding overlay
- [ ] Settings panel: output resolution, frame rate, proxy storage
- [ ] Keyboard shortcut reference panel
- [ ] Auto-save project
- [ ] Recent projects list
