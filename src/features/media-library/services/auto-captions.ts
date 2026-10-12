/**
 * Auto captions for the whole timeline (shorts wizard "テロップ" step):
 * transcribe every clip's source once, then place the transcript as separate
 * caption items on their own caption track, where they can be selected,
 * restyled, moved and trimmed independently of the clips.
 */

import type { MediaTranscriptModel } from '@/types/storage'
import type { TimelineItem } from '@/types/timeline'
import { useTimelineStore } from '@/features/media-library/deps/timeline-stores'
import type { CaptionTextItemTemplate } from '../utils/caption-items'
import { mediaTranscriptionService } from './media-transcription-service'
import { runMediaTranscriptionJob } from './media-transcription-runner'

/** Shorter audio clips (sound effects) are not worth transcribing. */
const MIN_AUDIO_SECONDS_TO_CAPTION = 5

export interface AutoCaptionResult {
  captionedMediaCount: number
  failedMediaCount: number
}

/** Clips to caption, grouped by source media: video clips, plus standalone longer audio. */
function collectCaptionTargets(): Map<string, string[]> {
  const { items, fps } = useTimelineStore.getState()
  const targets = new Map<string, string[]>()
  const videoMediaIds = new Set(
    items.flatMap((item) => (item.type === 'video' && item.mediaId ? [item.mediaId] : [])),
  )

  for (const item of items) {
    if (!item.mediaId) continue
    const isVideo = item.type === 'video'
    const isLongStandaloneAudio =
      item.type === 'audio' &&
      !videoMediaIds.has(item.mediaId) &&
      item.durationInFrames / fps >= MIN_AUDIO_SECONDS_TO_CAPTION
    if (!isVideo && !isLongStandaloneAudio) continue

    const clipIds = targets.get(item.mediaId) ?? []
    clipIds.push(item.id)
    targets.set(item.mediaId, clipIds)
  }
  return targets
}

/**
 * Clip-attached ("virtual") transcript captions render on top of the separate
 * caption items, and the timeline auto-enables them as soon as a transcript
 * exists. Switch them off for this media so captions show exactly once.
 */
function disableClipAttachedCaptions(mediaId: string): void {
  const { items, updateItem } = useTimelineStore.getState()
  for (const item of items) {
    if (
      (item.type === 'video' || item.type === 'audio') &&
      item.mediaId === mediaId &&
      item.transcriptCaptions?.enabled
    ) {
      updateItem(item.id, {
        transcriptCaptions: { ...item.transcriptCaptions, enabled: false, updatedAt: Date.now() },
      } as Partial<TimelineItem>)
    }
  }
}

export async function generateTimelineCaptions(options: {
  model: MediaTranscriptModel
  language?: string
  /** Style for brand-new captions, e.g. a font that has Japanese glyphs. */
  defaultStyle?: Partial<CaptionTextItemTemplate>
}): Promise<AutoCaptionResult> {
  const targets = collectCaptionTargets()
  let captionedMediaCount = 0
  let failedMediaCount = 0

  // Sequential on purpose: transcription workers are memory-heavy.
  for (const [mediaId, clipIds] of targets) {
    try {
      const existing = await mediaTranscriptionService.getTranscript(mediaId)
      if (!existing || existing.model !== options.model) {
        const result = await runMediaTranscriptionJob(mediaId, {
          model: options.model,
          language: options.language,
        })
        if (result.status === 'cancelled') continue
      }
      await mediaTranscriptionService.insertTranscriptAsCaptions(mediaId, {
        clipIds,
        replaceExisting: true,
        defaultStyle: options.defaultStyle,
      })
      disableClipAttachedCaptions(mediaId)
      captionedMediaCount += 1
    } catch {
      failedMediaCount += 1
    }
  }

  return { captionedMediaCount, failedMediaCount }
}

/** Number of distinct sources `generateTimelineCaptions` would transcribe. */
export function countCaptionTargets(): number {
  return collectCaptionTargets().size
}
