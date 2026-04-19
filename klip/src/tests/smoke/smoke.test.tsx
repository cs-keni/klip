/**
 * Phase 7 — Smoke Tests
 *
 * Coarse, fast, binary: if any of these fail, the build is not releasable.
 * Run with: `npx vitest run --grep "Smoke"`
 *
 * Heavy subcomponents (MediaBin, PreviewPanel, TimelinePanel, etc.) are
 * replaced with lightweight stubs so the structural shell can be tested
 * without triggering FFmpeg, Web Audio, or file-system side effects.
 *
 * NOTE: Electron-specific smokes (process launch, window title, clean shutdown)
 * are deferred to Playwright E2E and are NOT included here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useAppStore } from '@/stores/appStore'
import { useAppSettingsStore } from '@/stores/appSettingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'

import App from '@/App'
import WelcomeScreen from '@/components/WelcomeScreen/WelcomeScreen'
import CommandPalette from '@/components/CommandPalette/CommandPalette'

// ── Stub out heavy inner components ──────────────────────────────────────────
// These are replaced globally for this file so no IPC / canvas / FFmpeg code
// runs.  The stubs expose data-testid markers so structural tests can still
// assert their presence.
vi.mock('@/components/MediaBin/MediaBin',     () => ({ default: () => <div data-testid="media-bin" /> }))
vi.mock('@/components/MediaBin/MusicLibrary', () => ({ default: () => <div data-testid="music-library" /> }))
vi.mock('@/components/Layout/PreviewPanel',   () => ({ default: () => <div data-testid="preview-panel" /> }))
vi.mock('@/components/Layout/TimelinePanel',  () => ({ default: () => <div data-testid="timeline-panel" /> }))
vi.mock('@/components/MediaBin/SourceClipViewer', () => ({ default: () => null }))
vi.mock('@/components/Help/WhatThisOverlay',  () => ({ default: () => null }))

// ── Reset store state before every test ──────────────────────────────────────
beforeEach(() => {
  useAppStore.setState({ view: 'welcome' })
  useAppSettingsStore.setState({ hasSeenWalkthrough: false })
  useUIStore.setState({ showExport: false, showSettings: false, showProjectSettings: false, whatsThisMode: false })
  useCommandPaletteStore.setState({ isOpen: false })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function renderApp() {
  return render(<App />)
}

async function navigateToEditor() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /new project/i }))
}

// =============================================================================

describe('Smoke 7.1 — Welcome screen', () => {
  it('renders logo, New Project button, and Open Project button', () => {
    render(<WelcomeScreen />)

    expect(screen.getByAltText('Klip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open project/i })).toBeInTheDocument()
  })

  it('shows empty recent-projects placeholder when there are no recents', async () => {
    render(<WelcomeScreen />)
    // The placeholder renders asynchronously after the getRecent() promise resolves.
    expect(await screen.findByText(/no recent projects/i)).toBeInTheDocument()
  })
})

// =============================================================================

describe('Smoke 7.2 — New Project navigates to editor', () => {
  it('clicking New Project sets app view to "editor"', async () => {
    await renderApp()
    const user = userEvent.setup()

    expect(useAppStore.getState().view).toBe('welcome')
    await user.click(screen.getByRole('button', { name: /new project/i }))
    expect(useAppStore.getState().view).toBe('editor')
  })
})

// =============================================================================

describe('Smoke 7.3 — Editor layout', () => {
  it('renders sidebar, preview panel, and timeline panel areas', async () => {
    await navigateToEditor()

    expect(screen.getByTestId('media-bin')).toBeInTheDocument()
    expect(screen.getByTestId('preview-panel')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-panel')).toBeInTheDocument()
  })
})

// =============================================================================

describe('Smoke 7.4 — Default timeline tracks', () => {
  it('timelineStore initialises with 5 tracks (Video 1, Audio 1, Extra Audio, Music, Text)', () => {
    const tracks = useTimelineStore.getState().tracks
    const names  = tracks.map((t) => t.name)

    expect(tracks).toHaveLength(5)
    expect(names).toContain('Video 1')
    expect(names).toContain('Audio 1')
    expect(names).toContain('Extra Audio')
    expect(names).toContain('Music')
    expect(names).toContain('Text')
  })
})

// =============================================================================

describe('Smoke 7.5 — No console.error on startup', () => {
  it('welcome screen renders without any console.error calls', () => {
    // console.error is replaced with a vi.fn() spy in setup.ts.
    // Cast it so we can assert on it.
    const errorSpy = console.error as ReturnType<typeof vi.fn>
    errorSpy.mockClear()

    render(<WelcomeScreen />)

    expect(errorSpy).not.toHaveBeenCalled()
  })
})

// =============================================================================

describe('Smoke 7.6 — Tutorial auto-launches on first run', () => {
  it('TutorialOverlay is visible when hasSeenWalkthrough is false', async () => {
    // hasSeenWalkthrough defaults to false (fresh localStorage cleared in setup.ts)
    await navigateToEditor()

    // Step counter proves the overlay is active
    expect(await screen.findByText(/1\s*\/\s*7/)).toBeInTheDocument()
  })
})

// =============================================================================

describe('Smoke 7.7 — Tutorial completes without crash', () => {
  it('can advance through all 7 steps and click Done without throwing', async () => {
    await navigateToEditor()
    const user = userEvent.setup()

    // Advance through steps 1–6
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(await screen.findByRole('button', { name: /next/i }))
    }

    // Step 7 shows "Done"
    const doneBtn = await screen.findByRole('button', { name: /done/i })
    expect(screen.getByText(/7\s*\/\s*7/)).toBeInTheDocument()

    await user.click(doneBtn)

    // Overlay dismissed — step counter gone
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()
    // Store flag updated
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
  })
})

// =============================================================================

describe('Smoke 7.8 — Command Palette', () => {
  it('CommandPalette renders a search input when isOpen is true', async () => {
    // Render CommandPalette directly so we can control isOpen without the full
    // App/AppLayout render chain (keyboard binding lives in Timeline which is
    // mocked; this verifies the component itself works).
    render(<CommandPalette />)

    await act(async () => {
      useCommandPaletteStore.getState().open()
    })

    // The palette should now show a text input for searching commands
    expect(
      await screen.findByPlaceholderText(/type a command/i)
    ).toBeInTheDocument()
  })
})

// =============================================================================

describe('Smoke 7.9 — Settings dialog', () => {
  it('SettingsDialog renders when showSettings is set to true', async () => {
    await navigateToEditor()

    await act(async () => {
      useUIStore.getState().setShowSettings(true)
    })

    // SettingsDialog renders a "Settings" label in its left nav panel.
    // The component does not use role="dialog" — query by the visible label.
    expect(await screen.findByText(/^Settings$/)).toBeInTheDocument()
  })
})

// =============================================================================

describe('Smoke 7.10 — Export dialog', () => {
  it('ExportDialog renders when showExport is set to true', async () => {
    await navigateToEditor()

    await act(async () => {
      useUIStore.getState().setShowExport(true)
    })

    // ExportDialog renders an <h2>Export Video</h2> header.
    // The component does not use role="dialog" — query by heading text.
    expect(
      await screen.findByRole('heading', { name: /export video/i })
    ).toBeInTheDocument()
  })
})
