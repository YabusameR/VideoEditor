/**
 * Quick Place Actions - one-click placement used by the shorts wizard:
 * lay imported clips end to end, and drop a sound effect at the playhead.
 */

import type { TimelineItem, TimelineTrack } from '@/types/timeline'
import { useItemsStore } from '../items-store'
import { useTimelineSettingsStore } from '../timeline-settings-store'
import { usePlaybackStore } from '@/shared/state/playback'
import { useMediaLibraryStore } from '@/features/timeline/deps/media-library-store'
import { useProjectStore } from '@/features/timeline/deps/projects'
import { importMediaLibraryService } from '@/features/timeline/deps/media-library-service'
import { getMediaType, resolveMediaUrl } from '@/features/timeline/deps/media-library-resolver'
import { execute, applyTransitionRepairs } from './shared'
import { resolveSourceEditTrackTargets } from '../../utils/source-edit-targeting'
import { buildMediaTimelineItems } from '../../utils/media-timeline-item-builder'
import { createClassicTrack, getTrackKind } from '../../utils/classic-tracks'
import { findNearestAvailableSpace } from '../../utils/collision-utils'
import { DEFAULT_TRACK_HEIGHT } from '../../constants'
import { DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'

/** Still images are placed for this long when appended. */
const IMAGE_DURATION_SECONDS = 3

interface PreparedMedia {
  mediaId: string
  mediaType: 'video' | 'audio' | 'image' | 'lottie'
  hasAudio: boolean
  durationInFrames: number
  blobUrl: string
  thumbnailUrl: string | undefined
  media: {
    duration: number
    fps: number | undefined
    width: number | undefined
    height: number | undefined
    fileName: string
  }
}

async function prepareMedia(mediaId: string, projectFps: number): Promise<PreparedMedia | null> {
  const media = useMediaLibraryStore.getState().mediaById[mediaId]
  if (!media) return null
  const mediaType = getMediaType(media.mimeType)
  if (mediaType === 'unknown') return null

  const blobUrl = await resolveMediaUrl(mediaId)
  if (!blobUrl) return null
  const { mediaLibraryService } = await importMediaLibraryService()
  const thumbnailUrl = (await mediaLibraryService.getThumbnailBlobUrl(mediaId)) || undefined

  const durationInFrames =
    mediaType === 'image'
      ? projectFps * IMAGE_DURATION_SECONDS
      : Math.max(1, Math.round(media.duration * projectFps))

  return {
    mediaId,
    mediaType,
    hasAudio: mediaType === 'video' && !!media.audioCodec,
    durationInFrames,
    blobUrl,
    thumbnailUrl,
    media: {
      duration: media.duration,
      fps: media.fps,
      width: media.width,
      height: media.height,
      fileName: media.fileName,
    },
  }
}

function getCanvasSize() {
  const metadata = useProjectStore.getState().currentProject?.metadata
  return {
    canvasWidth: metadata?.width ?? DEFAULT_PROJECT_WIDTH,
    canvasHeight: metadata?.height ?? DEFAULT_PROJECT_HEIGHT,
  }
}

function getTrackEndFrame(items: TimelineItem[], trackIds: Array<string | undefined>): number {
  let end = 0
  for (const item of items) {
    if (trackIds.includes(item.trackId)) {
      end = Math.max(end, item.from + item.durationInFrames)
    }
  }
  return end
}

/**
 * Append visual media (video / image) to the end of the main video track in
 * the given order, keeping each video's audio linked on the audio track.
 * Audio-only files are skipped (they go in via the sound step).
 * Returns the number of clips placed.
 */
export async function appendMediaToTimeline(mediaIds: string[]): Promise<number> {
  const projectFps = useTimelineSettingsStore.getState().fps
  const prepared = (
    await Promise.all(mediaIds.map((mediaId) => prepareMedia(mediaId, projectFps)))
  ).filter(
    (entry): entry is PreparedMedia =>
      !!entry && (entry.mediaType === 'video' || entry.mediaType === 'image'),
  )
  if (prepared.length === 0) return 0

  const targets = resolveSourceEditTrackTargets({
    tracks: useItemsStore.getState().tracks,
    mediaType: 'video',
    hasAudio: prepared.some((entry) => entry.hasAudio),
    patchVideo: true,
    patchAudio: true,
    preferredTrackHeight: DEFAULT_TRACK_HEIGHT,
  })
  if (!targets?.videoTrackId) return 0
  const { videoTrackId, audioTrackId } = targets

  const { canvasWidth, canvasHeight } = getCanvasSize()
  let cursor = getTrackEndFrame(useItemsStore.getState().items, [videoTrackId, audioTrackId])
  const firstFrame = cursor
  const newItems: TimelineItem[] = []

  for (const entry of prepared) {
    const linkAudio = entry.hasAudio && !!audioTrackId
    newItems.push(
      ...buildMediaTimelineItems({
        media: entry.media,
        mediaId: entry.mediaId,
        mediaType: entry.mediaType,
        label: entry.media.fileName,
        projectFps,
        blobUrl: entry.blobUrl,
        thumbnailUrl: entry.thumbnailUrl,
        canvasWidth,
        canvasHeight,
        fallbackSourceFps: 30,
        placements: {
          primary: {
            trackId: videoTrackId,
            from: cursor,
            durationInFrames: entry.durationInFrames,
          },
          linkedAudio: linkAudio
            ? { trackId: audioTrackId, from: cursor, durationInFrames: entry.durationInFrames }
            : undefined,
        },
        linkVideoAudio: linkAudio,
        createLinkedGroupId: entry.hasAudio,
      }),
    )
    cursor += entry.durationInFrames
  }

  execute(
    'APPEND_MEDIA',
    () => {
      const store = useItemsStore.getState()
      store.setTracks(targets.tracks)
      for (const item of newItems) {
        store._addItem(item)
      }
      applyTransitionRepairs(newItems.map((item) => item.id))
      useTimelineSettingsStore.getState().markDirty()
    },
    { count: prepared.length, from: firstFrame },
  )

  usePlaybackStore.getState().setCurrentFrame(firstFrame)
  return prepared.length
}

/** An unlocked audio track that is free for `duration` frames starting at `frame`. */
function findFreeAudioTrack(
  tracks: TimelineTrack[],
  items: TimelineItem[],
  frame: number,
  duration: number,
): TimelineTrack | null {
  const audioTracks = tracks
    .filter((track) => !track.locked && !track.isGroup && getTrackKind(track) === 'audio')
    .sort((a, b) => a.order - b.order)
  return (
    audioTracks.find(
      (track) => findNearestAvailableSpace(frame, duration, track.id, items) === frame,
    ) ?? null
  )
}

/**
 * Place an audio file (sound effect) exactly at the playhead, on the first
 * audio track with room there, or on a new audio track below the others.
 */
export async function placeAudioAtPlayhead(mediaId: string): Promise<boolean> {
  const projectFps = useTimelineSettingsStore.getState().fps
  const entry = await prepareMedia(mediaId, projectFps)
  if (!entry || entry.mediaType !== 'audio') return false

  const frame = usePlaybackStore.getState().currentFrame
  const { tracks, items } = useItemsStore.getState()
  let nextTracks = tracks
  let track = findFreeAudioTrack(tracks, items, frame, entry.durationInFrames)
  if (!track) {
    const lastOrder = tracks.reduce((max, candidate) => Math.max(max, candidate.order), 0)
    track = createClassicTrack({ tracks, kind: 'audio', order: lastOrder + 1 })
    nextTracks = [...tracks, track]
  }
  const trackId = track.id

  const { canvasWidth, canvasHeight } = getCanvasSize()
  const newItems = buildMediaTimelineItems({
    media: entry.media,
    mediaId: entry.mediaId,
    mediaType: 'audio',
    label: entry.media.fileName,
    projectFps,
    blobUrl: entry.blobUrl,
    canvasWidth,
    canvasHeight,
    fallbackSourceFps: 30,
    placements: {
      primary: { trackId, from: frame, durationInFrames: entry.durationInFrames },
    },
  })

  execute(
    'PLACE_AUDIO_AT_PLAYHEAD',
    () => {
      const store = useItemsStore.getState()
      if (nextTracks !== tracks) store.setTracks(nextTracks)
      for (const item of newItems) {
        store._addItem(item)
      }
      useTimelineSettingsStore.getState().markDirty()
    },
    { trackId, from: frame },
  )
  return true
}
