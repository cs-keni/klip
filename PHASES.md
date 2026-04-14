# PHASES.md — Klip

## Overview

A desktop video editing application built with Electron + React for Windows 11.
Designed for editing long OBS recordings (2–8 hours) down to 8–12 minute YouTube-ready videos.
Aesthetic: dark, modern, fluid — closer to Figma/Linear than Blender.

**Stack:**
- Shell: Electron (frameless, custom titlebar)
- UI: React + TypeScript + Tailwind CSS + Shadcn/ui + Framer Motion
- Video processing: FFmpeg (via ffmpeg-static, child_process)
- Database: SQLite via better-sqlite3 (music library, project metadata)
- State: Zustand
- Project files: JSON

---

## MoSCoW Requirements

### Must Have
- Import video files (MP4, MKV, MOV from OBS)
- Import image files (PNG, JPG) as clips (needed for logos, game icons, title cards)
- Source clip viewer — preview any media bin clip and set in/out points before placing on timeline
- Timeline-based editor — arrange and manage clips in sequence
- Linked clip selection — clicking a video clip also selects and moves its linked audio together
- Cut / trim / split clips on the timeline
- Built-in video preview player with playback controls
- Follow playhead — timeline scrolls during playback to keep the playhead in view
- Music library — local SQLite database of non-copyright tracks
- Add music tracks to the timeline with volume control
- Text overlays — captions and titles with font, size, color, position
- Fade in / fade out transitions (black fades for intro/outro style)
- Solid color clip generator (black, white, or custom color — for backgrounds and holds)
- Export final video to MP4 (YouTube-ready)
- Project-level settings — resolution, frame rate, aspect ratio
- Missing file detection — on project open, flag any source files that can't be found
- Relink media — reassign a missing clip to a new file path (e.g., after moving OBS recordings to another drive)
- Undo / redo (full history stack)
- Project save / load (JSON project files)

### Should Have
- Crossfade transitions between clips
- Intro / outro designated slots (just clips, but marked and snapped to start/end)
- Digital zoom effect (punch in/out on a clip, no 3D)
- Multiple audio tracks (game audio + music + mic)
- Per-clip and per-track volume controls
- Audio normalization — one-click normalize a clip's loudness to a consistent target level
- Waveform visualization on audio tracks
- Gap detection — visually highlight empty gaps between clips on the timeline; right-click to close
- Copy / paste clips — Ctrl+C / Ctrl+V; paste inserts at playhead position
- Trim to playhead — Q key trims selected clip's end to playhead; W key trims its start
- Zoom to fit timeline — backslash key (\) zooms the timeline so all clips fit the visible width
- Track renaming — double-click a track label to rename it
- Keyboard shortcuts (Space, J/K/L scrub, S to split, I/O for in/out points, Delete to remove, Q/W trim)
- Timeline zoom (pinch/scroll to see more or less of the timeline)
- Snap-to-clip edges — toggle on/off (Ctrl+\ or toolbar button)
- Clip thumbnails on the timeline
- Track locking — lock a track to prevent accidental edits
- Playback speed control in preview (0.5x, 1x, 1.5x, 2x)
- Loop playback selection — set in/out range on timeline and loop that section
- Freeze frame — hold a single video frame for a set duration
- Frame rate / resolution mismatch warning — show a warning icon on clips that don't match project settings
- Auto-save (every 2 minutes, no data loss)
- Recent projects list on launch screen

### Could Have
- Speed controls — slow motion, fast forward per clip
- Basic color correction (brightness, contrast, saturation sliders)
- Chapter / marker pins on timeline (useful for navigating long raw recordings)
- Clip color coding — right-click a clip to assign a color label for organization
- Collect media — "Save Project with Media" copies all source files into a folder alongside the project for portability
- Export presets (YouTube 1080p, YouTube 4K, Draft quality)
- Draft preview export (fast low-res render to preview full edit before final export)
- Audio fade in / fade out per track
- Mute toggle per track
- Background music auto-duck (lower music volume when voice is detected)
- Volume keyframes within a clip — drop automation points to ramp volume up/down mid-clip
- Thumbnail frame export — export any frame as PNG/JPG for YouTube thumbnails
- Timeline ruler format toggle (seconds vs HH:MM:SS:FF timecode)
- Go to next / previous edit — jump playhead to the next or previous clip boundary (Up/Down arrow)

