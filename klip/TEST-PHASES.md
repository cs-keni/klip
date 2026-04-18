# Klip — Test Phases

> **Why this exists:** Klip has a complex two-process Electron architecture (main + renderer),
> stateful Zustand stores with undo/redo history, FFmpeg integration, IPC boundaries, and a
> virtualized timeline. Subtle bugs at any layer reach users as hard crashes. This document
> defines every test layer so issues are caught before they ship.
>
> **Design rule:** Every bug that has already shipped gets a permanent regression test.
> Every public-facing function gets at least one unit test. Components test behavior,
> not implementation.

---

## Test count summary

| Phase | Type | Expected tests |
|---|---|---|
| 1 | Unit — pure functions & utilities | ~122 |
| 2 | Unit — Zustand store actions | ~119 |
| 3 | Component — renderer UI + hooks | ~227 |
| 4 | Integration — store ↔ store | ~45 |
| 5 | Integration — IPC / main process + contracts | ~118 |
| 6 | Regression — one test per shipped bug | ~15 |
| 7 | Smoke — pre-build sanity | ~15 |
| 8 | Functional — feature checklist (manual / Playwright) | ~65 |
| 9 | Performance — benchmarks | ~15 |
| 10 | Security — Electron surface | ~12 |
| 11 | Acceptance — user stories | ~30 |
| 12 | Accessibility — axe + keyboard navigation | ~20 |
| **Total** | | **~803** |

---

## Testing stack

| Layer | Tool |
|---|---|
| Unit + store + component | **Vitest** + **React Testing Library** |
| E2E / functional | **Playwright** with `electron` launch driver |
| Performance benchmarks | **Vitest bench** + manual profiling |
| Coverage reporting | **@vitest/coverage-v8** |
| Property-based testing | **fast-check** (run inside Vitest) |
| Accessibility | **jest-axe** + **axe-core** (run inside Vitest + RTL) |

```bash
# All unit + component tests
npx vitest run

# Watch mode
npx vitest

# Coverage report
npx vitest run --coverage

# E2E (requires a built app)
npx playwright test

# Single phase or grep
npx vitest run --grep "REG-"
npx vitest run --grep "timelineStore"
```

---

## Phase 1 — Unit: Pure Functions & Utilities (~110 tests) ✅ IMPLEMENTED

> No DOM, no stores, no IPC. Input → expected output.
> **Files:** `src/tests/unit/media-utils.test.ts` (45 tests) · `src/tests/unit/static-data.test.ts` (28 tests) · `src/tests/unit/signals.test.ts` (21 tests) · `src/tests/unit/project-io.test.ts` (27 tests) · `src/tests/unit/property-based.test.ts` (24 tests) · 145 new tests, 314 total passing.

### 1.1 `mediaUtils.ts` — formatting helpers (~25 tests)

**`formatTimecode(seconds)`**
- [ ] `0` → `"00:00:00:00"`
- [ ] `1` → `"00:00:01:00"`
- [ ] `1.5` → `"00:00:01:15"` (30 fps frame count)
- [ ] `60` → `"00:01:00:00"`
- [ ] `3600` → `"01:00:00:00"`
- [ ] `3661.033` → `"01:01:01:01"`
- [ ] Negative input is clamped to zero (no negative timecodes)
- [ ] `Infinity` / `NaN` returns a stable fallback (no crash)

**`formatDuration(seconds)`**
- [ ] `0` → `"0:00"`
- [ ] `59` → `"0:59"`
- [ ] `60` → `"1:00"`
- [ ] `3599` → `"59:59"`
- [ ] `3600` → `"1:00:00"` (hours shown only when >= 1 hour)
- [ ] Negative input returns `"0:00"` (not a crash or negative string)

**`formatFileSize(bytes)`**
- [ ] `0` → `""` (empty, not "0 KB")
- [ ] `1023` → shows KB
- [ ] `1048576` → `"1.0 MB"`
- [ ] `1073741824` → `"1.00 GB"`

**`formatResolution(width, height)`**
- [ ] `1920, 1080` → `"1080p"`
- [ ] `2560, 1440` → `"1440p"`
- [ ] `3840, 2160` → `"4K"`
- [ ] `1280, 720` → `"720p"`
- [ ] `640, 480` → `"640×480"` (no named preset)
- [ ] `0, 0` → `""` (audio-only files have no resolution)

**`pathToFileUrl(filePath)`**
- [ ] Windows path `C:\Users\test\video.mp4` → `klip://local/C:/Users/test/video.mp4`
- [ ] Backslashes normalised to forward slashes
- [ ] Spaces in path are percent-encoded (`%20`)
- [ ] Unicode characters in filename are percent-encoded
- [ ] Drive letter `C:` is preserved (not encoded)
- [ ] UNC path `\\server\share\file.mp4` does not crash

**`getMediaTypeFromPath(path)`**
- [ ] `.mp4`, `.mov`, `.mkv`, `.avi`, `.webm` → `"video"`
- [ ] `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a` → `"audio"`
- [ ] `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp` → `"image"`
- [ ] Unknown extension falls back to `"video"`
- [ ] Extension comparison is case-insensitive (`.MP4` = `"video"`)
- [ ] Path with no extension falls back to `"video"`

---

### 1.2 `mediaUtils.ts` — async media processing (~8 tests)

*These require a jsdom or node environment with test fixture files.*

- [ ] `processMediaFile` resolves with `{ duration, width, height, thumbnail }` for a valid video fixture
- [ ] `processMediaFile` resolves with `thumbnail: null` for an audio file
- [ ] `processMediaFile` rejects with a clear Error message for a non-existent path
- [ ] `processMediaFile` rejects on a corrupted/unreadable file (no hang)
- [ ] `processImage` returns `duration: 5` (default still-image duration)
- [ ] `processImage` returns correct `width` and `height` from a known PNG fixture
- [ ] `processVideo` generates a base64 JPEG thumbnail string
- [ ] `processVideo` rejects with "Video load timeout" if loading exceeds 20 seconds

---

### 1.3 `tutorialSteps.ts` (~10 tests)

- [ ] `TUTORIAL_STEPS` has exactly 7 entries
- [ ] Every step has a unique `id` (no duplicates)
- [ ] Every step has non-empty `title` and `body` strings
- [ ] Every `target` that is non-null is a valid CSS selector string (not empty)
- [ ] The first step (`"welcome"`) has `target: null` (centered dialog)
- [ ] The step at index 4 (`"shortcuts"`) has `target: null`
- [ ] Every `placement` value (when present) is one of `"top" | "bottom" | "left" | "right" | "auto"`
- [ ] Step order is: welcome → import → media-bin → timeline → shortcuts → music → export
- [ ] No step has both `target: null` and a defined `placement` of a non-null direction (meaningless combination)
- [ ] Step IDs match what the tutorial overlay's spotlight system expects (cross-reference `data-tutorial` attributes)

---

### 1.4 Signal utilities (~12 tests)

**`snapIndicator.ts`**
- [ ] `subscribeSnapTime(cb)` calls `cb` with the emitted value when `publishSnapTime` fires
- [ ] Multiple subscribers all receive the same event
- [ ] Returned unsubscribe function stops future callbacks
- [ ] Unsubscribing twice does not throw
- [ ] `publishSnapTime(null)` fires with null (snap hidden)

**`rippleSignal.ts`**
- [ ] `markRipple(id)` calls all registered callbacks with the clip id
- [ ] Callback is not called after unsubscribing
- [ ] Calling with an id that no subscriber is interested in does not throw

**`copyFlash.ts`**
- [ ] `triggerCopyFlash(id)` emits to subscribers
- [ ] Flash event resolves/completes within the expected timeout window

---

### 1.5 `dragRegistry.ts` (~8 tests)

- [ ] `setDragPayload(data)` stores the payload
- [ ] `getDragPayload()` returns the stored payload
- [ ] `clearDragPayload()` returns null on next `getDragPayload()` call
- [ ] `getDragPayload()` before any set returns null (not undefined)
- [ ] Payload is isolated per drag operation (second drag overwrites first)
- [ ] Calling `clearDragPayload()` twice does not throw
- [ ] Payload round-trips complex objects (clips with nested settings)
- [ ] Registry does not hold stale references across component unmounts

---

### 1.6 `projectIO.ts` — serialization & deserialization (~15 tests)

- [ ] `serializeProject(state)` produces a valid JSON-serializable object
- [ ] `deserializeProject(json)` restores identical `tracks`, `clips`, and `transitions`
- [ ] Serialized format includes a `version` field
- [ ] Deserializing a project from a missing optional field (e.g. no `markers`) does not crash
- [ ] Deserializing a project with an unknown field ignores it gracefully
- [ ] Deserializing a project with a wrong `type` for a field throws a descriptive error (not a silent wrong state)
- [ ] An empty project (no clips) serializes and deserializes to the same empty state
- [ ] A project with 100 clips round-trips correctly (no clips lost or duplicated)
- [ ] Clip `textSettings` (nested object) survives the round-trip
- [ ] Clip `colorSettings`, `cropSettings` survive the round-trip
- [ ] `transitions` array survives the round-trip
- [ ] `markers` array survives the round-trip
- [ ] `autosaveProject` writes to disk (mocked fs) and is recoverable
- [ ] `restoreAutosave` reads the autosave file and applies state
- [ ] A corrupted autosave file is caught; `restoreAutosave` rejects cleanly without crashing the app

