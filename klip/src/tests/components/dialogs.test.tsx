/**
 * Phase 3 §3.12–3.14, §3.17
 *
 * §3.12 ExportDialog
 * §3.13 SourceClipViewer
 * §3.14 WhatThisOverlay
 * §3.17 SettingsDialog + ProjectSettingsModal
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useProjectStore }      from '@/stores/projectStore'
import { useAppSettingsStore }  from '@/stores/appSettingsStore'
import { useTimelineStore }     from '@/stores/timelineStore'
import { useMediaStore }        from '@/stores/mediaStore'
import { useSourceViewerStore } from '@/stores/sourceViewerStore'
import { useUIStore }           from '@/stores/uiStore'
import type { MediaClip }       from '@/types/media'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Find the first button that wraps an X (close) icon. */
function findXButton(): HTMLElement | null {
  const svg = document.body.querySelector('svg.lucide-x')
  return (svg?.closest('button') as HTMLElement) ?? null
}

function makeMediaClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id: 'clip-1', type: 'video', path: '/test.mp4', name: 'Test',
    duration: 60, width: 1920, height: 1080, fps: 30,
    fileSize: 1000, thumbnail: null, thumbnailStatus: 'idle',
    isOnTimeline: false, isMissing: false, addedAt: 1000,
    proxyStatus: 'none', proxyProgress: 0, proxyPath: null,
    ...overrides
  }
}

// =============================================================================
// §3.12 ExportDialog
// =============================================================================

describe('3.12 ExportDialog', () => {
  beforeEach(() => {
    useTimelineStore.setState({ tracks: [], clips: [] })
    useMediaStore.setState({ clips: [], selectedClipId: null })
  })

  it('renders without crashing', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('Export Video')).toBeInTheDocument()
  })

  it('shows the 5 export presets', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByText('YouTube 1080p60')).toBeInTheDocument()
    expect(screen.getByText('YouTube 1440p60')).toBeInTheDocument()
    expect(screen.getByText('YouTube 4K')).toBeInTheDocument()
    expect(screen.getByText('YouTube 1080p30')).toBeInTheDocument()
    expect(screen.getByText(/preview.*draft/i)).toBeInTheDocument()
  })

  it('clicking the close (X) button calls onClose', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    const onClose = vi.fn()
    render(<ExportDialog onClose={onClose} />)

    const xBtn = findXButton()
    expect(xBtn).not.toBeNull()
    xBtn!.click()

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders a filename input with default value "my-edit"', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('my-edit')).toBeInTheDocument()
  })

  it('clicking "Browse" calls window.api.export.pickOutputFolder', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    const user = userEvent.setup()
    render(<ExportDialog onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /browse/i }))

    expect(window.api.export.pickOutputFolder).toHaveBeenCalledOnce()
  })

  it('subscribes to export progress/done/error events on mount', async () => {
    const { default: ExportDialog } = await import('@/components/Export/ExportDialog')
    render(<ExportDialog onClose={vi.fn()} />)
    expect(window.api.export.onProgress).toHaveBeenCalledOnce()
    expect(window.api.export.onDone).toHaveBeenCalledOnce()
    expect(window.api.export.onError).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// §3.13 SourceClipViewer
// =============================================================================

describe('3.13 SourceClipViewer', () => {
  beforeEach(() => {
    useSourceViewerStore.setState({ isOpen: false, clip: null, inPoints: {}, outPoints: {} })
    useMediaStore.setState({ clips: [], selectedClipId: null })
  })

  it('renders nothing when isOpen is false', async () => {
    const { default: SourceClipViewer } = await import('@/components/MediaBin/SourceClipViewer')
    const { container } = render(<SourceClipViewer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the clip viewer when isOpen is true and clip is set', async () => {
    const clip = makeMediaClip({ id: 'sv-clip', name: 'Source Video' })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })
    useSourceViewerStore.setState({ isOpen: true, clip, inPoints: {}, outPoints: {} })

    const { default: SourceClipViewer } = await import('@/components/MediaBin/SourceClipViewer')
    render(<SourceClipViewer />)

    // The viewer shows "Source Clip Viewer" label
    expect(screen.getByText(/source clip viewer/i)).toBeInTheDocument()
  })

  it('shows the clip name in the header', async () => {
    const clip = makeMediaClip({ id: 'sv-clip2', name: 'My Cool Clip' })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })
    useSourceViewerStore.setState({ isOpen: true, clip, inPoints: {}, outPoints: {} })

    const { default: SourceClipViewer } = await import('@/components/MediaBin/SourceClipViewer')
    render(<SourceClipViewer />)

    expect(screen.getByText('My Cool Clip')).toBeInTheDocument()
  })

  it('returns null when isOpen is true but clip is null', async () => {
    useSourceViewerStore.setState({ isOpen: true, clip: null, inPoints: {}, outPoints: {} })
    const { default: SourceClipViewer } = await import('@/components/MediaBin/SourceClipViewer')
    const { container } = render(<SourceClipViewer />)
    expect(container.firstChild).toBeNull()
  })

  it('clicking the X button calls closeViewer on the store', async () => {
    const clip = makeMediaClip({ id: 'sv-3', name: 'Close Test' })
    useMediaStore.setState({ clips: [clip], selectedClipId: null })
    useSourceViewerStore.setState({ isOpen: true, clip, inPoints: {}, outPoints: {} })

    const { default: SourceClipViewer } = await import('@/components/MediaBin/SourceClipViewer')
    render(<SourceClipViewer />)

    const xBtn = findXButton()
    expect(xBtn).not.toBeNull()
    xBtn!.click()

    expect(useSourceViewerStore.getState().isOpen).toBe(false)
  })
})

