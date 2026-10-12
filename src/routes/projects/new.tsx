import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { createLogger } from '@/shared/logging/logger'
import { useCreateProject } from '@/features/projects/hooks/use-project-actions'
import { useProjectStore } from '@/features/projects/stores/project-store'
import { generateTemplateName } from '@/features/projects/utils/project-helpers'
import { DEFAULT_PROJECT_TEMPLATE } from '@/features/projects/utils/validation'
import { Button } from '@/components/ui/button'

const logger = createLogger('NewProject')

export const Route = createFileRoute('/projects/new')({
  component: NewProject,
  beforeLoad: async () => {
    try {
      const { loadProjects } = useProjectStore.getState()
      await loadProjects()
    } catch (err) {
      logger.warn('Failed to pre-load projects in beforeLoad:', err)
    }
  },
})

/**
 * Creating a short needs no choices: one vertical 1080×1920 / 30fps format,
 * an auto-numbered name, then straight into the editor.
 */
function NewProject() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const createProject = useCreateProject()
  const [error, setError] = useState<string | null>(null)
  // StrictMode runs effects twice; only ever create one project per visit.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      const existingNames = useProjectStore.getState().projects.map((p) => p.name)
      const result = await createProject({
        name: generateTemplateName(t('shorts.newProject.namePrefix'), existingNames),
        description: '',
        width: DEFAULT_PROJECT_TEMPLATE.width,
        height: DEFAULT_PROJECT_TEMPLATE.height,
        fps: DEFAULT_PROJECT_TEMPLATE.fps,
      })
      if (result.success && result.project) {
        navigate({
          to: '/editor/$projectId',
          params: { projectId: result.project.id },
          replace: true,
        })
      } else {
        logger.error('Failed to create project:', result.error)
        setError(result.error ?? t('projects.tryAgain'))
      }
    })()
  }, [createProject, navigate, t])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive">{t('projects.toasts.createFailed')}</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" asChild>
            <Link to="/projects">{t('shorts.newProject.backToList')}</Link>
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('shorts.newProject.creating')}</p>
        </>
      )}
    </div>
  )
}
