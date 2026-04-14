// ── Help Content ──────────────────────────────────────────────────────────────
// Shared by the Help tab in Settings and the "What's This?" overlay.
// Each entry maps to a data-help="id" attribute on a UI element.

export type HelpCategory =
  | 'importing'
  | 'timeline'
  | 'playback'
  | 'effects'
  | 'audio'
  | 'export'
  | 'general'

export const CATEGORY_LABELS: Record<HelpCategory, string> = {
  importing: 'Importing & Media',
  timeline:  'Timeline',
  playback:  'Playback',
  effects:   'Effects & Overlays',
  audio:     'Audio',
  export:    'Export',
  general:   'General'
}

export interface HelpEntry {
  id: string
  title: string
  description: string
  shortcut?: string[]
  category: HelpCategory
}

export const HELP_ENTRIES: HelpEntry[] = [
  // ── Importing ────────────────────────────────────────────────────────────────
  {
    id: 'import-drag-drop',
    title: 'Drag & Drop Import',
    description:
      'Drag video, audio, or image files directly from your file explorer onto the Media Bin panel to import them into your project.',
    category: 'importing'
  },
  {
    id: 'import-button',
    title: 'Import Media',
    description:
      'Click the import button in the Media Bin to open a file picker. Supports MP4, MKV, MOV, AVI, WebM, PNG, JPG, and common audio formats.',
    category: 'importing'
  },
  {
    id: 'source-viewer',
    title: 'Source Clip Viewer',
    description:
      'Double-click any clip in the Media Bin to open it in the Source Viewer. Set an in-point and out-point to define a selection range, then click "Add to Timeline" to place only that range — avoiding the need to trim on the timeline.',
    shortcut: ['I', 'O'],
    category: 'importing'
  },
  {
    id: 'proxy-generation',
    title: 'Proxy Generation',
    description:
      'Klip automatically generates low-resolution proxy files for imported videos in the background. Proxies enable smooth real-time playback of high-res footage. The green progress bar on clip cards shows proxy generation progress. Proxies are cached to disk and persist across sessions.',
    category: 'importing'
  },
  {
    id: 'relink-media',
    title: 'Relink Missing Media',
    description:
      'If a source file has been moved or renamed, Klip flags it with a "Media Offline" badge in the Media Bin. Right-click the clip and choose "Relink" to point it to the new file path and restore it.',
    category: 'importing'
  },
  {
    id: 'solid-color-clip',
    title: 'Solid Color Clip',
    description:
      'Generate a clip filled with a solid color — black, white, or any custom color. Useful for title card backgrounds, hold frames, or intro/outro padding. Set the duration and color in the generator dialog.',
    category: 'importing'
  },
  {
    id: 'music-library',
    title: 'Music Library',
    description:
      'The Music tab in the sidebar holds your collection of non-copyright tracks. Drag tracks onto a music lane on the timeline, or click the + button. Tracks can be tagged, searched, and previewed in-app.',
    category: 'importing'
  },

  // ── Timeline ──────────────────────────────────────────────────────────────────
  {
    id: 'split-clip',
    title: 'Split Clip',
    description:
      'Splits the selected clip at the exact frame where the playhead is positioned, creating two independent clips. Split is the primary way to cut out unwanted sections — split twice around the bad part, then delete the middle.',
    shortcut: ['S'],
    category: 'timeline'
  },
  {
    id: 'trim-end',
    title: 'Trim End to Playhead',
    description:
      'Trims the selected clip\'s end to the current playhead position. Position the playhead at the exact frame you want the clip to end, then press Q. Faster than dragging the clip edge for precise cuts.',
    shortcut: ['Q'],
    category: 'timeline'
  },
  {
    id: 'trim-start',
    title: 'Trim Start to Playhead',
    description:
      'Trims the selected clip\'s start to the current playhead position. Position the playhead at the exact frame you want the clip to begin, then press W.',
    shortcut: ['W'],
    category: 'timeline'
  },
  {
    id: 'delete-clip',
    title: 'Delete Clip',
    description:
      'Removes the selected clip from the timeline. The gap it leaves stays open — clips to its right don\'t move. Use Ripple Delete (Shift+Delete) if you want subsequent clips to shift left automatically.',
    shortcut: ['Delete'],
    category: 'timeline'
  },
  {
    id: 'ripple-delete',
    title: 'Ripple Delete',
    description:
      'Deletes the selected clip and automatically closes the gap by rippling all subsequent clips on the track left. The most common way to remove a clip in a finished edit without leaving a hole.',
    shortcut: ['Shift', 'Delete'],
    category: 'timeline'
  },
  {
    id: 'snap',
    title: 'Snap to Clip Edges',
    description:
      'When enabled, clips magnetize to adjacent clip edges and the playhead while dragging, making precise cuts much easier. A yellow indicator line appears when a clip is about to snap. Toggle with Ctrl+\\ or the magnet button in the timeline toolbar.',
    shortcut: ['Ctrl', '\\'],
    category: 'timeline'
  },
  {
    id: 'zoom-fit',
    title: 'Zoom to Fit',
    description:
      'Adjusts the timeline zoom level so your entire edit fits the visible width of the timeline in one view. Useful for getting a bird\'s-eye view of your whole project.',
    shortcut: ['\\'],
    category: 'timeline'
  },
  {
    id: 'markers',
    title: 'Timeline Markers',
    description:
      'Drop a labeled pin at the current playhead position. Useful for marking sections in long recordings — highlight moments, label chapters, or bookmark areas to revisit. Double-click to rename; right-click to delete.',
    shortcut: ['M'],
    category: 'timeline'
  },
  {
    id: 'freeze-frame',
    title: 'Freeze Frame',
    description:
      'Holds a single video frame for a set duration. Right-click a video clip at the playhead position and choose "Insert Freeze Frame". Klip inserts a still image clip of that exact frame on the timeline.',
    category: 'timeline'
  },
  {
    id: 'multi-select',
    title: 'Multi-Select Clips',
    description:
      'Hold Ctrl and click multiple clips to add or remove them from the selection. Move, delete, or copy them all at once. Multi-select drag moves all selected clips together while preserving their relative positions.',
    shortcut: ['Ctrl', 'Click'],
    category: 'timeline'
  },
  {
    id: 'close-gap',
    title: 'Close Gap',
    description:
      'Empty spaces between clips on a track are highlighted with an amber dashed indicator. Click the indicator to close the gap — all clips to its right ripple left to fill it.',
    category: 'timeline'
  },
  {
    id: 'track-locking',
    title: 'Track Locking',
    description:
      'Click the lock icon on any track header to lock it. Locked tracks are visually dimmed and ignore all edit operations — clips on them can\'t be moved, trimmed, or deleted. Prevents accidental edits to finished tracks.',
    category: 'timeline'
  },
  {
    id: 'copy-paste',
    title: 'Copy & Paste Clips',
    description:
      'Copy selected clips with Ctrl+C. Paste with Ctrl+V to place duplicates at the current playhead position on the same track(s). The original clips are briefly flashed to confirm the copy.',
    shortcut: ['Ctrl', 'C / V'],
    category: 'timeline'
  },
  {
    id: 'track-rename',
    title: 'Rename Track',
    description:
      'Double-click any track label in the track header column to rename it inline. Useful for labeling tracks by content — e.g., "Gameplay", "Mic", "BGM".',
    category: 'timeline'
  },
  {
    id: 'linked-clips',
    title: 'Linked Video + Audio',
    description:
      'When a video clip is placed on the timeline, its audio is automatically linked and placed on the audio track below it. Moving, trimming, or deleting the video clip affects the linked audio too. Hold Alt and click to select video or audio independently.',
    shortcut: ['Alt', 'Click'],
    category: 'timeline'
  },

  // ── Playback ──────────────────────────────────────────────────────────────────
  {
    id: 'play-pause',
    title: 'Play / Pause',
    description:
      'Toggles playback from the current playhead position. The timeline follows the playhead during playback, scrolling to keep it in view.',
    shortcut: ['Space'],
    category: 'playback'
  },
  {
    id: 'jkl-scrub',
    title: 'J / K / L Scrubbing',
    description:
      'Industry-standard shuttle controls. L plays forward (press multiple times to increase speed). J seeks back 10 seconds. K pauses. Used by professional editors in Premiere, Resolve, and Avid.',
    shortcut: ['J', 'K', 'L'],
    category: 'playback'
  },
  {
    id: 'frame-step',
    title: 'Frame Step',
    description:
      'Step exactly one frame forward or backward. Essential for finding the exact frame for a cut. Works when the preview panel is focused.',
    shortcut: ['←', '→'],
    category: 'playback'
  },
  {
    id: 'loop-playback',
    title: 'Loop Playback',
    description:
      'Set an in-point (I) and out-point (O) on the timeline to define a loop region, then toggle loop mode (Ctrl+L) to continuously replay just that section. Press Esc to clear the loop.',
    shortcut: ['I / O', 'Ctrl+L'],
    category: 'playback'
  },
  {
    id: 'playback-speed',
    title: 'Playback Speed',
    description:
      'Change the preview playback speed in the player controls (0.25×–2×). Useful for reviewing fast action or listening to dialogue at reduced speed. Does not affect export — use clip Speed Control for that.',
    category: 'playback'
  },
  {
    id: 'quick-render',
    title: 'Quick Render Preview',
    description:
      'Runs a fast, low-resolution FFmpeg draft encode of your full edit to a temp file, then opens it in the built-in player for seamless playback — transitions, audio mix, and all effects included. Use this before the final export to sanity-check the edit.',
    category: 'playback'
  },
  {
    id: 'fullscreen',
    title: 'Fullscreen Preview',
    description:
      'Expands the preview player to fill your entire screen for a proper viewing experience. Press F or click the fullscreen button. Press Escape to exit.',
    shortcut: ['F'],
    category: 'playback'
  },
  {
    id: 'next-prev-edit',
    title: 'Next / Previous Edit Point',
    description:
      'Jump the playhead to the next or previous clip boundary (cut point) on the timeline. Useful for quickly reviewing cuts without scrubbing.',
    shortcut: ['↓', '↑'],
    category: 'playback'
  },

  // ── Effects ────────────────────────────────────────────────────────────────────
  {
    id: 'text-overlays',
    title: 'Text Overlays',
    description:
      'Add captions, titles, or lower thirds with the T button in the toolbar. Text clips live on the Overlay track. Click a text clip to select it, then edit font, size, color, position, and animation preset in the right panel. Drag the text directly in the preview canvas to reposition it.',
    shortcut: ['T'],
    category: 'effects'
  },
  {
    id: 'transitions',
    title: 'Transitions',
    description:
      'Right-click any video clip to apply a transition at its in-point or out-point. Available types: Dip to Black (fade to/from black) and Crossfade (dissolve between clips). Adjust the duration with the slider (0.2s–3s).',
    category: 'effects'
  },
  {
    id: 'speed-control',
    title: 'Clip Speed Control',
    description:
      'Right-click any video clip and open the Speed section to set a custom playback rate (0.25×–16×). Slow motion (< 1×) and fast forward (> 1×) are both supported. Applied at export via FFmpeg\'s PTS filter.',
    category: 'effects'
  },
  {
    id: 'digital-zoom',
    title: 'Digital Zoom (Punch In)',
    description:
      'Right-click a video clip to set a zoom level (1×–4×) and pan position. Use the "Punch In" preset to jump to 2× center zoom instantly. Pan X/Y sliders or the minimap control which part of the frame is shown.',
    category: 'effects'
  },
  {
    id: 'color-grade',
    title: 'Color Grading',
    description:
      'Per-clip brightness, contrast, and saturation sliders are available in the right-click clip menu. Values range from −1 to +1. Applied at export via FFmpeg\'s eq filter — no preview degradation during editing.',
    category: 'effects'
  },
  {
    id: 'intro-outro',
    title: 'Intro / Outro Markers',
    description:
      'Right-click any video, image, or color clip and choose "Mark as Intro" or "Mark as Outro". The clip gets an INTRO or OUTRO badge on the timeline — purely organizational, useful for remembering which clips are your bumpers.',
    category: 'effects'
  },

  // ── Audio ──────────────────────────────────────────────────────────────────────
  {
    id: 'waveforms',
    title: 'Waveform Visualization',
    description:
      'Audio waveforms render on timeline clips — green bars for music tracks, blue bars for linked video audio. Waveforms are extracted in the background via FFmpeg and cached to disk so they don\'t regenerate on every project open.',
    category: 'audio'
  },
  {
    id: 'audio-fades',
    title: 'Audio Fade Handles',
    description:
      'Drag the diamond handles at the start or end edge of any audio or video clip to set a fade-in or fade-out duration. A gradient overlay shows the fade region on the clip. Fades are applied at export via FFmpeg\'s afade filter.',
    category: 'audio'
  },
  {
    id: 'audio-normalize',
    title: 'Audio Normalization',
    description:
      'Right-click a clip → Volume → Normalize to −18 LUFS. FFmpeg analyzes the clip\'s loudness (momentary and integrated) and computes the volume adjustment needed to hit the target level. Applied at export.',
    category: 'audio'
  },
  {
    id: 'per-clip-volume',
    title: 'Per-Clip Volume',
    description:
      'Right-click any audio or video clip and set a custom volume (0–200%). Values above 100% boost the clip; below 100% attenuate it. A volume badge appears on the clip when it\'s not at the default 100%.',
    category: 'audio'
  },
  {
    id: 'master-volume',
    title: 'Master Volume',
    description:
      'The volume slider in the preview player controls bar sets the master output level for playback. Click the speaker icon to toggle mute. The master level is also applied at export.',
    category: 'audio'
  },
  {
    id: 'audio-level-meters',
    title: 'Audio Level Meters',
    description:
      'Real-time L/R peak meters in the preview panel show audio levels during playback using the Web Audio API. The top 1–2 segments flash orange and then red when peaks go above 0 dB, with an 800ms hold on the red indicator.',
    category: 'audio'
  },
  {
    id: 'unlink-audio',
    title: 'Unlink Audio from Video',
    description:
      'By default, a video clip and its linked audio move together. Right-click → "Unlink Audio" to break the link so the video and audio clips can be moved, trimmed, and deleted independently.',
    category: 'audio'
  },

  // ── Export ──────────────────────────────────────────────────────────────────────
  {
    id: 'export-presets',
    title: 'Export Presets',
    description:
      'Choose from YouTube-optimized presets in the Export dialog: 1080p60, 1440p60, 4K30, 1080p30, and Draft (720p fast preview). All use H.264 with CRF 18 (high quality) and 320k AAC audio, except Draft which uses CRF 28 for speed.',
    category: 'export'
  },
  {
    id: 'export-progress',
    title: 'Export Progress',
    description:
      'The Export dialog shows real-time progress: percentage complete, estimated time remaining, and current FFmpeg processing speed (e.g., "3.2× realtime"). The app title bar also shows the export percentage.',
    category: 'export'
  },
  {
    id: 'export-history',
    title: 'Export History',
    description:
      'The Export dialog keeps a log of your last 10 exports with output path, preset used, and timestamp. Expand the history section at the bottom of the dialog to review or re-open past exports.',
    category: 'export'
  },
  {
    id: 'thumbnail-export',
    title: 'Export Thumbnail Frame',
    description:
      'Right-click the preview canvas at any point during editing to save the current video frame as a PNG file. Useful for creating YouTube thumbnails without opening a separate tool.',
    category: 'export'
  },

  // ── General ────────────────────────────────────────────────────────────────────
  {
    id: 'undo-redo',
    title: 'Undo / Redo',
    description:
      'Full undo/redo history for all timeline operations — clip moves, trims, splits, deletes, volume changes, and more. The history is stored in-memory for the current session.',
    shortcut: ['Ctrl+Z', 'Ctrl+Shift+Z'],
    category: 'general'
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    description:
      'Quick-access to clips, effects, settings, and actions by name. Start typing to search — results appear instantly. Use arrow keys to navigate and Enter to execute.',
    shortcut: ['Ctrl', 'K'],
    category: 'general'
  },
  {
    id: 'auto-save',
    title: 'Auto-Save & Crash Recovery',
    description:
      'Klip auto-saves your project every 2 minutes to a recovery file. If the app closes unexpectedly, the next launch detects the autosave and offers to restore your work before you do anything else.',
    category: 'general'
  },
  {
    id: 'project-settings',
    title: 'Project Settings',
    description:
      'Configure the project\'s resolution (1080p / 1440p / 4K), frame rate (24 / 30 / 60 fps), and aspect ratio (16:9, 9:16, 1:1). These become the defaults in the Export dialog. Clips that don\'t match are flagged with a warning icon.',
    category: 'general'
  },
  {
    id: 'settings',
    title: 'App Settings',
    description:
      'Open the Settings panel to configure your default export folder, music library location, proxy cache, FFmpeg binary, snap behavior, and keyboard shortcuts.',
    category: 'general'
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description:
      'Open the full keyboard shortcut reference. Every major action in Klip has a keyboard shortcut — learning the core ones (Space, S, Q, W, J/K/L) dramatically speeds up editing.',
    shortcut: ['?'],
    category: 'general'
  },
  {
    id: 'timeline-ruler',
    title: 'Timeline Ruler Format',
    description:
      'Toggle the timeline ruler between seconds-only and full HH:MM:SS:FF timecode display. Click the clock icon in the timeline toolbar to switch.',
    category: 'general'
  },
  {
    id: 'export-btn',
    title: 'Export Video',
    description:
      'Opens the Export dialog where you choose a preset, output path, and filename. Klip then runs FFmpeg to produce a final MP4 with all clips, transitions, text overlays, audio mix, and effects baked in.',
    category: 'export'
  }
]

// Build a lookup map by id for the WhatThisOverlay
export const HELP_BY_ID: Record<string, HelpEntry> = Object.fromEntries(
  HELP_ENTRIES.map((e) => [e.id, e])
)
