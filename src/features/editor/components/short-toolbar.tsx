import { memo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Download,
  FolderArchive,
  Keyboard,
  ListVideo,
  MoreHorizontal,
  Save,
  ScanLine,
  Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsDialog } from './settings-dialog'
import { ShortcutsDialog } from './shortcuts-dialog'
import { UnsavedChangesDialog } from './unsaved-changes-dialog'
import { formatSeconds } from '../utils/format-seconds'
import { WizardStepper } from './shorts-wizard/wizard-stepper'
import { EDITOR_LAYOUT_CSS_VALUES } from '@/config/editor-layout'
import { cn } from '@/shared/ui/cn'
import { LanguageSwitcher } from '@/shared/ui/language-switcher'
import { useItemsStore, useTimelineStore } from '@/features/editor/deps/timeline-store'
import {
  SHORTS_SAFE_ZONE_PLATFORMS,
  SHORTS_TARGET_DURATIONS,
  useShortsStore,
  type ShortsSafeZonePlatform,
} from '@/shared/state/shorts'

const SaveDirtyIndicator = memo(function SaveDirtyIndicator() {
  const isDirty = useTimelineStore((state) => state.isDirty)
  return isDirty ? (
    <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-orange-500" />
  ) : null
})

/**
 * Length of the cut against the chosen target (15s / 30s / 60s …). Short-form
 * platforms cap or penalise length, so this is the number the editor watches.
 */
export const DurationGauge = memo(function DurationGauge({ fps }: { fps: number }) {
  const { t } = useTranslation()
  const maxItemEndFrame = useItemsStore((state) => state.maxItemEndFrame)
  const targetDurationSec = useShortsStore((s) => s.targetDurationSec)
  const setTargetDurationSec = useShortsStore((s) => s.setTargetDurationSec)

  const durationSec = fps > 0 ? maxItemEndFrame / fps : 0
  const ratio = targetDurationSec > 0 ? durationSec / targetDurationSec : 0
  const isOver = ratio > 1

  return (
    <div className="flex items-center gap-2" data-testid="shorts-duration-gauge">
      <span
        className={cn(
          'font-mono text-xs tabular-nums',
          isOver ? 'text-destructive' : 'text-foreground',
        )}
        aria-label={t('shorts.toolbar.durationAria')}
      >
        {formatSeconds(durationSec)}
      </span>
      <div
        className="relative h-1.5 w-28 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetDurationSec}
        aria-valuenow={Math.round(durationSec)}
      >
        <div
          className={cn('absolute inset-y-0 left-0', isOver ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(1, ratio) * 100}%` }}
        />
      </div>
      <Select
        value={String(targetDurationSec)}
        onValueChange={(value) => setTargetDurationSec(Number(value))}
      >
        <SelectTrigger
          className="h-7 w-[104px] text-xs"
          aria-label={t('shorts.toolbar.targetDuration')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SHORTS_TARGET_DURATIONS.map((seconds) => (
            <SelectItem key={seconds} value={String(seconds)}>
              {t('shorts.toolbar.targetOption', { time: formatSeconds(seconds) })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOver && (
        <span className="text-xs text-destructive">
          {t('shorts.toolbar.overBy', { time: formatSeconds(durationSec - targetDurationSec) })}
        </span>
      )}
    </div>
  )
})

export const SafeZoneSelect = memo(function SafeZoneSelect({ className }: { className?: string }) {
  const { t } = useTranslation()
  const platform = useShortsStore((s) => s.safeZonePlatform)
  const setPlatform = useShortsStore((s) => s.setSafeZonePlatform)

  return (
    <Select
      value={platform}
      onValueChange={(value) => setPlatform(value as ShortsSafeZonePlatform)}
    >
      <SelectTrigger
        className={cn('h-7 w-[150px] gap-1.5 text-xs', className)}
        aria-label={t('shorts.safeZone.label')}
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHORTS_SAFE_ZONE_PLATFORMS.map((id) => (
          <SelectItem key={id} value={id}>
            {t(`shorts.safeZone.platforms.${id}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})

interface ShortToolbarProps {
  project: {
    id: string
    name: string
    width: number
    height: number
    fps: number
  }
  onSave?: () => Promise<void>
  onExport?: () => void
  onExportBundle?: () => void
  onOpenRenderQueue?: () => void
  renderQueueCount?: number
}

/**
 * Toolbar for the short-video editor: project name, length vs. target, safe
 * zone guide, save and export. Everything else lives in the overflow menu.
 */
export const ShortToolbar = memo(function ShortToolbar({
  project,
  onSave,
  onExport,
  onExportBundle,
  onOpenRenderQueue,
  renderQueueCount = 0,
}: ShortToolbarProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleBackClick = () => {
    if (useTimelineStore.getState().isDirty) {
      setShowUnsavedDialog(true)
    } else {
      navigate({ to: '/projects' })
    }
  }

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="panel-header flex flex-shrink-0 items-center gap-3 border-b border-border px-3"
      style={{ height: EDITOR_LAYOUT_CSS_VALUES.toolbarHeight }}
      role="toolbar"
      aria-label={t('toolbar.ariaLabel')}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleBackClick}
        data-tooltip={t('toolbar.backToProjects')}
        data-tooltip-side="right"
        aria-label={t('toolbar.backToProjectsAria')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onSave={handleSave}
        projectName={project.name}
      />
      <ShortcutsDialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog} />
      <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />

      <div className="flex min-w-0 flex-col -space-y-0.5">
        <h1 className="truncate text-sm font-medium leading-none">
          {project.name || t('common.untitledProject')}
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {project.width}×{project.height} · {project.fps}fps
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center">
        <WizardStepper />
      </div>

      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t('shorts.toolbar.more')}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowSettingsDialog(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              {t('toolbar.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowShortcutsDialog(true)} className="gap-2">
              <Keyboard className="h-4 w-4" />
              {t('toolbar.keyboardShortcuts')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {onOpenRenderQueue && (
              <DropdownMenuItem onClick={onOpenRenderQueue} className="gap-2">
                <ListVideo className="h-4 w-4" />
                {t('toolbar.renderQueue')}
                {renderQueueCount > 0 && ` (${renderQueueCount})`}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onExportBundle} className="gap-2">
              <FolderArchive className="h-4 w-4" />
              {t('toolbar.downloadProjectZip')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <LanguageSwitcher size="sm" align="end" side="bottom" />

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={isSaving}
          aria-label={t('toolbar.saveAria')}
        >
          <span className="relative">
            <Save className="h-4 w-4" />
            <SaveDirtyIndicator />
          </span>
          {t('toolbar.save')}
        </Button>

        <Button size="sm" className="gap-1.5 glow-primary-sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          {t('shorts.toolbar.export')}
        </Button>
      </div>
    </div>
  )
})
