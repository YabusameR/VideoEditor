import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SubtitleSegmentItem } from '@/types/timeline'

const mocks = vi.hoisted(() => ({ updateItem: vi.fn() }))

vi.mock('@/features/editor/deps/timeline-store', () => ({
  useTimelineStore: (selector: (state: { updateItem: typeof mocks.updateItem }) => unknown) =>
    selector({ updateItem: mocks.updateItem }),
}))

import { SubtitleAnimationSection } from './subtitle-animation-section'

function makeSegment(
  id: string,
  cueAnimation?: SubtitleSegmentItem['cueAnimation'],
): SubtitleSegmentItem {
  return {
    id,
    type: 'subtitle',
    trackId: 'captions',
    from: 0,
    durationInFrames: 300,
    label: 'Transcript',
    source: { type: 'transcript', mediaId: 'm', clipId: 'c' },
    cues: [],
    color: '#ffffff',
    cueAnimation,
  }
}

function group(name: RegExp) {
  return screen.getByRole('group', { name })
}

describe('SubtitleAnimationSection', () => {
  beforeEach(() => mocks.updateItem.mockClear())

  it('sets the entrance animation on every selected subtitle item', () => {
    render(<SubtitleAnimationSection items={[makeSegment('a'), makeSegment('b')]} />)
    const appear = group(/^appear$/i)
    fireEvent.click(appear.querySelectorAll('button')[2]!)

    expect(mocks.updateItem.mock.calls).toEqual([
      ['a', { cueAnimation: { in: 'pop' } }],
      ['b', { cueAnimation: { in: 'pop' } }],
    ])
  })

  it('clears the animation when both directions are set to none', () => {
    render(<SubtitleAnimationSection items={[makeSegment('a', { in: 'fade' })]} />)
    fireEvent.click(group(/^appear$/i).querySelectorAll('button')[0]!)

    expect(mocks.updateItem).toHaveBeenCalledWith('a', { cueAnimation: undefined })
  })

  it('marks the current choice and disables speed without an animation', () => {
    render(<SubtitleAnimationSection items={[makeSegment('a', { out: 'shrink' })]} />)
    const disappear = group(/disappear/i)
    expect(disappear.querySelector('[aria-pressed="true"]')?.textContent).toMatch(/shrink/i)
    expect(group(/speed/i).querySelector('button')?.disabled).toBe(false)
  })
})
