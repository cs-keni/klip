/**
 * Phase 1 — Unit: static data modules (§1.3, §1.7, §1.8)
 *
 * tutorialSteps.ts  — structure / ordering / content invariants
 * utils.ts          — cn() class merger
 * helpContent.ts    — help entry completeness + lookup
 *
 * No DOM, no stores, no IPC.
 */
import { describe, it, expect } from 'vitest'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import type { TutorialStep } from '@/lib/tutorialSteps'
import { cn } from '@/lib/utils'
import { HELP_ENTRIES, HELP_BY_ID } from '@/lib/helpContent'

// =============================================================================
// 1.3 tutorialSteps
// =============================================================================

describe('TUTORIAL_STEPS — structure', () => {
  it('has exactly 7 steps', () => {
    expect(TUTORIAL_STEPS).toHaveLength(7)
  })

  it('every step has a unique id', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every step has a non-empty title', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('every step has a non-empty body string', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.body.trim().length).toBeGreaterThan(0)
    }
  })

  it('every non-null target is a non-empty CSS selector / data-tutorial value', () => {
    for (const step of TUTORIAL_STEPS) {
      if (step.target !== null) {
        expect(step.target.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('first step ("welcome") has target: null (centred dialog, no spotlight)', () => {
    expect(TUTORIAL_STEPS[0].id).toBe('welcome')
    expect(TUTORIAL_STEPS[0].target).toBeNull()
  })

  it('step at index 4 ("shortcuts") has target: null', () => {
    expect(TUTORIAL_STEPS[4].id).toBe('shortcuts')
    expect(TUTORIAL_STEPS[4].target).toBeNull()
  })

  it('every defined placement is one of the valid values', () => {
    const valid = new Set(['top', 'bottom', 'left', 'right', 'auto'])
    for (const step of TUTORIAL_STEPS) {
      if (step.placement !== undefined) {
        expect(valid.has(step.placement)).toBe(true)
      }
    }
  })

  it('step order matches: welcome → import → media-bin → timeline → shortcuts → music → export', () => {
    const expectedIds = ['welcome', 'import', 'media-bin', 'timeline', 'shortcuts', 'music', 'export']
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(expectedIds)
  })

  it('no step has both target: null and a non-null directional placement', () => {
    // A centred dialog has no element to place the callout relative to —
    // combining target: null with a directional placement would be meaningless.
    const directional = new Set(['top', 'bottom', 'left', 'right'])
    for (const step of TUTORIAL_STEPS) {
      if (step.target === null) {
        expect(directional.has(step.placement as string)).toBe(false)
      }
    }
  })

  it('steps that have a target also have a placement defined', () => {
    // Each spotlight step should declare a preferred callout direction.
    for (const step of TUTORIAL_STEPS) {
      if (step.target !== null) {
        expect(step.placement).toBeDefined()
      }
    }
  })
})

// =============================================================================
// 1.7 utils.ts — cn() class merger
// =============================================================================

describe('cn — Tailwind class merger', () => {
  it('empty call returns ""', () => {
    expect(cn()).toBe('')
  })

  it('single class passes through unchanged', () => {
    expect(cn('p-4')).toBe('p-4')
  })

  it('merges multiple classes into a single string', () => {
    const result = cn('flex', 'items-center', 'gap-2')
    expect(result).toContain('flex')
    expect(result).toContain('items-center')
    expect(result).toContain('gap-2')
  })

  it('handles undefined values without including them', () => {
    expect(cn('p-4', undefined)).toBe('p-4')
  })

  it('handles null values without including them', () => {
    expect(cn('p-4', null)).toBe('p-4')
  })

  it('handles false values without including them', () => {
    expect(cn('p-4', false)).toBe('p-4')
  })

  it('resolves Tailwind conflicts — later padding wins (p-4 then p-2 → p-2)', () => {
    const result = cn('p-4', 'p-2')
    expect(result).toContain('p-2')
    expect(result).not.toContain('p-4')
  })

  it('conditional object syntax works', () => {
    const active = true
    const result = cn('base', { 'is-active': active, 'is-disabled': false })
    expect(result).toContain('is-active')
    expect(result).not.toContain('is-disabled')
  })

  it('array of classes works', () => {
    const result = cn(['flex', 'gap-2'])
    expect(result).toContain('flex')
    expect(result).toContain('gap-2')
  })
})

// =============================================================================
// 1.8 helpContent.ts
// =============================================================================

describe('HELP_ENTRIES — structure', () => {
  it('has at least 10 entries (guard against accidental deletion)', () => {
    expect(HELP_ENTRIES.length).toBeGreaterThanOrEqual(10)
  })

  it('every entry has a non-empty title', () => {
    for (const entry of HELP_ENTRIES) {
      expect(entry.title.trim().length).toBeGreaterThan(0)
    }
  })

  it('every entry has a non-empty description', () => {
    for (const entry of HELP_ENTRIES) {
      expect(entry.description.trim().length).toBeGreaterThan(0)
    }
  })

  it('every entry has a valid category', () => {
    const valid = new Set(['importing', 'timeline', 'playback', 'effects', 'audio', 'export', 'general'])
    for (const entry of HELP_ENTRIES) {
      expect(valid.has(entry.category)).toBe(true)
    }
  })

  it('no duplicate ids exist', () => {
    const ids = HELP_ENTRIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every entry that declares a shortcut has at least one non-empty shortcut string', () => {
    for (const entry of HELP_ENTRIES) {
      if (entry.shortcut !== undefined) {
        expect(Array.isArray(entry.shortcut)).toBe(true)
        expect(entry.shortcut.length).toBeGreaterThan(0)
        for (const s of entry.shortcut) {
          expect(s.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('entries are present for the 7 core help categories', () => {
    const categories = new Set(HELP_ENTRIES.map((e) => e.category))
    for (const cat of ['importing', 'timeline', 'playback', 'effects', 'audio', 'export', 'general']) {
      expect(categories.has(cat as never)).toBe(true)
    }
  })
})

describe('HELP_BY_ID — lookup map', () => {
  it('HELP_BY_ID is built from all HELP_ENTRIES (same count)', () => {
    expect(Object.keys(HELP_BY_ID).length).toBe(HELP_ENTRIES.length)
  })

  it('getHelpEntry(known key) returns the correct entry', () => {
    const entry = HELP_BY_ID['split-clip']
    expect(entry).toBeDefined()
    expect(entry.title).toBe('Split Clip')
  })

  it('HELP_BY_ID["import-drag-drop"] is the drag-drop import entry', () => {
    const entry = HELP_BY_ID['import-drag-drop']
    expect(entry).toBeDefined()
    expect(entry.category).toBe('importing')
  })

  it('unknown key returns undefined (not a crash)', () => {
    expect(HELP_BY_ID['nonexistent-key']).toBeUndefined()
  })

  it('every key in HELP_BY_ID matches its entry id', () => {
    for (const [key, entry] of Object.entries(HELP_BY_ID)) {
      expect(entry.id).toBe(key)
    }
  })
})
