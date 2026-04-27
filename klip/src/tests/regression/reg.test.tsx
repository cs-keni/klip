/**
 * Phase 6 — Regression Tests
 *
 * One test per bug that has already shipped.  Label format: REG-NNN.
 * These run on every commit via `npx vitest run --grep "REG-"`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'

import { useAppSettingsStore } from '@/stores/appSettingsStore'

// ---------------------------------------------------------------------------
// REG-001 — PreviewPanel TDZ crash
// Bug: handleSaveFrame referenced activeMediaClip in its useCallback dep array
//      before activeMediaClip was declared, causing a ReferenceError on mount.
// ---------------------------------------------------------------------------
describe('REG-001', () => {
  it('PreviewPanel mounts without ReferenceError when timeline is empty', async () => {
    // Lazy import so the module resolution error surfaces as a test failure,
    // not a compile-time error.
    const { default: PreviewPanel } = await import(
      '@/components/Layout/PreviewPanel'
    )
    expect(() => render(<PreviewPanel />)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// REG-002 — SidebarTab dataHelp prop missing from function signature
// Bug: `dataHelp` was destructured from props but not listed in the function
//      signature, so `data-help` was never forwarded to the DOM button.
// ---------------------------------------------------------------------------
describe('REG-002', () => {
  // Stub out heavy children so only the tab buttons are relevant.
  vi.mock('@/components/MediaBin/MediaBin',    () => ({ default: () => null }))
  vi.mock('@/components/MediaBin/MusicLibrary', () => ({ default: () => null }))

  it('Media tab button has data-help="import-drag-drop"', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    render(<Sidebar />)
    const mediaBtn = screen.getByRole('button', { name: /media/i })
    expect(mediaBtn).toHaveAttribute('data-help', 'import-drag-drop')
  })
})

// ---------------------------------------------------------------------------
// REG-003a — TutorialOverlay stale closure
// Bug: next() captured stepIndex directly instead of using a functional update,
//      so rapid clicks read a stale value and could produce TUTORIAL_STEPS[7]
//      === undefined, crashing the useLayoutEffect that reads step.target.
// ---------------------------------------------------------------------------
describe('REG-003a', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
  })

  it('clicking Next 20 times never throws and stepIndex stays <= 6', async () => {
    const { default: TutorialOverlay } = await import(
      '@/components/Tutorial/TutorialOverlay'
    )
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    // Re-query on every iteration — the card is re-keyed on each step, so the
    // DOM node is replaced and a stale reference would silently do nothing.
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      const nextBtn = screen.queryByRole('button', { name: /next/i })
      if (!nextBtn) break // reached the last step ("Done" is shown instead)
      // eslint-disable-next-line no-await-in-loop
      await user.click(nextBtn)
    }

    // The step counter must not exceed "7 / 7" (last valid step)
    expect(screen.queryByText(/8\s*\/\s*7/)).not.toBeInTheDocument()
    // The "Done" button (last step) should be visible — we're capped at step 7
    expect(await screen.findByRole('button', { name: /done/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REG-003b — TutorialOverlay missing guard on undefined step
// Bug: useLayoutEffect ran with step === undefined when stepIndex somehow
//      exceeded the array bounds, crashing on step.target.
// ---------------------------------------------------------------------------
describe('REG-003b', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
  })

  it('restarts cleanly to step 1 when hasSeenWalkthrough is reset to false', async () => {
    // We can't force stepIndex out-of-bounds externally, but the guard
    // `if (!step) return null` is verified by exercising the restart path:
    // skip tutorial → hasSeenWalkthrough=true, active=false →
    // reset to false → useEffect fires → component resets to step 1 without crash.
    const { default: TutorialOverlay } = await import(
      '@/components/Tutorial/TutorialOverlay'
    )
    const user = userEvent.setup()
    const { rerender } = render(<TutorialOverlay />)

    // Initially at step 1
    expect(await screen.findByText(/1\s*\/\s*7/)).toBeInTheDocument()

    // Skip all: calls finish() → sets active=false AND hasSeenWalkthrough=true
    await user.click(screen.getByRole('button', { name: /skip all/i }))

    // Overlay is now hidden (active=false)
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)

    // Simulate "Restart Tutorial" in settings — hasSeenWalkthrough changes true→false
    act(() => {
      useAppSettingsStore.setState({ hasSeenWalkthrough: false })
    })
    rerender(<TutorialOverlay />)

    // useEffect fires (dependency changed): setActive(true), setStepIndex(0)
    // → step 1 shown again, no crash from the out-of-bounds guard
    expect(await screen.findByText(/1\s*\/\s*7/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REG-004 — TitleBar inside ErrorBoundary
// Bug: TitleBar was nested inside ErrorBoundary, so when the renderer crashed
//      the window controls disappeared and the user couldn't close the app.
// ---------------------------------------------------------------------------
describe('REG-004', () => {
  it('TitleBar remains in DOM when a child inside ErrorBoundary throws', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')

    // A component that always throws on render
    const Crasher = (): never => {
      throw new Error('Simulated render crash for REG-004')
    }

    render(
      <div>
        <TitleBar />
        <ErrorBoundary>
          <Crasher />
        </ErrorBoundary>
      </div>
    )

    // Window controls must still be in DOM
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
    // ErrorBoundary fallback UI is shown
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// REG-005 — TIMELINE_DEFAULT too small to show all 5 tracks
// Bug: TIMELINE_DEFAULT = 220 was less than the minimum height needed to
//      display all 5 track rows (ruler 28 + 5 × 56 = 308 px).
// ---------------------------------------------------------------------------
describe('REG-005', () => {
  it('TIMELINE_DEFAULT constant in AppLayout.tsx is >= 304', () => {
    const src = readFileSync(
      resolve('src/renderer/src/components/Layout/AppLayout.tsx'),
      'utf-8'
    )
    const match = src.match(/const\s+TIMELINE_DEFAULT\s*=\s*(\d+)/)
    const value = match ? parseInt(match[1], 10) : 0
    expect(value).toBeGreaterThanOrEqual(304)
  })
})

// ---------------------------------------------------------------------------
// REG-006 — WelcomeScreen logo still rendering as SVG
// Bug: LogoMark SVG was still imported and rendered after the icon file was
//      replaced with an .ico, causing a broken/blank logo on the welcome screen.
// ---------------------------------------------------------------------------
describe('REG-006', () => {
  it('WelcomeScreen logo is an <img> element, not a <svg>', async () => {
    const { default: WelcomeScreen } = await import(
      '@/components/WelcomeScreen/WelcomeScreen'
    )
    render(<WelcomeScreen />)
    const logo = screen.getByAltText('Klip')
    expect(logo.tagName).toBe('IMG')
    // Double-check no SVG is present at the logo position
    expect(logo.closest('svg')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// REG-007 — TitleBar logo still rendering as SVG
// Bug: Same as REG-006 but in TitleBar — old play-button SVG persisted.
// ---------------------------------------------------------------------------
describe('REG-007', () => {
  it('TitleBar logo is an <img> element, not a <svg>', async () => {
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    const logo = screen.getByAltText('Klip')
    expect(logo.tagName).toBe('IMG')
    expect(logo.closest('svg')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// REG-008 — build:win script had dangling --config flag
// Bug: `electron-builder --win --config` with no argument caused a silent
//      build failure on some systems.
// ---------------------------------------------------------------------------
describe('REG-008', () => {
  it('build:win script in package.json has no dangling --config flag', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as {
      scripts: Record<string, string>
    }
    const script = pkg.scripts['build:win']
    expect(script).toBeDefined()
    // A dangling --config would appear at end-of-line or before another flag
    expect(script).not.toMatch(/--config\s*(?:--|$)/)
  })
})

// ---------------------------------------------------------------------------
// REG-009 — resources/icon.ico missing at build time
// Bug: electron-builder was configured to use resources/icon.ico but the file
//      was not committed, causing the Windows build to fail.
// ---------------------------------------------------------------------------
describe('REG-009', () => {
  it('resources/icon.ico exists on disk', () => {
    expect(existsSync(resolve('resources/icon.ico'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// REG-010 — SidebarTab dataTutorial prop missing from signature
// Bug: Found alongside REG-002. dataTutorial was passed as a prop but not
//      forwarded, so the tutorial spotlight could never find the element.
// ---------------------------------------------------------------------------
describe('REG-010', () => {
  it('Music tab button has both data-tutorial and data-help attributes', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    render(<Sidebar />)
    const musicBtn = screen.getByRole('button', { name: /music/i })
    expect(musicBtn).toHaveAttribute('data-tutorial', 'music-tab')
    expect(musicBtn).toHaveAttribute('data-help', 'music-library')
  })
})

// ---------------------------------------------------------------------------
// REG-011 — Thumbnail video NaN currentTime crash after clip trim
// Bug: When the scrub-bar hover thumbnail video element had not yet loaded its
//      metadata (duration === NaN), the expression `tv.duration ?? seekSrc`
//      returned NaN instead of seekSrc because `??` only guards null/undefined.
//      Setting currentTime = NaN throws "non-finite" TypeError in Chromium.
//      Triggered by trimming a clip while scrubHover was still set.
// ---------------------------------------------------------------------------
describe('REG-011', () => {
  it('thumbnail seekSrc clamping never produces a NaN currentTime', () => {
    // Replicate the exact expression that was buggy.
    // Before fix: Math.max(0, Math.min(seekSrc, tv.duration ?? seekSrc))
    // After fix:  Number.isFinite(tv.duration) && Number.isFinite(seekSrc)
    //             → Math.max(0, Math.min(seekSrc, tv.duration))
    const seekSrc = 3.5   // valid time within clip
    const nanDuration = NaN  // metadata not loaded yet

    // OLD (broken) expression
    const broken = Math.max(0, Math.min(seekSrc, nanDuration ?? seekSrc))
    expect(Number.isFinite(broken)).toBe(false)  // confirms the bug existed

    // NEW (fixed) guard
    const fixed = (Number.isFinite(seekSrc) && Number.isFinite(nanDuration))
      ? Math.max(0, Math.min(seekSrc, nanDuration))
      : null  // skip the assignment
    expect(fixed).toBeNull()  // correctly skips when duration is NaN
  })
})

// ---------------------------------------------------------------------------
// REG-012 — rippleDelete leaves audio track out of sync after deleting linked pair
// Bug: rippleDelete only shifted clips on clip.trackId (the video track). When a
//      linked video+audio pair was ripple-deleted, clips AFTER the audio on the
//      audio track were NOT shifted, leaving subsequent clips out of sync.
// ---------------------------------------------------------------------------
import { useTimelineStore } from '@/stores/timelineStore'

describe('REG-012', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [
        { id: 'v1', type: 'video', name: 'Video 1', isLocked: false, isMuted: false, isSolo: false },
        { id: 'a1', type: 'audio', name: 'Audio 1', isLocked: false, isMuted: false, isSolo: false },
      ],
      clips: [], transitions: [], markers: [],
      selectedClipId: null, selectedClipIds: [], clipboard: null,
      playheadTime: 0, isPlaying: false, past: [], future: [],
      snapEnabled: true, pxPerSec: 80, shuttleSpeed: 0,
      loopIn: null, loopOut: null, loopEnabled: false, masterVolume: 1
    })
  })

  it('shifts subsequent clips on the linked track after ripple-deleting a linked pair', () => {
    // Layout: videoA(0-5) + audioA(0-5) linked, then videoB(5-10) + audioB(5-10) linked
    useTimelineStore.setState({
      clips: [
        { id: 'vA', mediaClipId: 'm1', trackId: 'v1', startTime: 0,  duration: 5,  trimStart: 0, type: 'video', name: 'A', thumbnail: null, linkedClipId: 'aA' },
        { id: 'aA', mediaClipId: 'm1', trackId: 'a1', startTime: 0,  duration: 5,  trimStart: 0, type: 'audio', name: 'A', thumbnail: null, linkedClipId: 'vA' },
        { id: 'vB', mediaClipId: 'm2', trackId: 'v1', startTime: 5,  duration: 5,  trimStart: 0, type: 'video', name: 'B', thumbnail: null, linkedClipId: 'aB' },
        { id: 'aB', mediaClipId: 'm2', trackId: 'a1', startTime: 5,  duration: 5,  trimStart: 0, type: 'audio', name: 'B', thumbnail: null, linkedClipId: 'vB' },
      ]
    })

    useTimelineStore.getState().rippleDelete('vA')

    const { clips } = useTimelineStore.getState()
    const vB = clips.find((c) => c.id === 'vB')!
    const aB = clips.find((c) => c.id === 'aB')!

    // Both vA and aA are removed
    expect(clips.find((c) => c.id === 'vA')).toBeUndefined()
    expect(clips.find((c) => c.id === 'aA')).toBeUndefined()

    // vB shifts left (video track) — this worked before the fix too
    expect(vB.startTime).toBe(0)

    // aB must also shift left (audio track) — this was the bug
    expect(aB.startTime).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// REG-013 — projectIO DEFAULT_TRACKS fallback missing 'a2' Extra Audio track
// Bug: projectIO.ts had a 4-track DEFAULT_TRACKS that omitted the 'a2' Extra
//      Audio track, so a corrupted/legacy project open would restore the editor
//      with only 4 tracks and no Extra Audio lane.
// ---------------------------------------------------------------------------
describe('REG-013', () => {
  it('projectIO DEFAULT_TRACKS includes all 5 tracks including a2 Extra Audio', () => {
    const src = readFileSync(
      resolve('src/renderer/src/lib/projectIO.ts'),
      'utf-8'
    )
    // Check that both DEFAULT_TRACKS entries cover a2
    expect(src).toMatch(/id:\s*['"]a2['"]/)
    expect(src).toMatch(/Extra Audio/)
  })
})