// =============================================================================
// §3.14 WhatThisOverlay
// =============================================================================

describe('3.14 WhatThisOverlay', () => {
  beforeEach(() => {
    useUIStore.setState({ whatsThisMode: false })
  })

  it('renders nothing when whatsThisMode is false', async () => {
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)
    expect(screen.queryByText(/what's this\?/i)).not.toBeInTheDocument()
  })

  it('renders the mode badge when whatsThisMode is true', async () => {
    useUIStore.setState({ whatsThisMode: true })
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)
    expect(screen.getByText(/what's this\?/i)).toBeInTheDocument()
  })

  it('sets document.body cursor to "help" when active', async () => {
    useUIStore.setState({ whatsThisMode: true })
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)
    expect(document.body.style.cursor).toBe('help')
  })

  it('clears document.body cursor when whatsThisMode becomes false', async () => {
    useUIStore.setState({ whatsThisMode: true })
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)

    act(() => { useUIStore.setState({ whatsThisMode: false }) })

    expect(document.body.style.cursor).toBe('')
  })

  it('pressing Escape sets whatsThisMode to false', async () => {
    useUIStore.setState({ whatsThisMode: true })
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(useUIStore.getState().whatsThisMode).toBe(false)
  })

  it('badge hint text mentions pressing Esc to exit', async () => {
    useUIStore.setState({ whatsThisMode: true })
    const { default: WhatThisOverlay } = await import('@/components/Help/WhatThisOverlay')
    render(<WhatThisOverlay />)
    expect(screen.getByText(/esc to exit/i)).toBeInTheDocument()
  })
})

// =============================================================================
// §3.17 SettingsDialog
// =============================================================================

describe('3.17 SettingsDialog', () => {
  beforeEach(() => {
    useProjectStore.setState({
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
    })
    useAppSettingsStore.setState({
      defaultExportFolder: null, snapByDefault: true,
      musicLibraryFolder: null, hasSeenWalkthrough: false,
    })
  })

  it('renders settings UI via portal (screen finds "Settings" label)', async () => {
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    render(<SettingsDialog onClose={vi.fn()} />)
    // SettingsDialog renders to document.body via createPortal
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows all 6 tab buttons', async () => {
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    render(<SettingsDialog onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^app$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shortcuts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^help$/i })).toBeInTheDocument()
  })

  it('clicking the X button calls onClose', async () => {
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)

    const xBtn = findXButton()
    expect(xBtn).not.toBeNull()
    xBtn!.click()

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('switching to App tab calls window.api.settings.proxyCacheInfo', async () => {
    // proxyCacheInfo is loaded inside AppTab's useEffect
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    const user = userEvent.setup()
    render(<SettingsDialog onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /^app$/i }))

    expect(window.api.settings.proxyCacheInfo).toHaveBeenCalled()
  })

  it('switching to Shortcuts tab shows "Playback" section heading', async () => {
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    const user = userEvent.setup()
    render(<SettingsDialog onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /shortcuts/i }))

    expect(screen.getByText('Playback')).toBeInTheDocument()
  })

  it('clicking backdrop (absolute inset-0 div) calls onClose', async () => {
    const { default: SettingsDialog } = await import('@/components/Settings/SettingsDialog')
    const onClose = vi.fn()
    render(<SettingsDialog onClose={onClose} />)

    // The backdrop is the absolute inset-0 div with onClick={onClose}
    const backdrop = document.body.querySelector('.absolute.inset-0') as HTMLElement | null
    if (backdrop) fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// §3.17 ProjectSettingsModal
// =============================================================================

describe('3.17 ProjectSettingsModal', () => {
  beforeEach(() => {
    useProjectStore.setState({
      settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' }
    })
  })

  it('renders nothing when open is false', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    const { container } = render(<ProjectSettingsModal open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal content when open is true (via portal)', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    render(<ProjectSettingsModal open onClose={vi.fn()} />)
    // Portal renders to document.body; screen queries cover it
    expect(screen.getByText('Resolution')).toBeInTheDocument()
  })

  it('shows resolution options (1080p, 1440p, 4K)', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    render(<ProjectSettingsModal open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1080p' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1440p' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4K' })).toBeInTheDocument()
  })

  it('shows frame rate options (24, 30, 60)', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    render(<ProjectSettingsModal open onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '24 fps' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 fps' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '60 fps' })).toBeInTheDocument()
  })

  it('clicking a resolution button calls updateSettings', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    const updateSettings = vi.fn()
    useProjectStore.setState({ updateSettings })
    const user = userEvent.setup()
    render(<ProjectSettingsModal open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '1440p' }))

    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ resolution: '1440p' }))
  })

  it('pressing Escape calls onClose', async () => {
    const { default: ProjectSettingsModal } = await import(
      '@/components/Settings/ProjectSettingsModal'
    )
    const onClose = vi.fn()
    render(<ProjectSettingsModal open onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })
})
