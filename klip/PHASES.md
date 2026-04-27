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
- [x] Project settings modal — set resolution (1080p/1440p/4K), frame rate (30/60fps), aspect ratio (16:9)

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
- [x] Linked clip selection — clicking a video clip also selects its linked audio; they move together by default
  - [x] Hold Alt while clicking to select video or audio independently
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
- [x] Multi-select drag — move all selected clips together
- [ ] Shift+click range select (deferred)
- [x] Freeze frame — right-click a clip at the playhead position to insert a freeze frame hold
- [x] Full undo / redo stack (Ctrl+Z / Ctrl+Shift+Z)
- [x] Timeline virtualization — only render visible clip elements (handles 8-hour source clips)

**QoL / UX:**
- [x] Smooth animated clip drag with spring physics
- [x] Timeline ruler tick marks update smoothly on zoom
- [x] Clip resize handles appear on hover (not always visible — reduces clutter)
- [x] Snap indicator line when clip is about to snap to an edge
- [x] Locked tracks visually dimmed with lock icon
- [x] Gap indicators with amber dashed pattern
- [x] Ripple delete plays a subtle "collapse" animation
- [x] Copy confirmation — briefly flash the copied clip(s) to confirm the action

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
- [x] First-launch interactive walkthrough — runs automatically the first time the app opens
  - [x] Spotlight overlay highlights specific UI areas one at a time (rest of screen dims)
  - [x] Step-by-step narration: Welcome → Import → Media Bin → Timeline → Shortcuts → Music → Export (7 steps)
  - [x] "Next" / "Back" / "Skip All" controls — never forced; step dot-progress indicator
  - [x] Animated card transitions, spotlight box-shadow highlight with accent border
- [x] Tutorial accessible at any time from Settings → App → "Restart Tutorial"
- [x] In-app Help panel — searchable Help tab in Settings; all features organized by category with expandable descriptions and shortcut badges
- [x] "What's this?" hover mode — toggle button in toolbar (or press Esc to exit); hover any annotated UI element to see a floating rich tooltip with title, description, and keyboard shortcut
- [x] Keyboard shortcut cheat sheet — accessible from Help (? key) button, opens Settings → Shortcuts tab

**Settings Panel:**
- [x] App settings: theme (dark only for now), default export path, proxy cache management
- [x] Timeline settings: default snap behavior
- [x] Keyboard shortcuts viewer (updated with Ctrl+K entry)
- [x] FFmpeg path override (for users who want to use a system FFmpeg)
- [x] Music library folder location setting
- [x] Tutorial settings: "Restart Tutorial" button in App tab resets `hasSeenWalkthrough`

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
- [x] Timeline zoom: ruler and clips scale smoothly, not in jumps (lerp rAF + cursor-anchored)
- [x] Timeline scroll: inertia (coasts after fast scroll, decelerates naturally)
- [x] Modal open: scale up from 95% with fade-in (200ms); close is reverse (SettingsDialog, ExportDialog, CrashRecoveryDialog)
- [x] Notification/toast: slides in from bottom-right, auto-dismisses with a progress bar underneath (Toaster system built)
- [x] Staggered entrance: when media bin loads multiple clips, they appear one by one (30ms stagger)
- [x] Loading skeletons: shimmer animation on all loading states before content appears (SkeletonCard in media bin; animated placeholder bars in timeline clips while waveform loads)
- [x] Welcome screen: recent projects fade in staggered on load (stagger delay on RecentRow)
- [x] Waveform: bars grow up from the baseline progressively as data loads (450ms ease-out cubic, rAF-driven canvas animation)
- [x] Export progress bar: smooth fill, not chunky jumps (gradient animation in ExportDialog)
- [x] Playhead scrub: snappy, zero lag — this is the most-used interaction and must feel instant

---

---

## Phase 9 — Bug Fixes

> Goal: Correct known logic and preview-accuracy bugs before they become user-facing pain.

### Logic Bugs

- [x] **`rippleDeleteSelected` leaves gaps when multiple clips are on the same track**
  - **Root cause:** The loop iterates over `toDelete` using each clip's original `startTime` from before the loop. After the first clip is deleted and subsequent clips shift left, later iterations compute `gapEnd = del.startTime + del.duration` using the *original* startTime — not the *current* (post-shift) startTime. Clips that should shift don't, leaving gaps between non-selected clips.
  - **Fix (`timelineStore.ts` `rippleDeleteSelected`):** Inside each loop iteration, look up `del`'s current `startTime` from the live `clips` array (find by `del.id`) before computing `gapEnd`. This ensures every iteration uses the actual post-shift position.