### Won't Have (for now)
- Real-time multi-user collaboration
- Cloud sync or cloud storage
- Complex animations or keyframing
- 3D transitions or VFX
- AI auto-cut or highlight detection
- Green screen / chroma key
- Motion tracking

---

## Phase 1 — Foundation & App Shell

> Goal: A running Electron app that looks and feels like a real product, not a dev skeleton.

- [x] Scaffold Electron + React + TypeScript project
- [x] Configure Tailwind CSS, Shadcn/ui, Framer Motion
- [x] Frameless window with custom Windows 11-style titlebar
  - [x] Custom minimize / maximize / close buttons
  - [ ] Windows 11 snap layout support (snap zones on hover of maximize) — deferred, requires native hook
  - [x] Draggable titlebar region
- [x] App layout: sidebar (media bin) + main timeline area + top toolbar + preview panel
- [x] Dark theme design system — colors, typography, spacing, border radii
- [x] Custom scrollbars (thin, dark, styled)
- [x] Launch / welcome screen with "New Project" and "Recent Projects"
- [x] Smooth panel resize (drag dividers between sidebar, timeline, preview)
- [ ] FFmpeg integration — bundle ffmpeg-static, verify it runs on Windows (Phase 2)
- [ ] SQLite setup via better-sqlite3 (Phase 2)
- [x] Basic IPC bridge between Electron main process and React renderer
- [ ] Project settings modal — set resolution (1080p/1440p/4K), frame rate (30/60fps), aspect ratio (16:9)

**QoL / UX:**
- [x] Window remembers last size and position on reopen
- [x] Subtle fade-in animation on startup (app fades in from black rather than snapping open)
- [x] Animated panel transitions when opening/closing sidebars (slide + fade)
- [x] Smooth resize animation when dragging panel dividers

---

## Phase 2 — Media Import & Library

> Goal: Bring raw OBS recordings, images, and music into the app cleanly.

### Phase 2a — Core Media Import ✅ COMPLETE

- [x] Drag-and-drop video import (into media bin)
- [x] File picker import (MP4, MKV, MOV, AVI)
- [x] Image import (PNG, JPG, WEBP) — treated as a still clip with adjustable duration (defaults to 5s)
- [x] Solid color clip generator — create a clip of any solid color with a set duration, preset colors, and color picker
- [x] Media bin panel — grid view of imported clips and images
- [x] Auto-generate video thumbnails on import (via HTML5 canvas — no FFmpeg needed for 2a)
- [x] Show clip metadata: duration, resolution, file size
- [x] Frame rate / resolution mismatch warning — flag clips that don't match the project resolution with an icon and tooltip
- [x] Right-click context menus on media bin clips (rename inline, remove from project, reveal in explorer)

**QoL / UX:**
- [x] Skeleton loading cards while thumbnails generate (fade in when ready)
- [x] Clip card slides in with a spring animation when added to media bin
- [x] Visual indicator (green checkmark) on clips already placed on the timeline
- [x] Drag-over highlight on the media bin (accent glow + drop overlay with icon)
- [x] Stagger effect: clips appear as they finish processing (sequential feels natural)

> Note: Thumbnails use HTML5 `<video>` + `<canvas>` rather than FFmpeg, so `fps` detection is not
> available in Phase 2a. FFmpeg (via `ffmpeg-static`) will be added in Phase 2b.
> If installing from WSL, run `npm install` from Windows PowerShell to get the correct
> Windows binaries when FFmpeg is needed.

### Phase 2b — Heavy Features ✅ COMPLETE

- [x] Proxy file generation — FFmpeg generates a 480p low-res copy in the background for smooth timeline playback
  - [x] Show progress bar (green strip) during proxy generation on each clip card
  - [x] Background processing via child_process, non-blocking UI
  - [x] Auto-generates on video import; right-click → Generate Proxy for manual trigger
  - [x] Proxy-ready badge (P icon) on clip card when available
  - [x] Preview player automatically uses proxy when available, falls back to source
  - [x] Proxies persisted to `{userData}/klip-proxies/` across sessions
  - [x] Batch-check on app launch / project open restores proxy status without re-generating
- [x] **Source Clip Viewer** — double-click any clip in the media bin to open it in a dedicated preview panel
  - [x] Full playback controls within source viewer (play/pause, frame step, scrub)
  - [x] Set in-point (I key) and out-point (O key) to mark a selection
  - [x] "Add to Timeline" places only the selected range at the playhead
  - [x] Timecode display showing current position, in-point, out-point, and selection duration
  - [x] Source viewer remembers last in/out points per clip within the session