---

### 1.7 `utils.ts` (~5 tests)

- [ ] `cn(...)` (class merger) correctly merges Tailwind class strings
- [ ] `cn` handles falsy values (undefined, null, false) without including them
- [ ] `cn` resolves Tailwind conflicts (later class wins: `cn("p-4", "p-2")` → `"p-2"`)
- [ ] Empty call `cn()` returns `""`
- [ ] `cn` with arrays and objects works correctly

---

### 1.8 `helpContent.ts` (~7 tests)

- [ ] Every help entry has a non-empty `title` and `description`
- [ ] Every help entry that references a keyboard shortcut has a valid shortcut string
- [ ] No duplicate `data-help` keys exist in the content map
- [ ] `getHelpEntry(key)` returns the correct entry for a known key
- [ ] `getHelpEntry("nonexistent")` returns null/undefined (not a crash)
- [ ] Help entries are grouped correctly by category
- [ ] At least 10 help entries exist (guard against accidental deletions)

---

### 1.9 Property-based tests — timeline math invariants (~12 tests)

> Uses **fast-check** to generate arbitrary valid inputs and assert mathematical laws.
> These catch edge cases that hand-picked examples never think to try.

**`splitClip` invariants** (for any valid playhead in `(startTime, startTime + duration)`)
- [ ] `left.duration + right.duration === original.duration` (no time is gained or lost)
- [ ] `left.startTime === original.startTime`
- [ ] `right.startTime === original.startTime + left.duration`
- [ ] Both resulting clips have `duration > 0`

**`rippleDelete` ordering invariant** (for any timeline with N clips on the same track)
- [ ] After ripple delete, all surviving clips on the same track remain sorted by `startTime`
- [ ] No surviving clip on the same track has a `startTime` that is negative

**`moveClip` clamping invariant**
- [ ] For any arbitrary negative input, `clip.startTime >= 0` after the move

**`trimClip` invariant**
- [ ] For any trim patch, `clip.duration >= 0.033` (minimum one frame) after the trim

**`addClip` / `removeClip` count invariant**
- [ ] For any sequence of N `addClip` calls followed by N `removeClip` calls with valid IDs, `clips.length` returns to its original value

**`undo` / `redo` round-trip invariant**
- [ ] For any sequence of actions, `undo()` then `redo()` returns to the same clips snapshot (deep equality)
- [ ] `past.length` never exceeds 50 regardless of how many actions are performed (bounded by property test with 100 actions)

**`pasteClips` ID uniqueness invariant**
- [ ] After any number of consecutive pastes, all clip IDs in the store remain unique (no duplicates)

---

## Phase 2 — Unit: Zustand Store Actions (~90 tests) ✅ IMPLEMENTED

> Construct store instances directly. Assert state transitions synchronously.
> No DOM, no IPC, no React.
> **Files:** `src/tests/stores/simple-stores.test.ts` (35 tests) · `src/tests/stores/timeline-store.test.ts` (77 tests) · `src/tests/stores/media-project-stores.test.ts` (33 tests) · 145 store tests, 169 total passing.

### 2.1 `timelineStore` — clip lifecycle (~25 tests)

- [ ] Initial state: 5 default tracks, no clips, playhead at 0
- [ ] `addClip(clip)` → clip appears in `clips`
- [ ] `addClip` pushes one entry to `past` (undo history)
- [ ] `addClips([a, b])` → both clips added in one history entry (single undo reverts both)
- [ ] `removeClip(id)` → clip removed; missing id is a no-op (no crash)
- [ ] `removeSelectedClips()` → all clips in `selectedClipIds` are removed
- [ ] `moveClip(id, time)` → `startTime` updated; negative time clamped to 0
- [ ] `moveClipOnly(id, time)` → updates position without pushing to history
- [ ] `moveClips([{id, newStart}])` → all clips moved in one history entry
- [ ] `trimClip(id, patch)` → updates `trimStart` and `duration` correctly
- [ ] `trimClip` prevents `duration` from going negative (minimum 0.033s = one frame)
- [ ] `trimClipOnly(id, patch)` → updates without history entry
- [ ] `trimToPlayhead(id, "start")` → trims clip start to current playhead
- [ ] `trimToPlayhead(id, "end")` → trims clip end to current playhead
- [ ] `trimToPlayhead` is a no-op if playhead is outside the clip
- [ ] `unlinkClip(id)` → sets `linkedClipId` to null on the target clip

### 2.2 `timelineStore` — split (~8 tests)

- [ ] `splitClip(id)` at the middle → produces two clips; combined duration equals the original
- [ ] `splitClip` new clip 1 ends exactly at playhead; new clip 2 starts exactly at playhead
- [ ] `splitClip` preserves `trackId`, `mediaClipId`, `volume`, `speed`, `colorSettings`, `cropSettings`
- [ ] `splitClip` at `startTime` exactly → no-op (avoids zero-duration first clip)
- [ ] `splitClip` at `startTime + duration` exactly → no-op (avoids zero-duration second clip)
- [ ] `splitClip` on a text clip creates two text clips, each with a copy of `textSettings`
- [ ] `splitClip` on a color clip creates two color clips
- [ ] `splitClip` of a non-existent id → no-op

### 2.3 `timelineStore` — ripple delete (~8 tests)

- [ ] `rippleDelete(id)` → target clip removed
- [ ] All clips on the same track with `startTime > target.startTime` shift left by `target.duration`
- [ ] Clips on OTHER tracks are NOT moved
- [ ] `rippleDelete` of a non-existent id → no-op
- [ ] `rippleDeleteSelected()` → all selected clips ripple-deleted in one undo step
- [ ] After ripple delete, no clip has a negative `startTime`
- [ ] Ripple delete on a clip at time 0 shifts no clips (nothing is to the right at a negative position)
- [ ] Ripple delete pushes exactly one history entry (multi-clip ripple is one undo)

### 2.4 `timelineStore` — copy/paste (~6 tests)

- [ ] `copySelectedClips()` → `clipboard` is set to clones of selected clips
- [ ] `pasteClips()` → new clips with fresh IDs inserted at current `playheadTime`
- [ ] Pasting preserves all clip settings (trimStart, duration, volume, speed, textSettings)
- [ ] Pasting after moving the playhead inserts at the new position
- [ ] `pasteClips()` with empty clipboard → no-op
- [ ] Pasted clips are added to `selectedClipIds` (they become the new selection)

### 2.5 `timelineStore` — undo/redo (~12 tests)

- [ ] `undo()` restores the previous `clips` snapshot
- [ ] `undo()` on empty `past` → no-op (no crash)
- [ ] `undo()` moves the undone state to `future`
- [ ] `redo()` re-applies the undone state
- [ ] `redo()` on empty `future` → no-op
- [ ] Any new action after `undo()` clears `future` (cannot redo after branching)
- [ ] 51 consecutive actions → `past` is capped at 50 (oldest entry dropped)
- [ ] `undo()` after `splitClip` fully reverses the split (original clip restored, new clips gone)
- [ ] `undo()` after `rippleDelete` restores all shifted clips to their original positions
- [ ] `undo()` after `pasteClips` removes all pasted clips atomically
- [ ] `undo()` after `addClips([a,b])` removes both clips in one undo step
- [ ] `redo()` after a full undo chain correctly re-applies each step in order

### 2.6 `timelineStore` — selection (~6 tests)

- [ ] `selectClip(id)` → `selectedClipId === id` and `selectedClipIds === [id]`
- [ ] `selectClip(null)` → `selectedClipId === null` and `selectedClipIds === []`
- [ ] `toggleClipInSelection(id)` adds when not present
- [ ] `toggleClipInSelection(id)` removes when already present
- [ ] Selecting a new clip via `selectClip` clears multi-selection
- [ ] `removeSelectedClips` clears `selectedClipIds` after deletion

### 2.7 `timelineStore` — playback & navigation (~8 tests)

- [ ] `setPlayheadTime(t)` clamps to `>= 0` (no negative times)
- [ ] `setIsPlaying(true)` → `isPlaying === true`
- [ ] `setShuttleSpeed(2)` → `shuttleSpeed === 2`
- [ ] Valid shuttle speeds: `-4, -2, -1, 0, 1, 2, 4`; invalid value is rejected or clamped
- [ ] `setMasterVolume(v)` clamps to `[0, 2]` (0–200%)
- [ ] `loopIn` / `loopOut` can be independently set to null or a positive number
- [ ] `toggleLoop()` flips `loopEnabled`
- [ ] `closeGap(trackId, gapStart)` shifts all clips after `gapStart` on that track left

### 2.8 `timelineStore` — miscellaneous actions (~7 tests)

