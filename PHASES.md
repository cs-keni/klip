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

## Phase 5 — Audio

> Goal: Full audio control — game sound, music, voice, all in balance.

- [ ] Multiple audio tracks on the timeline (at least 3: Video Audio, Music, Extra)
- [ ] Each video clip carries its audio by default (linked video + audio)
- [ ] Unlink audio from video clip (detach to manipulate independently)
- [ ] Drag music from music library onto a music track lane
- [ ] Per-clip volume slider (0–200%, default 100%)
- [ ] Audio normalization per clip — analyze and auto-adjust gain to a target loudness (one-click)
- [ ] Per-track mute button and solo button
- [ ] Track locking applies to audio tracks too
- [ ] Waveform visualization on all audio clips (generated from FFmpeg)
  - [ ] Cached after first generation, not recomputed on every open
- [ ] Audio fade in / fade out handles on clip edges (drag to create a fade ramp)
- [ ] Master volume control
- [ ] Audio level meters in the preview panel (show peaks in real time during playback)

**QoL / UX:**
- [ ] Waveform renders progressively (bars appear left to right as data is computed)
- [ ] Color-coded tracks (video audio = blue, music = green, extra = purple)
- [ ] Volume slider animates smoothly when adjusted with scroll wheel
- [ ] Clipping indicator on audio meter (flashes red when audio peaks above 0dB)
- [ ] Mute button animates (icon cross-fade, track dims)

---

## Phase 6 — Effects & Overlays

> Goal: Text, transitions, and visual effects to make the video feel produced.

**Transitions:**
- [ ] Fade to black / fade from black (essential for your intro/outro style)
- [ ] Crossfade between clips (dissolve)
- [ ] Transition duration is adjustable
- [ ] Transitions applied by dragging onto clip edge or right-click menu

**Text Overlays:**
- [ ] Add text to any point on the timeline (start time + duration)
- [ ] Text editor: font family, font size, color, bold, italic
- [ ] Text position: drag on preview canvas to place
- [ ] Text alignment and anchor presets (center, lower-third, top)
- [ ] Background fill option (solid or semi-transparent box behind text)
- [ ] Text animation presets: fade in, slide up, typewriter effect
- [ ] Text overlays visible as a layer on the timeline

**Digital Zoom:**
- [ ] Per-clip zoom level (1x–4x)
- [ ] Zoom position — pan the zoomed frame (which part of the frame is visible)
- [ ] Animated zoom — keyframe start zoom and end zoom for a slow push-in effect
- [ ] Zoom presets: "Punch in" (quick snap zoom) and "Slow push" (gradual)

**Intro / Outro:**
- [ ] Designated "Intro" slot at the start of the timeline (snaps to position 0)
- [ ] Designated "Outro" slot at the end of the timeline
- [ ] Visual distinction from regular clips (different color or badge)
- [ ] These are just clips — any video file, image, or solid color can be used as intro or outro

**QoL / UX:**
- [ ] Transition previews on hover in the effects panel (looping thumbnail animation)
- [ ] Text overlay selected state shows handles on preview canvas (resize, move)
- [ ] Zoom region shown as an overlay box on preview while editing
- [ ] Adding a transition plays a smooth "insertion" animation on the timeline

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
- [ ] App settings: theme (dark only for now), default export path, proxy storage location
- [ ] Timeline settings: default snap behavior, default new track count
- [ ] Keyboard shortcuts viewer and (eventually) remapper
- [ ] FFmpeg path override (for users who want to use a system FFmpeg)
- [ ] Music library folder location setting
- [ ] Tutorial settings: option to replay the tutorial or reset onboarding state

**General QoL:**
- [ ] Auto-save every 2 minutes to a `.autosave` project file
- [ ] Crash recovery — on startup, detect unsaved autosave and offer to restore
- [ ] "Unsaved changes" indicator in titlebar (dot next to project name, like VS Code)
- [ ] Ctrl+S to save, Ctrl+Shift+S to save as
- [ ] Project name shown in titlebar
- [ ] Recent projects on welcome screen (last 5, with thumbnail)
- [ ] Context menus throughout (right-click on everything that should have one)
- [ ] Tooltip system — hover any button for 300ms to see a label + keyboard shortcut
- [ ] Global search / command palette (Ctrl+K) — search clips, effects, settings, actions
- [ ] Clip markers — drop a pin on the timeline with a label (M key)
- [ ] Timeline ruler format toggle (seconds vs HH:MM:SS:FF timecode)
- [ ] Go to next / previous edit — jump playhead to the next/previous clip boundary (Up/Down arrow)

**Performance:**
- [ ] Waveform cache on disk — don't recompute on every project open
- [ ] Proxy file cache management — settings to clear old proxies, see disk usage

**Animations & Feel:**
Every interaction should feel responsive and alive — not flashy, just smooth and deliberate.
- [ ] Consistent easing: ease-out for elements entering the screen, ease-in for exits, spring physics for drags
- [ ] Button press: scale down slightly (0.96) on mousedown, spring back on release
- [ ] Panel open/close: slide in/out with a fast ease-out (150–200ms) — never instant, never slow
- [ ] Sidebar tab switch: content cross-fades (not a hard swap)
- [ ] Clip drag: ghost/shadow follows cursor; original clip dims slightly
- [ ] Clip drop: landing clip bounces softly into place (spring)
- [ ] Clip delete: clip collapses horizontally before disappearing
- [ ] Timeline zoom: ruler and clips scale smoothly, not in jumps
- [ ] Timeline scroll: inertia (coasts after fast scroll, decelerates naturally)
- [ ] Modal open: scale up from 95% with fade-in (200ms); close is reverse
- [ ] Notification/toast: slides in from bottom-right, auto-dismisses with a progress bar underneath
- [ ] Staggered entrance: when media bin loads multiple clips, they appear one by one (30ms stagger)
- [ ] Loading skeletons: shimmer animation on all loading states before content appears
- [ ] Welcome screen: recent projects fade in staggered on load
- [ ] Waveform: bars grow up from the baseline progressively as data loads
- [ ] Export progress bar: smooth fill, not chunky jumps
- [ ] Playhead scrub: snappy, zero lag — this is the most-used interaction and must feel instant

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
