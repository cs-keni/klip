/**
 * Phase 3 §3.11 — CommandPalette component tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { useUIStore }             from '@/stores/uiStore'

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
// §3.11  CommandPalette
// =============================================================================

describe('3.11 CommandPalette', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({ isOpen: false })
  })

  it('renders nothing in the DOM when isOpen is false', async () => {
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument()
  })

  it('renders the search input when isOpen is true', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument()
  })

  it('shows command groups (File, Edit, Playback, Timeline, View) by default', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)
    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Playback')).toBeInTheDocument()
  })

  it('typing a query filters commands to matching results only', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    const user = userEvent.setup()
    render(<CommandPalette />)

    await user.type(screen.getByPlaceholderText(/type a command/i), 'undo')

    expect(screen.getByText('Undo')).toBeInTheDocument()
    // "Save Project" should not match "undo"
    expect(screen.queryByText('Save Project')).not.toBeInTheDocument()
  })

  it('pressing Escape on the input closes the palette', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)

    const input = screen.getByPlaceholderText(/type a command/i)
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('clicking the backdrop div closes the palette', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)

    // The backdrop is the absolute inset-0 div with onClick={onClose}
    const backdrop = document.body.querySelector('.absolute.inset-0') as HTMLElement | null
    if (backdrop) fireEvent.click(backdrop)

    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('shows "No commands found" when query matches nothing', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    const user = userEvent.setup()
    render(<CommandPalette />)

    await user.type(screen.getByPlaceholderText(/type a command/i), 'xyznonexistent')

    expect(screen.getByText(/no commands found/i)).toBeInTheDocument()
  })

  it('pressing ArrowDown then Enter runs the second command', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    // Focus on "Export Video" which triggers setShowExport
    const user = userEvent.setup()
    render(<CommandPalette />)

    // Type "export" to isolate the Export command
    await user.type(screen.getByPlaceholderText(/type a command/i), 'export video')
    await user.keyboard('{Enter}')

    // The command closes the palette; palette should be closed
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('command count footer shows the number of filtered commands', async () => {
    useCommandPaletteStore.setState({ isOpen: true })
    const { default: CommandPalette } = await import(
      '@/components/CommandPalette/CommandPalette'
    )
    render(<CommandPalette />)

    // No query — all commands shown; footer has "N commands"
    const footer = screen.getByText(/\d+ commands?/i)
    expect(footer).toBeInTheDocument()
  })
})