- [ ] `setTextSettings(clipId, patch)` merges patch into existing `textSettings`
- [ ] `setClipVolume(clipId, v)` sets volume; clamped to `[0, 2]`
- [ ] `setClipSpeed(clipId, s)` sets speed; minimum `0.1`
- [ ] `setClipColorSettings(clipId, patch)` merges into `colorSettings`
- [ ] `setClipCropSettings(clipId, patch)` merges into `cropSettings`
- [ ] `setSnapEnabled(true/false)` updates store correctly
- [ ] `addMarker` / `removeMarker` / `updateMarker` CRUD works and pushes to undo history

### 2.9 `mediaStore` (~10 tests)

- [ ] `addClip(mediaClip)` → clip in `clips` array
- [ ] `addClip` is a no-op for a duplicate `id`
- [ ] `removeClip(id)` → clip removed; missing id is a no-op
- [ ] `updateClip(id, patch)` → merges patch into existing clip
- [ ] `updateClip` on non-existent id → no-op
- [ ] `setMissingStatus(id, true)` marks `isMissing` without altering other fields
- [ ] `relinkClip(id, newPath)` updates `path` and clears `isMissing`
- [ ] `clips` persists across store re-creation (Zustand persist wired correctly)
- [ ] `checkMissingFiles()` does not mutate clips when all paths exist (mocked fs)
- [ ] `checkMissingFiles()` marks clips as missing when file does not exist (mocked fs)

---

### 2.10 `musicStore` (~8 tests)

- [ ] Initial state: `tracks === []`, `searchQuery === ""`
- [ ] `addTracks([a, b])` → both tracks added to `tracks`
- [ ] `addTracks` skips duplicate `filePath` entries (idempotent import)
- [ ] `addTracks` with an entirely duplicate batch → no new entries added
- [ ] `removeTrack(id)` → track removed; missing id is a no-op
- [ ] `updateTrack(id, { title: "New" })` → title updated; other fields unchanged
- [ ] `setSearchQuery("chill")` → `searchQuery === "chill"`
- [ ] `tracks` persists across store re-creation (Zustand persist keyed `klip-music-library`)

---

### 2.11 `commandPaletteStore` (~4 tests)

- [ ] Initial state: `isOpen === false`
- [ ] `open()` → `isOpen === true`
- [ ] `close()` → `isOpen === false`
- [ ] `toggle()` alternates `isOpen` on successive calls

---

### 2.12 `sourceViewerStore` (~8 tests)

- [ ] Initial state: `isOpen === false`, `clip === null`, `inPoints === {}`, `outPoints === {}`
- [ ] `openClip(clip)` → `isOpen === true`, `clip === clip`
- [ ] `closeViewer()` → `isOpen === false`, `clip === null`
- [ ] `setInPoint("abc", 3.5)` → `inPoints["abc"] === 3.5`
- [ ] `setOutPoint("abc", 7.0)` → `outPoints["abc"] === 7.0`
- [ ] In/out points for clip A are not overwritten when setting points for clip B
- [ ] `openClip` for a second clip does not clear existing `inPoints`/`outPoints` for the first
- [ ] `closeViewer` does not clear `inPoints`/`outPoints` (session memory preserved for re-open)

---

### 2.13 `appStore` (~3 tests)

- [ ] Initial state: `view === "welcome"`
- [ ] `setView("editor")` → `view === "editor"`
- [ ] `setView("welcome")` → `view === "welcome"`

---

### 2.14 `uiStore` (~6 tests)

- [ ] Initial state: all booleans `false`
- [ ] `setShowExport(true)` → `showExport === true`
- [ ] `setShowSettings(true)` → `showSettings === true`
- [ ] `setShowProjectSettings(true)` → `showProjectSettings === true`
- [ ] `setWhatsThisMode(true)` → `whatsThisMode === true`
- [ ] Each setter is independent — toggling one does not affect others

---

## Phase 3 — Component Tests (~110 tests) ✅ IMPLEMENTED (§3.1–3.23, 128 component + 99 hooks = 227 tests)

> React Testing Library. Mock `window.api` (IPC bridge). Test behavior, not implementation.

### 3.1 `TutorialOverlay` (~18 tests)

*Two real crashes already lived here — be thorough.*

- [ ] Renders null when `hasSeenWalkthrough: true`
- [ ] Renders step 1 card on first mount (`hasSeenWalkthrough: false`)
- [ ] Step counter shows `"1 / 7"` on first step
- [ ] Step counter shows `"7 / 7"` on last step
- [ ] "Back" button hidden on step 1
- [ ] "Back" button visible from step 2 onwards
- [ ] "Next" button text is `"Next"` on steps 1–6 and `"Done"` on step 7
- [ ] Clicking "Next" advances the step counter
- [ ] Clicking "Back" decrements the step counter
- [ ] Clicking "Skip all" unmounts the overlay (`active` → false)
- [ ] Clicking "Done" on step 7 unmounts the overlay
- [ ] Clicking "Done" calls `setHasSeenWalkthrough(true)`
- [ ] **REG-003**: Clicking "Next" 20 times in rapid succession never throws `TypeError` or causes `step === undefined`
- [ ] **REG-003**: After 20 rapid "Next" clicks, `stepIndex` is capped at 6 (last valid index)
- [ ] Close (X) button dismisses the overlay from any step
- [ ] Overlay re-activates when `hasSeenWalkthrough` changes from true → false (restart tutorial)
- [ ] Step dot indicator: active dot is wider; past dots have partial opacity
- [ ] Centered dialog layout used for steps with `target: null`

### 3.2 `Sidebar` / `SidebarTab` (~10 tests)

- [ ] **REG-002**: Media tab button has `data-help="import-drag-drop"` attribute rendered
- [ ] **REG-002**: Music tab button has `data-help="music-library"` attribute rendered
- [ ] Media tab button has `data-tutorial="import-btn"` ... wait, check actual value (`import-drag-drop` is the help key; the tutorial target for import is `import-btn` on `TopToolbar` — verify actual data-tutorial on each tab)
- [ ] Clicking "Music" tab shows `MusicLibrary` content
- [ ] Clicking "Media" tab shows `MediaBin` content
- [ ] Active tab has the accent underline class
- [ ] Inactive tab does not have the accent underline class
- [ ] Tab content cross-fades (`AnimatePresence` key changes on tab switch)
- [ ] Both tabs are accessible via keyboard (focus + Enter)
- [ ] Tab strip does not overflow its container with long labels

### 3.3 `ErrorBoundary` (~8 tests)

- [ ] Renders children normally when no error is thrown
- [ ] Catches a synchronous render error thrown inside a child component
- [ ] Shows the "Something went wrong" heading when an error is caught
- [ ] Shows the error message text in the details box
- [ ] "Reload Klip" button triggers `window.location.reload`
- [ ] "Copy" button writes the error text to clipboard
- [ ] "Copy" button shows "Copied!" feedback for 2 seconds then reverts
- [ ] `componentDidCatch` logs to `console.error` (verifiable via spy)

### 3.4 `WelcomeScreen` (~12 tests)

- [ ] Logo renders as an `<img>` tag (not the old SVG — **REG-006**)
- [ ] "New Project" button is visible
- [ ] "Open Project" button is visible
- [ ] Clicking "New Project" calls `newProject` and navigates to editor
- [ ] Clicking "Open Project" calls `window.api.project.openDialog`
- [ ] Empty recent projects shows the placeholder state (no recent projects message)
- [ ] Recent projects list renders one row per entry
- [ ] Recent row shows project name and relative timestamp
- [ ] Clicking a recent row calls `openProject` with the correct `path`
- [ ] Recent rows stagger-animate in (`initial={{ opacity: 0, x: -8 }}`)
- [ ] Layout is centered vertically and horizontally
- [ ] Radial glow background is present (decorative div exists in DOM)

### 3.5 `PreviewPanel` — critical paths (~16 tests)

- [ ] Renders without crash when `videoClips` is empty (new project)
- [ ] **REG-001**: `handleSaveFrame` is defined after `activeMediaClip` in component order (no TDZ crash on mount)
- [ ] **REG-001**: Right-clicking the preview canvas when no clip is active does not crash
- [ ] Play button calls `setIsPlaying(true)`
- [ ] Pause button calls `setIsPlaying(false)`
- [ ] Volume slider input changes `masterVolume` in store
- [ ] Volume icon click toggles mute (0 ↔ previous value)
- [ ] Speed selector button opens the speed menu
- [ ] Selecting a speed from the menu updates `previewSpeed`
- [ ] Loop toggle button calls `toggleLoop`
- [ ] Playhead time is displayed as formatted timecode
- [ ] Total duration is displayed correctly
- [ ] Controls auto-hide class is applied after mouse-out timeout
- [ ] Controls are visible on mouse-enter
- [ ] Scrub bar click fires `setPlayheadTime` with the correct fraction × total duration
- [ ] Audio level meter bars are rendered (DOM elements exist even at level 0)

### 3.6 `TitleBar` (~8 tests)

