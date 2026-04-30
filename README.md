# Klip

> A desktop video editor built for YouTube creators — dark, fast, and local-first.

Klip is a Windows 11 desktop application for editing long OBS recordings into polished YouTube videos. It handles the full workflow: import raw footage, arrange clips on a multi-track timeline, apply effects and text overlays, and export a YouTube-ready MP4 — all without a subscription or internet connection.

[![Klip welcome screen](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/welcome.jpg)](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/welcome.jpg)

**[▶ Watch the demo](https://raw.githubusercontent.com/cs-keni/klip/main/docs/demo.mp4)**

---

## Features

### Timeline editing
- Multi-track timeline — video, audio, music, and text overlay tracks
- Clip trimming, splitting, ripple delete, and gap close
- Multi-select with Ctrl+click or lasso drag; Ctrl+A selects all
- Snap-to-edges with a toggle, full undo/redo stack (Ctrl+Z / Ctrl+Shift+Z)
- Timeline minimap for navigating long recordings
- Markers with labels and color coding; chapter metadata embedded in export

### Media & playback
- Proxy generation — FFmpeg renders a 480p copy in the background on import for smooth playback of 4K/8-hour source files
- Source clip viewer with in/out points before placing on the timeline
- Linked video+audio clips that move, trim, and split together
- Waveform visualization on all audio and video clips
- Audio scrubbing — brief audio playback while dragging the playhead

### Effects
- Per-clip color grade (brightness, contrast, saturation)
- Crop / zoom with a minimap pan widget (up to 4×)
- Speed control (0.25×–16×)
- Audio fade-in / fade-out handles with live preview
- Crossfade and dip-to-black transitions with adjustable duration
- Text overlays with WYSIWYG canvas positioning, font controls, and animation presets

### Export
- YouTube presets: 1080p60, 1440p60, 4K, 1080p30
- Additional presets: Draft (720p fast), WebM VP9, Animated GIF
- Pre-flight validation (writable path, filename, disk space estimate)
- Export progress with ETA, real-time speed, and cancel
- System notification on completion; "Show in Explorer" button

### Project reliability
- Auto-save every 2 minutes; crash recovery on next launch
- Save-before-close confirmation
- Missing-file detection with relink on project open
- Playhead position, master volume, and markers all serialized to the project file

---

## Screenshots

| Editor | Export |
|---|---|
| [![Main editor](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/main.jpg)](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/main.jpg) | [![Export dialog](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/export.jpg)](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/export.jpg) |

| Settings |
|---|
| [![Settings](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/settings.jpg)](https://raw.githubusercontent.com/cs-keni/klip/main/docs/screenshots/settings.jpg) |

---

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 30 (frameless, custom titlebar) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Video processing | FFmpeg (bundled via ffmpeg-static) |
| State | Zustand |
| Music library | SQLite via better-sqlite3 |
| Build | electron-vite |
| Tests | Vitest + Testing Library + Playwright |

---

## Getting started

**Requirements:** Node.js 20+, Windows 11 (the app targets Windows; the dev server runs on any OS but the Electron shell is Windows-only for production builds).

```bash
git clone https://github.com/cs-keni/klip.git
cd klip/klip
npm install
npm run dev
```

> If you're on WSL, run `npm install` from Windows PowerShell rather than WSL so that `ffmpeg-static` resolves the correct Windows binary.

---

## Building

```bash
# Production build + Windows installer (.exe via NSIS)
npm run build:win
```

Output lands in `dist/`.

---

## Testing

```bash
# Unit + component tests (Vitest)
npm test

# Watch mode
npm run test:watch

# End-to-end tests (Playwright — requires a built app)
npm run build:test
```

667 unit/component tests across stores, IPC handlers, components, accessibility, and regression cases.

---

## Project structure

```
klip/
├── src/
│   ├── main/           # Electron main process + IPC handlers
│   ├── preload/        # Context bridge (window.api)
│   └── renderer/
│       └── src/
│           ├── components/   # React UI (Timeline, MediaBin, PreviewPanel, …)
│           ├── stores/       # Zustand stores (timeline, media, project, …)
│           ├── hooks/        # useProjectIO, useWaveform, useProxyEvents
│           ├── lib/          # projectIO, mediaUtils, FFmpeg helpers
│           └── types/        # Shared TypeScript types
├── docs/
│   ├── screenshots/
│   └── demo.mp4
└── package.json
```