- [x] Missing file detection — on project open, scan all referenced file paths and flag any that are missing
  - [x] Show a clear "Media Offline" badge on affected clips in the media bin
  - [x] "Relink" button opens a file picker to reassign the clip to the correct path
  - [x] Missing file check runs on AppLayout mount AND on every project open
- [x] Music library panel — separate tab in sidebar
  - [x] Add music by drag-and-drop or file picker (MP3, WAV, FLAC, AAC)
  - [x] Display track list with duration, artist, title
  - [x] Search and filter tracks by title / artist / tag
  - [x] Tag tracks (e.g., "upbeat", "chill", "intro", "transition") with inline tag editor
  - [x] Play preview of a track on click (toggle play/pause)
  - [x] Drag track to music lane or click "+" to add to timeline
  - [x] Library persisted via localStorage across sessions

---

## Phase 3 — Timeline Core ✅ MOSTLY COMPLETE

> Goal: The heart of the editor — arranging, cutting, and trimming clips.

- [x] Horizontal scrollable timeline with time ruler at top
- [x] Video track lanes and audio track lanes (separate rows)
- [x] Track renaming — double-click any track label to rename it
- [x] Drag clips from media bin onto timeline
- [ ] Linked clip selection — clicking a video clip also selects its linked audio; they move together by default
  - [ ] Hold Alt while clicking to select video or audio independently
- [x] Drag to reorder / reposition clips on the timeline
- [x] Playhead — scrub left/right to seek
- [x] Follow playhead — timeline scrolls during playback to keep the playhead centered in view
- [x] Timeline zoom — scroll wheel to zoom in/out (more/less time visible)
- [x] Zoom to fit — backslash key (\) zooms the timeline so all clips fit the visible width
- [x] Clip trimming — drag the left or right edge of a clip to trim it
- [x] Trim to playhead — Q trims the selected clip's end to the playhead; W trims its start
- [x] Split clip at playhead (keyboard: S)
- [x] Delete clip from timeline (keyboard: Delete / Backspace)
- [x] Ripple delete — remove a clip and close the gap automatically (Shift+Delete)
- [x] Gap detection — empty gaps between clips are highlighted with a visible amber indicator
  - [x] Right-click (or left-click) a gap to "Close Gap" (ripples all subsequent clips left)
- [x] Copy / paste clips — Ctrl+C copies selected clip(s); Ctrl+V pastes at the playhead position
- [x] Snap-to-clip-edges — clips magnetize to adjacent clip edges while dragging
- [x] Snap toggle — enable/disable snapping (Ctrl+\ or toolbar magnet button)
- [x] Track locking — lock/unlock individual tracks via a padlock icon (prevents edits/drops)
- [x] Clip thumbnails visible on the timeline at sufficient zoom levels
- [x] Clip duration label on each timeline clip
- [x] Multi-select clips — Ctrl+click to toggle clips in/out of selection; Delete/copy work on all selected
- [ ] Multi-select drag — move all selected clips together (deferred)
- [ ] Shift+click range select (deferred)
- [ ] Freeze frame — right-click a clip at the playhead position to insert a freeze frame hold
- [x] Full undo / redo stack (Ctrl+Z / Ctrl+Shift+Z)
- [ ] Timeline virtualization — only render visible clip elements (handles 8-hour source clips)

**QoL / UX:**
- [x] Smooth animated clip drag with spring physics
- [x] Timeline ruler tick marks update smoothly on zoom
- [x] Clip resize handles appear on hover (not always visible — reduces clutter)
- [ ] Snap indicator line when clip is about to snap to an edge
- [x] Locked tracks visually dimmed with lock icon
- [x] Gap indicators with amber dashed pattern
- [ ] Ripple delete plays a subtle "collapse" animation
- [ ] Copy confirmation — briefly flash the copied clip(s) to confirm the action

---

## Phase 4 — Preview Player ✅ COMPLETE

> Goal: See exactly what the final video will look like at any point during editing.