- [x] **`insertFreezeFrame` unlinks the left video and left audio from each other**
  - **Root cause:** After the freeze frame split, `leftVideo.linkedClipId = undefined` and `leftAudio.linkedClipId = undefined`. Only the right halves are re-linked; the left halves become two orphan clips.
  - **Fix (`timelineStore.ts` `insertFreezeFrame`):** Set `leftVideo.linkedClipId = linkedAudio.id` and `leftAudio.linkedClipId = src.id`. Both left halves must remain linked to each other, mirroring how the right halves are linked.

- [x] **`pasteClips` drops video + audio link when pasting a linked pair**
  - **Root cause:** All pasted clips get `linkedClipId: undefined` to avoid dangling refs. Pasting a linked video+audio pair produces two unlinked orphan clips.
  - **Fix (`timelineStore.ts` `pasteClips`):** Build an `idMap` (old ID → new `crypto.randomUUID()`) before mapping. When setting `linkedClipId` on a pasted clip, if the original `linkedClipId` is in `idMap`, use the mapped new ID. This re-wires linked pairs while still dropping links to clips not in the paste batch.

- [x] **`closeGap` doesn't shift linked audio when closing a video track gap**
  - **Root cause:** `closeGap` only shifts clips on the same `trackId`. A video clip linked to an audio clip on `a1` falls out of sync when the gap is closed on `v1`.
  - **Fix (`timelineStore.ts` `closeGap`):** After identifying clips to shift on `trackId`, also shift their `linkedClipId` counterparts on other tracks by the same `gapSize`.

- [x] **Export silently replaces missing-source clips with black gaps**
  - **Root cause:** In `buildFFmpegArgs`, when `job.mediaPaths[clip.mediaClipId]` is undefined, the clip falls through to `pushGap(clip.duration)` with no warning. The exported video has silent black holes instead of the expected content.
  - **Fix (`ExportDialog.tsx`):** Add a pre-flight check before calling `runExport`. Scan all clips for undefined paths and show a blocking warning modal listing the affected clips (name + track). The user must acknowledge or relink before export proceeds.

### Preview Accuracy Bugs

- [x] **Text overlay font size mismatches export — preview uses `vw`, export uses frame height**
  - **Root cause:** `TextOverlay` in `PreviewPanel.tsx` renders with `` fontSize: `${fontSize * 0.056}vw` `` (relative to viewport width). The FFmpeg export uses `Math.round(ts.fontSize * height / 1080)` (relative to output frame height). On a typical dual-panel layout these produce visually different sizes — the preview cannot be trusted as WYSIWYG.
  - **Fix (`PreviewPanel.tsx` `TextOverlay`):** Add a `canvasHeight` prop, measured via `ResizeObserver` on the canvas `div` ref (or `getBoundingClientRect` on each render). Render font size as `` `${fontSize * (canvasHeight / 1080)}px` ``. This exactly mirrors the FFmpeg formula and makes text size accurate in preview.

- [x] **Audio fade envelopes (fade-in / fade-out) are not applied during live playback**
  - **Root cause:** `fadeIn`/`fadeOut` values drive `afade` FFmpeg filters at export, but the preview player's `<video>` and `<audio>` elements receive no volume ramping. Users can't audition their fade choices.
  - **Fix (`PreviewPanel.tsx` playback engine):** When starting clip playback, schedule `GainNode.gain.linearRampToValueAtTime` calls on the existing `audioCtxRef` Web Audio graph: ramp 0 → clipVolume over `fadeIn` seconds at clip start, and clipVolume → 0 over `fadeOut` seconds ending at clip end. Route both the `<video>` and `<audio>` element sources through this gain node.

---

## Phase 10 — Seamless & Modern UX

> Goal: Close the gap between "functional" and "feels like a real product." Every session should feel fast, discoverable, and satisfying.

### Interaction & Navigation

