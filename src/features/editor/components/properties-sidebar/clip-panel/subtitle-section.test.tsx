import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SubtitleSegmentItem } from '@/types/timeline'

const mocks = vi.hoisted(() => ({ updateItem: vi.fn() }))

vi.mock('@/features/editor/deps/timeline-store', () => ({
  useTimelineStore: (
    selector: (state: { updateItem: typeof mocks.updateItem; fps: number }) => unknown,
  ) => selector({ updateItem: mocks.updateItem, fps: 30 }),
}))

vi.mock('./caption-style-controls', () => ({ CaptionStyleControls: () => null }))

// jsdom has no layout, so render every row instead of a measured window.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: 0 })),
    getTotalSize: () => 0,
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}))

import { SubtitleSection } from './subtitle-section'

function makeSegment(cues: SubtitleSegmentItem['cues']): SubtitleSegmentItem {
  return {
    id: 'seg',
    type: 'subtitle',
    trackId: 'captions',
    from: 0,
    durationInFrames: 300,
    label: 'Transcript',
    source: { type: 'transcript', mediaId: 'm', clipId: 'c' },
    cues,
    color: '#ffffff',
  }
}

function cueFields() {
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[]
}

describe('SubtitleSection cue editing', () => {
  beforeEach(() => mocks.updateItem.mockClear())

  it('splits a cue at the cursor with Shift+Enter', () => {
    render(
      <SubtitleSection
        items={[makeSegment([{ id: 'a', startSeconds: 0, endSeconds: 4, text: 'こんにちは世界' }])]}
      />,
    )
    const [field] = cueFields()
    field!.setSelectionRange(5, 5)
    fireEvent.keyDown(field!, { key: 'Enter', shiftKey: true })

    expect(mocks.updateItem).toHaveBeenCalledTimes(1)
    const { cues } = mocks.updateItem.mock.calls[0]![1] as Pick<SubtitleSegmentItem, 'cues'>
    expect(cues.map((cue) => cue.text)).toEqual(['こんにちは', '世界'])
  })

  it('does not split while an IME conversion is being confirmed', () => {
    render(
      <SubtitleSection
        items={[makeSegment([{ id: 'a', startSeconds: 0, endSeconds: 4, text: 'こんにちは世界' }])]}
      />,
    )
    const [field] = cueFields()
    field!.setSelectionRange(5, 5)
    fireEvent.keyDown(field!, { key: 'Enter', shiftKey: true, isComposing: true })

    expect(mocks.updateItem).not.toHaveBeenCalled()
  })

  it('joins a cue onto the previous one with Backspace at its start', () => {
    render(
      <SubtitleSection
        items={[
          makeSegment([
            { id: 'a', startSeconds: 0, endSeconds: 1, text: 'こんにちは' },
            { id: 'b', startSeconds: 1, endSeconds: 3, text: '世界' },
          ]),
        ]}
      />,
    )
    const second = cueFields()[1]!
    second.setSelectionRange(0, 0)
    fireEvent.keyDown(second, { key: 'Backspace' })

    const { cues } = mocks.updateItem.mock.calls[0]![1] as Pick<SubtitleSegmentItem, 'cues'>
    expect(cues).toEqual([{ id: 'a', startSeconds: 0, endSeconds: 3, text: 'こんにちは世界' }])
  })

  it('leaves Backspace alone when the cursor is not at the start', () => {
    render(
      <SubtitleSection
        items={[
          makeSegment([
            { id: 'a', startSeconds: 0, endSeconds: 1, text: 'one' },
            { id: 'b', startSeconds: 1, endSeconds: 3, text: 'two' },
          ]),
        ]}
      />,
    )
    const second = cueFields()[1]!
    second.setSelectionRange(2, 2)
    fireEvent.keyDown(second, { key: 'Backspace' })

    expect(mocks.updateItem).not.toHaveBeenCalled()
  })
})