- [ ] Logo renders as an `<img>` tag (not old SVG — **REG-006**)
- [ ] Minimize button calls `window.api.window.minimize()`
- [ ] Maximize button calls `window.api.window.maximize()`
- [ ] Close button calls `window.api.window.close()`
- [ ] Project name is shown when `projectStore.projectName` is set
- [ ] Unsaved changes dot (●) is shown when `hasUnsavedChanges: true`
- [ ] Unsaved changes dot is NOT shown when `hasUnsavedChanges: false`
- [ ] Restore icon (two-window SVG) is shown when `isMaximized: true`; square icon otherwise

### 3.7 `TimelineClipView` (~14 tests)

- [ ] Renders at correct `left` position: `startTime * pxPerSec` pixels from track origin
- [ ] Renders at correct `width`: `duration * pxPerSec` pixels
- [ ] Selected clip has accent border class applied
- [ ] Unselected clip does not have accent border class
- [ ] Clip name label is visible when clip is wide enough
- [ ] Duration label is visible when clip is wide enough
- [ ] Volume badge shown when volume is not 100%
- [ ] Volume badge NOT shown when volume is 100%
- [ ] Thumbnail strip renders when `thumbnail` is provided
- [ ] Chain-link badge shown when `linkedClipId` is not null
- [ ] Speed badge shown when `speed !== 1`
- [ ] INTRO badge shown when role is `"intro"`
- [ ] OUTRO badge shown when role is `"outro"`
- [ ] Right-click fires the context menu open handler

### 3.8 `TrackRow` (~10 tests)

- [ ] Track header shows correct track name
- [ ] Locked track shows padlock icon and `isLocked: true` dimming
- [ ] Muted track shows mute icon in active state
- [ ] Solo track shows solo icon in active state
- [ ] Clicking lock toggles `isLocked` via store
- [ ] Clicking mute toggles `isMuted` via store
- [ ] Clicking solo toggles `isSolo` via store
- [ ] Drop zone accepts drag payloads of the correct media type
- [ ] Drop zone rejects media type mismatches (video onto audio track → no-op)
- [ ] Track row height matches `TRACK_HEIGHT[type]` (video=64, audio=56, music=56, overlay=44)

### 3.9 `ClipContextMenu` + `ClipCard` (~14 tests)

**`ClipContextMenu`:**
- [ ] "Rename" option fires inline rename on the clip card
- [ ] "Remove" option calls `mediaStore.removeClip` with the correct id
- [ ] "Reveal in Explorer" calls `window.api.shell.openPath`
- [ ] "Relink Media" option visible when `isMissing: true`
- [ ] "Relink Media" opens file picker and calls `relinkClip` with the new path
- [ ] "Generate Proxy" option calls proxy IPC handler
- [ ] Menu closes when clicking outside

**`ClipCard`:**
- [ ] Thumbnail image renders when `thumbnail` is not null
- [ ] Skeleton shimmer renders while `isLoading: true`
- [ ] Missing file badge visible when `isMissing: true`
- [ ] Proxy-ready `P` badge visible when `proxyReady: true`
- [ ] Proxy progress bar visible during proxy generation
- [ ] On-timeline checkmark visible when clip is used on the timeline
- [ ] Mismatch warning icon visible when clip resolution ≠ project resolution

---

### 3.10 `TopToolbar` (~8 tests)

- [ ] "T" (text clip) button renders without crash
- [ ] Clicking "T" calls `addClip` with a text-type clip at the current playhead
- [ ] Snap toggle button reflects `snapEnabled` store state (icon active when on)
- [ ] Clicking snap toggle calls `setSnapEnabled` with the inverted value
- [ ] Undo button is disabled (visual class) when `past` is empty
- [ ] Redo button is disabled when `future` is empty
- [ ] Export button calls `setShowExport(true)` on click
- [ ] "What's this?" toggle button sets `whatsThisMode(true)` on click; pressing Esc clears it

---

### 3.11 `CommandPalette` (~8 tests)

- [ ] Not rendered when `commandPaletteStore.isOpen === false`
- [ ] Renders the search input when `isOpen === true`
- [ ] Typing in the input filters the command list in real time
- [ ] Pressing `Escape` calls `close()`
- [ ] Pressing `Enter` on a highlighted command executes its action
- [ ] Arrow keys move the highlight up/down through the command list
- [ ] "Export" command in the list calls `setShowExport(true)` and closes the palette
- [ ] "Settings" command calls `setShowSettings(true)` and closes the palette

---

### 3.12 `ExportDialog` (~10 tests)

- [ ] Renders when `showExport === true`
- [ ] Does not render when `showExport === false`
- [ ] Preset selector shows all 5 export presets
- [ ] Selecting a preset updates resolution/fps display
- [ ] "Browse" button calls `window.api.project.saveDialog` (or equivalent file save IPC)
- [ ] "Export" button is disabled when no output path is set
- [ ] "Export" button calls `window.api.export.start` with the correct job payload
- [ ] Progress bar and ETA are shown during export (`isExporting === true`)
- [ ] "Cancel" button calls `window.api.export.cancel`
- [ ] Export completion hides the progress bar and shows "Open in Explorer" button

---

### 3.13 `SourceClipViewer` (~12 tests)

- [ ] Not rendered when `sourceViewerStore.isOpen === false`
- [ ] Renders the clip name when `isOpen === true`
- [ ] Play/Pause button toggles playback
- [ ] `I` key calls `setInPoint` with the current playhead time
- [ ] `O` key calls `setOutPoint` with the current playhead time
- [ ] In-point and out-point timecodes display correctly when set
- [ ] "Add to Timeline" button is disabled when no in/out range is set
- [ ] "Add to Timeline" button calls `addClip` with trimStart and duration derived from in/out
- [ ] Selection duration label shows correct `outPoint - inPoint` value
- [ ] Scrub bar click updates the preview position
- [ ] Close button calls `closeViewer()`
- [ ] Reopening the same clip restores the previous in/out points from the store

---

### 3.14 `WhatThisOverlay` (`HelpPanel`) (~8 tests)

- [ ] Not rendered when `whatsThisMode === false`
- [ ] Rendered when `whatsThisMode === true`
- [ ] Hovering an element with a matching `data-help` attribute shows the tooltip
- [ ] Tooltip contains the title and description from `helpContent.ts`
- [ ] Tooltip shows keyboard shortcut badge when the entry has a shortcut
- [ ] Moving the mouse to a different annotated element switches the tooltip content
- [ ] Moving the mouse to a non-annotated element hides the tooltip
- [ ] Pressing `Esc` calls `setWhatsThisMode(false)` and unmounts the overlay

---

### 3.15 `TimelineRuler` (~6 tests)

- [ ] Renders tick marks at the correct pixel intervals for current `pxPerSec`
- [ ] Timecode labels formatted as `"0:00"` in seconds mode
- [ ] Timecode labels formatted as `"00:00:00:00"` in HH:MM:SS:FF mode
- [ ] Ruler updates tick density on `pxPerSec` change (no stale layout)
- [ ] The ruler width fills the full scrollable timeline width
- [ ] A click on the ruler calls `setPlayheadTime` with the correct time offset

---

### 3.16 `WaveformCanvas` (~6 tests)

- [ ] Renders a `<canvas>` element
- [ ] Canvas is blank (or shows a loading placeholder) while `peaks === null`
- [ ] When `peaks` is provided, canvas is painted (non-zero imageData)
- [ ] Canvas repaints when `peaks` changes (new file loaded)
- [ ] Canvas dimensions match the clip width × track height at current zoom
- [ ] Color of bars matches the track accent color passed via props

---

### 3.17 `SettingsDialog` + `ProjectSettingsModal` (~10 tests)

**`SettingsDialog`:**
- [ ] Renders when `showSettings === true`
- [ ] Close button calls `setShowSettings(false)`
- [ ] "App" tab renders; "Shortcuts" tab renders; "Help" tab renders
- [ ] Switching tabs shows the correct content panel
- [ ] "Restart Tutorial" button calls `setHasSeenWalkthrough(false)` and closes the dialog
- [ ] FFmpeg path field displays the current custom path (or placeholder if none)

**`ProjectSettingsModal`:**
- [ ] Renders when `showProjectSettings === true`
- [ ] Resolution selector shows 1080p / 1440p / 4K options
- [ ] Frame rate selector shows 30 / 60 fps options
- [ ] Changing resolution and confirming updates `projectStore.resolution`

---

### 3.18 `ColorClipDialog` (~6 tests)

- [ ] Dialog opens when the "Color Clip" action is triggered
- [ ] Color swatches render preset colors
- [ ] Clicking a preset swatch selects it (visual selection state)
- [ ] Custom color picker changes the selected color
- [ ] Duration input defaults to 5 seconds
- [ ] Confirming calls `addClip` with a color clip and the selected color + duration

---

### 3.19 `MusicLibrary` (~10 tests)

- [ ] Renders the track list from `musicStore.tracks`
- [ ] Shows empty state when `tracks === []`
- [ ] Import button calls the file picker IPC
- [ ] After import, new tracks appear in the list
- [ ] Search input filters the list to matching title/artist in real time
- [ ] Clearing the search shows the full list again
- [ ] Clicking a track row starts preview playback; clicking again stops it
- [ ] Right-click → "Add to Timeline" calls `addClip` on the music track
- [ ] Right-click → "Remove" calls `musicStore.removeTrack`
- [ ] Tags on a track display as pill badges

