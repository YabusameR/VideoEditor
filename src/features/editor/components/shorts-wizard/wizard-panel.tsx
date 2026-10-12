import { memo, useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  Download,
  FilePlus2,
  ListVideo,
  Loader2,
  Play,
  Plus,
  Scissors,
  Trash2,
  Type,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/ui/cn'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { SHORTS_WIZARD_STEPS, useShortsStore, type ShortsWizardStep } from '@/shared/state/shorts'
import {
  appendMediaToTimeline,
  placeAudioAtPlayhead,
  splitAllItemsAtFrame,
  useItemsStore,
  useTimelineStore,
} from '@/features/editor/deps/timeline-store'
import { useSilenceRemovalDialogStore } from '@/features/editor/deps/timeline-ui'
import {
  importAutoCaptions,
  MediaLibrary,
  useMediaLibraryStore,
} from '@/features/editor/deps/media-library'
import { useSettingsStore } from '@/features/editor/deps/settings'
import { addTextAtPlayhead } from '../../utils/add-text-at-playhead'
import { DurationGauge, SafeZoneSelect } from '../short-toolbar'
import { formatSeconds } from '../../utils/format-seconds'
import { WIZARD_STEP_ICONS } from './wizard-steps'
import { SFX_IDS, getSfxFileName, getSfxUrl, type SfxId } from './sfx-catalog'

function ActionButton({
  icon: Icon,
  children,
  variant = 'secondary',
  className,
  ...props
}: {
  icon: typeof Plus
  children: ReactNode
  variant?: 'default' | 'secondary' | 'outline'
} & Omit<React.ComponentProps<typeof Button>, 'variant' | 'children'>) {
  return (
    <Button
      variant={variant}
      className={cn(
        'h-11 w-full justify-start gap-2.5 rounded-xl px-4 text-sm',
        variant === 'default' && 'glow-primary-sm',
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{children}</span>
    </Button>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** Starting font for auto captions in Japanese (changeable in the caption panel). */
const JAPANESE_CAPTION_FONT = 'Noto Sans JP'

const ImportStep = memo(function ImportStep() {
  const { t } = useTranslation()
  const importMedia = useMediaLibraryStore((s) => s.importMedia)
  const [isAppending, setIsAppending] = useState(false)

  const handleAppendAll = useCallback(async () => {
    // The library lists newest first; lay clips out in the order they were added.
    const mediaIds = useMediaLibraryStore
      .getState()
      .mediaItems.filter(
        (media) => media.mimeType.startsWith('video/') || media.mimeType.startsWith('image/'),
      )
      .map((media) => media.id)
      .reverse()
    if (mediaIds.length === 0) {
      toast.info(t('shorts.wizard.import.nothingToAppend'))
      return
    }
    setIsAppending(true)
    try {
      const count = await appendMediaToTimeline(mediaIds)
      if (count > 0) toast.success(t('shorts.wizard.import.appended', { count }))
      else toast.info(t('shorts.wizard.import.nothingToAppend'))
    } finally {
      setIsAppending(false)
    }
  }, [t])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-2">
        <ActionButton icon={FilePlus2} variant="default" onClick={() => void importMedia()}>
          {t('shorts.wizard.import.addFiles')}
        </ActionButton>
        <ActionButton
          icon={isAppending ? Loader2 : ListVideo}
          onClick={() => void handleAppendAll()}
          disabled={isAppending}
        >
          {t('shorts.wizard.import.appendAll')}
        </ActionButton>
        <Hint>{t('shorts.wizard.import.dropHint')}</Hint>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        <MediaLibrary />
      </div>
    </div>
  )
})

const CutStep = memo(function CutStep() {
  const { t } = useTranslation()
  const hasItems = useItemsStore((s) => s.items.length > 0)
  const selectedCount = useSelectionStore((s) => s.selectedItemIds.length)

  const handleSplit = useCallback(() => {
    const { previewFrame, currentFrame } = usePlaybackStore.getState()
    splitAllItemsAtFrame(previewFrame ?? currentFrame)
  }, [])

  const handleDelete = useCallback(() => {
    const ids = useSelectionStore.getState().selectedItemIds
    if (ids.length === 0) {
      toast.info(t('shorts.wizard.cut.nothingSelected'))
      return
    }
    // Ripple so the cut closes the gap, like cutting tape.
    useTimelineStore.getState().rippleDeleteItems(ids)
  }, [t])

  const handleAutoSilence = useCallback(() => {
    const itemIds = useItemsStore
      .getState()
      .items.filter((item) => item.type === 'video' || item.type === 'audio')
      .map((item) => item.id)
    useSilenceRemovalDialogStore.getState().open({ itemIds })
  }, [])

  if (!hasItems) return <Hint>{t('shorts.wizard.cut.noClips')}</Hint>

  return (
    <div className="space-y-2">
      <ActionButton icon={Scissors} variant="default" onClick={handleSplit}>
        {t('shorts.wizard.cut.split')}
      </ActionButton>
      <ActionButton icon={Trash2} onClick={handleDelete} disabled={selectedCount === 0}>
        {t('shorts.wizard.cut.deleteSelected')}
      </ActionButton>
      <ActionButton icon={AudioWaveform} onClick={handleAutoSilence}>
        {t('shorts.wizard.cut.autoSilence')}
      </ActionButton>
      <Hint>
        {selectedCount === 0 ? t('shorts.wizard.cut.nothingSelected') : t('shorts.wizard.cut.tips')}
      </Hint>
    </div>
  )
})

const CaptionsStep = memo(function CaptionsStep() {
  const { t, i18n } = useTranslation()
  const [isRunning, setIsRunning] = useState(false)

  const handleAutoCaptions = useCallback(async () => {
    const { countCaptionTargets, generateTimelineCaptions } = await importAutoCaptions()
    if (countCaptionTargets() === 0) {
      toast.info(t('shorts.wizard.captions.noTargets'))
      return
    }
    // Parakeet (the app default) has no Japanese; Whisper does.
    const isJapanese = i18n.language.startsWith('ja')
    const model = isJapanese ? 'whisper-small' : useSettingsStore.getState().defaultWhisperModel
    setIsRunning(true)
    try {
      const result = await generateTimelineCaptions({
        model,
        language: isJapanese ? 'ja' : undefined,
        // The caption presets use Latin-only fonts; start Japanese captions
        // on a font with Japanese glyphs so preview and export match.
        defaultStyle: isJapanese ? { fontFamily: JAPANESE_CAPTION_FONT } : undefined,
      })
      if (result.captionedMediaCount > 0) {
        toast.success(
          t('shorts.wizard.captions.done', { count: result.captionedMediaCount }),
          result.failedMediaCount > 0
            ? {
                description: t('shorts.wizard.captions.partial', {
                  failed: result.failedMediaCount,
                }),
              }
            : undefined,
        )
      } else if (result.failedMediaCount > 0) {
        toast.error(t('shorts.wizard.captions.partial', { failed: result.failedMediaCount }))
      }
    } finally {
      setIsRunning(false)
    }
  }, [i18n.language, t])

  return (
    <div className="space-y-2">
      <ActionButton
        icon={isRunning ? Loader2 : Wand2}
        variant="default"
        onClick={() => void handleAutoCaptions()}
        disabled={isRunning}
        className={cn(isRunning && '[&_svg]:animate-spin')}
      >
        {t('shorts.wizard.captions.auto')}
      </ActionButton>
      {isRunning && <Hint>{t('shorts.wizard.captions.running')}</Hint>}
      <ActionButton
        icon={Type}
        onClick={() => addTextAtPlayhead(t('shorts.wizard.captions.defaultText'))}
      >
        {t('shorts.wizard.captions.addText')}
      </ActionButton>
      <Hint>{t('shorts.wizard.captions.styleHint')}</Hint>
      <div className="pt-2">
        <SafeZoneSelect className="h-10 w-full rounded-xl text-sm" />
      </div>
    </div>
  )
})

async function findOrImportSfx(id: SfxId) {
  const fileName = getSfxFileName(id)
  const existing = useMediaLibraryStore
    .getState()
    .mediaItems.find((media) => media.fileName === fileName)
  if (existing) return existing
  const [imported] = await useMediaLibraryStore
    .getState()
    .importMediaFromUrl(new URL(getSfxUrl(id), window.location.origin).href)
  return (
    imported ??
    useMediaLibraryStore.getState().mediaItems.find((media) => media.fileName === fileName)
  )
}

const SoundStep = memo(function SoundStep() {
  const { t } = useTranslation()
  const [busyId, setBusyId] = useState<SfxId | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)

  const handlePreview = useCallback((id: SfxId) => {
    previewRef.current?.pause()
    const audio = new Audio(getSfxUrl(id))
    previewRef.current = audio
    void audio.play().catch(() => {})
  }, [])

  const handleAdd = useCallback(
    async (id: SfxId) => {
      const name = t(`shorts.wizard.sound.names.${id}`)
      setBusyId(id)
      try {
        const media = await findOrImportSfx(id)
        if (media && (await placeAudioAtPlayhead(media.id))) {
          toast.success(t('shorts.wizard.sound.added', { name }))
        } else {
          toast.error(t('shorts.wizard.sound.failed'))
        }
      } catch {
        toast.error(t('shorts.wizard.sound.failed'))
      } finally {
        setBusyId(null)
      }
    },
    [t],
  )

  return (
    <div className="grid grid-cols-2 gap-2">
      {SFX_IDS.map((id) => {
        const name = t(`shorts.wizard.sound.names.${id}`)
        return (
          <div
            key={id}
            className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1"
          >
            <button
              type="button"
              onClick={() => handlePreview(id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={t('shorts.wizard.sound.preview', { name })}
            >
              <Play className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleAdd(id)}
              disabled={busyId !== null}
              className="flex h-9 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-60"
              aria-label={t('shorts.wizard.sound.add', { name })}
            >
              <span className="truncate">{name}</span>
              {busyId === id ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
})

const ExportStep = memo(function ExportStep({
  fps,
  onExport,
}: {
  fps: number
  onExport?: () => void
}) {
  const { t } = useTranslation()
  const maxItemEndFrame = useItemsStore((s) => s.maxItemEndFrame)
  const targetDurationSec = useShortsStore((s) => s.targetDurationSec)
  const durationSec = fps > 0 ? maxItemEndFrame / fps : 0
  const isEmpty = maxItemEndFrame === 0

  return (
    <div className="space-y-4">
      <dl className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('shorts.wizard.export.length')}</dt>
          <dd className="font-mono tabular-nums">{formatSeconds(durationSec)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{t('shorts.wizard.export.format')}</dt>
          <dd>{t('shorts.wizard.export.formatValue')}</dd>
        </div>
      </dl>
      {isEmpty ? (
        <Hint>{t('shorts.wizard.export.empty')}</Hint>
      ) : (
        durationSec > targetDurationSec && (
          <p className="text-xs text-destructive">
            {t('shorts.wizard.export.overTarget', { time: formatSeconds(targetDurationSec) })}
          </p>
        )
      )}
      <ActionButton icon={Download} variant="default" onClick={onExport} disabled={isEmpty}>
        {t('shorts.wizard.export.button')}
      </ActionButton>
    </div>
  )
})

interface WizardPanelProps {
  fps: number
  onExport?: () => void
}

/**
 * Left column of the editor: the current wizard step's title, guidance and
 * one-click actions, with Back / Next to walk the steps in order.
 */
export const WizardPanel = memo(function WizardPanel({ fps, onExport }: WizardPanelProps) {
  const { t } = useTranslation()
  const step = useShortsStore((s) => s.wizardStep)
  const setWizardStep = useShortsStore((s) => s.setWizardStep)
  const index = SHORTS_WIZARD_STEPS.indexOf(step)
  const Icon = WIZARD_STEP_ICONS[step]
  const goTo = (offset: number) => {
    const next: ShortsWizardStep | undefined = SHORTS_WIZARD_STEPS[index + offset]
    if (next) setWizardStep(next)
  }

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col border-r border-border panel-bg xl:w-[360px]"
      data-testid="shorts-wizard-panel"
    >
      <header className="space-y-2 border-b border-border px-5 pb-4 pt-5">
        <p className="text-xs font-medium text-primary">
          {t('shorts.wizard.stepCounter', {
            current: index + 1,
            total: SHORTS_WIZARD_STEPS.length,
          })}
        </p>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon className="h-5 w-5 text-primary" />
          {t(`shorts.wizard.steps.${step}.title`)}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(`shorts.wizard.steps.${step}.description`)}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {step === 'import' && <ImportStep />}
        {step === 'cut' && <CutStep />}
        {step === 'captions' && <CaptionsStep />}
        {step === 'sound' && <SoundStep />}
        {step === 'export' && <ExportStep fps={fps} onExport={onExport} />}
      </div>

      <footer className="space-y-3 border-t border-border p-4">
        {step !== 'export' && <DurationGauge fps={fps} />}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10 flex-1 gap-1.5 rounded-xl"
            onClick={() => goTo(-1)}
            disabled={index === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('shorts.wizard.back')}
          </Button>
          {index < SHORTS_WIZARD_STEPS.length - 1 && (
            <Button className="h-10 flex-1 gap-1.5 rounded-xl" onClick={() => goTo(1)}>
              {t('shorts.wizard.next')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </footer>
    </aside>
  )
})