- [x] Video preview panel (top-right area of layout)
- [x] Play / pause (Space bar)
- [x] Scrub bar synced with timeline playhead
- [x] Frame step forward / backward (arrow keys when focused)
- [x] J / K / L keyboard scrubbing (reverse / pause / forward, industry standard)
- [x] Current timecode display (HH:MM:SS:FF)
- [x] Total duration display
- [x] Fullscreen preview mode (F key or button)
- [ ] Preview resolution toggle (Full / Half / Quarter — for performance) — deferred; requires proxy file generation (Phase 2b)
- [x] Playback speed control (0.25x / 0.5x / 0.75x / 1x / 1.5x / 2x) — for review purposes
- [x] Loop playback selection — set in/out range on timeline (I/O keys) and toggle loop (Ctrl+L)
- [x] Seamless clip-to-clip playback
  - [x] When playhead crosses a clip boundary, continue into the next clip without pause
- [x] "Quick Render Preview" button — runs a fast FFmpeg draft export to temp file for true seamless preview
  - [x] Low quality (720p, low bitrate) but fast to generate relative to full export
  - [x] Opens in the built-in player automatically

**QoL / UX:**
- [x] Smooth playhead scrubbing with frame thumbnail shown on hover
- [x] Player controls fade out when not hovering (cinema-style), fade back in on mouse move
- [x] Play icon pulses briefly on play, shrinks briefly on pause (subtle feedback)
- [x] Loading spinner when switching clips during heavy proxy generation
- [x] Playback speed indicator visible in player corner when not at 1x
- [ ] Fullscreen transition is animated (smooth scale-up, not a jump) — limited by native fullscreen API; acceptable as-is

---

## Phase 5a — Audio Core ✅ COMPLETE

> Goal: Linked video+audio clips, per-clip and master volume, extra audio track.

- [x] Multiple audio tracks on the timeline (Video Audio `a1`, Extra Audio `a2`, Music `m1`)
- [x] Each video clip carries its audio by default — auto-creates a linked audio clip on `a1` when a video is dropped on the video track
- [x] Linked clip sync — move, trim, split, ripple-delete, and delete all keep linked video+audio in lockstep
- [x] Unlink audio from video clip — right-click → "Unlink Audio" breaks the link so clips move independently
- [x] Drag music from music library onto a music track lane (already worked; preserved)
- [x] Per-clip volume slider (0–200%, default 100%) — right-click any clip → Volume
- [x] Per-track mute button and solo button (already existed; preserved)
- [x] Track locking applies to audio tracks (already existed; preserved)
- [x] Waveform visualization on pure audio clips (music library tracks on timeline)
- [x] Master volume control — slider in preview panel controls bar; clamps HTML5 playback to 100%, full range applied at export

**QoL / UX:**
- [x] Color-coded tracks (video audio = blue, music = green, extra = blue)
- [x] Linked audio clip shows a chain-link badge on the timeline clip
- [x] Volume badge visible on clip when not at 100%
- [x] Master volume icon click toggles mute (0 ↔ last value)

---

## Phase 5b — Audio Advanced ✅ COMPLETE

> Goal: Waveform for video clips, audio fades, normalization, level meters.

- [x] Waveform visualization for video clips (FFmpeg audio extraction via IPC handler)
  - [x] Cached to disk after first generation (`{userData}/klip-waveforms/`), not recomputed on every open
  - [x] Waveform bars appear once data loads (same animated entrance as audio clips)
- [x] Audio fade in / fade out handles on clip edges — draggable diamond handles; gradient overlay on clip; applied at export via `afade` FFmpeg filter
- [x] Audio normalization per clip — FFmpeg loudnorm analysis → one-click "Normalize to −18 LUFS" in Volume context menu; async with loading state
- [x] Audio level meters in the preview panel — Web Audio API AnalyserNode tap on video element, real-time L/R peak display with 8-segment bar meter
- [x] Clipping indicator (top 1–2 segments flash orange/red when peaks above 0 dB; holds red for 800ms)
- [ ] Volume slider animates smoothly on scroll wheel adjustment — deferred; low impact vs. effort

---

## Phase 6 — Effects & Overlays ✅ COMPLETE

> Goal: Text, transitions, and visual effects to make the video feel produced.

**Transitions:**
- [x] Fade to black / fade from black — "Dip to Black" transition type via right-click context menu
- [x] Crossfade between clips (dissolve) — "Fade" transition type
- [x] Transition duration is adjustable — slider in context menu (0.2s–3.0s)
- [x] Transitions applied by right-click context menu on any video clip

**Text Overlays:**
- [x] Add text to any point on the timeline — "T" button in toolbar, overlay track
- [x] Text editor: font family (8 options), font size, color, bold, italic
- [x] Text position: drag on preview canvas to place (pointer capture drag)
- [x] Text alignment and anchor presets (Top, Center, Lower Third + Left/Center/Right text align)
- [x] Background fill option (solid color with transparency toggle)
- [x] Text animation presets: Fade In, Slide Up (preview via Framer Motion; Fade In also applied at export via alpha expression)
- [x] Text overlays visible as a layer on the timeline (overlay track, cyan color)

