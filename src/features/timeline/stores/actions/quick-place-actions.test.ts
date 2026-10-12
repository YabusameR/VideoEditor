// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { TimelineItem } from '@/types/timeline'

const mocks = vi.hoisted(() => ({
  mediaById: {} as Record<string, unknown>,
}))

vi.mock('@/features/timeline/deps/media-library-store', () => ({
  useMediaLibraryStore: {
    getState: () => ({ mediaById: mocks.mediaById }),
  },
}))

vi.mock('@/features/timeline/deps/projects', () => ({
  useProjectStore: {
    getState: () => ({
      currentProject: { metadata: { width: 1080, height: 1920, fps: 30 } },
    }),
  },
}))

vi.mock('@/features/timeline/deps/media-library-service', () => ({
  importMediaLibraryService: async () => ({
    mediaLibraryService: {
      getThumbnailBlobUrl: async () => null,
    },
  }),
}))

vi.mock('@/features/timeline/deps/media-library-resolver', () => ({
  getMediaType: (mimeType: string) =>
    mimeType.startsWith('video')
      ? 'video'
      : mimeType.startsWith('audio')
        ? 'audio'
        : mimeType.startsWith('image')
          ? 'image'
          : 'unknown',
  resolveMediaUrl: async () => 'blob:media',
}))

import { makeTimelineAudioItem, makeTimelineTrack } from '../../test-helpers'
import { resetPlaybackPreviewState } from '@/shared/state/playback-preview-test-helpers'
import { useSelectionStore } from '@/shared/state/selection'
import { usePlaybackStore } from '@/shared/state/playback'
import { useItemsStore } from '../items-store'
import { useTransitionsStore } from '../transitions-store'
import { useTimelineCommandStore } from '../timeline-command-store'
import { useTimelineSettingsStore } from '../timeline-settings-store'
import { appendMediaToTimeline, placeAudioAtPlayhead } from './quick-place-actions'

function setMedia(entries: Record<string, Record<string, unknown>>) {
  mocks.mediaById = Object.fromEntries(
    Object.entries(entries).map(([id, overrides]) => [
      id,
      { id, fileName: `${id}.mp4`, fps: 30, width: 1080, height: 1920, ...overrides },
    ]),
  )
}

function trackItems(trackId: string): TimelineItem[] {
  return useItemsStore
    .getState()
    .items.filter((item) => item.trackId === trackId)
    .sort((a, b) => a.from - b.from)
}

describe('quick place actions', () => {
  beforeEach(() => {
    useTimelineCommandStore.getState().clearHistory()
    useTimelineSettingsStore.setState({ fps: 30, isDirty: false })
    useItemsStore
      .getState()
      .setTracks([
        makeTimelineTrack({ id: 'track-v1', name: 'V1', kind: 'video', order: 0 }),
        makeTimelineTrack({ id: 'track-a1', name: 'A1', kind: 'audio', order: 1 }),
      ])
    useItemsStore.getState().setItems([])
    useTransitionsStore.getState().setTransitions([])
    useSelectionStore.getState().setActiveTrack(null)
    resetPlaybackPreviewState(0)
  })

  describe('appendMediaToTimeline', () => {
    it('lays clips end to end in the given order and links video audio', async () => {
      setMedia({
        first: { mimeType: 'video/mp4', duration: 2, audioCodec: 'aac' },
        photo: { mimeType: 'image/png', duration: 0, fileName: 'photo.png' },
        second: { mimeType: 'video/mp4', duration: 1, audioCodec: undefined },
      })

      const count = await appendMediaToTimeline(['first', 'photo', 'second'])

      expect(count).toBe(3)
      const video = trackItems('track-v1')
      expect(video.map((item) => [item.mediaId, item.from, item.durationInFrames])).toEqual([
        ['first', 0, 60],
        ['photo', 60, 90],
        ['second', 150, 30],
      ])
      const audio = trackItems('track-a1')
      expect(audio).toHaveLength(1)
      expect(audio[0]).toMatchObject({ mediaId: 'first', from: 0, durationInFrames: 60 })
      expect(audio[0]?.linkedGroupId).toBe(video[0]?.linkedGroupId)
      expect(useTimelineSettingsStore.getState().isDirty).toBe(true)
    })

    it('appends after what is already on the timeline and is undoable as one step', async () => {
      setMedia({ clip: { mimeType: 'video/mp4', duration: 1 } })
      await appendMediaToTimeline(['clip'])
      await appendMediaToTimeline(['clip'])

      expect(trackItems('track-v1').map((item) => item.from)).toEqual([0, 30])

      useTimelineCommandStore.getState().undo()
      expect(trackItems('track-v1')).toHaveLength(1)
    })

    it('skips audio-only and unknown media', async () => {
      setMedia({
        song: { mimeType: 'audio/mpeg', duration: 10 },
        doc: { mimeType: 'application/pdf', duration: 0 },
      })

      expect(await appendMediaToTimeline(['song', 'doc'])).toBe(0)
      expect(useItemsStore.getState().items).toHaveLength(0)
    })
  })

  describe('placeAudioAtPlayhead', () => {
    it('drops the sound on a free audio track at the exact playhead frame', async () => {
      setMedia({ pop: { mimeType: 'audio/wav', duration: 0.5, fileName: 'sfx-pop.wav' } })
      usePlaybackStore.setState({ currentFrame: 45 })

      expect(await placeAudioAtPlayhead('pop')).toBe(true)

      expect(trackItems('track-a1')).toEqual([
        expect.objectContaining({ mediaId: 'pop', from: 45, durationInFrames: 15 }),
      ])
    })

    it('creates a new audio track instead of shifting the sound when tracks are busy', async () => {
      setMedia({ pop: { mimeType: 'audio/wav', duration: 0.5 } })
      useItemsStore
        .getState()
        .setItems([
          makeTimelineAudioItem({
            id: 'dialog',
            trackId: 'track-a1',
            from: 0,
            durationInFrames: 300,
          }),
        ])
      usePlaybackStore.setState({ currentFrame: 100 })

      await placeAudioAtPlayhead('pop')

      const { tracks, items } = useItemsStore.getState()
      expect(tracks).toHaveLength(3)
      const placed = items.find((item) => item.mediaId === 'pop')
      expect(placed?.from).toBe(100)
      expect(placed?.trackId).not.toBe('track-a1')
    })

    it('refuses non-audio media', async () => {
      setMedia({ clip: { mimeType: 'video/mp4', duration: 1 } })
      expect(await placeAudioAtPlayhead('clip')).toBe(false)
      expect(useItemsStore.getState().items).toHaveLength(0)
    })
  })
})
