import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { SubtitleSegmentItem } from '@/types/timeline'
import { cn } from '@/shared/ui/cn'
import { parseSubtitleCueText } from '@/shared/utils/subtitle-cue-format'
import { clampCueBoundary, cuesTouch, moveCueBoundary } from '@/shared/utils/subtitle-cue-edit'
import { useTimelineContentPixelsPerSecond } from '../../contexts/timeline-zoom-context'
import { useItemsStore } from '../../stores/items-store'
import { useTimelineStore } from '../../stores/timeline-store'

interface BoundaryDrag {
  index: number
  startClientX: number
  startSeconds: number
  seconds: number
}

/**
 * Cue-by-cue view of a subtitle item on the timeline. Each cue is a block at
 * its own time; where two cues touch, the boundary between them can be
 * dragged to move the split point (one undo step per drag).
 */
export const SubtitleCueStrip = memo(function SubtitleCueStrip({
  item,
}: {
  item: SubtitleSegmentItem
}) {
  const { t } = useTranslation()
  const pixelsPerSecond = useTimelineContentPixelsPerSecond()
  const updateItem = useTimelineStore((s) => s.updateItem)
  const isLocked = useItemsStore(
    (s) => s.tracks.find((track) => track.id === item.trackId)?.locked === true,
  )
  // Read cues from the store: the timeline clip shell re-renders on timing
  // changes, not on cue edits, so the `item` prop can hold stale cues.
  const storedCues = useItemsStore((s) => {
    const stored = s.itemById[item.id]
    return stored?.type === 'subtitle' ? stored.cues : undefined
  })
  const itemCues = storedCues ?? item.cues
  const [drag, setDrag] = useState<BoundaryDrag | null>(null)

  const cues = drag ? moveCueBoundary(itemCues, drag.index, drag.seconds) : itemCues

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    // Keep the clip itself from starting a move/selection drag.
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const seconds = itemCues[index]!.endSeconds
    setDrag({ index, startClientX: event.clientX, startSeconds: seconds, seconds })
  }

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || pixelsPerSecond <= 0) return
    const proposed = drag.startSeconds + (event.clientX - drag.startClientX) / pixelsPerSecond
    setDrag({ ...drag, seconds: clampCueBoundary(itemCues, drag.index, proposed) })
  }

  const endDrag = () => {
    if (!drag) return
    if (Math.abs(drag.seconds - drag.startSeconds) > 1e-4) {
      updateItem(item.id, { cues: moveCueBoundary(itemCues, drag.index, drag.seconds) })
    }
    setDrag(null)
  }

  return (
    <div className="absolute inset-0 overflow-hidden" data-subtitle-cue-strip>
      <div className="px-2 pt-0.5 text-[10px] text-muted-foreground truncate">
        {t('timeline.subtitleStrip.label', { count: itemCues.length })}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-4">
        {cues.map((cue, index) => {
          const left = cue.startSeconds * pixelsPerSecond
          const width = Math.max(1, (cue.endSeconds - cue.startSeconds) * pixelsPerSecond)
          return (
            <div
              key={cue.id}
              className={cn(
                'absolute inset-y-0.5 overflow-hidden rounded-sm border border-white/15 px-1 text-[11px] leading-tight text-foreground/90',
                index % 2 === 0 ? 'bg-white/10' : 'bg-white/[0.06]',
                drag && (drag.index === index || drag.index + 1 === index) && 'border-primary/70',
              )}
              style={{ left, width }}
              title={parseSubtitleCueText(cue.text).plainText}
            >
              {width > 16 && (
                <span className="block truncate">{parseSubtitleCueText(cue.text).plainText}</span>
              )}
            </div>
          )
        })}
        {!isLocked &&
          cues.map((cue, index) =>
            cuesTouch(itemCues, index) ? (
              <button
                key={`boundary-${cue.id}`}
                type="button"
                aria-label={t('timeline.subtitleStrip.moveBoundary', { number: index + 1 })}
                data-subtitle-cue-boundary={index}
                className={cn(
                  'absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none',
                  'after:absolute after:inset-y-1 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full',
                  drag?.index === index
                    ? 'after:bg-primary'
                    : 'after:bg-transparent hover:after:bg-primary/80',
                )}
                style={{ left: cue.endSeconds * pixelsPerSecond }}
                onPointerDown={(event) => startDrag(event, index)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              />
            ) : null,
          )}
      </div>
    </div>
  )
})