**Speed Control:**
- [x] Per-clip playback speed (0.25x–16x) via right-click → Speed section

**Digital Zoom:**
- [x] Per-clip zoom level (1x–4x) with Punch In preset (2× centered)
- [x] Zoom position — pan the zoomed frame via minimap or Pan X/Y sliders
- [ ] Animated zoom — keyframe start/end zoom — deferred (requires keyframe infrastructure)

**Color Grade:**
- [x] Per-clip brightness, contrast, saturation sliders (−1 to +1 range)
- [x] Applied at export via FFmpeg `eq` filter

**Intro / Outro:**
- [x] Right-click any video/image/color clip → Mark as Intro or Outro
- [x] Visual badge (amber INTRO / red OUTRO) on timeline clip
- [x] Clear role by clicking the active designation again

**QoL / UX:**
- [x] Text overlay selected state shows dashed outline and grab cursor on preview canvas
- [x] Position anchor preset buttons in text panel (Top / Center / Lower Third)
- [x] Hint text "Drag text in preview to reposition" in text settings panel
- [ ] Transition previews on hover in effects panel — deferred (no effects panel; transitions accessible via right-click)
- [ ] Zoom region overlay box on preview — deferred (low value vs. complexity)

---

## Phase 7 — Export ✅ COMPLETE

> Goal: Produce a final, YouTube-ready MP4 with one click.

- [x] Export panel / modal with settings
- [x] Presets:
  - [x] YouTube 1080p60 (H.264, CRF 18, 320k audio)
  - [x] YouTube 1440p60 (H.264, CRF 18, 320k audio)
  - [x] YouTube 4K / 2160p30 (H.264, CRF 18, 320k audio)
  - [x] YouTube 1080p30 (H.264, CRF 18, 320k audio)
  - [x] Draft (720p, CRF 28, veryfast — for quick reviews before final export)
- [ ] Manual settings: resolution, framerate, video bitrate, audio bitrate — deferred; presets cover the main use cases
- [x] Output file path picker
- [x] Export progress bar with:
  - [x] Percentage complete
  - [x] Estimated time remaining
  - [x] Current processing speed (e.g., "3.2x realtime")
  - [x] Cancel button
- [x] Export completes with notification + "Show in Explorer" button
- [x] Export history log (last 10 exports, with output path, preset, and timestamp; shown as a collapsible section)
- [x] Thumbnail frame export — right-click the preview canvas to save the current video frame as PNG

**QoL / UX:**
- [ ] Export modal shows a live preview of the first frame — deferred; requires a separate FFmpeg thumbnail call
- [x] "Remember last settings" — output folder, filename, and preset persist via localStorage
- [x] System notification when export finishes (even if app is in background) via Electron Notification API
- [x] Animated progress ring alongside the progress bar (SVG stroke-dasharray animated)
- [x] App window title shows export % while exporting ("Klip — Exporting 47%") via both document.title and mainWindow.setTitle
- [x] Progress bar fills with a smooth gradient animation (not a hard edge)

---

## Phase 8 — Tutorial, Polish, QoL & Settings

> Goal: Make the app feel finished — easy to learn, tight, fast, and satisfying to use every session.

**Tutorial & Onboarding:**
- [ ] First-launch interactive walkthrough — runs automatically the first time the app opens
  - [ ] Spotlight overlay highlights specific UI areas one at a time (rest of screen dims)
  - [ ] Step-by-step narration: Welcome → Import a clip → Source Viewer & In/Out points → Add to timeline → Trim → Add music → Add text overlay → Export
  - [ ] "Next" / "Skip" / "Skip All" controls — never forced
  - [ ] Animated arrows and callouts guide the eye to each element
- [ ] Tutorial accessible at any time from Help menu ("Restart Tutorial")
- [ ] In-app Help panel (? icon or Shift+?) — searchable descriptions of every feature
  - [ ] Each entry has a short description and a visual GIF or diagram
- [ ] "What's this?" hover mode — toggle it on, then hover any UI element to see a detailed tooltip explaining exactly what it does and its keyboard shortcut
- [ ] Keyboard shortcut cheat sheet — one page, printable, accessible from Help menu

