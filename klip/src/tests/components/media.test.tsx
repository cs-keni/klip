/**
 * Phase 3 §3.9, §3.18, §3.19
 *
 * §3.9  ClipCard + ClipContextMenu
 * §3.18 ColorClipDialog
 * §3.19 MusicLibrary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useProjectStore } from '@/stores/projectStore'
import { useMusicStore }   from '@/stores/musicStore'
import type { MediaClip }  from '@/types/media'

// mediaUtils needs processMediaFile mocked for MusicLibrary import tests
vi.mock('@/lib/mediaUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mediaUtils')>()
  return { ...actual, processMediaFile: vi.fn().mockResolvedValue({ duration: 180 }) }
})

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeClip(overrides: Partial<MediaClip> = {}): MediaClip {
  return {
    id:              'clip-1',
    type:            'video',
    path:            '/test/clip.mp4',
    name:            'Test Clip',
    duration:        60,
    width:           1920,
    height:          1080,
    fps:             30,
    fileSize:        100_000,
    thumbnail:       null,
    thumbnailStatus: 'idle',
    isOnTimeline:    false,
    isMissing:       false,
    addedAt:         1000,
    proxyStatus:     'none',
    proxyProgress:   0,
    proxyPath:       null,
    ...overrides,
  }
}

// =============================================================================
// §3.9  ClipCard
// =============================================================================

describe('3.9 ClipCard', () => {
  const defaultCardProps = {
    isSelected:       false,
    isRenaming:       false,
    onClick:          vi.fn(),
    onDoubleClick:    vi.fn(),
    onContextMenu:    vi.fn(),
    onRenameCommit:   vi.fn(),
    onRenameCancel:   vi.fn(),
  }

  beforeEach(() => {
    useProjectStore.setState({ settings: { resolution: '1080p', frameRate: 60, aspectRatio: '16:9' } })
  })

  it('renders the clip name', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    render(<ClipCard {...defaultCardProps} clip={makeClip({ name: 'My Footage' })} />)
    expect(screen.getByText('My Footage')).toBeInTheDocument()
  })

  it('is draggable when not renaming', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    const { container } = render(<ClipCard {...defaultCardProps} clip={makeClip()} />)
    const draggable = container.querySelector('[draggable="true"]')
    expect(draggable).not.toBeNull()
  })

  it('is not draggable when renaming', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    const { container } = render(
      <ClipCard {...defaultCardProps} clip={makeClip()} isRenaming />
    )
    const draggable = container.querySelector('[draggable="true"]')
    expect(draggable).toBeNull()
  })

  it('calls onClick when clicked', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ClipCard {...defaultCardProps} clip={makeClip()} onClick={onClick} />)

    await user.click(screen.getByText('Test Clip'))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows rename input when isRenaming is true', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    render(<ClipCard {...defaultCardProps} clip={makeClip()} isRenaming />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onRenameCommit with trimmed value on Enter', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    const onRenameCommit = vi.fn()
    render(
      <ClipCard
        {...defaultCardProps}
        clip={makeClip({ name: 'Old Name' })}
        isRenaming
        onRenameCommit={onRenameCommit}
      />
    )

    const input = screen.getByRole('textbox')
    // Use fireEvent for reliable controlled-input interaction
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameCommit).toHaveBeenCalledWith('New Name')
  })

  it('calls onRenameCancel on Escape', async () => {
    const { default: ClipCard } = await import('@/components/MediaBin/ClipCard')
    const onRenameCancel = vi.fn()
    render(
      <ClipCard {...defaultCardProps} clip={makeClip()} isRenaming onRenameCancel={onRenameCancel} />
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onRenameCancel).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// §3.9  ClipContextMenu
// =============================================================================

describe('3.9 ClipContextMenu', () => {
  const defaultMenuProps = {
    x:                100,
    y:                100,
    onClose:          vi.fn(),
    onRename:         vi.fn(),
    onRemove:         vi.fn(),
    onReveal:         vi.fn(),
    onRelink:         vi.fn(),
    onGenerateProxy:  vi.fn(),
    onCancelProxy:    vi.fn(),
  }

  it('renders Rename and Remove from Project options', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    render(<ClipContextMenu {...defaultMenuProps} clip={makeClip()} />)
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText(/remove from project/i)).toBeInTheDocument()
  })

  it('shows "Reveal in Explorer" for non-missing, non-color clips', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    render(<ClipContextMenu {...defaultMenuProps} clip={makeClip({ type: 'video', isMissing: false })} />)
    expect(screen.getByText(/reveal in explorer/i)).toBeInTheDocument()
  })

  it('shows "Relink Media" option for missing clips', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    render(<ClipContextMenu {...defaultMenuProps} clip={makeClip({ isMissing: true })} />)
    expect(screen.getByText(/relink media/i)).toBeInTheDocument()
  })

  it('does not show "Reveal in Explorer" for missing clips', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    render(<ClipContextMenu {...defaultMenuProps} clip={makeClip({ isMissing: true })} />)
    expect(screen.queryByText(/reveal in explorer/i)).not.toBeInTheDocument()
  })

  it('calls onRename and onClose when Rename is clicked', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    const onRename = vi.fn()
    const onClose  = vi.fn()
    const user = userEvent.setup()
    render(
      <ClipContextMenu
        {...defaultMenuProps}
        clip={makeClip()}
        onRename={onRename}
        onClose={onClose}
      />
    )

    await user.click(screen.getByText('Rename'))

    expect(onRename).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ClipContextMenu {...defaultMenuProps} clip={makeClip()} onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "Generate Proxy" for non-missing video clips without proxy', async () => {
    const { default: ClipContextMenu } = await import('@/components/MediaBin/ClipContextMenu')
    render(
      <ClipContextMenu
        {...defaultMenuProps}
        clip={makeClip({ type: 'video', isMissing: false, proxyStatus: 'none' })}
      />
    )
    expect(screen.getByText('Generate Proxy')).toBeInTheDocument()
  })
})

// =============================================================================
// §3.18 ColorClipDialog
// =============================================================================

describe('3.18 ColorClipDialog', () => {
  it('renders when open is true', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    render(<ColorClipDialog open onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.getByText(/solid color clip/i)).toBeInTheDocument()
  })

  it('renders nothing (no dialog header) when open is false', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    render(<ColorClipDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryByText(/solid color clip/i)).not.toBeInTheDocument()
  })

  it('clicking Cancel calls onClose', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ColorClipDialog open onClose={onClose} onCreate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking "Create Clip" calls onCreate with name, color, and duration', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    const onCreate = vi.fn()
    const user = userEvent.setup()
    render(<ColorClipDialog open onClose={vi.fn()} onCreate={onCreate} />)

    await user.click(screen.getByRole('button', { name: /create clip/i }))

    expect(onCreate).toHaveBeenCalledOnce()
    const [name, color, duration] = onCreate.mock.calls[0]
    expect(typeof name).toBe('string')
    expect(color).toMatch(/^#/)
    expect(typeof duration).toBe('number')
  })

  it('clicking a preset color updates the selected color', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    const user = userEvent.setup()
    render(<ColorClipDialog open onClose={vi.fn()} onCreate={vi.fn()} />)

    // Click the "White" preset (#ffffff)
    await user.click(screen.getByTitle('White'))

    // The clip name input should auto-update to "White"
    const nameInput = screen.getByPlaceholderText(/e\.g\. black intro/i) as HTMLInputElement
    expect(nameInput.value).toBe('White')
  })

  it('pressing Escape on the dialog calls onClose', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    const onClose = vi.fn()
    render(<ColorClipDialog open onClose={onClose} onCreate={vi.fn()} />)

    // The onKeyDown is on the dialog motion.div; fire on name input which is inside it
    const nameInput = screen.getByPlaceholderText(/e\.g\. black intro/i)
    fireEvent.keyDown(nameInput, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('"Create Clip" button is disabled when clip name is empty', async () => {
    const { default: ColorClipDialog } = await import('@/components/MediaBin/ColorClipDialog')
    const user = userEvent.setup()
    render(<ColorClipDialog open onClose={vi.fn()} onCreate={vi.fn()} />)

    const nameInput = screen.getByPlaceholderText(/e\.g\. black intro/i)
    await user.clear(nameInput)

    expect(screen.getByRole('button', { name: /create clip/i })).toBeDisabled()
  })
})

// =============================================================================
// §3.19 MusicLibrary
// =============================================================================

describe('3.19 MusicLibrary', () => {
  beforeEach(() => {
    useMusicStore.setState({ tracks: [], searchQuery: '' })
  })

  it('shows empty state when there are no tracks', async () => {
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    render(<MusicLibrary />)
    expect(screen.getByText(/no music yet/i)).toBeInTheDocument()
  })

  it('shows "Add Music" button in the empty state', async () => {
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    render(<MusicLibrary />)
    // Two "Add Music" buttons: one in header ("Add"), one in EmptyState ("Add Music")
    expect(screen.getByRole('button', { name: /add music/i })).toBeInTheDocument()
  })

  it('renders track titles when tracks are present in the store', async () => {
    useMusicStore.setState({
      tracks: [
        { id: 't1', title: 'Chill Beats', artist: 'Artist A', duration: 180, filePath: '/a.mp3', tags: [], addedAt: 1000 },
        { id: 't2', title: 'Upbeat Track', artist: 'Artist B', duration: 120, filePath: '/b.mp3', tags: [], addedAt: 2000 },
      ],
      searchQuery: ''
    })
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    render(<MusicLibrary />)
    expect(screen.getByText('Chill Beats')).toBeInTheDocument()
    expect(screen.getByText('Upbeat Track')).toBeInTheDocument()
  })

  it('filters tracks based on searchQuery in the store', async () => {
    useMusicStore.setState({
      tracks: [
        { id: 't1', title: 'Chill Beats', artist: 'Artist A', duration: 180, filePath: '/a.mp3', tags: [], addedAt: 1000 },
        { id: 't2', title: 'Upbeat Track', artist: 'Artist B', duration: 120, filePath: '/b.mp3', tags: [], addedAt: 2000 },
      ],
      searchQuery: 'chill'
    })
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    render(<MusicLibrary />)
    expect(screen.getByText('Chill Beats')).toBeInTheDocument()
    expect(screen.queryByText('Upbeat Track')).not.toBeInTheDocument()
  })

  it('search input updates the store searchQuery when typed into', async () => {
    useMusicStore.setState({
      tracks: [
        { id: 't1', title: 'Chill Beats', artist: 'Artist A', duration: 180, filePath: '/a.mp3', tags: [], addedAt: 1000 },
      ],
      searchQuery: ''
    })
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    const user = userEvent.setup()
    render(<MusicLibrary />)

    // Search input is only visible when tracks.length > 0; placeholder matches "Search title…"
    const searchInput = screen.getByPlaceholderText(/search title/i)
    await user.type(searchInput, 'jazz')

    expect(useMusicStore.getState().searchQuery).toBe('jazz')
  })

  it('remove button calls removeTrack for the corresponding track', async () => {
    useMusicStore.setState({
      tracks: [
        { id: 't1', title: 'Delete Me', artist: 'X', duration: 60, filePath: '/x.mp3', tags: [], addedAt: 1000 }
      ],
      searchQuery: ''
    })
    const { default: MusicLibrary } = await import('@/components/MediaBin/MusicLibrary')
    const { container } = render(<MusicLibrary />)

    // Remove button has title accessible via its Tooltip content or aria-label.
    // Find any button containing Trash2 icon (data approach) or click by position.
    // The remove button is the last icon button in the track row actions.
    const allButtons = container.querySelectorAll('button')
    // Buttons in a track row: play, tags, add-to-timeline, remove
    // Remove is last within the row actions
    const removeBtn = Array.from(allButtons).find((btn) =>
      btn.closest('.group\\/row') !== null &&
      btn !== allButtons[0] // skip play button at index 0
    )
    if (removeBtn) {
      // Fire the remove by clicking the last action button
      const actionButtons = Array.from(
        container.querySelectorAll('.group\\/row button')
      )
      const lastActionBtn = actionButtons[actionButtons.length - 1] as HTMLElement
      lastActionBtn.click()
    }

    expect(useMusicStore.getState().tracks).toHaveLength(0)
  })
})
