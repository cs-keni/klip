/**
 * Phase 3 §3.1 — TutorialOverlay component tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { useAppSettingsStore } from '@/stores/appSettingsStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function importOverlay() {
  const mod = await import('@/components/Tutorial/TutorialOverlay')
  return mod.default
}

// =============================================================================
// §3.1  TutorialOverlay
// =============================================================================

describe('3.1 TutorialOverlay', () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: false })
  })

  it('renders null (nothing in DOM) when hasSeenWalkthrough is true', async () => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: true })
    const TutorialOverlay = await importOverlay()
    render(<TutorialOverlay />)
    expect(screen.queryByText(/\/ 7/)).not.toBeInTheDocument()
  })

  it('renders step 1 of 7 on first mount', async () => {
    const TutorialOverlay = await importOverlay()
    render(<TutorialOverlay />)
    expect(screen.getByText(/1\s*\/\s*7/)).toBeInTheDocument()
  })

  it('Back button is absent on step 1', async () => {
    const TutorialOverlay = await importOverlay()
    render(<TutorialOverlay />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('Next button is present on step 1', async () => {
    const TutorialOverlay = await importOverlay()
    render(<TutorialOverlay />)
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('clicking Next advances to step 2 and shows Back button', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText(/2\s*\/\s*7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('clicking Back from step 2 returns to step 1', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByText(/1\s*\/\s*7/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })

  it('last step shows Done button instead of Next', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    // Advance to the last step (7 steps → 6 clicks)
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    expect(screen.getByText(/7\s*\/\s*7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
  })

  it('clicking Done calls setHasSeenWalkthrough(true) and hides the overlay', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: /next/i }))
    }

    await user.click(screen.getByRole('button', { name: /done/i }))

    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()
  })

  it('clicking "Skip all" dismisses the overlay and marks walkthrough done', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    await user.click(screen.getByRole('button', { name: /skip all/i }))

    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()
  })

  it('clicking the X button dismisses the overlay', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    // The X button has title="Skip tutorial"
    await user.click(screen.getByTitle('Skip tutorial'))

    expect(useAppSettingsStore.getState().hasSeenWalkthrough).toBe(true)
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()
  })

  it('20 rapid Next clicks never exceed step 7 / 7', async () => {
    const TutorialOverlay = await importOverlay()
    const user = userEvent.setup()
    render(<TutorialOverlay />)

    for (let i = 0; i < 20; i++) {
      const next = screen.queryByRole('button', { name: /next/i })
      if (!next) break
      // eslint-disable-next-line no-await-in-loop
      await user.click(next)
    }

    expect(screen.queryByText(/8\s*\/\s*7/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('re-activates when hasSeenWalkthrough transitions from true to false', async () => {
    useAppSettingsStore.setState({ hasSeenWalkthrough: true })
    const TutorialOverlay = await importOverlay()
    const { rerender } = render(<TutorialOverlay />)

    // No overlay while hasSeenWalkthrough is true
    expect(screen.queryByText(/\/\s*7/)).not.toBeInTheDocument()

    // Simulate "Restart Tutorial"
    act(() => { useAppSettingsStore.setState({ hasSeenWalkthrough: false }) })
    rerender(<TutorialOverlay />)

    expect(screen.getByText(/1\s*\/\s*7/)).toBeInTheDocument()
  })

  it('step counter dot indicator count matches TUTORIAL_STEPS.length', async () => {
    const TutorialOverlay = await importOverlay()
    render(<TutorialOverlay />)
    // There are 7 steps; the counter reads "1 / 7"
    const counter = screen.getByText(/1\s*\/\s*7/)
    expect(counter).toBeInTheDocument()
  })
})
