export interface TutorialStep {
  /** Unique ID for keying. */
  id: string
  /** Title shown in the callout card. */
  title: string
  /** Body text shown in the callout card. */
  body: string
  /**
   * `data-tutorial` attribute value of the element to spotlight.
   * Null = centered dialog with no spotlight.
   */
  target: string | null
  /**
   * Preferred callout placement relative to the target.
   * 'auto' lets the overlay pick based on available space.
   */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Klip',
    body: "Let's take a quick tour of the key features. You can go back, skip a step, or exit any time.",
    target: null
  },
  {
    id: 'import',
    title: 'Import your footage',
    body: 'Click the upload icon to import video, audio, or image files — or drag them straight from Explorer. Every file lands in the Media Bin until you add it to the timeline.',
    target: 'import-btn',
    placement: 'bottom'
  },
  {
    id: 'media-bin',
    title: 'Media Bin',
    body: 'Double-click any clip to open the Source Viewer where you can set in / out points before editing. Right-click for rename, relink, and proxy options.',
    target: 'media-bin',
    placement: 'right'
  },
  {
    id: 'timeline',
    title: 'The Timeline',
    body: 'Drag clips from the Media Bin onto the video or audio tracks. Drag a clip edge to trim it, drag the body to reposition. Press S to split at the playhead.',
    target: 'timeline-panel',
    placement: 'top'
  },
  {
    id: 'shortcuts',
    title: 'Essential shortcuts',
    body: 'Space plays/pauses · J/K/L for shuttle · Q/W trims to playhead · Shift+Delete for ripple delete · Ctrl+K opens the Command Palette. Press ? any time to see all shortcuts.',
    target: null
  },
  {
    id: 'music',
    title: 'Background music',
    body: 'Open the Music tab to build a library of tracks. Drag any track onto the audio lane in the timeline. Klip auto-normalises loudness so your music never overpowers dialogue.',
    target: 'music-tab',
    placement: 'right'
  },
  {
    id: 'export',
    title: "You're ready to export",
    body: "When your edit is done, click Export to render. Choose format, resolution, and output folder — or use Quick Preview to check the result before a full render.",
    target: 'export-btn',
    placement: 'bottom'
  }
]