---

### 3.20 `Toaster` (~6 tests)

- [ ] No toast elements rendered when `toastStore` is empty
- [ ] Calling `toastStore.toast("Hello")` renders a toast with that message
- [ ] Toast auto-removes after its `duration` elapses
- [ ] Two consecutive toasts both render simultaneously (not one at a time)
- [ ] Toast has a progress bar that depletes over `duration` ms
- [ ] Clicking the X on a toast dismisses it immediately

---

### 3.21 `useProjectIO` hook (~8 tests) ✅ IMPLEMENTED

> Mount via a minimal wrapper component. Mock `window.api` and Zustand stores.
> **File:** `src/tests/hooks/hooks.test.tsx`

- [x] Hook is stable — mounting does not immediately mark the project dirty
- [x] A timeline change after 500ms (after the liveness guard) sets `hasUnsavedChanges === true`
- [x] A timeline change within the first 500ms does NOT set `hasUnsavedChanges`
- [x] `Ctrl+S` keydown calls `saveProject`
- [x] `Ctrl+S` calls `saveProject` regardless of whether a project path is set (path handled internally by saveProject)
- [x] `Ctrl+Shift+S` always calls `saveProjectAs` regardless of existing path
- [x] Auto-save fires `window.api.project.autosave` when `hasUnsavedChanges === true` after `AUTOSAVE_INTERVAL_MS`
- [x] Auto-save does NOT fire when `hasUnsavedChanges === false`

---

### 3.22 `useWaveform` hook (~6 tests) ✅ IMPLEMENTED

> Test in jsdom; mock `window.api.waveform.extract` (video path).
> **File:** `src/tests/hooks/hooks.test.tsx`

- [x] Returns `{ peaks: null, loading: false }` when `filePath` is null/undefined
- [x] Returns `{ peaks: null, loading: true }` on initial mount before data loads
- [x] Returns `{ peaks: Float32Array, loading: false }` after a successful fetch
- [x] Second mount for the same `filePath` returns cached peaks immediately (no re-fetch)
- [x] Returns `{ peaks: null, loading: false }` when extract returns null (failure)
- [x] Changing `filePath` resets `loading` to `true` and triggers a new fetch

---

### 3.23 `useProxyEvents` hook (~4 tests) ✅ IMPLEMENTED

> Test by triggering the mocked `window.api` event emitter.
> **File:** `src/tests/hooks/hooks.test.tsx`

- [x] Subscribes to `proxy:progress`, `proxy:done`, and `proxy:error` events on mount
- [x] Receiving a `proxy:progress` event updates clip `proxyStatus` and `proxyProgress` in mediaStore
- [x] Receiving a `proxy:done` event sets `proxyStatus: 'ready'` and records `proxyPath` on the correct clip
- [x] Unsubscribes from all three proxy events on unmount (cleanup called)

---

### 3.24 `AppLayout` + `ResizeHandle` (~8 tests)

*The outermost editor shell — no coverage exists today.*

**`AppLayout`:**
- [ ] Renders the sidebar, preview panel, and timeline panel without crash when timeline is empty
- [ ] **REG-005** (component-level recheck): initial timeline section height is `>= 304px`
- [ ] `setShowExport(true)` causes `ExportDialog` to appear in the DOM
- [ ] `setShowSettings(true)` causes `SettingsDialog` to appear in the DOM
- [ ] Missing-file check IPC is called on mount (verifies `window.api.media.checkFilesExist` was invoked)
- [ ] Proxy batch-check IPC is called on mount when media clips exist

**`ResizeHandle`:**
- [ ] Dragging the horizontal resize handle updates the timeline panel height
- [ ] Dragging the vertical resize handle updates the sidebar width
- [ ] Panel sizes are clamped — timeline height never drops below the minimum (304px)

---

## Phase 4 — Integration: Store ↔ Store (~45 tests)

> Test that multiple stores interact correctly. No DOM required.

### 4.1 Media → Timeline linking (~12 tests)

- [ ] Dropping a video media clip onto the timeline creates a `TimelineClip` with matching `mediaClipId`
- [ ] Dropping a video clip auto-creates a linked audio clip on `a1` track
- [ ] Linked audio clip has the same `duration` as the video clip
- [ ] Linked audio clip has a `linkedClipId` pointing to the video clip
- [ ] Removing the media clip via `mediaStore.removeClip` also removes all linked timeline clips
- [ ] `checkMissingFiles` marks all timeline clips using that media as having an offline source
- [ ] `relinkClip` updates the path for all timeline clips that reference the old id
- [ ] Dropping an audio-only file creates a clip only on the `a1` track (no video clip)
- [ ] Dropping an image file creates a clip only on the video track (duration 5s default)
- [ ] Dropping a music file creates a clip only on the `m1` track
- [ ] Dropping a color clip creates a video track clip with no linked audio
- [ ] Media bin "already on timeline" checkmark is driven by `timelineStore.clips` having a matching `mediaClipId`

### 4.2 Project save/load cycle (~12 tests)

- [ ] `projectStore.newProject("Name")` resets both `timelineStore` and `mediaStore` to defaults
- [ ] After `newProject`, `projectStore.projectName === "Name"`
- [ ] After `newProject`, `hasUnsavedChanges === false`
- [ ] Any edit after load sets `hasUnsavedChanges === true`
- [ ] `saveProject()` writes a file containing all `timelineStore` and `mediaStore` state
- [ ] `openProject(path)` restores `timelineStore.clips` identically
- [ ] `openProject` restores `timelineStore.tracks` and their lock/mute/solo states
- [ ] `openProject` restores `mediaStore.clips` including thumbnails (or re-generates missing ones)
- [ ] `openProject` restores `transitions` array
- [ ] `openProject` restores `markers` array
- [ ] Opening a project from a newer version (unknown fields) succeeds without crash
- [ ] Opening a project from a missing file path shows an error toast, does not crash

### 4.3 Undo across stores (~8 tests)

- [ ] `undo()` after multi-clip paste reverts all pasted clips atomically
- [ ] `undo()` after trimming a clip + moving a clip (two actions) reverts both independently
- [ ] `undo()` in `mediaStore` does not interfere with `timelineStore` undo stack
- [ ] Undo history is bounded at 50 entries; 51st action drops the oldest
- [ ] `redo()` works correctly after a sequence of undo steps
- [ ] Branching (new action after undo) clears the redo stack
- [ ] Opening a new project resets both `past` and `future` to empty
- [ ] Undo does not restore changes from a previous project session

### 4.4 UI store + feature interactions (~8 tests)

- [ ] `setShowExport(true)` → export dialog rendered in `AppLayout`
- [ ] `setShowSettings(true)` → settings dialog rendered
- [ ] `setShowProjectSettings(true)` → project settings modal rendered
- [ ] `setWhatsThisMode(true)` activates "What's this?" hover tooltips globally
- [ ] `whatsThisMode` indicator is shown in the toolbar when active
- [ ] `toastStore.toast(message)` adds a toast entry
- [ ] Toast entry auto-removes after `duration` ms
- [ ] Showing a toast while another is visible does not crash the toast stack

### 4.5 `appSettingsStore` + `TutorialOverlay` interaction (~5 tests)

- [ ] `hasSeenWalkthrough: true` → overlay not mounted
- [ ] Setting `hasSeenWalkthrough` to `false` (simulate "Restart Tutorial") activates overlay
- [ ] `setHasSeenWalkthrough(true)` persists across store re-creation (Zustand persist)
- [ ] Tutorial restarting resets `stepIndex` to 0
- [ ] Tutorial restarting does not crash if called while tutorial is mid-way through

---

## Phase 5 — Integration: IPC / Main Process (~60 tests)

> Test main-process handlers in isolation. Use a real temp directory on disk.
> Electron's `BrowserWindow` is not needed — IPC handlers are plain async functions.

### 5.1 `mediaHandlers` (~18 tests)

- [ ] `media:probe` returns `{ duration, width, height }` for a known `.mp4` fixture
- [ ] `media:probe` returns `width: 0, height: 0` for an audio-only file
- [ ] `media:probe` rejects with an Error for a non-existent path
- [ ] `media:probe` rejects with a timeout error after 30 seconds on a hang (mocked timeout)
- [ ] `media:getType` classifies `.mp4` as `"video"`, `.mp3` as `"audio"`, `.png` as `"image"`
- [ ] `media:open-dialog` calls `dialog.showOpenDialog` with the correct filters
- [ ] `media:reveal-in-explorer` calls `shell.showItemInFolder`
- [ ] Importing a duplicate path via IPC does not add a second `MediaClip` to the store
- [ ] Importing a file larger than 8 GB does not crash (large file metadata read)
- [ ] Importing an image returns `duration: 5` (default still-image duration)
- [ ] File path with special characters (spaces, Unicode) is handled without error
- [ ] `media:probe` on a zero-byte file returns a descriptive error, not a crash
- [ ] `media:get-file-info` returns `{ size }` in bytes for a known file
- [ ] `media:get-file-info` rejects for a non-existent path
- [ ] `media:check-files-exist` returns `{ path: true }` for existing paths and `{ path: false }` for missing ones
- [ ] `media:pick-file` calls `dialog.showOpenDialog` with filters scoped to the requested type (`"video"`, `"audio"`, or `"image"`)
- [ ] `media:extract-frame` produces a PNG file at the requested time position for a known video fixture
- [ ] `media:extract-frame` returns `null` gracefully when FFmpeg cannot decode the file

