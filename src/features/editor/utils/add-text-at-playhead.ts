import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import {
  createOverlayLayerTrack,
  createTextTemplateItem,
  getDefaultGeneratedLayerDurationInFrames,
} from '@/features/editor/deps/timeline-utils'
import { useProjectStore } from '@/features/editor/deps/projects'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_WIDTH } from '@/shared/projects/defaults'
import { TEXT_STYLE_PRESETS } from '@/shared/typography/text-style-presets'
import type { TextItem } from '@/types/timeline'

type TextStylePresetId = (typeof TEXT_STYLE_PRESETS)[number]['id']

/**
 * Add a text item on its own new layer at the playhead and select it — the
 * same result as dragging a text preset onto the canvas, minus the cursor
 * position. Returns the new item, or null when no track could be made.
 */
export function addTextAtPlayhead(text: string, presetId?: TextStylePresetId): TextItem | null {
  // Read state directly so callers don't subscribe to fast-changing stores.
  const { tracks, fps, addItemOnNewTrack } = useTimelineStore.getState()
  const { activeTrackId, selectItems, setActiveTrack } = useSelectionStore.getState()
  const currentProject = useProjectStore.getState().currentProject

  const newTrack = createOverlayLayerTrack({ tracks, activeTrackId })
  if (!newTrack) return null

  const textStylePreset = presetId
    ? TEXT_STYLE_PRESETS.find((preset) => preset.id === presetId)
    : undefined
  const textItem: TextItem = createTextTemplateItem({
    placement: {
      trackId: newTrack.trackId,
      from: Math.max(0, usePlaybackStore.getState().currentFrame),
      durationInFrames: getDefaultGeneratedLayerDurationInFrames(fps),
      canvasWidth: currentProject?.metadata.width ?? DEFAULT_PROJECT_WIDTH,
      canvasHeight: currentProject?.metadata.height ?? DEFAULT_PROJECT_HEIGHT,
      fps,
    },
    label: textStylePreset?.label,
    text,
    textStylePresetId: presetId,
  })

  addItemOnNewTrack(textItem, newTrack.tracks)
  setActiveTrack(newTrack.trackId)
  selectItems([textItem.id])
  return textItem
}
