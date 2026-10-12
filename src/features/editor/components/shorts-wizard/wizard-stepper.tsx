import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/shared/ui/cn'
import { SHORTS_WIZARD_STEPS, useShortsStore } from '@/shared/state/shorts'
import { WIZARD_STEP_ICONS } from './wizard-steps'

/**
 * The five wizard steps as a clickable progress bar. Steps are a guide, not a
 * gate: any step can be opened at any time.
 */
export const WizardStepper = memo(function WizardStepper() {
  const { t } = useTranslation()
  const currentStep = useShortsStore((s) => s.wizardStep)
  const setWizardStep = useShortsStore((s) => s.setWizardStep)
  const currentIndex = SHORTS_WIZARD_STEPS.indexOf(currentStep)

  return (
    <nav aria-label={t('shorts.wizard.stepCounter', { current: currentIndex + 1, total: 5 })}>
      <ol className="flex items-center gap-1">
        {SHORTS_WIZARD_STEPS.map((step, index) => {
          const Icon = WIZARD_STEP_ICONS[step]
          const isCurrent = step === currentStep
          const isDone = index < currentIndex
          return (
            <li key={step} className="flex items-center gap-1">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-px w-4 lg:w-6',
                    isDone || isCurrent ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => setWizardStep(step)}
                aria-current={isCurrent ? 'step' : undefined}
                data-wizard-step={step}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors duration-150 lg:px-3',
                  isCurrent && 'bg-primary text-primary-foreground glow-primary-sm',
                  !isCurrent && isDone && 'bg-primary/15 text-primary hover:bg-primary/25',
                  !isCurrent &&
                    !isDone &&
                    'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    isCurrent ? 'bg-primary-foreground/15' : 'bg-secondary',
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="hidden md:inline">{t(`shorts.wizard.steps.${step}.label`)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
})