### 5.2 `projectHandlers` (~15 tests)

- [ ] `project:save` writes a valid JSON file to the specified path
- [ ] `project:save` creates parent directories if they don't exist
- [ ] `project:save` overwrites an existing file
- [ ] `project:open` reads and parses the previously saved file
- [ ] `project:open` rejects for a missing path
- [ ] `project:open` rejects for a corrupted (non-JSON) file
- [ ] `project:openDialog` calls `dialog.showOpenDialog` with `.klip` filter
- [ ] `project:getRecent` returns an array sorted by most-recently-accessed first
- [ ] `project:getRecent` returns `[]` when no recents file exists
- [ ] `project:addRecent(path, name)` prepends to the list and caps at 5 entries
- [ ] `project:checkAutosave` returns `true` when autosave file exists
- [ ] `project:checkAutosave` returns `false` when autosave file is absent
- [ ] `project:clearAutosave` deletes the autosave file; subsequent `checkAutosave` returns `false`
- [ ] `project:saveAutosave` writes to the autosave path without overwriting the main project file
- [ ] Autosave path is in `app.getPath("userData")` (not next to the project file)

### 5.3 `exportHandlers` (~19 tests)

- [ ] Export handler spawns an FFmpeg child process with the correct arguments
- [ ] Progress events (`export:progress`) fire with increasing percentage 0–100
- [ ] Output file exists on disk after export completes
- [ ] Export resolves with the output file path
- [ ] Export rejects cleanly when FFmpeg exits with code 1 (codec error)
- [ ] Export rejects cleanly when FFmpeg binary is not found
- [ ] Cancelling via `export:cancel` IPC kills the FFmpeg process
- [ ] After cancellation, the partial output file is deleted
- [ ] A second `export:start` while one is running returns a "busy" error, not a second spawn
- [ ] A timeline with only audio (no video track clips) exports audio-only correctly
- [ ] A timeline with only image clips produces a valid slideshow video
- [ ] Exporting a text overlay includes the `drawtext` FFmpeg filter in the command
- [ ] Exporting a transition includes the `fade` FFmpeg filter
- [ ] Exporting speed-ramped clips includes the `setpts` filter
- [ ] `export:quick-preview` spawns FFmpeg with 720p + veryfast + CRF 28 (draft quality flags)
- [ ] `export:quick-preview-progress` events fire during the quick render
- [ ] `export:quick-preview-done` emits the temp file path when complete
- [ ] `export:cancel-quick-preview` kills the quick-preview FFmpeg process without affecting a running full export
- [ ] `export:save-frame` writes a PNG/JPEG data URL to the chosen path via a save dialog; returns the saved path

### 5.4 `waveformHandlers` (~10 tests)

- [ ] Returns a `Float32Array` (or serialized equivalent) of peak data for a known audio file
- [ ] Returns data with the expected sample count for the requested resolution
- [ ] Returns an empty/null result for a file with no audio stream
- [ ] Writes the waveform cache to `userData/klip-waveforms/` on first generation
- [ ] Subsequent requests return cached data (no re-processing)
- [ ] Cache key is tied to the file path (different path → different cache entry)
- [ ] Deleting the cache file triggers re-generation on next request
- [ ] Corrupt cache file is detected; fallback to re-generation (no crash)
- [ ] `media:analyze-loudness` returns `{ inputI }` (integrated LUFS) for a known audio fixture
- [ ] `media:analyze-loudness` returns `null` gracefully for a file with no audio stream (no crash)

### 5.5 `windowHandlers` (~6 tests)

- [ ] `window:minimize` calls `mainWindow.minimize()`
- [ ] `window:maximize` calls `mainWindow.maximize()` when not maximized
- [ ] `window:maximize` calls `mainWindow.unmaximize()` when already maximized
- [ ] `window:close` calls `mainWindow.close()`
- [ ] `window:isMaximized` returns `true` when maximized, `false` otherwise
- [ ] `window:maximized-changed` event is pushed to renderer when maximize state changes

### 5.6 `proxyHandlers` (~8 tests)

- [ ] Proxy generation produces a `.mp4` file in `userData/klip-proxies/`
- [ ] Proxy file is at 480p regardless of source resolution
- [ ] Progress events (`media:proxy-progress`) fire during generation with `{ clipId, progress }` shape
- [ ] `media:proxy-done` event fires with `{ clipId, proxyPath }` on completion
- [ ] `media:proxy-error` event fires with `{ clipId, error }` on FFmpeg failure
- [ ] `media:cancel-proxy` stops only the targeted clip's FFmpeg process (other proxies keep running)
- [ ] `media:check-proxy` returns the proxy file path when it exists, or `null` when absent
- [ ] `media:check-proxies-batch` returns a `Record<clipId, path | null>` for each requested id

---

### 5.7 `settingsHandlers` (~8 tests)

- [ ] `settings:proxy-cache-info` returns `{ count: 0, totalBytes: 0 }` when proxy directory does not exist
- [ ] `settings:proxy-cache-info` returns correct `count` and `totalBytes` for a temp dir containing 3 proxy `.mp4` files
- [ ] `settings:clear-proxy-cache` deletes all `.mp4` files in the proxy directory and returns the deleted count
- [ ] `settings:clear-proxy-cache` is a no-op (returns `0`) when the directory does not exist
- [ ] `settings:get-ffmpeg-path` returns `null` when no custom path has been configured
- [ ] `settings:set-ffmpeg-path` writes the path to `klip-config.json`; subsequent `get` returns that value
- [ ] `settings:set-ffmpeg-path(null)` clears the path; `getCustomFfmpegPath()` returns `null`
- [ ] `settings:get-ffmpeg-path` returns `null` when the configured path no longer exists on disk

---

### 5.8 `localFileProtocol` (~8 tests)

> Call `registerLocalFileProtocol` in a test harness; make synthetic `Request` objects.

- [ ] Full GET for a known temp file returns `status: 200` and correct `Content-Type`
- [ ] Range request (`Range: bytes=0-1023`) returns `status: 206` and the exact byte slice
- [ ] `Content-Range` header in the 206 response matches the requested range
- [ ] Request for a non-existent path returns `status: 404`
- [ ] Windows-style path `/C:/Users/...` strips the leading `/` before calling `statSync`
- [ ] Unix/WSL path `//mnt/c/...` is resolved correctly (no double-slash in fs path)
- [ ] `Content-Type` for `.mp4` is `"video/mp4"`; for `.mp3` is `"audio/mpeg"`; for `.png` is `"image/png"`
- [ ] Unknown extension returns `"application/octet-stream"` Content-Type (no crash)

---

### 5.9 `ffmpegExport` — argument builder unit tests (~8 tests)

> Test the FFmpeg command construction logic in isolation (mock `spawn`, check `args`).

- [ ] A simple one-clip video-only export produces a valid FFmpeg command (`-i`, `-c:v libx264`, `-crf`, output path)
- [ ] A clip with `colorSettings` (brightness ≠ 0) includes the `eq=` filter in the filter graph
- [ ] A clip with `cropSettings.zoom > 1` includes the `scale` + `crop` filters
- [ ] A clip with non-zero `speed` includes the `setpts` and `atempo` filters
- [ ] A text overlay clip includes `drawtext=` in the filter graph with the correct font color (hex)
- [ ] A transition between two clips includes `fade` or `xfade` filter entries in the correct positions
- [ ] An audio-only export (no video track clips) omits `-c:v` and produces an `-acodec` command
- [ ] Output path with spaces is passed as a single quoted/escaped argument (no shell injection)

---

### 5.10 `windowState` (~5 tests)

> Call `loadWindowState` / `saveWindowState` against a temp `userData` directory.

- [ ] `loadWindowState()` returns the default `{ width: 1440, height: 900, isMaximized: false }` when no file exists
- [ ] `saveWindowState(state)` writes a valid JSON file; `loadWindowState()` returns the same state
- [ ] `loadWindowState()` merges saved values over defaults (missing fields use default values)
- [ ] A corrupted JSON file causes `loadWindowState()` to return defaults without throwing
- [ ] `saveWindowState` is non-throwing when the userData directory is read-only (graceful failure)

---

### 5.11 IPC surface / contract tests (~10 tests)

> Verify that every channel exposed in `preload/index.ts` has a registered handler in main,
> and that every main-process `ipcMain.handle` / `ipcMain.on` call is surfaced in the preload.
> Prevents the two processes silently drifting apart after a rename or deletion.

