import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createProjectFormSchema,
  type ProjectFormData,
  DEFAULT_PROJECT_VALUES,
} from '../utils/validation'
import { getProjectFpsOptions } from '../utils/project-fps'

interface EditProjectFormProps {
  onSubmit: (data: ProjectFormData) => Promise<void> | void
  onCancel: () => void
  defaultValues?: Partial<ProjectFormData>
  isSubmitting?: boolean
}

const inputClassName =
  'w-full px-3 py-2 bg-secondary border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-[color,border-color,box-shadow] duration-150'

/**
 * Rename / describe a project. Resolution is fixed to the project's original
 * size (new shorts are always 1080×1920), so it is shown but not editable.
 */
export function EditProjectForm({
  onSubmit,
  onCancel,
  defaultValues,
  isSubmitting = false,
}: EditProjectFormProps) {
  const { t } = useTranslation()
  const resolvedDefaultValues = useMemo(
    () => ({ ...DEFAULT_PROJECT_VALUES, ...defaultValues }),
    [defaultValues],
  )
  const validationSchema = useMemo(() => createProjectFormSchema((key) => t(key)), [t])

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: resolvedDefaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    reset(resolvedDefaultValues)
  }, [reset, resolvedDefaultValues])

  const fps = watch('fps')
  const fpsOptions = useMemo(() => getProjectFpsOptions(fps), [fps])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-foreground">
          {t('projects.form.projectName')} <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className={inputClassName}
          placeholder={t('projects.form.projectNamePlaceholder')}
        />
        {errors.name && <p className="mt-1.5 text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block text-sm font-medium text-foreground">
          {t('projects.form.description')}
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className={`${inputClassName} resize-none`}
          placeholder={t('projects.form.descriptionPlaceholder')}
        />
        {errors.description && (
          <p className="mt-1.5 text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fps" className="mb-2 block text-sm font-medium text-foreground">
            {t('projects.form.frameRate')}
          </label>
          <Select
            value={fps.toString()}
            onValueChange={(value) => setValue('fps', Number(value), { shouldValidate: true })}
          >
            <SelectTrigger id="fps">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fpsOptions.map((preset) => (
                <SelectItem key={preset.value} value={preset.value.toString()}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-foreground">
            {t('projects.form.resolution')}
          </span>
          <p className="py-2 font-mono text-sm text-muted-foreground">
            {resolvedDefaultValues.width}×{resolvedDefaultValues.height}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="min-w-[140px]" disabled={!isValid || isSubmitting}>
          {isSubmitting ? t('common.saving') : t('projects.form.updateProject')}
        </Button>
      </div>
    </form>
  )
}
