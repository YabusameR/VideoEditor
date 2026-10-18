import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SubtitleSegmentItem } from '@/types/timeline'

const mocks = vi.hoisted(() => ({
  updateItem: vi.fn(),
  locked: false,
  itemById: {} as Record<string, unknown>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.number !== undefined ? `${key}:${options.number}` : key,
  }),
}))
vi.mock('../../contexts/timeline-zoom-context', () => ({
  useTimelineContentPixelsPerSecond: () => 100,
}))
vi.mock('../../stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: { updateItem: typeof mocks.updateItem }) => unknown) =>
    selector({ updateItem: mocks.updateItem }),
}))
vi.mock('../../stores/items-store', () => ({
  useItemsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ tracks: [{ id: 'captions', locked: mocks.locked }], itemById: mocks.itemById }),
}))

import { SubtitleCueStrip } from './subtitle-cue-strip'

const segment: SubtitleSegmentItem = {
  id: 'seg',
  type: 'subtitle',
  trackId: 'captions',
  from: 0,
  durationInFrames: 120,
  label: 'Transcript',
  source: { type: 'transcript', mediaId: 'm', clipId: 'c' },
  color: '#fff',
  cues: [
    { id: 'a', startSeconds: 0, endSeconds: 1, text: 'こんにちは' },
    { id: 'b', startSeconds: 1, endSeconds: 2, text: '世界' },
    { id: 'c', startSeconds: 3, endSeconds: 4, text: 'またね' },
  ],
}

describe('SubtitleCueStrip', () => {
  beforeEach(() => {
    mocks.updateItem.mockClear()
    mocks.locked = false
    mocks.itemById = {}
  })

  it('shows each cue and a handle only where cues touch', () => {
    render(<SubtitleCueStrip item={segment} />)

    expect(screen.getByTitle('こんにちは')).toBeInTheDocument()
    expect(screen.getByTitle('またね')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('drags the shared boundary and commits once on release', () => {
    render(<SubtitleCueStrip item={segment} />)
    const handle = screen.getByRole('button', { name: 'timeline.subtitleStrip.moveBoundary:1' })

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 })
    expect(mocks.updateItem).not.toHaveBeenCalled()
    fireEvent.pointerUp(handle, { clientX: 150, pointerId: 1 })

    expect(mocks.updateItem).toHaveBeenCalledTimes(1)
    const { cues } = mocks.updateItem.mock.calls[0]![1] as Pick<SubtitleSegmentItem, 'cues'>
    expect(cues[0]?.endSeconds).toBeCloseTo(1.5)
    expect(cues[1]?.startSeconds).toBeCloseTo(1.5)
    expect(cues[2]).toEqual(segment.cues[2])
  })

  it('does not offer handles on a locked track', () => {
    mocks.locked = true
    render(<SubtitleCueStrip item={segment} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows the stored cues even when the item prop is stale', () => {
    // The clip shell does not re-render on cue-only edits; the store is the truth.
    mocks.itemById = {
      seg: { ...segment, cues: [{ id: 'z', startSeconds: 0, endSeconds: 1, text: '更新後' }] },
    }
    render(<SubtitleCueStrip item={segment} />)

    expect(screen.getByTitle('更新後')).toBeInTheDocument()
    expect(screen.queryByTitle('こんにちは')).toBeNull()
  })
})