- [ ] Every channel name in `window.api.window.*` has a matching `ipcMain.handle` or `ipcMain.on` registration
- [ ] Every channel name in `window.api.media.*` has a matching handler
- [ ] Every channel name in `window.api.project.*` has a matching handler
- [ ] Every channel name in `window.api.export.*` (start, cancel, quick-preview, save-frame) has a matching handler
- [ ] Every channel name in `window.api.waveform.*` has a matching handler
- [ ] Every channel name in `window.api.settings.*` has a matching handler
- [ ] Every channel name in `window.api.proxy.*` has a matching handler
- [ ] No `ipcMain.handle` or `ipcMain.on` registration in main uses a channel name that is NOT present in the preload (no dead handlers)
- [ ] Preload event subscriptions (`onProgress`, `onDone`, `onError` for export and proxy) return a working unsubscribe function that calls `ipcRenderer.removeListener`
- [ ] Calling the returned unsubscribe function twice does not throw

---

## Phase 6 — Regression Tests (~15 tests) ✅ IMPLEMENTED

> One test per bug that has already shipped. These run as part of every CI pass.
> Label format: `REG-NNN`.
> **File:** `src/tests/regression/reg.test.tsx` — 11 tests, all passing.

| ID | Component | Bug description | Status |
|---|---|---|---|
| REG-001 | `PreviewPanel` | `activeMediaClip` TDZ crash — `handleSaveFrame` used `activeMediaClip` in its dep array before it was declared | ✅ |
| REG-002 | `SidebarTab` | `dataHelp is not defined` — prop destructured but not included in function signature | ✅ |
| REG-003a | `TutorialOverlay` | Stale closure: `stepIndex` read from stale dep caused `TUTORIAL_STEPS[7]` = `undefined` | ✅ |
| REG-003b | `TutorialOverlay` | No guard on `step` being `undefined` in `useLayoutEffect` | ✅ |
| REG-004 | `App` + `ErrorBoundary` | `TitleBar` was inside `ErrorBoundary`; crash removed window controls | ✅ |
| REG-005 | `AppLayout` | Default `TIMELINE_DEFAULT = 220` was too short to show all 5 tracks | ✅ |
| REG-006 | `WelcomeScreen` | `LogoMark` SVG still shown after icon replacement | ✅ |
| REG-007 | `TitleBar` | Old play-button SVG still shown in title bar after icon replacement | ✅ |
| REG-008 | `build` | `build:win` had a dangling `--config` flag that failed silently | ✅ |
| REG-009 | `build` | `resources/icon.ico` missing at build time | ✅ |
| REG-010 | `Sidebar` | `dataTutorial` prop missing from `SidebarTab` signature (found alongside REG-002) | ✅ |

---

## Phase 7 — Smoke Tests (~15 tests) ✅ IMPLEMENTED

> Run before every build. Fast. Coarse. If any of these fail, do not ship.
> **File:** `src/tests/smoke/smoke.test.tsx` — 11 tests, all passing.
> Electron process-level smokes (launch, window title, clean shutdown) deferred to Phase 8 Playwright.

- [x] App process launches (renderer shell renders without crash) — covered by Smoke 7.1
- [x] Welcome screen renders: logo, "New Project", "Open Project" all visible — Smoke 7.1
- [x] "New Project" button transitions to the editor view — Smoke 7.2
- [x] Editor layout renders: sidebar, preview panel, timeline all in DOM — Smoke 7.3
- [x] All 5 timeline tracks present in timelineStore (Video 1, Audio 1, Extra Audio, Music, Text) — Smoke 7.4
- [x] No uncaught errors (`console.error`) on startup — Smoke 7.5
- [x] Tutorial auto-launches on a simulated first run (`hasSeenWalkthrough: false`) — Smoke 7.6
- [x] Tutorial can be advanced to step 7 and completed with "Done" (no crash) — Smoke 7.7
- [x] Command Palette renders a search input when opened via store — Smoke 7.8
- [x] Settings dialog renders when `showSettings` is set to true — Smoke 7.9
- [x] Export dialog renders when `showExport` is set to true — Smoke 7.10
- [ ] App window title shows "Klip" (not "Electron") — deferred to Playwright E2E
- [ ] Closing the app via the X button exits with code 0 (clean shutdown) — deferred to Playwright E2E
- [ ] A second launch after a clean close opens normally (no corrupted state) — deferred to Playwright E2E

---

## Phase 8 — Functional Tests (~65 tests)

> Feature-level verification. Manual checklist or Playwright E2E.

### 8.1 Project lifecycle (~8 tests)

- [ ] "New Project" opens editor with all 5 tracks empty
- [ ] Project name shows "Untitled Project" in titlebar after new project
- [ ] `Ctrl+S` opens Save As dialog (no path yet)
- [ ] After saving, `Ctrl+S` saves silently (no dialog, no unsaved dot)
- [ ] `Ctrl+Shift+S` opens Save As dialog even when a path is already set
- [ ] Crash recovery dialog appears on launch after a simulated autosave
- [ ] "Restore" from crash recovery loads the autosaved state
- [ ] "Discard" from crash recovery clears the autosave and starts fresh

### 8.2 Media import (~10 tests)

- [ ] Drag a `.mp4` from Explorer into the Media Bin — clip card appears with thumbnail
- [ ] Click import button, select a `.mov` — clip card appears
- [ ] Importing a `.png` shows the image with `duration: 5s`
- [ ] Importing a `.mp3` shows an audio clip card (no thumbnail, waveform placeholder)
- [ ] Importing an unsupported format shows an error toast and no clip card
- [ ] Importing the same file twice shows a "duplicate" toast and does not add a second card
- [ ] Right-click → "Reveal in Explorer" opens the correct folder
- [ ] Right-click → "Rename" enters inline rename mode; press Enter to confirm
- [ ] Right-click → "Remove" removes clip from media bin; confirms if clip is on timeline
- [ ] Thumbnail generates within 5 seconds for a short video

### 8.3 Timeline editing (~18 tests)

- [ ] Drag clip from Media Bin to Video 1 track — clip appears at drop position
- [ ] Dragging near another clip's edge triggers snap indicator line
- [ ] Drag clip edge (left) to trim start — clip start moves, content shifts
- [ ] Drag clip edge (right) to trim end — clip end moves
- [ ] Press `S` — clip splits at playhead into two clips
- [ ] Press `Delete` on selected clip — clip removed
- [ ] Press `Shift+Delete` — ripple delete; all clips to the right shift left
- [ ] `Ctrl+Z` undoes the last operation
- [ ] `Ctrl+Z` × 3 steps back through three operations
- [ ] `Ctrl+Y` redoes one step
- [ ] `Ctrl+C` then `Ctrl+V` — pasted clip appears at playhead with new ID
- [ ] Multi-select with `Ctrl+Click` selects both clips
- [ ] Moving multi-selected clips moves them all
- [ ] Deleting multi-selected clips removes all of them in one undo step
- [ ] `Q` trims selected clip end to playhead
- [ ] `W` trims selected clip start to playhead
- [ ] Right-click clip → "Add Transition" → "Fade" adds a crossfade
- [ ] Locked track: dragging a clip onto it does nothing

### 8.4 Playback (~8 tests)

- [ ] `Space` plays from current playhead
- [ ] `Space` pauses; playhead stops
- [ ] `L` key plays forward; second `L` doubles speed; third doubles again
- [ ] `J` key plays in reverse
- [ ] `K` stops playback
- [ ] Dragging the scrub bar seeks the preview in real time
- [ ] Set loop in (`I`) and out (`O`); enable loop (`Ctrl+L`); playback loops in range
- [ ] Volume slider at 0 mutes preview audio

### 8.5 Keyboard shortcuts (~9 tests)