**Settings Panel:**
- [x] App settings: theme (dark only for now), default export path, proxy cache management
- [x] Timeline settings: default snap behavior
- [x] Keyboard shortcuts viewer (updated with Ctrl+K entry)
- [x] FFmpeg path override (for users who want to use a system FFmpeg)
- [ ] Music library folder location setting
- [ ] Tutorial settings: option to replay the tutorial or reset onboarding state

**General QoL:**
- [x] Auto-save every 2 minutes to a `.autosave` project file (`klip-autosave.klip` in userData)
- [x] Crash recovery — on startup, detect unsaved autosave and offer to restore
- [x] "Unsaved changes" indicator in titlebar (dot next to project name, like VS Code)
- [x] Ctrl+S to save, Ctrl+Shift+S to save as
- [x] Project name shown in titlebar
- [x] Recent projects on welcome screen (last 5, with thumbnail)
- [x] Context menus throughout (right-click on everything that should have one)
  - [x] Timeline clips, track headers, gaps, media bin clips, preview canvas, markers — all complete
  - [x] Music library tracks — right-click: Play/Stop Preview, Add to Timeline, Reveal in Explorer, Remove
- [x] Tooltip system — hover any button for 300ms to see a label + keyboard shortcut (already built in Phase 6)
- [x] Global search / command palette (Ctrl+K) — search clips, effects, settings, actions
- [x] Clip markers — drop a pin on the timeline with a label (M key; double-click to rename, right-click to delete)
- [x] Timeline ruler format toggle — Timer icon in timeline toolbar switches between seconds and HH:MM:SS:FF timecode
- [x] Go to next / previous edit — jump playhead to the next/previous clip boundary (↓/↑ arrow keys)

**Performance:**
- [x] Waveform cache on disk — don't recompute on every project open (done in Phase 5b)
- [x] Proxy file cache management — settings to clear old proxies, see disk usage

**Animations & Feel:**
Every interaction should feel responsive and alive — not flashy, just smooth and deliberate.
- [x] Consistent easing: ease-out for elements entering the screen, ease-in for exits, spring physics for drags (established across components)
- [x] Button press: scale down slightly (0.96) on mousedown, spring back on release (`active:scale-[0.96]` on toolbar buttons)
- [x] Panel open/close: slide in/out with a fast ease-out (150–200ms) (Framer Motion across all panels)
- [x] Sidebar tab switch: content cross-fades (AnimatePresence mode="wait" in Sidebar)
- [x] Clip drag: ghost/shadow follows cursor; original clip dims slightly (opacity 0.72 + elevated shadow during drag)
- [x] Clip drop: landing clip bounces softly into place (spring — position changes animate with spring stiffness 500/damping 38, applies to zoom too)
- [x] Clip delete: clip collapses horizontally before disappearing (scaleX 0, originX left, 160ms ease-in)
- [ ] Timeline zoom: ruler and clips scale smoothly, not in jumps
- [ ] Timeline scroll: inertia (coasts after fast scroll, decelerates naturally)
- [x] Modal open: scale up from 95% with fade-in (200ms); close is reverse (SettingsDialog, ExportDialog, CrashRecoveryDialog)
- [x] Notification/toast: slides in from bottom-right, auto-dismisses with a progress bar underneath (Toaster system built)
- [x] Staggered entrance: when media bin loads multiple clips, they appear one by one (30ms stagger)
- [x] Loading skeletons: shimmer animation on all loading states before content appears (SkeletonCard in media bin; animated placeholder bars in timeline clips while waveform loads)
- [x] Welcome screen: recent projects fade in staggered on load (stagger delay on RecentRow)
- [x] Waveform: bars grow up from the baseline progressively as data loads (450ms ease-out cubic, rAF-driven canvas animation)
- [x] Export progress bar: smooth fill, not chunky jumps (gradient animation in ExportDialog)
- [x] Playhead scrub: snappy, zero lag — this is the most-used interaction and must feel instant

---

## Phase Order Summary

| Phase | Focus | Dependency |
|---|---|---|
| 1 | Foundation & App Shell | None |
| 2 | Media Import & Library | Phase 1 |
| 3 | Timeline Core | Phase 2 |
| 4 | Preview Player | Phase 3 |
| 5 | Audio | Phase 3 + 4 |
| 6 | Effects & Overlays | Phase 4 + 5 |
| 7 | Export | Phase 3 + 5 + 6 |
| 8 | Tutorial, Polish & Settings | All phases |
