import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { cn } from '@/shared/ui/cn'
import {
  DEFAULT_SUBTITLE_CUE_ANIMATION_SECONDS,
  SUBTITLE_CUE_IN_ANIMATIONS,
  SUBTITLE_CUE_OUT_ANIMATIONS,
} from '@/shared/utils/subtitle-cue-animation'
import type { SubtitleCueAnimation, SubtitleSegmentItem } from '@/types/timeline'

const SPEEDS = [
  { id: 'fast', seconds: 0.15 },
  { id: 'normal', seconds: DEFAULT_SUBTITLE_CUE_ANIMATION_SECONDS },
  { id: 'slow', seconds: 0.45 },
] as const

/**
 * Picks the animation played each time a caption changes. Applies to the
 * selected subtitle items only, and runs on every cue rather than once at the
 * start and end of the whole segment.
 */
export function SubtitleAnimationSection({ items }: { items: SubtitleSegmentItem[] }) {
  const { t } = useTranslation()
  const updateItem = useTimelineStore((s) => s.updateItem)
  const current = items[0]?.cueAnimation ?? {}
  const currentSeconds = current.durationSeconds ?? DEFAULT_SUBTITLE_CUE_ANIMATION_SECONDS

  const apply = useCallback(
    (patch: Partial<SubtitleCueAnimation>) => {
      for (const item of items) {
        const next: SubtitleCueAnimation = { ...item.cueAnimation, ...patch }
        const empty = !next.in && !next.out
        updateItem(item.id, { cueAnimation: empty ? undefined : next })
      }
    },
    [items, updateItem],
  )

  return (
    <section className="flex flex-col gap-3" data-testid="subtitle-animation-section">
      <div>
        <h3 className="text-xs font-medium">{t('editor.subtitleAnimation.title')}</h3>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          {t('editor.subtitleAnimation.hint')}
        </p>
      </div>

      <ChoiceRow
        label={t('editor.subtitleAnimation.inLabel')}
        options={[undefined, ...SUBTITLE_CUE_IN_ANIMATIONS].map((id) => ({
          id,
          label: t(`editor.subtitleAnimation.in.${id ?? 'none'}`),
        }))}
        value={current.in}
        onChange={(value) => apply({ in: value })}
      />
      <ChoiceRow
        label={t('editor.subtitleAnimation.outLabel')}
        options={[undefined, ...SUBTITLE_CUE_OUT_ANIMATIONS].map((id) => ({
          id,
          label: t(`editor.subtitleAnimation.out.${id ?? 'none'}`),
        }))}
        value={current.out}
        onChange={(value) => apply({ out: value })}
      />
      <ChoiceRow
        label={t('editor.subtitleAnimation.speedLabel')}
        options={SPEEDS.map((speed) => ({
          id: speed.seconds,
          label: t(`editor.subtitleAnimation.speed.${speed.id}`),
        }))}
        value={currentSeconds}
        disabled={!current.in && !current.out}
        onChange={(value) => apply({ durationSeconds: value })}
      />
    </section>
  )
}

function ChoiceRow<T>({
  label,
  options,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  options: { id: T; label: string }[]
  value: T
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option.id === value
          return (
            <button
              key={option.label}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                selected
                  ? 'border-primary bg-primary/15 text-foreground'
                  : 'border-border/60 text-muted-foreground hover:border-border hover:bg-secondary/40 hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