- [ ] `?` opens keyboard cheat sheet
- [ ] `Ctrl+K` opens Command Palette
- [ ] `\` zooms timeline to fit all clips
- [ ] `M` drops a marker at the playhead
- [ ] `↓` jumps playhead to next clip boundary
- [ ] `↑` jumps playhead to previous clip boundary
- [ ] `Ctrl+\` toggles snap on/off; magnet icon in toolbar reflects state
- [ ] `Esc` exits "What's This?" mode
- [ ] `F` enters fullscreen preview mode

### 8.6 Export (~6 tests)

- [ ] Export dialog shows preset options and output path picker
- [ ] "Browse" button opens OS file save dialog
- [ ] Starting export shows progress bar and ETA
- [ ] Export completes; output file exists on disk
- [ ] Output file plays in an external player (VLC or Windows Media Player)
- [ ] "Cancel" mid-export stops FFmpeg and removes the partial file

### 8.7 Text overlays (~6 tests)

- [ ] "T" toolbar button creates a text clip on the Text track at playhead
- [ ] Double-clicking the text clip opens the text settings panel
- [ ] Changing font color in the panel updates the overlay in the preview in real time
- [ ] Dragging the text on the preview canvas repositions it (positionX/Y updates)
- [ ] Text overlay visible during playback at the correct timeline range
- [ ] Text overlay is included in the exported video

---

## Phase 9 — Performance Tests (~15 tests)

> Benchmark critical hot paths. Set pass/fail thresholds.

### 9.1 Timeline rendering

- [ ] **Bench**: Adding 100 clips renders in < 100ms total (initial layout)
- [ ] **Bench**: Scrolling 500px horizontally on a 100-clip timeline completes a single rAF in < 16ms
- [ ] **Bench**: Zooming the timeline (pxPerSec change) triggers no more than 2 re-renders of `Timeline`
- [ ] **Bench**: `splitClip` store action completes in < 2ms
- [ ] **Bench**: `rippleDelete` on a 100-clip track completes in < 5ms

### 9.2 Media processing

- [ ] Thumbnail generated for a 1-minute 1080p clip in < 5 seconds
- [ ] Waveform peaks calculated for a 10-minute MP3 in < 10 seconds
- [ ] Waveform cache hit returns data in < 50ms

### 9.3 Playback

- [ ] Seek (scrub bar drag) updates preview within one rAF (~16ms) of pointer move
- [ ] Switching from one timeline clip to the next during playback takes < 200ms to load new source
- [ ] 60-second continuous playback of a 1080p clip shows no dropped frames in preview

### 9.4 Export

- [ ] A 1-minute 1080p timeline exports in < 3 minutes on target hardware
- [ ] Progress events fire at least once per second (UI does not appear frozen)
- [ ] Export memory usage does not grow unboundedly (no leak in progress event handler)

### 9.5 App startup

- [ ] Cold launch to welcome screen in < 3 seconds
- [ ] Reopening a project with 50 clips (including waveform cache) in < 5 seconds

---

## Phase 10 — Security Tests (~12 tests)

> Electron-specific attack surface. Run once before each public release.

- [ ] `contextIsolation: true` is set in `BrowserWindow` webPreferences
- [ ] `nodeIntegration` is `false` or not set (defaults to false) — renderer cannot call `require()`
- [ ] `sandbox: false` is intentional for preload; documented; preload does not expose raw `ipcRenderer`
- [ ] Preload `window.api` only exposes the specific IPC methods defined in `preload/index.ts` — no extra surface
- [ ] `shell.openExternal` is called only with URLs that begin with `https://` or `http://` (no `file://` or `javascript:`)
- [ ] FFmpeg is invoked with a hard-coded binary path (not a user-supplied path without validation)
- [ ] Exported file path is inside the user-chosen directory — test with a traversal payload (`../../../evil.mp4`) and assert it is rejected or sanitized
- [ ] No project file content is logged to `console.log` in production builds
- [ ] `webSecurity: false` is limited to renderer loading `klip://` protocol files — no remote content loaded
- [ ] The `klip://` protocol handler only serves files from paths that the user explicitly imported (not arbitrary paths)
- [ ] Autosave file is written to `app.getPath("userData")` — not to a world-writable temp directory
- [ ] IPC channel names are not guessable / enumerable from the renderer beyond what `preload` exposes

---

## Phase 11 — Acceptance Tests (~30 tests)

> Final sign-off before each release. Validates complete user stories.

### Story 1 — First-time user onboarding

> "I installed Klip, launched it, and understood the UI within 5 minutes."

- [ ] Tutorial launches automatically on first run
- [ ] Tutorial spotlight correctly highlights each of the 7 target elements
- [ ] Tutorial card is never clipped by the window edge (card stays inside viewport)
- [ ] Tutorial can be exited at any step; app is fully functional afterward
- [ ] After completing tutorial, it does not reappear on next launch
- [ ] "Restart Tutorial" in Settings → App tab re-runs the tutorial from step 1
- [ ] Restarting tutorial does not lose any existing project data

### Story 2 — Core edit workflow

> "I imported footage, trimmed clips, added music, added a title card, and exported."

- [ ] Import 3 video files into Media Bin
- [ ] Drag all 3 to the Video 1 track in order
- [ ] Trim 2 seconds from the start of the first clip
- [ ] Split the second clip and delete the first half
- [ ] Import a music file into the Music Library; drag it to the Music track
- [ ] Lower music volume to 60%
- [ ] Add a text overlay ("My Video Title") over the first clip
- [ ] Export to MP4 1080p60; file is produced and plays correctly
- [ ] Exported video duration matches the timeline total duration

### Story 3 — Project persistence

> "I saved my project, closed Klip, reopened it, and everything was exactly where I left it."

- [ ] Save project with clips, trims, text overlays, and a transition
- [ ] Close and reopen Klip
- [ ] Project appears in recents list with correct name and timestamp
- [ ] Open from recents: all clips are at the correct positions
- [ ] Text overlays have the same text, font, and position
- [ ] Transitions are preserved
- [ ] Playhead is at time 0 (or last-saved position)
- [ ] `hasUnsavedChanges` is `false` immediately after opening

### Story 4 — Error recovery after crash

> "The app crashed mid-edit, but when I reopened it my work was mostly there."

- [ ] Auto-save fires within 2 minutes of making an edit
- [ ] Force-crash the renderer (trigger an error boundary) and reopen
- [ ] Crash recovery dialog is shown with "Restore" and "Discard" options
- [ ] "Restore" loads the autosaved state including the most recent edits
- [ ] "Discard" clears the autosave and starts fresh (no remnants)
- [ ] If autosave file is corrupted, the dialog shows a graceful error — no crash

---

## Phase 12 — Accessibility Tests (~20 tests)

> **Tool:** `jest-axe` (axe-core wrapped for Vitest) + React Testing Library.
> Every rendered component must pass `expect(await axe(container)).toHaveNoViolations()`.
> Additional manual checks cover keyboard-only navigation and focus management.

### 12.1 axe automated scans (~8 tests)

*Run `axe()` on the fully-rendered component and assert zero violations.*

- [ ] `WelcomeScreen` — no axe violations
- [ ] `TutorialOverlay` (step 1) — no axe violations
- [ ] `ExportDialog` — no axe violations
- [ ] `SettingsDialog` — no axe violations
- [ ] `CommandPalette` — no axe violations
- [ ] `ErrorBoundary` fallback UI — no axe violations
- [ ] `ClipCard` — no axe violations
- [ ] `TrackRow` — no axe violations

### 12.2 Focus management (~6 tests)

- [ ] Opening `SettingsDialog` traps focus inside — Tab cycling never escapes the modal while it is open
- [ ] Closing `SettingsDialog` (Esc or X) returns focus to the element that triggered the open
- [ ] Opening `CommandPalette` moves focus to the search input automatically
- [ ] Closing `CommandPalette` (Esc) returns focus to the trigger button
- [ ] `TutorialOverlay` "Next" button is auto-focused on each step change (keyboard users can advance without mouse)
- [ ] `ExportDialog` export button is reachable by Tab without skipping interactive controls

### 12.3 Keyboard navigation (~6 tests)

- [ ] All toolbar buttons are reachable by Tab key
- [ ] All toolbar buttons activate on Enter and Space (not just click)
- [ ] Timeline clip selection responds to keyboard: Tab moves focus between clips; Enter selects
- [ ] Track header lock/mute/solo buttons are keyboard-operable
- [ ] `ClipContextMenu` can be navigated entirely via arrow keys; Enter confirms; Esc closes
- [ ] "What's this?" mode is exitable with Esc key (no mouse required)

---

## Priority order

Start here — highest ROI first:

1. **Phase 6 (Regression)** — protect against every crash already shipped
2. **Phase 7 (Smoke)** — fast gate before every build; catches catastrophic regressions in minutes
3. **Phase 1 §1.1–1.8 (Unit: mediaUtils + signals + tutorialSteps)** — pure functions, zero mocking overhead
4. **Phase 1 §1.9 (Property-based)** — run alongside unit tests; catches timeline math edge cases exhaustively
5. **Phase 2 (Unit: timelineStore + all stores)** — the most-used code paths; every action verified; includes §2.10–2.14 for the five previously uncovered stores
6. **Phase 3 §3.1–3.9 (Components: TutorialOverlay, ErrorBoundary, TitleBar, WelcomeScreen)** — already broke twice each
7. **Phase 3 §3.10–3.24 (Components: TopToolbar, CommandPalette, ExportDialog, SourceClipViewer, WhatThisOverlay, TimelineRuler, WaveformCanvas, SettingsDialog, ColorClipDialog, MusicLibrary, Toaster, AppLayout)** — zero coverage today
8. **Phase 3 §3.21–3.23 (Hooks: useProjectIO, useWaveform, useProxyEvents)** — autosave and waveform bugs are hard to reproduce manually
9. **Phase 4 (Store integration)** — catches state management bugs before they surface in the UI
10. **Phase 5 §5.1–5.6 (IPC core: mediaHandlers, projectHandlers, exportHandlers)** — file I/O and FFmpeg are the highest-risk main-process code
11. **Phase 5 §5.7–5.11 (IPC extended: settingsHandlers, localFileProtocol, ffmpegExport unit, windowState, IPC contract)** — zero coverage today; IPC contract tests prevent silent main/renderer drift
12. **Phase 12 (Accessibility)** — after component tests are passing; run axe scans and keyboard nav tests together
13. **Phase 8 (Functional)** — manual checklist until E2E is wired; run before every beta release
14. **Phase 9 (Performance)** — once core features are stable
15. **Phase 10 (Security)** — before any public release beyond private beta
16. **Phase 11 (Acceptance)** — final sign-off gate before each versioned release
