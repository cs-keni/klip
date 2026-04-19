/**
 * Phase 12 — Accessibility tests
 *
 * §12.1  axe automated scans (jest-axe)
 * §12.2  Focus management
 * §12.3  Keyboard navigation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import React from 'react'

// axe rules that are meaningless in jsdom (no real CSS vars / page-level structure)
const AXE_OPTIONS = {
  rules: {
    'color-contrast':        { enabled: false },
    'landmark-one-main':     { enabled: false },
    'region':                { enabled: false },
    'page-has-heading-one':  { enabled: false },
  }
}

vi.mock('@/lib/projectIO', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/projectIO')>()
  return {
    ...actual,
    saveProject:   vi.fn().mockResolvedValue(true),
    saveProjectAs: vi.fn().mockResolvedValue(true),
    openProject:   vi.fn().mockResolvedValue(undefined),
  }
})

// =============================================================================
// §12.1  axe automated scans
// =============================================================================

describe('12.1 axe automated scans', () => {

  it('WelcomeScreen has no axe violations', async () => {
    const { default: WelcomeScreen } = await import(
      '@/components/WelcomeScreen/WelcomeScreen'
    )
    const { container } = render(<WelcomeScreen />)
    const results = await axe(container, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('ExportDialog has no axe violations', async () => {
    const { default: ExportDialog } = await import(
      '@/components/Export/ExportDialog'
    )
    render(<ExportDialog onClose={vi.fn()} />)
    const results = await axe(document.body, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('SettingsDialog has no axe violations', async () => {
    const { default: SettingsDialog } = await import(
      '@/components/Settings/SettingsDialog'
    )
    render(<SettingsDialog onClose={vi.fn()} />)
    const results = await axe(document.body, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('CommandPalette has no axe violations when open', async () => {
    const { useCommandPaletteStore } = await import('@/stores/commandPaletteStore')
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    const results = await axe(document.body, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('ErrorBoundary fallback UI has no axe violations', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    const Boom = (): JSX.Element => { throw new Error('test crash') }
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    const results = await axe(container, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('ClipCard has no axe violations', async () => {
    const { default: ClipCard } = await import(
      '@/components/MediaBin/ClipCard'
    )
    const clip = {
      id: 'c1', name: 'test.mp4', type: 'video' as const,
      path: '/tmp/test.mp4', duration: 5, width: 1920, height: 1080,
      fps: 30, size: 1024, thumbnailUrl: null, proxyPath: null,
    }
    const { container } = render(
      <ClipCard
        clip={clip}
        isSelected={false}
        isRenaming={false}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        onRenameCommit={vi.fn()}
        onRenameCancel={vi.fn()}
      />
    )
    const results = await axe(container, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('TutorialOverlay has no axe violations when active', async () => {
    const { useAppSettingsStore } = await import('@/stores/appSettingsStore')
    // Force hasSeenWalkthrough=false so overlay shows
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
    const { default: TutorialOverlay } = await import(
      '@/components/Tutorial/TutorialOverlay'
    )
    render(<TutorialOverlay />)
    const results = await axe(document.body, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })

  it('TopToolbar has no axe violations', async () => {
    const { default: TopToolbar } = await import(
      '@/components/Layout/TopToolbar'
    )
    const { container } = render(
      <TopToolbar
        onExportClick={vi.fn()}
        onAddTextClip={vi.fn()}
        onSettingsClick={vi.fn()}
        onProjectSettingsClick={vi.fn()}
        onHelpClick={vi.fn()}
        onWhatsThisClick={vi.fn()}
        whatsThisActive={false}
      />
    )
    const results = await axe(container, AXE_OPTIONS)
    expect(results).toHaveNoViolations()
  })
})

// =============================================================================
// §12.2  Focus management
// =============================================================================

describe('12.2 Focus management', () => {

  it('CommandPalette auto-focuses search input on open', async () => {
    vi.useFakeTimers()
    const { useCommandPaletteStore } = await import('@/stores/commandPaletteStore')
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    act(() => { vi.advanceTimersByTime(100) })
    const input = screen.getByPlaceholderText(/type a command/i)
    expect(document.activeElement).toBe(input)
    vi.useRealTimers()
  })

  it('CommandPalette closes on Escape key', async () => {
    const { useCommandPaletteStore } = await import('@/stores/commandPaletteStore')
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText(/type a command/i)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('SettingsDialog close button is accessible via keyboard', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { default: SettingsDialog } = await import(
      '@/components/Settings/SettingsDialog'
    )
    render(<SettingsDialog onClose={onClose} />)
    const closeBtn = screen.getByLabelText(/close settings/i)
    closeBtn.focus()
    await user.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ExportDialog close button is accessible via keyboard', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { default: ExportDialog } = await import(
      '@/components/Export/ExportDialog'
    )
    render(<ExportDialog onClose={onClose} />)
    const closeBtn = screen.getByLabelText(/close export dialog/i)
    closeBtn.focus()
    await user.keyboard('{Enter}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('TutorialOverlay Skip button is focusable and activatable', async () => {
    const user = userEvent.setup()
    const { useAppSettingsStore } = await import('@/stores/appSettingsStore')
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
    const { default: TutorialOverlay } = await import(
      '@/components/Tutorial/TutorialOverlay'
    )
    render(<TutorialOverlay />)
    const skipBtn = screen.getAllByRole('button', { name: /skip/i })[0]
    expect(skipBtn).toBeDefined()
    skipBtn.focus()
    expect(document.activeElement).toBe(skipBtn)
    await user.keyboard('{Enter}')
    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
  })

  it('ErrorBoundary Reload button is focusable', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    const Boom = (): JSX.Element => { throw new Error('crash') }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    const reloadBtn = screen.getByRole('button', { name: /reload klip/i })
    reloadBtn.focus()
    expect(document.activeElement).toBe(reloadBtn)
  })
})

// =============================================================================
// §12.3  Keyboard navigation
// =============================================================================

describe('12.3 Keyboard navigation', () => {

  it('TopToolbar buttons are keyboard-accessible (have aria-label)', async () => {
    const { default: TopToolbar } = await import(
      '@/components/Layout/TopToolbar'
    )
    render(
      <TopToolbar
        onExportClick={vi.fn()}
        onAddTextClip={vi.fn()}
        onSettingsClick={vi.fn()}
        onProjectSettingsClick={vi.fn()}
        onHelpClick={vi.fn()}
        onWhatsThisClick={vi.fn()}
        whatsThisActive={false}
      />
    )
    const undoBtn = screen.getByRole('button', { name: /undo/i })
    const redoBtn = screen.getByRole('button', { name: /redo/i })
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(undoBtn).toBeInTheDocument()
    expect(redoBtn).toBeInTheDocument()
    expect(saveBtn).toBeInTheDocument()
  })

  it('CommandPalette ArrowDown/ArrowUp moves selection', async () => {
    const { useCommandPaletteStore } = await import('@/stores/commandPaletteStore')
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText(/type a command/i)
    // Move down twice, then up once
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // The active item should have data-active="true"
    const activeItem = document.querySelector('[data-active="true"]')
    expect(activeItem).toBeInTheDocument()
  })

  it('CommandPalette Enter executes the active command and closes', async () => {
    const { useCommandPaletteStore } = await import('@/stores/commandPaletteStore')
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText(/type a command/i)
    // Type to narrow to a single predictable command
    fireEvent.change(input, { target: { value: 'Undo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Palette should have closed
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('"What\'s This?" button has aria-pressed reflecting active state', async () => {
    const { default: TopToolbar } = await import(
      '@/components/Layout/TopToolbar'
    )
    const { rerender } = render(
      <TopToolbar
        onExportClick={vi.fn()}
        onAddTextClip={vi.fn()}
        onSettingsClick={vi.fn()}
        onProjectSettingsClick={vi.fn()}
        onHelpClick={vi.fn()}
        onWhatsThisClick={vi.fn()}
        whatsThisActive={false}
      />
    )
    const btn = screen.getByRole('button', { name: /what's this/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <TopToolbar
        onExportClick={vi.fn()}
        onAddTextClip={vi.fn()}
        onSettingsClick={vi.fn()}
        onProjectSettingsClick={vi.fn()}
        onHelpClick={vi.fn()}
        onWhatsThisClick={vi.fn()}
        whatsThisActive={true}
      />
    )
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('ClipContextMenu items are buttons with accessible roles', async () => {
    const { default: ClipContextMenu } = await import(
      '@/components/MediaBin/ClipContextMenu'
    )
    const clip = {
      id: 'c1', name: 'test.mp4', type: 'video' as const,
      path: '/tmp/test.mp4', duration: 5, width: 1920, height: 1080,
      fps: 30, size: 1024, thumbnailUrl: null, proxyPath: null,
      proxyStatus: undefined, isMissing: false,
    }
    render(
      <ClipContextMenu
        clip={clip as never}
        x={100}
        y={100}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        onReveal={vi.fn()}
        onRelink={vi.fn()}
      />
    )
    const buttons = document.body.querySelectorAll('button, [role="menuitem"]')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('TutorialOverlay Next and Back buttons are keyboard-activatable', async () => {
    const user = userEvent.setup()
    const { useAppSettingsStore } = await import('@/stores/appSettingsStore')
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
    const { default: TutorialOverlay } = await import(
      '@/components/Tutorial/TutorialOverlay'
    )
    render(<TutorialOverlay />)
    const nextBtn = screen.getByRole('button', { name: /next/i })
    nextBtn.focus()
    expect(document.activeElement).toBe(nextBtn)
    await user.keyboard('{Enter}')
    // After advancing, a Back button appears
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })
})