- [x] **Timeline lasso (drag-select) for multi-clip selection**
  - Drag on empty track area to draw a selection rectangle; any clip whose bounding box intersects is added to the selection. Much faster than Ctrl+clicking individual clips.
  - Visual: translucent accent-colored rectangle that follows the cursor. Clips briefly illuminate as they enter the selection boundary.
  - Start drag on an empty track row region only (not on an existing clip). `pointerdown` on empty space → track drag delta → compute intersecting clips on `pointerup`.

- [x] **Timecode click-to-edit — type a time to jump the playhead**
  - Click the timecode display in the preview panel transport row to enter edit mode. Renders as a `<input type="text">` with mono font, same size as the timecode label, auto-selected on click.
  - Parse HH:MM:SS:FF, HH:MM:SS, or plain seconds. Enter confirms and seeks; Escape cancels and restores. Invalid input reverts silently.

- [x] **Timeline clip hover tooltip — rich info on hover**
  - Hovering a clip for 350ms shows a floating popover (above the clip, positioned left or right depending on screen edge): source file name, output duration, trim region (in → out), resolution + codec (video), and active effects (speed, color grade, zoom, fades).
  - Implemented as a portal-rendered `div` positioned to the clip's bounding rect. Framer Motion fade-in (80ms). Dismisses immediately on pointer leave.

- [x] **Audio scrubbing — brief audio feedback when dragging the playhead**
  - While actively dragging the timeline playhead (pointer captured on ruler), play a ≈80ms audio window at the current scrub position at 1× speed. Throttle to one fire per 60ms.
  - Implement via `AudioContext.decodeAudioData` + `AudioBufferSourceNode`. Decode only once per source clip; cache the buffer. Stop the previous buffer source before starting the next.

- [x] **Add / remove tracks — dynamic track count**
  - "+" button in the track headers panel to add a track. Opens a small picker: Video, Audio, Music.
  - Right-click a track header → "Remove Track" — only enabled when the track is empty and not a system track (`v1`, `a1`, `m1`).
  - New tracks join the store's `tracks` array and persist in the project JSON. `DEFAULT_TRACKS` stays the same; additions are user-created.

### Organization & Editing

- [x] **Clip color labels** *(promoted from Could Have)*
  - Right-click any clip → "Label Color" → inline color picker with 8 swatches: gray (default), red, orange, yellow, green, cyan, blue, purple.
  - Stored as `TimelineClip.labelColor?: string`. Applied as a subtle overlay tint (20% opacity) on the clip body, visible at all zoom levels.
  - Persisted in project JSON. No effect on export.

- [x] **Timeline minimap**
  - A slim (22px tall) full-width bar above the ruler, spanning from time 0 to `totalDuration`.
  - Renders all clips as tiny colored blocks at proportional positions (same colors as `CLIP_STYLE`).
  - A translucent viewport window shows the currently visible time range. Drag it or click anywhere to scroll.
  - Critical for navigating 8-hour OBS recordings where the visible timeline window is a tiny fraction of the content.

- [x] **Clip "Rename" via timeline context menu**
  - Right-click a timeline clip → "Rename" — shows an inline text input overlay on the clip label. Enter / click-outside saves. Escape cancels.
  - Renames only the timeline clip instance (`clip.name`), not the source media bin clip.

- [x] **"Extract Audio" on video clips**
  - Right-click a video clip → "Extract Audio to Extra Track" — creates a standalone audio clip on `a2` from the same source, at the same `startTime` / `trimStart` / `duration`. Unlinks the original video+audio pair so the extracted audio can be independently trimmed.
  - Useful for layering multiple mixes or pulling a specific vocal take separately from gameplay.

- [x] **Ripple-insert paste — Ctrl+Shift+V**
  - Paste clips at the playhead AND ripple all later clips on every track rightward by the total pasted duration, making room.
  - Distinct from Ctrl+V (which overlays without shifting anything).

### Export & Output

- [x] **YouTube chapter metadata export**
  - If any `TimelineMarker` entries have non-empty `label` strings, offer a checkbox in `ExportDialog`: "Embed chapters in MP4."
  - At export, pass chapter metadata via FFmpeg `-metadata:s:v` or a `-map_chapters` side file. YouTube reads these and auto-creates the chapter list.
  - Show a preview table of (timestamp, label) in the dialog before the user starts export.

### Animations & Feel

