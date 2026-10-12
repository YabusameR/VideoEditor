import { Clapperboard, Download, Music2, Scissors, Type, type LucideIcon } from 'lucide-react'
import type { ShortsWizardStep } from '@/shared/state/shorts'

export const WIZARD_STEP_ICONS: Record<ShortsWizardStep, LucideIcon> = {
  import: Clapperboard,
  cut: Scissors,
  captions: Type,
  sound: Music2,
  export: Download,
}
