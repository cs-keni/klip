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
- [x] Relink dialog for missing files (right-click → "Relink Media…" → OS file picker → re-processes metadata + thumbnail)
- [x] **Source Clip Viewer** — double-click a media bin clip to open a dedicated preview modal
  - [x] Full playback with play/pause, frame step, scrub bar
  - [x] I key = set in-point, O key = set out-point; purple region shown on scrub bar
  - [x] Timecode display: in-point · current · out-point · selection duration
  - [x] "Add to Timeline" button places trimmed clip at playhead or end of track
  - [x] In/out points remembered per clip within the session
  - [x] Keyboard: Space = play/pause, I/O = in/out, ←/→ = ±1 frame, Esc = close
- [x] **Music Library** — sidebar "Music" tab
  - [x] Tracks stored via Zustand persist (localStorage); fields: id, title, artist, duration, filePath, tags
  - [x] Import via file picker or drag-and-drop (MP3, WAV, FLAC, AAC, M4A, OGG)
  - [x] Auto-parse "Artist - Title" from file name on import
  - [x] Track list with duration, artist, inline tag pills
  - [x] Search by title, artist, or tag (live filter)
  - [x] Inline tag editor per track (add/remove freeform tags)
  - [x] Click play button to preview a track; click again to stop
  - [x] Drag a track directly onto the music lane on the timeline
  - [x] "Add to Timeline" per-track button
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
- [x] **Loop playback** — I = set loop in, O = set loop out, Ctrl+L = toggle loop on/off
  - [x] Purple region shown on both timeline ruler and preview scrub bar
  - [x] Loop repeats seamlessly during playback (rAF + gap-advance checked)
  - [x] Toolbar shows current in/out timecodes; Escape clears the loop
- [x] **Quick Render Preview** — ⚡ button in preview controls
  - [x] Runs FFmpeg in background at 720p / CRF 32 / ultrafast to a temp file
  - [x] Progress overlay with animated fill bar shown during render
  - [x] Rendered file auto-plays in an overlay panel when done; close to return to editing

## Phase 5 — Audio ✅
- [x] Waveform rendering for audio clips on timeline (Web Audio API, canvas-based)
- [ ] Waveform rendering for video clips (requires FFmpeg — Phase 7)
- [x] Per-clip volume control (right-click clip → volume slider)
- [x] Per-track mute/solo (wired buttons, visual feedback, affects playback)
- [x] Audio/music track playback in preview (hidden <audio> element, wall-clock sync)
- [ ] Audio normalization (detect loudness, suggest gain) — deferred

## Phase 6 — Effects & Overlays ✅
- [x] Text overlays: "T" toolbar button, overlay track, right-click text editor (content, size, color, bold/italic, alignment, position X/Y), preview via CSS absolutely-positioned div, export via FFmpeg drawtext filter
- [x] Transitions: fade / dip-to-black between adjacent video clips; right-click context menu; preview opacity fade in rAF loop; export via FFmpeg fade=t=out/in filters
- [x] Speed ramp: 0.25×–4× per clip; right-click speed buttons; preview via video.playbackRate; export via setpts + chained atempo
- [x] Digital zoom / crop: zoom 1×–4×, pan X/Y per clip; preview via CSS scale+translate; export via FFmpeg crop filter
- [x] Color grade: brightness/contrast/saturation per clip; preview via CSS filter; export via FFmpeg eq filter

## Phase 7 — Export ✅
- [x] Export to MP4 via FFmpeg (ffmpeg-static; install from Windows terminal for Windows binary)
- [x] Presets: YouTube 1080p60, 1440p60, 1080p30, Preview/Draft
- [x] Progress bar with fps, speed, ETA
- [x] Handles video clips, image clips, color clips, audio/music track clips, gaps
- [ ] Chapter markers from timeline regions — deferred

## Phase 8 — Polish & Settings
- [ ] Tutorial / onboarding overlay
- [x] Settings panel: Project tab (resolution/fps/aspect ratio), Export tab (default output folder), Shortcuts tab (keyboard reference)
- [x] Keyboard shortcut reference panel (inside Settings → Shortcuts tab)
- [x] Auto-save project (every 2 min to project file when path exists; Ctrl+S / Ctrl+Shift+S to save/save-as)
- [x] Recent projects list (stored in userData/recent-projects.json; shown on welcome screen with relative timestamps)