- [x] **Context menu opens from the click point, not top-left**
  - The menu's Framer Motion `scale: 0.94 → 1` animation always expands from the implicit `transform-origin: top left`, which looks wrong when the menu is repositioned to avoid screen edges.
  - Fix: compute `transformOrigin` from the quadrant of the click relative to the screen (`top-left` / `top-right` / `bottom-left` / `bottom-right`) and pass it to the motion `div`'s `style` prop. The animation will then expand from the click origin.

- [x] **Scrub bar — draggable playhead thumb, not just click-seek**
  - Currently the preview scrub bar handles `onClick` + `onMouseMove`. There's no `pointerdown` → capture → continuous `pointermove` loop for true drag-scrub.
  - Fix: replace with a `onPointerDown` handler that captures the pointer and calls `seekTo` on every `pointermove`. The thumb pill should scale up (1 → 1.4) during drag via Framer Motion `whileDrag`.

- [x] **Marker color picker**
  - Double-clicking a marker already opens a label editor. Add a row of 6 color swatches (amber default, red, green, cyan, purple, white) alongside the label input.
  - Stored in `TimelineMarker.color` (already modeled as a hex string — just unused beyond the default `'#f59e0b'`).

- [x] **Track header collapse — fold a track to minimal height**
  - Click the track type icon (or a small chevron) in the track header to collapse the track to 18px, showing only the name and mute/lock icons.
  - Expand on another click. Animate with Framer Motion `layout` so sibling tracks slide smoothly into the new position.
  - Stored in `Track.isCollapsed?: boolean`. Not persisted (resets on project open).

---

---

## Phase 11 — Bug Fixes II ✅ COMPLETE

> Goal: Squash logic bugs found in code audit after Phase 10 shipped.

### Logic Bugs

