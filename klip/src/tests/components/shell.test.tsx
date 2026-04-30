/**
 * Phase 3 §3.2–3.4, §3.6, §3.10, §3.20
 *
 * §3.2  Sidebar / SidebarTab
 * §3.3  ErrorBoundary
 * §3.4  WelcomeScreen
 * §3.6  TitleBar
 * §3.10 TopToolbar
 * §3.20 Toaster
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useProjectStore }  from '@/stores/projectStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { useToastStore }    from '@/stores/toastStore'

// Heavy children mocked so Sidebar tests don't need the full MediaBin / MusicLibrary
vi.mock('@/components/MediaBin/MediaBin',    () => ({ default: () => <div data-testid="media-bin" /> }))
vi.mock('@/components/MediaBin/MusicLibrary', () => ({ default: () => <div data-testid="music-library" /> }))
vi.mock('@/lib/projectIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/projectIO')>()
  return {
    ...actual,
    openProject:  vi.fn().mockResolvedValue(undefined),
    saveProject:  vi.fn().mockResolvedValue(true),
    saveProjectAs: vi.fn().mockResolvedValue(true),
  }
})

// =============================================================================
// §3.2  Sidebar / SidebarTab
// =============================================================================

describe('3.2 Sidebar', () => {
  it('Media tab is active by default and shows MediaBin', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    render(<Sidebar />)

    expect(screen.getByRole('button', { name: /media/i })).toBeInTheDocument()
    expect(screen.getByTestId('media-bin')).toBeInTheDocument()
    expect(screen.queryByTestId('music-library')).not.toBeInTheDocument()
  })

  it('Media tab button has data-help="import-drag-drop"', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /media/i })).toHaveAttribute('data-help', 'import-drag-drop')
  })

  it('Music tab button has data-tutorial="music-tab" and data-help="music-library"', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    render(<Sidebar />)
    const musicBtn = screen.getByRole('button', { name: /music/i })
    expect(musicBtn).toHaveAttribute('data-tutorial', 'music-tab')
    expect(musicBtn).toHaveAttribute('data-help', 'music-library')
  })

  it('clicking Music tab shows MusicLibrary and hides MediaBin', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    const user = userEvent.setup()
    render(<Sidebar />)

    await user.click(screen.getByRole('button', { name: /music/i }))

    expect(screen.getByTestId('music-library')).toBeInTheDocument()
    expect(screen.queryByTestId('media-bin')).not.toBeInTheDocument()
  })

  it('clicking Music then back to Media shows MediaBin again', async () => {
    const { default: Sidebar } = await import('@/components/Layout/Sidebar')
    const user = userEvent.setup()
    render(<Sidebar />)

    await user.click(screen.getByRole('button', { name: /music/i }))
    await user.click(screen.getByRole('button', { name: /media/i }))

    expect(screen.getByTestId('media-bin')).toBeInTheDocument()
  })
})

// =============================================================================
// §3.3  ErrorBoundary
// =============================================================================

const Crasher = (): never => { throw new Error('Test crash') }

describe('3.3 ErrorBoundary', () => {
  it('renders children normally when no error', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    render(<ErrorBoundary><span>safe content</span></ErrorBoundary>)
    expect(screen.getByText('safe content')).toBeInTheDocument()
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument()
  })

  it('shows crash UI when a child throws', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    render(<ErrorBoundary><Crasher /></ErrorBoundary>)
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('shows "Reload Klip" button in crash UI', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    render(<ErrorBoundary><Crasher /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: /reload klip/i })).toBeInTheDocument()
  })

  it('shows Copy button in crash UI', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    render(<ErrorBoundary><Crasher /></ErrorBoundary>)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('Copy button shows "Copied!" feedback after click', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    const user = userEvent.setup()
    render(<ErrorBoundary><Crasher /></ErrorBoundary>)

    await user.click(screen.getByRole('button', { name: /copy/i }))

    // After clicking, the button shows "Copied!" (state toggled in handleCopy)
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('error message is visible in the pre block', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    render(<ErrorBoundary><Crasher /></ErrorBoundary>)
    expect(screen.getByText(/Test crash/)).toBeInTheDocument()
  })
})

// =============================================================================
// §3.4  WelcomeScreen
// =============================================================================

describe('3.4 WelcomeScreen', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projectName: null,
      projectPath: null,
      hasUnsavedChanges: false,
    })
    vi.mocked(window.api.project.getRecent).mockResolvedValue([])
  })

  it('renders the Klip logo img (not SVG)', async () => {
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    render(<WelcomeScreen />)
    const logo = screen.getByAltText('Klip')
    expect(logo.tagName).toBe('IMG')
    expect(logo.closest('svg')).toBeNull()
  })

  it('renders "New Project" and "Open Project" buttons', async () => {
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    render(<WelcomeScreen />)
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open project/i })).toBeInTheDocument()
  })

  it('calls window.api.project.getRecent on mount', async () => {
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    render(<WelcomeScreen />)
    expect(window.api.project.getRecent).toHaveBeenCalledOnce()
  })

  it('shows "No recent projects" when getRecent returns empty array', async () => {
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    render(<WelcomeScreen />)
    expect(await screen.findByText(/no recent projects/i)).toBeInTheDocument()
  })

  it('shows recent project names when getRecent resolves with entries', async () => {
    vi.mocked(window.api.project.getRecent).mockResolvedValueOnce([
      { name: 'Holiday Video', path: '/projects/holiday.klip', lastEditedAt: new Date().toISOString() }
    ])
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    render(<WelcomeScreen />)
    expect(await screen.findByText('Holiday Video')).toBeInTheDocument()
  })

  it('clicking "New Project" calls newProject and transitions to editor view', async () => {
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    const user = userEvent.setup()
    render(<WelcomeScreen />)

    await user.click(screen.getByRole('button', { name: /new project/i }))

    // appStore view should be 'editor'
    const { useAppStore } = await import('@/stores/appStore')
    expect(useAppStore.getState().view).toBe('editor')
  })

  it('clicking "Open Project" calls openProject', async () => {
    const { openProject } = await import('@/lib/projectIO')
    const { default: WelcomeScreen } = await import('@/components/WelcomeScreen/WelcomeScreen')
    const user = userEvent.setup()
    render(<WelcomeScreen />)

    await user.click(screen.getByRole('button', { name: /open project/i }))

    expect(openProject).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// §3.6  TitleBar
// =============================================================================

describe('3.6 TitleBar', () => {
  beforeEach(() => {
    useProjectStore.setState({ projectName: null, hasUnsavedChanges: false })
  })

  it('renders logo img with alt="Klip"', async () => {
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    const logo = screen.getByAltText('Klip')
    expect(logo.tagName).toBe('IMG')
  })

  it('has Minimize, Maximize, and Close buttons', async () => {
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximize')).toBeInTheDocument()
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('clicking Minimize calls window.api.window.minimize', async () => {
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    const user = userEvent.setup()
    render(<TitleBar />)

    await user.click(screen.getByLabelText('Minimize'))

    expect(window.api.window.minimize).toHaveBeenCalledOnce()
  })

  it('clicking Close calls window.api.window.close', async () => {
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    const user = userEvent.setup()
    render(<TitleBar />)

    await user.click(screen.getByLabelText('Close'))

    expect(window.api.window.close).toHaveBeenCalledOnce()
  })

  it('shows project name when set in projectStore', async () => {
    useProjectStore.setState({ projectName: 'My Edit' })
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    expect(screen.getByText(/my edit/i)).toBeInTheDocument()
  })

  it('shows unsaved dot (●) when hasUnsavedChanges is true', async () => {
    useProjectStore.setState({ projectName: 'My Edit', hasUnsavedChanges: true })
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    expect(screen.getByText('●')).toBeInTheDocument()
  })

  it('does not show unsaved dot when hasUnsavedChanges is false', async () => {
    useProjectStore.setState({ projectName: 'My Edit', hasUnsavedChanges: false })
    const { default: TitleBar } = await import('@/components/TitleBar/TitleBar')
    render(<TitleBar />)
    expect(screen.queryByText('●')).not.toBeInTheDocument()
  })
})

// =============================================================================
// §3.10 TopToolbar
// =============================================================================

describe('3.10 TopToolbar', () => {
  const defaultProps = {
    onExportClick:         vi.fn(),
    onAddTextClip:         vi.fn(),
    onSettingsClick:       vi.fn(),
    onProjectSettingsClick: vi.fn(),
    onHelpClick:           vi.fn(),
    onWhatsThisClick:      vi.fn(),
    whatsThisActive:       false,
  }

  beforeEach(() => {
    useProjectStore.setState({ settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' } })
  })

  it('renders an Export button', async () => {
    const { default: TopToolbar } = await import('@/components/Layout/TopToolbar')
    render(<TopToolbar {...defaultProps} />)
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
  })

  it('clicking Export calls onExportClick', async () => {
    const { default: TopToolbar } = await import('@/components/Layout/TopToolbar')
    const user = userEvent.setup()
    const onExportClick = vi.fn()
    render(<TopToolbar {...defaultProps} onExportClick={onExportClick} />)

    await user.click(screen.getByRole('button', { name: /^export$/i }))

    expect(onExportClick).toHaveBeenCalledOnce()
  })

  it('clicking Undo button calls useTimelineStore.undo', async () => {
    const undo = vi.fn()
    // past must be non-empty so the button is enabled
    useTimelineStore.setState({ undo, past: [useTimelineStore.getState() as never] })
    const { default: TopToolbar } = await import('@/components/Layout/TopToolbar')
    const { container } = render(<TopToolbar {...defaultProps} />)

    // ToolBtn wraps the button in a Tooltip <span> — no accessible name.
    // Find by data-help; Undo is the first button with data-help="undo-redo".
    const undoBtn = container.querySelectorAll('[data-help="undo-redo"]')[0] as HTMLElement
    undoBtn.click()

    expect(undo).toHaveBeenCalledOnce()
  })

  it('clicking Redo button calls useTimelineStore.redo', async () => {
    const redo = vi.fn()
    // future must be non-empty so the button is enabled
    useTimelineStore.setState({ redo, future: [useTimelineStore.getState() as never] })
    const { default: TopToolbar } = await import('@/components/Layout/TopToolbar')
    const { container } = render(<TopToolbar {...defaultProps} />)

    // Redo is the second button with data-help="undo-redo"
    const redoBtn = container.querySelectorAll('[data-help="undo-redo"]')[1] as HTMLElement
    redoBtn.click()

    expect(redo).toHaveBeenCalledOnce()
  })

  it('shows resolution and fps badge from projectStore settings', async () => {
    useProjectStore.setState({ settings: { resolution: '1440p', frameRate: 30, aspectRatio: '16:9' } })
    const { default: TopToolbar } = await import('@/components/Layout/TopToolbar')
    render(<TopToolbar {...defaultProps} />)
    // The badge shows "1440p · 30 fps"
    expect(screen.getByText(/1440p/)).toBeInTheDocument()
    expect(screen.getByText(/30 fps/)).toBeInTheDocument()
  })
})

// =============================================================================
// §3.20 Toaster
// =============================================================================

describe('3.20 Toaster', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when there are no toasts', async () => {
    const { default: Toaster } = await import('@/components/ui/Toaster')
    render(<Toaster />)
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it('renders a toast message when pushed', async () => {
    const { default: Toaster } = await import('@/components/ui/Toaster')
    render(<Toaster />)

    act(() => { useToastStore.getState().push('File saved', 'success') })

    expect(screen.getByText('File saved')).toBeInTheDocument()
  })

  it('renders multiple toasts (up to 3)', async () => {
    const { default: Toaster } = await import('@/components/ui/Toaster')
    render(<Toaster />)

    act(() => {
      useToastStore.getState().push('Toast A', 'info')
      useToastStore.getState().push('Toast B', 'info')
      useToastStore.getState().push('Toast C', 'success')
    })

    // All three are within the 3-toast limit
    expect(screen.getByText('Toast A')).toBeInTheDocument()
    expect(screen.getByText('Toast B')).toBeInTheDocument()
    expect(screen.getByText('Toast C')).toBeInTheDocument()
  })

  it('clicking dismiss removes a toast from the store', async () => {
    const { default: Toaster } = await import('@/components/ui/Toaster')
    const user = userEvent.setup()
    render(<Toaster />)

    act(() => { useToastStore.getState().push('Deletable toast', 'warning') })

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText('Deletable toast')).not.toBeInTheDocument()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('auto-dismisses after duration elapses', async () => {
    vi.useFakeTimers()
    const { default: Toaster } = await import('@/components/ui/Toaster')
    render(<Toaster />)

    act(() => { useToastStore.getState().push('Auto gone', 'info', 2000) })

    expect(screen.getByText('Auto gone')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(2001) })

    expect(screen.queryByText('Auto gone')).not.toBeInTheDocument()
  })

  it('a toast with type="error" is still rendered as a toast item', async () => {
    const { default: Toaster } = await import('@/components/ui/Toaster')
    render(<Toaster />)

    act(() => { useToastStore.getState().push('Export failed', 'error') })

    expect(screen.getByText('Export failed')).toBeInTheDocument()
  })
})
