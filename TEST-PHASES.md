# TEST-PHASES.md — Klip Test Suite

## Overview

All tests live under `klip/src/tests/` (Vitest + RTL) and `klip/e2e/` (Playwright).
Run unit/integration suite: `npx vitest run`
Run E2E suite: `npx playwright test`

---

## Phase 1 — Property-Based / Math Invariants ✅ COMPLETE

**File:** `src/tests/unit/property-based.test.ts`

- [x] §1.9 Timeline math invariants via fast-check (split, trim, duration)
  - [x] Split always produces two clips whose durations sum to the original
  - [x] Trim never makes a clip's duration negative
  - [x] Clip start time is always ≥ 0 after any move operation

---

## Phase 2 — Unit Tests ✅ COMPLETE

**Files:** `src/tests/unit/`

- [x] §2.1 Static data (constants, default track shapes, type guards)
- [x] §2.2 Signals (Zustand store subscriptions, computed values)
- [x] §2.3 Project I/O (serializeProject / openProject round-trip)
- [x] §2.4 Media utils (duration formatting, resolution label helpers)

---

## Phase 3 — Store Tests ✅ COMPLETE

**Files:** `src/tests/stores/`

- [x] §3.1 Simple stores (uiStore, appStore, projectStore, toastStore)
- [x] §3.2 timelineStore — full CRUD: addClip, splitClip, trimClip, rippleDelete, undo/redo
- [x] §3.3 mediaStore + projectStore — add, update, remove, isOnTimeline flag

---

## Phase 4 — Integration Tests ✅ COMPLETE

**File:** `src/tests/integration/store-interactions.test.ts`

- [x] §4.1 Media → Timeline linking (isOnTimeline syncs on add/remove)
- [x] §4.2 Project save/load round-trip (serializeProject → openProject restores state)
- [x] §4.3 Undo across stores (timeline undo does not corrupt media store)
- [x] §4.4 UI store + feature interactions (showExport / showSettings flags)
- [x] §4.5 appSettingsStore interactions (hasSeenWalkthrough persists)
- [x] §4.6 Text overlay round-trip (textSettings survive serialize/openProject)
- [x] §4.7 Transition round-trip (fade/dip-to-black persist through serialize/openProject, duplicate replace, clip-delete cascade)
- [x] §4.8 Speed/zoom/color-grade survive save/load (speed clamping, colorSettings, cropSettings, role, audio fades)

---

## Phase 5 — IPC Handler Tests ✅ COMPLETE

**Files:** `src/tests/ipc/`

- [x] §5.1 window-state handlers
- [x] §5.2 settings handlers (read/write app config)
- [x] §5.3 project handlers (save, load, autosave, crash recovery)
- [x] §5.4 window handlers (minimize, maximize, close)
- [x] §5.5 media handlers (thumbnail generation, proxy generation)
- [x] §5.6 waveform handlers (FFmpeg audio extraction, disk cache)
- [x] §5.7 proxy handlers (480p transcode, progress events)
- [x] §5.8 local-file protocol (`klip://` handler)
- [x] §5.9 ffmpeg-export handlers (export pipeline, progress, cancel)
- [x] §5.10 quick-render preview handler
- [x] §5.11 IPC contract test — preload channels vs handler channels must be in sync

---

## Phase 6 — Regression Tests ✅ SEEDED (expand as bugs ship)

**File:** `src/tests/regression/reg.test.tsx`

Format: one test per shipped bug, labeled `REG-NNN`.

- [x] REG-001 PreviewPanel TDZ crash (handleSaveFrame declared-before-use)
- [x] REG-002 SidebarTab `data-help` prop not forwarded to DOM
- [ ] REG-003+ Add new entries here as bugs are discovered and fixed

---

## Phase 7 — Smoke Tests ✅ COMPLETE

**File:** `src/tests/smoke/smoke.test.tsx`

Binary pass/fail — if any smoke fails, build is not releasable.

- [x] §7.1 WelcomeScreen renders logo + New / Open buttons
- [x] §7.2 New Project navigates to editor view
- [x] §7.3 Editor layout: sidebar, preview panel, timeline panel all mount
- [x] §7.4 Default timeline tracks (5 tracks on init)
- [x] §7.5 No console.error on welcome screen render
- [x] §7.6 Tutorial auto-launches on first run (hasSeenWalkthrough=false)
- [x] §7.7 Tutorial completes all 7 steps without crash
- [x] §7.8 Command Palette renders search input when open
- [x] §7.9 Settings dialog renders when showSettings=true
- [x] §7.10 Export dialog renders when showExport=true

---

## Phase 8 — E2E Tests (Playwright) ✅ COMPLETE

**Files:** `klip/e2e/`