- [x] **`rippleDelete` (single clip) doesn't shift clips on the linked track**
  - **Root cause:** `rippleDelete` only shifted clips on `clip.trackId`. When a linked video+audio pair was ripple-deleted, the audio clip (on `a1`) was removed, but subsequent clips on `a1` (e.g., the next clip's audio) were NOT shifted left. This left all subsequent audio clips 5–60s ahead of their video counterparts.
  - **Fix (`timelineStore.ts` `rippleDelete`):** After removing the linked pair, also compute `linkedGapEnd` from the linked clip's position and duration. Shift any clip on `linkedClip.trackId` that starts at or after `linkedGapEnd` by `linkedClip.duration`, mirroring what was already done for the primary track.

- [x] **`DEFAULT_TRACKS` in `projectIO.ts` was missing the `a2` Extra Audio track**
  - **Root cause:** The 4-item `DEFAULT_TRACKS` array used as a fallback during project open/crash-recovery was never updated when the `a2` Extra Audio track was added in Phase 5. Projects opened without a stored `tracks` array (old format, corrupted save, or autosave recovery edge case) would restore the editor with only 4 tracks — no Extra Audio lane.
  - **Fix (`projectIO.ts`):** Added `{ id: 'a2', type: 'audio', name: 'Extra Audio', ... }` to the fallback `DEFAULT_TRACKS` array so it matches `timelineStore.ts` exactly.

- [x] **`advanceGap` ignored `previewSpeed` — gap playback was always 1× real-time**
  - **Root cause:** The `advanceGap` helper (used when the playhead passes through a gap between timeline clips) advanced time by `(wallClock - start) / 1000` seconds, which is always 1× speed regardless of the user's selected preview speed. At 2× preview speed, the playhead would correctly double-speed through clips but then drop back to 1× through gaps, causing a jarring slowdown.
  - **Fix (`PreviewPanel.tsx` `advanceGap`):** Multiply the elapsed wall-clock seconds by `previewSpeedRef.current` so gaps advance at the same rate as clips.

- [x] **`ResizeObserver` not polyfilled in jsdom — REG-001 (PreviewPanel mount test) was broken**
  - **Root cause:** Phase 9 added a `ResizeObserver` in `PreviewPanel.tsx` to measure canvas height for WYSIWYG text font sizing. jsdom (used by Vitest) doesn't implement `ResizeObserver`, causing REG-001 to throw on mount rather than testing the original TDZ crash.
  - **Fix (`src/tests/setup.ts`):** Added a no-op `ResizeObserver` class stub alongside the existing `scrollIntoView` stub.

### New Regression Tests

- [x] **REG-012** — `rippleDelete` with a linked pair now also shifts clips on the linked track
- [x] **REG-013** — `projectIO.ts` DEFAULT_TRACKS has all 5 tracks including `a2`

---

## Phase 12 — Quality & Polish ✅ COMPLETE

> Ideas surfaced during the Phase 11 audit. All items implemented.

### P0 — Undo Coverage Gaps (user-visible inconsistency) ✅
- [x] **`commitClipUndo()` added to `timelineStore`** — snapshots current state into the undo stack without modifying it. Called on `onPointerDown` from `SliderRow` and `onDragStart` from `FadeHandle`/`ZoomMinimap` so each drag produces exactly one undo entry.
- [x] **`renameClip` and `setClipLabelColor` now push to undo stack** — consistent with `setClipSpeed` and other structural ops.
- [x] **Volume / fade / color-grade / crop / pan sliders in `ClipContextMenu`** — all wired with `onPointerDown={onCommitUndo}` so the pre-drag state is captured as one undo entry.
- [x] **`FadeHandle` and `ZoomMinimap`** — each gained `onDragStart` prop, called before the drag mutates state.

### P1 — Master Volume Persisted ✅
- [x] **`masterVolume` serialized in project JSON** — added to `serializeProject()` and restored in `deserializeProject()` (defaults to `1` for legacy projects).

### P1 — True Dip-to-Black Export ✅
- [x] **`dip-to-black` now uses `D/2` fades** — each clip fades to/from black over half the transition duration, producing a genuine black frame between clips. `fade` type continues to use the full duration for a true crossfade appearance.

### P2 — `extractAudio` Inherits Video-Specific Fields ✅
- [x] **`extractAudio` now explicitly copies only audio-relevant fields** — no more `textSettings`, `colorSettings`, `cropSettings`, `thumbnail`, `role`, `labelColor`, or any video-only data on the extracted audio clip.

### P2 — Preview Speed During Gap Advance ✅
- [x] **`reverseAdvanceGap` already multiplied by `previewSpeedRef.current`** — confirmed correct; this was only an issue in `advanceGap` which was fixed in Phase 11.

### P3 — Worthwhile New Features ✅ (subset implemented)
- [x] **Export to GIF / WebM** — two new presets added: `Animated GIF` (1280×720 @ 15fps, palette-based, no audio) and `WebM (VP9)` (1080p @ 30fps, VP9+Opus). File extension in the path preview updates dynamically.
- [x] **Zoom to selection** — `Shift+\` (`|`) zooms the timeline so selected clips fill the viewport, scrolling to keep them centered. Falls back to zoom-to-fit when no clips are selected.
- [x] **Marker navigation shortcuts** — `[` jumps to the previous marker, `]` jumps to the next marker.
- [x] **Timeline ruler right-click → add marker** — right-clicking anywhere on the ruler places a marker at that time position. Faster than pressing `M`.

- [ ] **Volume keyframes** — requires keyframe data model (deferred; significant scope).
- [ ] **Auto-duck music** — requires cross-clip analysis pass (deferred).
- [ ] **Batch audio normalize** — deferred; can be done as a future feature.
- [ ] **Clip speed ramp** — requires non-linear `setpts` expression (deferred).
- [ ] **Clip group / compound clip** — significant UI scope (deferred).

---

---

## Phase 13 — Hardening & Polish

> Goal: Close the remaining gaps between "functional" and "trustworthy." Every action should give the user clear feedback; every failure should be handled gracefully.

### P0 — Correctness Bugs (data-loss or silent-failure risk)

- [x] **Save-before-close confirmation** — Ctrl+W / title-bar ✕ with unsaved changes shows a modal: "Save before closing?" with Save / Discard / Cancel. Currently the app closes silently and the user may lose work that hasn't been auto-saved yet.

- [x] **Undo stack cleared on "New Project"** — Opening or creating a new project should reset `past` and `future` to empty. Currently the previous project's history lingers, so Ctrl+Z can undo across a project boundary into stale state.

- [x] **Loop in/out range cleared on project open** — The loop range (`loopStart`, `loopEnd`, `isLooping`) is not reset when a different project is opened. Users arrive at a new project with a confusing loop baked in from the last session.

- [x] **Autosave corruption graceful fallback** — The crash-recovery flow calls `JSON.parse()` on the autosave file without a try-catch. A truncated write (power loss mid-save) throws uncaught, causing the crash-recovery dialog to silently fail. Wrap in try-catch; offer "Autosave was corrupted — start fresh or open a project."

- [x] **Proxy FFmpeg process cancelled when source clip is removed** — Deleting a clip from the media bin while its proxy is still generating leaves a zombie FFmpeg child process running in the background, burning CPU until it finishes. `removeMediaClip` should kill the in-flight child process if one is tracked for that `mediaClipId`.

- [x] **Export IPC failure leaves UI frozen** — The `await window.api.export.start(job)` call in `ExportDialog` has no `.catch()` handler. If the IPC channel rejects (FFmpeg binary missing, path traversal blocked), the dialog stays in the "exporting" state indefinitely. Add error handling that transitions to the error state with a human-readable message.

### P1 — UX Gaps (missing feedback loops)

- [x] **Export pre-flight validation** — Before starting export, check: (a) output folder exists and is writable, (b) filename contains no invalid Windows characters (`< > : " | ? *`), (c) rough disk-space estimate vs. available space. Show inline field errors in real time as the user types; block the Export button until valid.

- [x] **Waveform extraction failure shows a toast** — Currently, if FFmpeg fails to extract waveform data (disk full, FFmpeg missing, corrupted audio), the hook returns `peaks: null` silently and the timeline shows no waveform. Show a toast: "Waveform generation failed for [clip name]" with a Retry option.

- [x] **Copy confirmation toast with count** — The current copy confirmation is a brief flash on the copied clip(s), easy to miss. Replace with (or supplement with) a toast: "Copied 1 clip" / "Copied 3 clips" that appears bottom-right and auto-dismisses in 2s.

- [x] **Undo/redo empty-state tooltip** — When the undo or redo stack is empty, the toolbar button is `opacity-50` but shows no tooltip. Add: "Nothing to undo (Ctrl+Z)" / "Nothing to redo (Ctrl+Shift+Z)" so users understand they've hit the history boundary.

- [x] **Clip duration minimum-clamp warning** — `Math.max(0.1, ...)` silently floors clip duration during trim. Show a one-shot toast "Minimum clip duration is 0.1 s" the first time a trim hits the floor so the user understands why the handle stopped moving.

- [x] **"Clear Proxy Cache" requires confirmation** — One click deletes potentially gigabytes of proxy files with no warning. Show a dialog: "Clear X MB of proxy files? They will be regenerated on next import." with a Cancel option.

- [x] **Playhead position saved and restored in project JSON** — The current playhead time is not serialized. Opening a saved project always drops the playhead at 0:00. Add `playheadTime` to `serializeProject()` / `deserializeProject()` so the editor reopens exactly where the user left off.

### P2 — Animation & Polish

- [ ] **Export dialog state cross-fade** — The `DialogState` switch between `idle → exporting → done → error` is a hard DOM swap. Wrap the content areas in `<AnimatePresence mode="wait">` with a 150ms fade so the progress bar slides in rather than snapping.

- [ ] **Clip resize handles scale with zoom** — Trim handle hit-targets are a fixed pixel width in `TimelineClipView`. At high zoom they're oversized; at low zoom they're unclickable. Compute handle width as `clamp(6, 12 / zoomFactor, 20)` so they scale inversely with zoom and remain usable at all levels.

- [ ] **Tooltip delay reduced to 150 ms** — The global tooltip delay is 300ms (`delayDuration` in `tooltip.tsx`). At that speed, tooltips appear after the user has already moved on. 150ms is the standard for dense tool-heavy apps (Figma, VS Code); change the default.

- [ ] **Stale markers auto-removed when timeline shrinks** — If clips are deleted and the total timeline duration shrinks, markers that now fall beyond the new end time become invisible orphans in the store. On any operation that reduces `totalDuration`, prune any `TimelineMarker` whose `time > newDuration` and show a toast if any were removed.

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
| 9 | Bug Fixes | All phases |
| 10 | Seamless & Modern UX | Phase 9 |
| 11 | Bug Fixes II | Phase 10 |
| 12 | Quality & Polish (ideas) | Phase 11 |
| 13 | Hardening & Polish | Phase 12 |