- [x] §8.1 Project lifecycle (new project, title bar, Ctrl+S, crash recovery)
- [x] §8.2 Media import (drag-and-drop, file picker, missing file detection)
- [x] §8.3 Timeline (add clip, split, trim, delete, undo/redo, snap)
- [x] §8.4 Playback (play/pause, scrub, J/K/L, loop, speed control)
- [x] §8.5 Keyboard shortcuts (S split, Q/W trim, Delete, Ctrl+Z, \\ zoom-fit)
- [x] §8.6 Export (dialog opens, preset visible, output path, progress, cancel)
- [x] §8.7 Text overlays (add via toolbar, editor panel opens, clip on timeline)
- [x] §8.8 Audio (per-clip volume/fades, mute/solo track, master volume)
- [x] §8.9 Effects — Transitions & Roles (fade/dip-to-black add/remove, clip role intro/outro)
- [x] §8.10 Color grade & digital zoom (setColorSettings, setCropSettings, setClipSpeed, clamping)
- [x] §8.11 Proxy generation (proxyStatus state transitions, UI clip card visible)
- [x] §8.12 Music library (Music tab, addTracks, removeTrack, search, no-duplicate guard)
- [x] §8.13 Source clip viewer (openClip/closeViewer, in/out points, per-clip isolation)
- [x] §8.14 Missing file detection & relink (isMissing flag, relinkClip, multi-clip states)

---

## Phase 9 — Performance Tests ✅ COMPLETE

**File:** `src/tests/performance/perf.test.ts`

- [x] §9.1 Timeline store operations (addClip×100 <200ms, split <20ms, rippleDelete×100 <50ms, zoom <10ms, moveClips×100 <50ms)
- [x] §9.2 Media store operations (addClip×50 <100ms, waveform cache lookup×1000 <5ms, updateClip×50 <100ms)
- [x] §9.3 Playback state (setPlayheadTime <1ms, selectClip×100 <50ms, setMasterVolume×1000 <100ms)
- [x] §9.4 Export state throughput (100 progress updates <50ms, store hydration 50 clips <50ms)
- [x] §9.5 Store init + undo chain (getState() <5ms, 50 adds + 50 undos <100ms)
- [ ] §9.6 Hardware benchmarks (deferred — require Electron + FFmpeg + real media fixtures)
  - [ ] Thumbnail generation for 1-min 1080p clip < 5s
  - [ ] Waveform for 10-min MP3 < 10s
  - [ ] 1-min export < 3 minutes
  - [ ] Cold launch to welcome screen < 3s
  - [ ] Reopen project with 50 clips < 5s

---

## Phase 10 — Security Tests ✅ COMPLETE

**File:** `src/tests/security/security.test.ts`

- [x] §10.1 BrowserWindow webPreferences (contextIsolation=true, nodeIntegration≠true, webSecurity comment)
- [x] §10.2 Preload surface (no raw ipcRenderer exposed; setWindowOpenHandler validates URLs)
- [x] §10.3 isAllowedExternalUrl (allows http/https; blocks file://, javascript:, data:, ftp://)
- [x] §10.4 isExportPathSafe (rejects relative paths + traversal payloads; accepts absolute paths)
- [x] §10.5 getFFmpegPath: custom path only used when file exists on disk
- [x] §10.6 Autosave path is inside userData, not OS temp
- [x] §10.7 No console.log of project data in main-process IPC handlers

---

## Phase 11 — Component Tests ✅ COMPLETE

**Files:** `src/tests/components/`, `src/tests/hooks/`

- [x] Tutorial walkthrough (TutorialOverlay step progression, Skip, Done)
- [x] Shell (AppLayout renders, panel resize, sidebar tab switch)
- [x] Media (ClipCard, MediaBin interactions, context menu)
- [x] Timeline (clip render, drag, trim handles, gap indicator)
- [x] Dialogs (SettingsDialog, ExportDialog, ProjectSettingsDialog)
- [x] CommandPalette (search, keyboard nav, execute command)
- [x] Custom hooks (usePlayback, useKeyboardShortcuts, etc.)

---

## Phase 12 — Accessibility Tests ✅ COMPLETE

**File:** `src/tests/accessibility/a11y.test.tsx`

- [x] §12.1 axe automated scans (WelcomeScreen, ExportDialog, SettingsDialog, CommandPalette, ErrorBoundary, ClipCard, TutorialOverlay, TopToolbar)
- [x] §12.2 Focus management (CommandPalette auto-focus, Escape closes, dialog close buttons keyboard-accessible, TutorialOverlay Skip)
- [x] §12.3 Keyboard navigation (TopToolbar aria-labels, CommandPalette ArrowUp/Down, Enter executes, What's-This aria-pressed, ClipContextMenu roles)

---

## Still To Implement

### P0 — Fill regression gaps as bugs ship
- [ ] REG-003+ entries: add one test per bug that reaches production

### P3 — Performance hardware benchmarks (§9.6 above)
- All five are registered as `it.todo` — implement once CI has a machine with FFmpeg access

### P4 — Visual regression (future)
- [ ] Screenshot baseline for welcome screen, editor layout, export dialog
- [ ] Requires Playwright `toHaveScreenshot()` + stored snapshots

---

## Test Count Summary

| Layer | Files | Status |
|---|---|---|
| Property-based | 1 | ✅ |
| Unit | 4 | ✅ |
| Stores | 3 | ✅ |
| Integration | 1 | ✅ |
| IPC handlers | 11 | ✅ |
| Regression | 1 (2 cases) | ✅ seeded |
| Smoke | 1 (10 cases) | ✅ |
| E2E (Playwright) | 7 | ✅ |
| Performance | 1 | ✅ |
| Security | 1 | ✅ |
| Components + Hooks | 7 | ✅ |
| Accessibility | 1 | ✅ |
| E2E new (§8.8–8.14) | 7 | ✅ |
| **Total** | **40** | **✅** |
